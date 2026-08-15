const express = require('express');
const { withRequestContext } = require('./db');
const { readAuth } = require('./auth');
const { resolveEmbed, serializeForColumn, resolveConflictWhere } = require('./relationships');

// ============================================================
// PostgREST-subset query layer. Implements exactly the operator set the
// frontend's 756 supabase.from() call sites actually use (confirmed via
// grep across src/): eq, neq, gt, gte, lt, lte, like, ilike, in, is, not,
// or, select, order, limit, range, insert, update, upsert, delete, rpc,
// plus embedded/nested resource selects (select=col,relation(cols),
// alias:relation(cols), relation!fk_constraint(cols) -- see relationships.js).
// ============================================================

const RESERVED_PARAMS = new Set(['select', 'order', 'limit', 'offset', 'or']);
const TABLE_NAME_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

function assertValidIdentifier(name) {
  if (!TABLE_NAME_RE.test(name)) {
    const err = new Error(`Invalid identifier: ${name}`);
    err.status = 400;
    throw err;
  }
  return name;
}

// Splits a select/order-by-comma string on top-level commas only (ignores
// commas nested inside parens, e.g. `a,b(c,d),e` -> ['a', 'b(c,d)', 'e']).
function splitTopLevel(str) {
  const parts = [];
  let depth = 0;
  let current = '';
  for (const ch of str) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current) parts.push(current);
  return parts;
}

// `[alias:]name[!constraint](inner)` -- the embed syntax for one select token.
const EMBED_RE = /^(?:([a-zA-Z_][a-zA-Z0-9_]*):)?([a-zA-Z_][a-zA-Z0-9_]*)(?:!([a-zA-Z_][a-zA-Z0-9_]*))?\(([\s\S]*)\)$/;
// `[alias:]column` -- a flat column, optionally aliased. `*` alone (e.g. as
// one token in `select=*,relation(cols)`) must also match -- the previous
// pattern required the token to START with a letter/underscore, so a bare
// `*` token fell through to "Unparseable select fragment" and broke every
// query that combines `*` with an embed (e.g. CourseDetail.tsx's
// `select('*, categories(name), ...')`, used platform-wide).
const FLAT_RE = /^(?:([a-zA-Z_][a-zA-Z0-9_]*):)?(\*|[a-zA-Z_][a-zA-Z0-9_]*)$/;

// Recursively builds a SQL select-list for `table`, resolving embedded
// resources into correlated subqueries (to_jsonb for many-to-one,
// jsonb_agg for one-to-many), so `select=title,course(name)` becomes
// `"title", (SELECT to_jsonb(sub) FROM (SELECT "name" FROM course WHERE course.id = t.course_id) sub) AS "course"`.
async function buildSelectClause(table, selectParam) {
  if (!selectParam || selectParam === '*') return '*';
  const tokens = splitTopLevel(selectParam).map((t) => t.trim()).filter(Boolean);
  if (tokens.length === 0) return '*';

  const parts = [];
  for (const token of tokens) {
    const embedMatch = EMBED_RE.exec(token);
    if (embedMatch) {
      const [, alias, name, constraint, inner] = embedMatch;
      // `!inner`/`!left` are PostgREST join-TYPE hints (e.g.
      // `assignment_submissions!inner(...)`), not a foreign-key constraint
      // name -- treating "inner" as a literal constraint to look up always
      // failed with "No relationship found for embed ... on table ...",
      // confirmed live against AdminPlagiarism.tsx's exact query. Only a
      // real `!constraint_name` (anything else) should be passed through as
      // a disambiguation hint; a bare join-type hint falls back to normal
      // name/column-based resolution.
      const constraintHint = constraint === 'inner' || constraint === 'left' ? null : constraint;
      const rel = await resolveEmbed(table, name, constraintHint);
      assertValidIdentifier(rel.targetTable);
      assertValidIdentifier(rel.localColumn);
      assertValidIdentifier(rel.foreignColumn);
      const innerSelect = await buildSelectClause(rel.targetTable, inner);
      const outAlias = alias || name;
      assertValidIdentifier(outAlias);

      const innerQuery = `SELECT ${innerSelect} FROM public."${rel.targetTable}" WHERE public."${rel.targetTable}"."${rel.foreignColumn}" = "${table}"."${rel.localColumn}"`;
      if (rel.isArray) {
        parts.push(`(SELECT COALESCE(jsonb_agg(to_jsonb(sub)), '[]'::jsonb) FROM (${innerQuery}) sub) AS "${outAlias}"`);
      } else {
        parts.push(`(SELECT to_jsonb(sub) FROM (${innerQuery} LIMIT 1) sub) AS "${outAlias}"`);
      }
      continue;
    }

    const flatMatch = FLAT_RE.exec(token);
    if (flatMatch) {
      const [, alias, column] = flatMatch;
      if (column === '*') {
        parts.push('*');
      } else {
        assertValidIdentifier(column);
        parts.push(alias ? `"${column}" AS "${alias}"` : `"${column}"`);
      }
      continue;
    }

    const err = new Error(`Unparseable select fragment: ${token}`);
    err.status = 400;
    throw err;
  }
  return parts.join(', ');
}

