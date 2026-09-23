const { pool } = require('./db');

// Cache of all public-schema FK constraints; loaded once, invalidated only on
// demand (schema doesn't change at runtime for this app).
let cache = null;

// Cache of { table -> Set(column names with data_type json/jsonb) }. The
// generic REST insert/update handlers push req.body values straight into `pg`
// query params -- for a jsonb/json column, `pg` needs a JSON *string*, but
// supabase-js/fetch already deserializes the request body into a real JS
// array/object by the time it reaches us, and `pg` serializes a raw JS array
// param as a Postgres array literal (`{a,b}`), not JSON, which Postgres then
// rejects for a jsonb column ("invalid input syntax for type json"). This
// lets the insert/update handlers know which columns need an explicit
// JSON.stringify() first, without touching genuinely-native array columns
// (text[], uuid[], etc., whose information_schema.data_type is "ARRAY", not
// "json"/"jsonb", and which `pg` already serializes correctly on its own).
let jsonColumnsCache = null;

async function loadJsonColumns() {
  if (jsonColumnsCache) return jsonColumnsCache;
  const { rows } = await pool.query(`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND data_type IN ('json', 'jsonb')
  `);
  const map = new Map();
  for (const r of rows) {
    if (!map.has(r.table_name)) map.set(r.table_name, new Set());
    map.get(r.table_name).add(r.column_name);
  }
  jsonColumnsCache = map;
  return jsonColumnsCache;
}

async function isJsonColumn(table, column) {
  const map = await loadJsonColumns();
  return map.get(table)?.has(column) ?? false;
}

// Cache of function names (public schema) that return a set (RETURNS TABLE(...)
// / RETURNS SETOF ...), as opposed to a single scalar/jsonb value.
let setReturningFnCache = null;

async function loadSetReturningFunctions() {
  if (setReturningFnCache) return setReturningFnCache;
  // Only functions returning a row/composite set (RETURNS TABLE(...), or
  // RETURNS SETOF some_composite_type) need the `SELECT * FROM fn()` fix --
  // a plain `RETURNS SETOF uuid`/`text`/etc. scalar set is already handled
  // correctly by the existing `SELECT fn() AS result` path (one row per
  // element, real scalar value each time), so it's deliberately excluded
  // here to avoid turning a working array-of-scalars response into an
  // array-of-single-key-objects for any such function added later.
  const { rows } = await pool.query(`
    SELECT p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    JOIN pg_type t ON t.oid = p.prorettype
    WHERE n.nspname = 'public' AND p.proretset = true
      AND (
        t.typtype = 'c'
        OR (t.typname = 'record' AND p.proargmodes IS NOT NULL AND p.proargmodes && ARRAY['o','t']::"char"[])
      )
  `);
  setReturningFnCache = new Set(rows.map((r) => r.proname));
  return setReturningFnCache;
}

// A table/set-returning function (e.g. RETURNS TABLE(id uuid, name text))
// called as `SELECT public.fn() AS result` collapses each row into an
// opaque anonymous composite-type value (postgres prints it as
// "(val1,val2,...)") instead of named JSON columns -- node-pg can't parse
// an unregistered composite type, so callers received a raw string with no
// field access at all. Confirmed live: qb_get_exam_questions (every exam
// loaded zero questions -- `qs.find(q => q.id === id)` always missed since
// `q` was a string, not an object) and qb_subject_question_counts (every
// admin subject card showed 0/0/0). The real fix is calling these as
// `SELECT * FROM public.fn()` instead, which yields proper named columns.
async function isSetReturningFunction(fn) {
  const set = await loadSetReturningFunctions();
  return set.has(fn);
}

// Normalizes a single value for binding as a `pg` query param: JSON.stringify
// it if (and only if) the target column is a json/jsonb column and the value
// is a real object/array that still needs serializing (already-a-string and
// null/undefined pass through untouched).
async function serializeForColumn(table, column, value) {
  if (value !== null && typeof value === 'object' && (await isJsonColumn(table, column))) {
    return JSON.stringify(value);
  }
  return value;
}

