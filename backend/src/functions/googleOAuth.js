const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const fetch = require('node-fetch');
const { pool } = require('../db');
const { signToken } = require('../auth');

const JWT_SECRET = process.env.JWT_SECRET;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'https://api.onlinetextileschool.com/auth/v1/google/callback';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://onlinetextileschool.com';

const router = express.Router();

// One-time exchange codes so the real session JWT never rides in a URL
// (browser history / Referer header) -- the callback hands the browser a
// short opaque code, and the frontend trades it for the session via POST
// /exchange. In-memory Map is fine: single Node process, 60s TTL.
const pendingExchanges = new Map();
function sweepExpired() {
  const now = Date.now();
  for (const [k, v] of pendingExchanges) if (v.expiresAt < now) pendingExchanges.delete(k);
}

// GET /auth/v1/google/start?redirect=/dashboard
router.get('/start', (req, res) => {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return res.status(503).send('Google sign-in is not configured on this server yet.');
  }
  const redirectPath = typeof req.query.redirect === 'string' && req.query.redirect.startsWith('/')
    ? req.query.redirect
    : '/';
  // Signed + short-lived so the callback can trust it without server-side
  // session storage, and can't be tampered with to redirect elsewhere.
  const state = jwt.sign({ redirect: redirectPath }, JWT_SECRET, { expiresIn: '10m' });

  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', GOOGLE_CLIENT_ID);
  url.searchParams.set('redirect_uri', GOOGLE_REDIRECT_URI);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid email profile');
  url.searchParams.set('state', state);
  url.searchParams.set('prompt', 'select_account');
  res.redirect(url.toString());
});

// GET /auth/v1/google/callback -- Google redirects here with ?code&state
router.get('/callback', async (req, res) => {
  const fail = (reason) => res.redirect(`${FRONTEND_URL}/auth/login?oauth_error=${encodeURIComponent(reason)}`);
  const { code, state, error } = req.query;
  if (error) return fail(String(error));
  if (!code || !state) return fail('missing_code');

  let redirectPath = '/';
  try {
    redirectPath = jwt.verify(String(state), JWT_SECRET).redirect || '/';
  } catch {
    return fail('invalid_or_expired_state');
  }

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: String(code),
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    });
    const tokenBody = await tokenRes.json();
    if (!tokenRes.ok || !tokenBody.id_token) {
      console.error('Google token exchange failed:', tokenBody);
      return fail('token_exchange_failed');
    }

    const idPayload = jwt.decode(tokenBody.id_token);
    if (!idPayload || !idPayload.email) return fail('no_email_from_google');
    if (idPayload.email_verified === false) return fail('google_email_not_verified');

    const email = String(idPayload.email).toLowerCase();

    const client = await pool.connect();
    let userRow;
    try {
      await client.query('BEGIN');
      // Same elevation as /auth/v1/signup: INSERT into auth.users cascades
      // into user_profiles/user_roles/wallets via handle_new_user(), which
      // is gated on auth.role() = 'service_role' (db/05-bootstrap-policies.sql).
      await client.query("SELECT set_config('request.jwt.claim.role', 'service_role', true)");

      const existing = await client.query(
        'SELECT id, email, created_at, banned_until FROM auth.users WHERE email = $1',
        [email]
      );

      if (existing.rows[0]) {
        // Links to the existing account by verified email (e.g. one
        // originally created with a password) -- same convenience-login
        // behavior most "Continue with Google" buttons offer.
        userRow = existing.rows[0];
      } else {
        const inserted = await client.query(
          `INSERT INTO auth.users (email, encrypted_password, email_confirmed_at, raw_user_meta_data)
           VALUES ($1, NULL, now(), $2)
           RETURNING id, email, created_at, banned_until`,
          [email, JSON.stringify({
            full_name: idPayload.name || '',
            avatar_url: idPayload.picture || '',
            provider: 'google',
          })]
        );
        userRow = inserted.rows[0];
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      throw e;
    } finally {
      client.release();
    }

    if (userRow.banned_until && new Date(userRow.banned_until) > new Date()) {
      return fail('account_suspended');
    }

    await pool.query('UPDATE auth.users SET last_sign_in_at = now() WHERE id = $1', [userRow.id]);

    const accessToken = signToken(userRow);
    const exchangeCode = crypto.randomBytes(24).toString('hex');
    sweepExpired();
    pendingExchanges.set(exchangeCode, {
      expiresAt: Date.now() + 60_000,
      payload: {
        access_token: accessToken,
        token_type: 'bearer',
        user: { id: userRow.id, email: userRow.email, created_at: userRow.created_at },
      },
    });

    res.redirect(`${FRONTEND_URL}/auth/callback?code=${exchangeCode}&redirect=${encodeURIComponent(redirectPath)}`);
  } catch (e) {
    console.error('Google OAuth callback error:', e);
    return fail('server_error');
  }
});

// POST /auth/v1/google/exchange { code } -- trades the one-time code from
// the redirect for the real session (called by the frontend callback page).
router.post('/exchange', (req, res) => {
  sweepExpired();
  const { code } = req.body || {};
  const entry = code && pendingExchanges.get(String(code));
  if (!entry) return res.status(400).json({ error: 'Invalid or expired code' });
  pendingExchanges.delete(String(code));
  res.json(entry.payload);
});

module.exports = router;