// Translates one `col=op.value` pair into a SQL fragment + bound param(s).
function buildCondition(column, rawValue, params) {
  assertValidIdentifier(column);
  let value = rawValue;
  let negate = false;
  if (value.startsWith('not.')) {
    negate = true;
    value = value.slice(4);
  }
  const dot = value.indexOf('.');
  const op = dot === -1 ? value : value.slice(0, dot);
  const arg = dot === -1 ? '' : value.slice(dot + 1);

  let sql;
  switch (op) {
    case 'eq':
      params.push(arg);
      sql = `"${column}" = $${params.length}`;
      break;
    case 'neq':
      params.push(arg);
      sql = `"${column}" <> $${params.length}`;
      break;
    case 'gt':
      params.push(arg);
      sql = `"${column}" > $${params.length}`;
      break;
    case 'gte':
      params.push(arg);
      sql = `"${column}" >= $${params.length}`;
      break;
    case 'lt':
      params.push(arg);
      sql = `"${column}" < $${params.length}`;
      break;
    case 'lte':
      params.push(arg);
      sql = `"${column}" <= $${params.length}`;
      break;
    case 'like':
      params.push(arg.replace(/\*/g, '%'));
      sql = `"${column}" LIKE $${params.length}`;
      break;
    case 'ilike':
      params.push(arg.replace(/\*/g, '%'));
      sql = `"${column}" ILIKE $${params.length}`;
      break;
    case 'is':
      sql = `"${column}" IS ${arg === 'null' ? 'NULL' : arg === 'true' ? 'TRUE' : 'FALSE'}`;
      break;
    case 'in': {
      const list = arg.replace(/^\(|\)$/g, '').split(',').filter((v) => v.length);
      const placeholders = list.map((v) => {
        params.push(v);
        return `$${params.length}`;
      });
      sql = `"${column}" IN (${placeholders.join(', ')})`;
      break;
    }
    case 'cs':
      params.push(arg);
      sql = `"${column}" @> $${params.length}`;
      break;
    default: {
      const err = new Error(`Unsupported filter operator: ${op}`);
      err.status = 400;
      throw err;
    }
  }
  return negate ? `NOT (${sql})` : sql;
}

// `or=(col.eq.val,col2.eq.val2)` -> "(col = $1 OR col2 = $2)"
function buildOrCondition(orParam, params) {
  const inner = orParam.replace(/^\(|\)$/g, '');
  const parts = [];
  let depth = 0;
  let current = '';
  for (const ch of inner) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current) parts.push(current);

  const clauses = parts.map((part) => {
    const dot = part.indexOf('.');
    const col = part.slice(0, dot);
    const rest = part.slice(dot + 1);
    return buildCondition(col, rest, params);
  });
  return `(${clauses.join(' OR ')})`;
}

