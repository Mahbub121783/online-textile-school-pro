// Real-time push via Server-Sent Events, backed by Postgres LISTEN/NOTIFY.
// Two kinds of subscriber:
//   - per-user (JWT-identified): role grants, profile edits, notifications
//   - per-campus (public, no auth): campus notices/gallery/roster changes,
//     for anonymous visitors on a campus's public portfolio page
// EventSource can't retry forever into a black hole, and a Passenger process
// recycle or a network blip WILL drop connections -- so this is deliberately
// additive to (not a replacement for) polling, which stays as a slower
// fallback safety net everywhere it already existed.
const express = require('express');
const jwt = require('jsonwebtoken');
const { Client } = require('pg');
const { pool, serviceQuery } = require('./db');
const { fanOutNotification } = require('./notify');

const JWT_SECRET = process.env.JWT_SECRET;
const HEARTBEAT_MS = 25000;
// How often connected admins on the System Controls page get a fresh stats
// push. Only actually runs the (cheap but non-trivial) queries when at
// least one admin is connected -- see broadcastSystemStatsIfWatched below.
const SYSTEM_STATS_MS = 5000;
// Postgres connections that sit idle waiting on LISTEN get reaped by this
// hosting tier's connection management periodically ("terminating connection
// due to administrator command", confirmed live -- 126 reconnects observed
// in one log). A lightweight periodic query keeps the connection looking
// active, cutting down how often that happens (a full reconnect still stays
// as the safety net for whenever it does).
const KEEPALIVE_MS = 4 * 60 * 1000;

// userId -> Set<res>. One user can have multiple open tabs/devices.
const clientsByUser = new Map();
// campusId -> Set<res>. Public subscribers (no login required) watching one
// campus's portfolio page.
const clientsByCampus = new Map();
// Unkeyed -- broadcasts to every connected admin (System Controls page),
// not per-user like clientsByUser above.
const clientsAdmin = new Set();

function addClient(map, key, res) {
  if (!map.has(key)) map.set(key, new Set());
  map.get(key).add(res);
}

function removeClient(map, key, res) {
  const set = map.get(key);
  if (!set) return;
  set.delete(res);
  if (set.size === 0) map.delete(key);
}

function writeEvent(set, event, payload) {
  if (!set || set.size === 0) return;
  const data = `event: ${event}\ndata: ${JSON.stringify(payload || {})}\n\n`;
  for (const res of set) {
    try { res.write(data); } catch { /* dead socket -- 'close' handler below cleans it up */ }
  }
}

function broadcast(userId, event, payload) {
  writeEvent(clientsByUser.get(userId), event, payload);
}

function broadcastCampus(campusId, event, payload) {
  writeEvent(clientsByCampus.get(campusId), event, payload);
}

function broadcastAdmin(event, payload) {
  writeEvent(clientsAdmin, event, payload);
}

// The tables System Controls' "Database Overview" cares about -- counted
// server-side in one round trip instead of the frontend firing 12 separate
// count=exact REST calls.
const STATS_TABLES = [
  'user_profiles', 'courses', 'enrollments', 'orders', 'lessons', 'quizzes',
  'assignments', 'certificates', 'ebooks', 'notifications', 'media_library',
  'wallet_transactions',
];

// Mirrors src/lib/maintenanceSchedule.ts's isMaintenanceActive() -- kept in
// sync by hand (different runtime, can't share the file). Lets a
// duration-limited or scheduled-future maintenance window work as a pure
// function of the current time, no cron job needed to flip anything in the DB.
function isMaintenanceActive(settings, now = new Date()) {
  const end = settings.maintenance_scheduled_end ? new Date(settings.maintenance_scheduled_end) : null;
  const start = settings.maintenance_scheduled_start ? new Date(settings.maintenance_scheduled_start) : null;
  if (settings.maintenance_mode === 'true') return !(end && now >= end);
  if (start && now >= start) return !(end && now >= end);
  return false;
}

