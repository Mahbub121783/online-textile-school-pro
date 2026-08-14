const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('./db');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRE = process.env.JWT_EXPIRE || '30d';

if (!JWT_SECRET) {
  // Fail loudly at boot rather than silently signing tokens with `undefined`.
  throw new Error('JWT_SECRET env var is not set');
}

function signToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: 'authenticated' },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRE }
  );
}

// Verifies the Authorization: Bearer <jwt> header and returns
// { sub, email, role } for withRequestContext(), or the anon role if absent/invalid.
function readAuth(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return { role: 'anon', sub: null, email: null };
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    return { role: payload.role || 'authenticated', sub: payload.sub, email: payload.email };
  } catch {
    return { role: 'anon', sub: null, email: null };
  }
}

function publicUser(row) {
  return { id: row.id, email: row.email, created_at: row.created_at };
}

const router = express.Router();

// POST /auth/v1/signup { email, password, data? }
router.post('/signup', async (req, res) => {
  const { email, password, data } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });
  if (password.length < 8) return res.status(400).json({ error: 'password must be at least 8 characters' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // No SET LOCAL ROLE (service_role doesn't exist on self-host) -- but the
    // INSERT below fires handle_new_user(), which cascades INSERTs into
    // user_profiles/user_roles/wallets that are gated on auth.role() =
    // 'service_role' (see db/05-bootstrap-policies.sql), so that GUC must
    // be set for the cascade to pass RLS.
    await client.query("SELECT set_config('request.jwt.claim.role', 'service_role', true)");

    const existing = await client.query('SELECT id FROM auth.users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const hash = await bcrypt.hash(password, 10);
    const insert = await client.query(
      `INSERT INTO auth.users (email, encrypted_password, email_confirmed_at, raw_user_meta_data)
       VALUES ($1, $2, now(), $3)
       RETURNING id, email, created_at`,
      [email.toLowerCase(), hash, JSON.stringify(data || {})]
    );
    await client.query('COMMIT');

    const user = insert.rows[0];
    res.status(201).json({ access_token: signToken(user), token_type: 'bearer', user: publicUser(user) });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// POST /auth/v1/token?grant_type=password { email, password }
router.post('/token', async (req, res) => {
  if (req.query.grant_type !== 'password') {
    return res.status(400).json({ error: 'unsupported grant_type' });
  }
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // No SET LOCAL ROLE: service_role doesn't exist on self-host, and
    // auth.users has no RLS enabled anyway (see db/01-auth-shim.sql).
    const r = await client.query(
      'SELECT id, email, encrypted_password, created_at, banned_until FROM auth.users WHERE email = $1',
      [email.toLowerCase()]
    );
    await client.query('COMMIT');

    const row = r.rows[0];
    if (!row) return res.status(400).json({ error: 'Invalid login credentials' });
    if (row.banned_until && new Date(row.banned_until) > new Date()) {
      return res.status(403).json({ error: 'Account suspended' });
    }
    const ok = await bcrypt.compare(password, row.encrypted_password || '');
    if (!ok) return res.status(400).json({ error: 'Invalid login credentials' });

    await pool.query('UPDATE auth.users SET last_sign_in_at = now() WHERE id = $1', [row.id]);
    res.json({ access_token: signToken(row), token_type: 'bearer', user: publicUser(row) });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// GET /auth/v1/user
router.get('/user', async (req, res) => {
  const auth = readAuth(req);
  if (!auth.sub) return res.status(401).json({ error: 'Not authenticated' });
  const r = await pool.query('SELECT id, email, created_at FROM auth.users WHERE id = $1', [auth.sub]);
  if (!r.rows[0]) return res.status(404).json({ error: 'User not found' });
  res.json(publicUser(r.rows[0]));
});

// POST /auth/v1/logout -- stateless JWT, nothing to invalidate server-side yet.
router.post('/logout', (req, res) => res.status(204).end());

module.exports = { router, readAuth, signToken };
