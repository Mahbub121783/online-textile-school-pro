const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { pool } = require('./db');
const { router: authRouter } = require('./auth');
const restRouter = require('./rest');
const functionsRouter = require('./functions');

// The original Supabase edge-function gateway required at least the (public,
// but non-empty) anon key on every call, which our self-host has no
// equivalent gatekeeper for -- several ported functions (send-smtp-email,
// send-sms, meta-capi, push-send, etc.) have no auth check of their own,
// matching the originals, and are now real-credential-backed (SMTP/SMS/cPanel)
// so an open, unthrottled endpoint is a genuine abuse/cost risk. A per-IP
// rate limit is a minimal, behavior-preserving substitute for that missing
// gateway-level throttle.
const functionsLimiter = rateLimit({ windowMs: 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false });
const relayLimiter = rateLimit({ windowMs: 60 * 1000, limit: 8, standardHeaders: true, legacyHeaders: false });

const ALLOWED_ORIGINS = [
  'https://www.onlinetextileschool.com',
  'https://onlinetextileschool.com',
  'http://localhost:8080',
];

const app = express();
app.use(cors({
  origin(origin, callback) {
    // Allow no-origin requests (curl, server-to-server) and any allowed origin.
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'ots-backend', time: new Date().toISOString() });
});

app.get('/health/db', async (req, res) => {
  try {
    const r = await pool.query('SELECT current_database(), current_user, now()');
    res.json({ ok: true, ...r.rows[0] });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.use('/auth/v1', authRouter);
app.use('/rest/v1', restRouter);
app.use('/functions/v1/send-smtp-email', relayLimiter);
app.use('/functions/v1/send-sms', relayLimiter);
app.use('/functions/v1', functionsLimiter, functionsRouter);

app.use((req, res) => res.status(404).json({ error: 'Not found' }));

module.exports = app;