function buildWhere(query, params) {
  const clauses = [];
  for (const [key, value] of Object.entries(query)) {
    if (RESERVED_PARAMS.has(key)) continue;
    const rawValue = Array.isArray(value) ? value[0] : value;
    clauses.push(buildCondition(key, rawValue, params));
  }
  if (query.or) {
    clauses.push(buildOrCondition(Array.isArray(query.or) ? query.or[0] : query.or, params));
  }
  return clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
}

function buildOrder(orderParam) {
  if (!orderParam) return '';
  const parts = orderParam.split(',').map((p) => {
    const [col, dir, nulls] = p.split('.');
    assertValidIdentifier(col);
    let sql = `"${col}" ${dir === 'desc' ? 'DESC' : 'ASC'}`;
    if (nulls === 'nullsfirst') sql += ' NULLS FIRST';
    if (nulls === 'nullslast') sql += ' NULLS LAST';
    return sql;
  });
  return `ORDER BY ${parts.join(', ')}`;
}

function wantsSingleObject(req) {
  return (req.headers.accept || '').includes('application/vnd.pgrst.object+json');
}

function preferReturn(req) {
  const prefer = req.headers.prefer || '';
  return prefer.includes('return=representation');
}

// The GET handler already branched on wantsSingleObject (real PostgREST's
// contract for .single()/.maybeSingle(): respond with a bare object, not an
// array, when the client sends `Accept: application/vnd.pgrst.object+json`)
// -- but POST/PATCH/DELETE always sent back `result.rows` as a plain array
// regardless of that header. supabase-js trusts the server to honor the
// Accept header and does no reshaping itself, so every
// `.insert(...).select().single()` (and the .update()/.delete() equivalents)
// silently received an array where calling code expected an object --
// `const { data: order } = await ...insert(...).select('id').single(); ...
// order.id` resolved to `undefined` on a real array response, which then got
// sent as a null FK/column value to the next query. Confirmed live: this
// exact pattern in the admin "Grant Ebook Access" flow (StudentDetail.tsx)
// failed with "null value in column order_id ... violates not-null
// constraint" because `order.id` was undefined. This one shared helper fixes
// every affected call site (113 occurrences across 79 files) at the root
// instead of patching each one.
function respondRows(req, res, rows, statusCode) {
  if (!preferReturn(req)) return res.status(statusCode).json([]);
  if (wantsSingleObject(req)) {
    if (rows.length !== 1) {
      return res.status(406).json({ code: 'PGRST116', message: 'Expected exactly one row', details: null, hint: null });
    }
    return res.status(statusCode).json(rows[0]);
  }
  return res.status(statusCode).json(rows);
}

// supabase-js (postgrest-js) parses a non-2xx response body directly as a
// PostgrestError: { message, details, hint, code }. Every catch block below
// used to send { error: err.message }, which has no `.message` key -- so
// every failed request surfaced as literally "undefined" in the UI (e.g.
// "Failed to save order items: undefined") no matter what the real error
// was, hiding the actual RLS/constraint failure from both users and admins.
function sendPgError(res, err) {
  res.status(err.status || 500).json({
    message: err.message || 'Unknown error',
    details: err.detail || null,
    hint: err.hint || null,
    code: err.code || null,
  });
}

const router = express.Router();

// Cron-only / maintenance SECURITY DEFINER functions. On real Supabase these
// were protected by REVOKE EXECUTE FROM anon, authenticated (see the removed
// DO block in migration 20260516131917) -- since self-host has no such
// per-role grants, block them here instead so they're never reachable via
// public RPC, only ever called internally (cron jobs, triggers).
const RPC_BLOCKLIST = new Set([
  'kill_idle_connections', 'prune_free_tier_data', 'cleanup_old_ai_chats',
  'pg_housekeeping_daily', 'pg_vacuum_bloat_tables', 'auto_update_workshop_status',
  'qb_refresh_leaderboard', 'qb_aggregate_question_stats', 'qb_auto_close_orphans',
  'refresh_homepage_stats', 'notify_admins', 'maybe_run_unreplied_message_reminder',
  'maybe_run_workshop_reminder', 'maybe_run_workshop_auto_status',
  'bulk_issue_workshop_certificates', 'handle_new_user', 'handle_updated_at',
  // credit_wallet/debit_wallet: found to be a live fund-mint/drain exploit
  // when called directly via this public RPC endpoint (any caller could
  // pass an arbitrary _user_id/_amount). The SQL functions themselves are
  // now also locked to service_role-origin-only (db/29), but block them
  // here too as defense in depth -- every legitimate use case now goes
  // through backend/src/functions/checkoutFinalize.js instead.
  'credit_wallet', 'debit_wallet',
]);

