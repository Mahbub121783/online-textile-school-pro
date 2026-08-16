const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { pool } = require('./db');
const { router: authRouter } = require('./auth');
const restRouter = require('./rest');
const functionsRouter = require('./functions');
const uploadsRouter = require('./functions/uploadsRouter');
const { router: realtimeRouter, startListener: startRealtimeListener } = require('./realtime');

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
// Campus subdomains (campusSubdomain.ts / CampusPortfolio.tsx) are a
// separate browser origin from the bare domain above, so their own fetches
// to this API were being silently blocked by CORS -- the page had no way
// to tell "campus not found" apart from "request blocked", so it always
// showed the generic "not available" fallback. Every *.onlinetextileschool.com
// subdomain needs to be allowed, not just www/apex.
const CAMPUS_SUBDOMAIN_ORIGIN_RE = /^https:\/\/[a-z0-9-]+\.onlinetextileschool\.com$/;

const app = express();
// This app always runs behind cPanel/Apache's reverse proxy (Passenger),
// which sets X-Forwarded-For -- without telling Express to trust it,
// express-rate-limit can't tell real client IPs apart and silently falls
// back to keying every single visitor's rate limit off the proxy's own
// local IP, meaning the entire site's traffic shares ONE limiter bucket
// (confirmed live: 39 ERR_ERL_UNEXPECTED_X_FORWARDED_FOR warnings in the
// log). `1` trusts exactly one hop (the local Apache proxy), not an
// arbitrary chain, so a client can't spoof X-Forwarded-For to fake a
// different rate-limit identity.
app.set('trust proxy', 1);
app.use(cors({
  origin(origin, callback) {
    // Allow no-origin requests (curl, server-to-server) and any allowed origin.
    if (!origin || ALLOWED_ORIGINS.includes(origin) || CAMPUS_SUBDOMAIN_ORIGIN_RE.test(origin)) {
      return callback(null, true);
    }
    console.warn('[cors] rejected origin:', origin);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
// Local file-manager image hosting (fallback path alongside Cloudinary/R2) --
// see backend/src/functions/localUpload.js. Images only, served as static
// files so it costs nothing beyond disk (no extra Node process/CPU per request).
app.use('/uploads', express.static(path.join(__dirname, '..', 'public', 'uploads'), { maxAge: '30d', immutable: true }));

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
app.use('/realtime', realtimeRouter);
app.use('/functions/v1/uploads', uploadsRouter);
app.use('/functions/v1/send-smtp-email', relayLimiter);
app.use('/functions/v1/send-sms', relayLimiter);
app.use('/functions/v1', functionsLimiter, functionsRouter);

app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// express.json()'s body-size limit and express.raw()'s per-route limits
// (uploadsRouter.js) both throw a PayloadTooLargeError that, left
// unhandled, falls through to Express's default HTML error page -- which
// breaks any client doing res.json() on the response, turning a clear
// "file too large" into a confusing JSON-parse error instead.
app.use((err, req, res, next) => {
  if (err && err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'File is too large.' });
  }
  if (err) {
    console.error('Unhandled request error:', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
  next();
});

startRealtimeListener();

module.exports = app;
