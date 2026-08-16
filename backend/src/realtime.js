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

const JWT_SECRET = process.env.JWT_SECRET;
const HEARTBEAT_MS = 25000;
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
      if (payload?.campus_id) broadcastCampus(payload.campus_id, payload.event || 'update', payload);
      else if (payload?.user_id) broadcast(payload.user_id, payload.event || 'update', payload);
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

module.exports = { router, startListener, broadcast, broadcastCampus };