// node-postgres serializes a bare JS array as a Postgres array literal
// (`{a,b,c}`), not JSON text -- fine for a real `uuid[]`/`text[]` SQL
// parameter, but wrong for a `jsonb` parameter that happens to hold an
// array (e.g. qb_submit_exam's `_answers jsonb`, an array of answer
// objects), which then fails with "invalid input syntax for type json".
// A plain object is never valid as a bare Postgres scalar/array parameter
// at all, so it must always mean a json/jsonb argument. Only stringify
// arrays whose elements are themselves objects -- a plain scalar array
// (uuid[]/text[]/int[]) must stay a real JS array for node-pg to encode
// as a native Postgres array.
function coerceRpcParam(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    const hasObjectElements = value.some((v) => v !== null && typeof v === 'object' && !Array.isArray(v));
    return hasObjectElements ? JSON.stringify(value) : value;
  }
  return JSON.stringify(value);
}

router.post('/rpc/:fn', async (req, res) => {
  try {
    const fn = assertValidIdentifier(req.params.fn);
    if (RPC_BLOCKLIST.has(fn)) return res.status(403).json({ message: 'Function not callable via RPC' });
    const auth = readAuth(req);
    const args = req.body && typeof req.body === 'object' ? req.body : {};
    const argNames = Object.keys(args);
    const params = argNames.map((k) => coerceRpcParam(args[k]));
    const namedArgs = argNames.map((k, i) => `"${k}" := $${i + 1}`).join(', ');

    const result = await withRequestContext(auth, (client) =>
      client.query(`SELECT public.${fn}(${namedArgs}) AS result`, params)
    );
    res.json(result.rows.length === 1 ? result.rows[0].result : result.rows.map((r) => r.result));
  } catch (err) {
    sendPgError(res, err);
  }
});

