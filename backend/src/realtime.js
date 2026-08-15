// Real-time push for the current user's own account changes (role grants,
// profile edits, new notifications) via Server-Sent Events, backed by
// Postgres LISTEN/NOTIFY. This replaces useAuth.tsx's 30s poll-for-changes
// loop -- now that this is a self-hosted Node+Postgres stack we own outright
// (not funneled through a third-party realtime-channel quota), a real push
// path is actually feasible, unlike when this ran on Supabase's free tier.
// EventSource can't retry forever into a black hole, and a Passenger process
// recycle or a network blip WILL drop connections -- so this is deliberately
// additive to (not a replacement for) the existing poll, which stays as a
// slower fallback safety net.
const express = require('express');
const jwt = require('jsonwebtoken');
const { Client } = require('pg');

const JWT_SECRET = process.env.JWT_SECRET;
const HEARTBEAT_MS = 25000;

// userId -> Set<res>. One user can have multiple open tabs/devices.
const clientsByUser = new Map();

function addClient(userId, res) {
  if (!clientsByUser.has(userId)) clientsByUser.set(userId, new Set());
  clientsByUser.get(userId).add(res);
}

function removeClient(userId, res) {
  const set = clientsByUser.get(userId);
  if (!set) return;
  set.delete(res);
  if (set.size === 0) clientsByUser.delete(userId);
}

function broadcast(userId, event, payload) {
  const set = clientsByUser.get(userId);
  if (!set || set.size === 0) return;
  const data = `event: ${event}\ndata: ${JSON.stringify(payload || {})}\n\n`;
  for (const res of set) {
    try { res.write(data); } catch { /* dead socket -- 'close' handler below cleans it up */ }
  }
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

  addClient(userId, res);
  const heartbeat = setInterval(() => {
    try { res.write(': heartbeat\n\n'); } catch { /* ignore -- close handler cleans up */ }
  }, HEARTBEAT_MS);

  req.on('close', () => {
    clearInterval(heartbeat);
    removeClient(userId, res);
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

  let reconnectScheduled = false;
  const scheduleReconnect = () => {
    if (reconnectScheduled) return;
    reconnectScheduled = true;
    setTimeout(startListener, 5000);
  };

  client.connect()
    .then(() => client.query('LISTEN ots_realtime'))
    .then(() => console.log('[realtime] LISTEN ots_realtime active'))
    .catch((err) => {
      console.error('[realtime] failed to start listener, retrying in 5s:', err.message);
      scheduleReconnect();
    });

  client.on('notification', (msg) => {
    try {
      const payload = JSON.parse(msg.payload);
      if (payload?.user_id) broadcast(payload.user_id, payload.event || 'update', payload);
    } catch (err) {
      console.error('[realtime] bad notification payload:', err.message);
    }
  });

  client.on('error', (err) => {
    console.error('[realtime] listener connection error, reconnecting:', err.message);
    scheduleReconnect();
  });
}

module.exports = { router, startListener, broadcast };
