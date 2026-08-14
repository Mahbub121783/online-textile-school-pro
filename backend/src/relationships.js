const { pool } = require('./db');

// Cache of all public-schema FK constraints; loaded once, invalidated only on
// demand (schema doesn't change at runtime for this app).
let cache = null;

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

module.exports = { resolveEmbed, loadRelationships };