async function computeSystemStats() {
  const tableCounts = {};
  await Promise.all(STATS_TABLES.map(async (t) => {
    const r = await serviceQuery(`SELECT count(*)::int AS n FROM public."${t}"`).catch(() => ({ rows: [{ n: 0 }] }));
    tableCounts[t] = r.rows[0]?.n ?? 0;
  }));

  const settingsRes = await serviceQuery(
    "SELECT key, value FROM public.site_settings WHERE key IN ('smtp_host','smtp_user','maintenance_mode','maintenance_scheduled_start','maintenance_scheduled_end')"
  ).catch(() => ({ rows: [] }));
  const settings = {};
  settingsRes.rows.forEach((s) => { settings[s.key] = s.value; });

  // R2/Cloudinary credentials live in their own admin-managed tables
  // (backend/src/functions/r2Presign.js, cloudinaryProxy.js), not env vars.
  const r2Res = await serviceQuery("SELECT count(*)::int AS n FROM public.cloudflare_r2_accounts WHERE status = 'active'").catch(() => ({ rows: [{ n: 0 }] }));
  const cloudinaryRes = await serviceQuery('SELECT count(*)::int AS n FROM public.cloudinary_accounts').catch(() => ({ rows: [{ n: 0 }] }));

  const mem = process.memoryUsage();
  return {
    tableCounts,
    totalRecords: Object.values(tableCounts).reduce((a, b) => a + b, 0),
    connectedUsers: clientsByUser.size,
    connectedAdmins: clientsAdmin.size,
    dbPool: { total: pool.totalCount, idle: pool.idleCount, waiting: pool.waitingCount },
    process: {
      uptimeSeconds: Math.round(process.uptime()),
      memoryMb: Math.round(mem.rss / 1024 / 1024),
      nodeVersion: process.version,
    },
    services: {
      smtpConfigured: !!(settings.smtp_host && settings.smtp_user),
      pushConfigured: !!process.env.VAPID_PRIVATE_KEY,
      r2Configured: (r2Res.rows[0]?.n ?? 0) > 0,
      cloudinaryConfigured: (cloudinaryRes.rows[0]?.n ?? 0) > 0,
      googleOAuthConfigured: !!process.env.GOOGLE_CLIENT_ID,
    },
    maintenanceMode: isMaintenanceActive(settings),
    maintenanceManualFlag: settings.maintenance_mode === 'true',
    maintenanceScheduledStart: settings.maintenance_scheduled_start || null,
    maintenanceScheduledEnd: settings.maintenance_scheduled_end || null,
    timestamp: new Date().toISOString(),
  };
}

function startSystemStatsBroadcaster() {
  setInterval(async () => {
    if (clientsAdmin.size === 0) return; // nobody's watching -- skip the work
    try {
      const stats = await computeSystemStats();
      broadcastAdmin('stats', stats);
    } catch (e) {
      console.warn('[realtime] system stats broadcast failed:', e.message);
    }
  }, SYSTEM_STATS_MS);
}

function openSseStream(res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    // Defeats reverse-proxy response buffering (LiteSpeed/nginx in front of
    // the Passenger-managed Node app) -- without this, events can sit
    // buffered instead of reaching the browser immediately.
    'X-Accel-Buffering': 'no',
  });
  res.write(': connected\n\n');
  return setInterval(() => {
    try { res.write(': heartbeat\n\n'); } catch { /* ignore -- close handler cleans up */ }
  }, HEARTBEAT_MS);
}

const router = express.Router();

// GET /realtime/stream?token=<jwt>
// EventSource can't send an Authorization header, so the same JWT travels
// as a query param here instead -- verified with the exact same jwt.verify()
// every other route uses, just read from a different place on the request.
router.get('/stream', (req, res) => {
  const token = req.query.token;
  if (!token) return res.status(401).end();
  let userId;
  try {
    userId = jwt.verify(token, JWT_SECRET).sub;
  } catch {
    return res.status(401).end();
  }
  if (!userId) return res.status(401).end();

  const heartbeat = openSseStream(res);
  addClient(clientsByUser, userId, res);
  req.on('close', () => {
    clearInterval(heartbeat);
    removeClient(clientsByUser, userId, res);
  });
});

// GET /realtime/campus/:campusId -- no auth: campus portfolio pages are
// public, so anonymous visitors need to be able to see live updates too.
router.get('/campus/:campusId', (req, res) => {
  const { campusId } = req.params;
  if (!campusId) return res.status(400).end();

  const heartbeat = openSseStream(res);
  addClient(clientsByCampus, campusId, res);
  req.on('close', () => {
    clearInterval(heartbeat);
    removeClient(clientsByCampus, campusId, res);
  });
});