// Cache of { table -> [{ columns: string[], whereClause: string|null }] }
// for every unique/PK index in public schema. Needed because several
// dedupe tables use a PARTIAL unique index per NULL-combination instead of
// a single plain UNIQUE constraint (Postgres 13 has no `UNIQUE NULLS NOT
// DISTINCT` -- see db/ migration notes), e.g. class_video_views has
// separate `(video_id, user_id) WHERE user_id IS NOT NULL` and
// `(video_id, session_key) WHERE user_id IS NULL AND session_key IS NOT
// NULL` indexes. A bare `ON CONFLICT (video_id, user_id) DO ...` does NOT
// match a partial index unless the WHERE predicate is repeated verbatim in
// the ON CONFLICT clause -- Postgres rejects it with "no unique or
// exclusion constraint matching the ON CONFLICT specification". This cache
// lets the upsert handler find and reattach the right predicate instead of
// trusting the client-supplied column list blindly.
let uniqueIndexCache = null;

async function loadUniqueIndexes() {
  if (uniqueIndexCache) return uniqueIndexCache;
  const { rows } = await pool.query(`
    SELECT
      t.relname AS table_name,
      i.relname AS index_name,
      pg_get_expr(ix.indpred, ix.indrelid) AS where_clause,
      array_agg(a.attname::text ORDER BY k.ord) AS columns
    FROM pg_index ix
    JOIN pg_class t ON t.oid = ix.indrelid
    JOIN pg_class i ON i.oid = ix.indexrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN LATERAL unnest(ix.indkey) WITH ORDINALITY AS k(attnum, ord) ON true
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum
    WHERE ix.indisunique AND n.nspname = 'public'
    GROUP BY t.relname, i.relname, ix.indpred, ix.indrelid
  `);
  const map = new Map();
  for (const r of rows) {
    if (!map.has(r.table_name)) map.set(r.table_name, []);
    map.get(r.table_name).push({ columns: r.columns, whereClause: r.where_clause });
  }
  uniqueIndexCache = map;
  return uniqueIndexCache;
}

// Given the on_conflict column list a client supplied, finds the matching
// unique index and returns its WHERE clause (null for a plain, non-partial
// unique constraint -- the common case, where a bare column-list ON
// CONFLICT already works fine).
async function resolveConflictWhere(table, columns) {
  const map = await loadUniqueIndexes();
  const indexes = map.get(table) || [];
  const wanted = [...columns].sort();
  const match = indexes.find((idx) => {
    const cols = [...idx.columns].sort();
    return cols.length === wanted.length && cols.every((c, i) => c === wanted[i]);
  });
  return match ? match.whereClause : null;
}

async function loadRelationships() {
  if (cache) return cache;
  const { rows } = await pool.query(`
    SELECT
      tc.constraint_name,
      tc.table_name AS local_table,
      kcu.column_name AS local_column,
      ccu.table_name AS foreign_table,
      ccu.column_name AS foreign_column
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
  `);
  cache = rows;
  return cache;
}

// Resolves a PostgREST-style embed hint (table name, FK column name, or
// explicit !constraint_name) into the join direction needed to build a
// correlated subquery.
//   - table has the FK column pointing at the target -> many-to-one (single object)
//   - target has the FK column pointing back at table -> one-to-many (array)
async function resolveEmbed(table, hint, constraintHint) {
  const rels = await loadRelationships();
  let candidates;
  if (constraintHint) {
    candidates = rels.filter((r) => r.constraint_name === constraintHint);
  } else {
    candidates = rels.filter(
      (r) =>
        (r.local_table === table && (r.foreign_table === hint || r.local_column === hint)) ||
        (r.foreign_table === table && r.local_table === hint)
    );
  }
  if (candidates.length === 0) {
    const err = new Error(`No relationship found for embed "${hint}" on table "${table}"`);
    err.status = 400;
    throw err;
  }
  if (candidates.length > 1) {
    const err = new Error(`Ambiguous embed "${hint}" on table "${table}" -- disambiguate with !constraint_name`);
    err.status = 400;
    throw err;
  }
  const r = candidates[0];
  if (r.local_table === table) {
    return { targetTable: r.foreign_table, localColumn: r.local_column, foreignColumn: r.foreign_column, isArray: false };
  }
  return { targetTable: r.local_table, localColumn: r.foreign_column, foreignColumn: r.local_column, isArray: true };
}

module.exports = { resolveEmbed, loadRelationships, serializeForColumn, resolveConflictWhere, isSetReturningFunction };