router.route('/:table')
  .get(async (req, res) => {
    try {
      const table = assertValidIdentifier(req.params.table);
      const auth = readAuth(req);
      const params = [];
      const where = buildWhere(req.query, params);
      const order = buildOrder(req.query.order);
      const select = await buildSelectClause(table, req.query.select);

      let limitClause = '';
      if (req.query.limit) {
        params.push(Number(req.query.limit));
        limitClause += ` LIMIT $${params.length}`;
      }
      if (req.query.offset) {
        params.push(Number(req.query.offset));
        limitClause += ` OFFSET $${params.length}`;
      }
      // supabase-js .range(from, to) sends a Range header instead of limit/offset.
      const rangeHeader = req.headers.range;
      if (!req.query.limit && rangeHeader) {
        const [from, to] = rangeHeader.split('-').map(Number);
        params.push(to - from + 1);
        limitClause += ` LIMIT $${params.length}`;
        params.push(from);
        limitClause += ` OFFSET $${params.length}`;
      }

      const sql = `SELECT ${select} FROM public."${table}" ${where} ${order} ${limitClause}`;
      const result = await withRequestContext(auth, (client) => client.query(sql, params));

      if (wantsSingleObject(req)) {
        if (result.rows.length !== 1) {
          return res.status(406).json({ code: 'PGRST116', message: 'Expected exactly one row' });
        }
        return res.json(result.rows[0]);
      }
      res.json(result.rows);
    } catch (err) {
      sendPgError(res, err);
    }
  })
  .post(async (req, res) => {
    try {
      const table = assertValidIdentifier(req.params.table);
      const auth = readAuth(req);
      const rows = Array.isArray(req.body) ? req.body : [req.body];
      if (rows.length === 0) return res.status(400).json({ message: 'empty insert body' });

      const columns = Object.keys(rows[0]);
      columns.forEach(assertValidIdentifier);
      const params = [];
      const valueRows = [];
      for (const row of rows) {
        const placeholders = [];
        for (const col of columns) {
          params.push(await serializeForColumn(table, col, row[col]));
          placeholders.push(`$${params.length}`);
        }
        valueRows.push(`(${placeholders.join(', ')})`);
      }

      const onConflict = req.query.on_conflict;
      const prefer = req.headers.prefer || '';
      let conflictClause = '';
      if (onConflict) {
        const conflictCols = onConflict.split(',');
        conflictCols.forEach(assertValidIdentifier);
        // Several dedupe tables use a PARTIAL unique index (one per
        // NULL-combination) instead of a plain UNIQUE constraint -- Postgres
        // 13 has no `UNIQUE NULLS NOT DISTINCT`. A bare `ON CONFLICT (cols)`
        // only matches a partial index if its WHERE predicate is repeated
        // verbatim, otherwise Postgres rejects it with "no unique or
        // exclusion constraint matching the ON CONFLICT specification" --
        // confirmed live on class_video_views, which broke ALL video view
        // counting. resolveConflictWhere looks up the real index so this
        // works for any such table without hardcoding table names here.
        const whereClause = await resolveConflictWhere(table, conflictCols);
        const conflictTarget = `(${onConflict})${whereClause ? ` WHERE ${whereClause}` : ''}`;
        if (prefer.includes('resolution=ignore-duplicates')) {
          conflictClause = ` ON CONFLICT ${conflictTarget} DO NOTHING`;
        } else {
          const updates = columns
            .filter((c) => !conflictCols.includes(c))
            .map((c) => `"${c}" = EXCLUDED."${c}"`)
            .join(', ');
          conflictClause = ` ON CONFLICT ${conflictTarget} DO UPDATE SET ${updates}`;
        }
      }

      const cols = columns.map((c) => `"${c}"`).join(', ');
      const returning = preferReturn(req) ? `RETURNING ${await buildSelectClause(table, req.query.select)}` : '';
      const sql = `INSERT INTO public."${table}" (${cols}) VALUES ${valueRows.join(', ')}${conflictClause} ${returning}`;
      const result = await withRequestContext(auth, (client) => client.query(sql, params));

      respondRows(req, res, result.rows, 201);
    } catch (err) {
      sendPgError(res, err);
    }
  })
  .patch(async (req, res) => {
    try {
      const table = assertValidIdentifier(req.params.table);
      const auth = readAuth(req);
      const columns = Object.keys(req.body || {});
      if (columns.length === 0) return res.status(400).json({ message: 'empty update body' });
      columns.forEach(assertValidIdentifier);

      const params = [];
      const setParts = [];
      for (const c of columns) {
        params.push(await serializeForColumn(table, c, req.body[c]));
        setParts.push(`"${c}" = $${params.length}`);
      }
      const setClause = setParts.join(', ');
      const where = buildWhere(req.query, params);
      const returning = preferReturn(req) ? `RETURNING ${await buildSelectClause(table, req.query.select)}` : '';
      const sql = `UPDATE public."${table}" SET ${setClause} ${where} ${returning}`;
      const result = await withRequestContext(auth, (client) => client.query(sql, params));

      respondRows(req, res, result.rows, 200);
    } catch (err) {
      sendPgError(res, err);
    }
  })
  .delete(async (req, res) => {
    try {
      const table = assertValidIdentifier(req.params.table);
      const auth = readAuth(req);
      const params = [];
      const where = buildWhere(req.query, params);
      if (!where) return res.status(400).json({ message: 'refusing DELETE with no filter' });

      const returning = preferReturn(req) ? `RETURNING ${await buildSelectClause(table, req.query.select)}` : '';
      const sql = `DELETE FROM public."${table}" ${where} ${returning}`;
      const result = await withRequestContext(auth, (client) => client.query(sql, params));

      respondRows(req, res, result.rows, 200);
    } catch (err) {
      sendPgError(res, err);
    }
  });

module.exports = router;