// GET /realtime/admin?token=<jwt> -- powers the System Controls page's
// live-updating stats. Admin-only: verifies the JWT, then checks has_role
// admin/super_admin the same way every other admin-gated backend route
// does, rejecting 401/403 before ever adding the client to the broadcast set.
router.get('/admin', async (req, res) => {
  const token = req.query.token;
  if (!token) return res.status(401).end();
  let userId;
  try {
    userId = jwt.verify(token, JWT_SECRET).sub;
  } catch {
    return res.status(401).end();
  }
  if (!userId) return res.status(401).end();

  const roleRes = await serviceQuery(
    "SELECT (has_role($1,'admin') OR has_role($1,'super_admin')) AS ok",
    [userId]
  ).catch(() => ({ rows: [{ ok: false }] }));
  if (!roleRes.rows[0]?.ok) return res.status(403).end();

  const heartbeat = openSseStream(res);
  clientsAdmin.add(res);
  // Send an immediate snapshot instead of making the client wait up to
  // SYSTEM_STATS_MS for the first update.
  computeSystemStats().then((stats) => writeEvent(new Set([res]), 'stats', stats)).catch(() => {});
  req.on('close', () => {
    clearInterval(heartbeat);
    clientsAdmin.delete(res);
  });
});

// One dedicated, non-pooled connection for LISTEN -- LISTEN state is
// per-connection so this can't share the app's pg.Pool. Reconnects on
// error/close so a dropped connection (or a Passenger process recycle)
// doesn't silently kill all push delivery until the next full app restart.
function startListener() {
  const client = new Client({
    host: process.env.PGHOST || 'localhost',
    port: process.env.PGPORT || 5432,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
  });

  // Both 'error' and 'end' can fire for the same disconnect (a graceful
  // close from the server side, e.g. an idle-connection reap, often emits
  // only 'end' with no preceding 'error') -- this flag makes sure a single
  // disconnect only ever triggers one reconnect and one cleanup, instead of
  // two concurrent startListener() calls stacking up dangling connections.
  let settled = false;
  let keepaliveTimer = null;

  const cleanupAndReconnect = () => {
    if (settled) return;
    settled = true;
    if (keepaliveTimer) clearInterval(keepaliveTimer);
    // Best-effort close -- the socket may already be dead, which is exactly
    // why this is wrapped: an unhandled throw here would crash the process.
    try { client.end().catch(() => {}); } catch { /* already closed */ }
    setTimeout(startListener, 5000);
  };

  client.connect()
    .then(() => client.query('LISTEN ots_realtime'))
    .then(() => {
      console.log('[realtime] LISTEN ots_realtime active');
      keepaliveTimer = setInterval(() => {
        client.query('SELECT 1').catch(() => {} /* 'error'/'end' handlers below own reconnect */);
      }, KEEPALIVE_MS);
    })
    .catch((err) => {
      console.error('[realtime] failed to start listener, retrying in 5s:', err.message);
      cleanupAndReconnect();
    });

  client.on('notification', (msg) => {
    try {
      const payload = JSON.parse(msg.payload);
      if (payload?.admin) {
        // Fabric Library inventory/admin-list changes -- same clientsAdmin
        // room the System Controls stats push already uses.
        broadcastAdmin(payload.event || 'update', payload);
      } else if (payload?.campus_id) {
        broadcastCampus(payload.campus_id, payload.event || 'update', payload);
      } else if (payload?.user_id) {
        broadcast(payload.user_id, payload.event || 'update', payload);
        // Email + mobile push for every notification row, fired from the
        // same event that already drives the real-time bell -- see notify.js.
        if (payload.event === 'notification') {
          fanOutNotification({
            user_id: payload.user_id,
            type: payload.type,
            title: payload.title,
            message: payload.message,
            link: payload.link,
            already_emailed: payload.already_emailed,
          }).catch((e) => console.warn('[realtime] fanOutNotification error:', e.message));
        }
      }
    } catch (err) {
      console.error('[realtime] bad notification payload:', err.message);
    }
  });

  client.on('error', (err) => {
    console.error('[realtime] listener connection error, reconnecting:', err.message);
    cleanupAndReconnect();
  });

  client.on('end', () => {
    console.log('[realtime] listener connection closed, reconnecting');
    cleanupAndReconnect();
  });
}

let statsStarted = false;
function startSystemStatsBroadcasterOnce() {
  if (statsStarted) return; // startListener() re-runs on every LISTEN reconnect -- guard against stacking duplicate timers
  statsStarted = true;
  startSystemStatsBroadcaster();
}

module.exports = {
  router,
  startListener: (...args) => { startListener(...args); startSystemStatsBroadcasterOnce(); },
  broadcast,
  broadcastCampus,
  broadcastAdmin,
};
