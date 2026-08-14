// Maintenance jobs that used to run via pg_cron on Supabase (pg_cron is
// unavailable on self-host; each was already ported to a plain SQL function
// during the migration patching pass -- see the "pg_cron unavailable on
// self-host" comments throughout supabase/migrations/). Triggered by cPanel
// Cron Jobs hitting this single endpoint with ?job=<name>, gated by a shared
// secret since these run administrative operations (data pruning, killing
// connections) with less built-in self-throttling than the reminder
// functions have.
//
// pg-vacuum-daily / pg_vacuum_bloat_tables() intentionally NOT wired here:
// it only targets cron.job_run_details / net._http_response, tables that
// don't exist in this self-host schema (no pg_cron/pg_net extensions) --
// dead code in this environment.
const { serviceQuery } = require('../db');

const JOBS = {
  'workshop-auto-status': 'SELECT public.auto_update_workshop_status()',
  'qb-refresh-leaderboard': 'SELECT public.qb_refresh_leaderboard()',
  'qb-prune-free-tier': 'SELECT public.prune_free_tier_data()',
  'qb-aggregate-question-stats': 'SELECT public.qb_aggregate_question_stats()',
  'qb-auto-close-orphans': 'SELECT public.qb_auto_close_orphans()',
  'refresh-homepage-stats': 'SELECT public.refresh_homepage_stats()',
  'pg-housekeeping-daily': 'SELECT public.pg_housekeeping_daily()',
  'kill-idle-connections': 'SELECT public.kill_idle_connections()',
};

async function internalCron(req, res) {
  const secret = req.headers['x-cron-secret'] || req.query.secret;
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const job = req.query.job;
  const sql = JOBS[job];
  if (!sql) return res.status(400).json({ error: 'unknown job', known: Object.keys(JOBS) });

  try {
    const result = await serviceQuery(sql);
    res.json({ ok: true, job, result: result.rows[0] });
  } catch (e) {
    console.error(`internal cron job "${job}" failed:`, e.message);
    res.status(500).json({ error: e.message });
  }
}

module.exports = { internalCron };
