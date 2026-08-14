const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: process.env.PGPORT || 5432,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  max: Number(process.env.PGPOOL_MAX || 10),
  idleTimeoutMillis: 30000,
});

// Runs `fn(client)` inside a transaction with the request's JWT claims set
// as session GUCs, exactly like PostgREST does. The rewritten RLS policies
// (see scratch_rewrite_policies.cjs) check auth.role()/auth.uid(), which
// read these GUCs -- NOT actual Postgres role membership, since the hosting
// provider declined to create anon/authenticated/service_role/authenticator
// (see db/01-auth-shim.sql header). Every request runs as the single
// connecting DB role (tecnedub_ots_app); there is no SET LOCAL ROLE here.
async function withRequestContext(auth, fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const role = auth?.role || 'anon';
    const claims = JSON.stringify({
      sub: auth?.sub || null,
      role,
      email: auth?.email || null,
    });
    await client.query('SELECT set_config($1, $2, true)', ['request.jwt.claims', claims]);
    await client.query('SELECT set_config($1, $2, true)', ['request.jwt.claim.sub', auth?.sub || '']);
    await client.query('SELECT set_config($1, $2, true)', ['request.jwt.claim.role', role]);

    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

// Convenience for backend-internal code (ported edge functions) that needs
// to run trusted, elevated queries outside of a per-user request -- these
// are equivalent to what Supabase edge functions did with the
// SERVICE_ROLE_KEY to bypass RLS. A bare pool.query() runs with no GUCs set,
// which auth.role() defaults to 'anon' (see db/01-auth-shim.sql), so any
// RLS-gated write silently fails without this.
async function serviceQuery(text, params) {
  return withRequestContext({ role: 'service_role' }, (client) => client.query(text, params));
}

module.exports = { pool, withRequestContext, serviceQuery };
