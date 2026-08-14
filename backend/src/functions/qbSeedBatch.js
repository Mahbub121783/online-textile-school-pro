// Ported from supabase/functions/qb-seed-batch/index.ts (Deno -> Node).
// The original had NO auth check at all (relied on the real Supabase
// service-role key's blanket RLS bypass, which our self-host has no
// equivalent of). Added a staff-only JWT check here, since qb_questions'
// own RLS policy (qb_questions_staff_manage) checks qb_is_staff(auth.uid())
// directly with no service_role branch -- unlike most other tables in this
// codebase, service_role context alone would NOT satisfy this policy
// (auth.uid() resolves to NULL with no sub claim set), so the insert is run
// under the actual authenticated user's identity via withRequestContext
// instead of serviceQuery.
const jwt = require('jsonwebtoken');
const { withRequestContext, serviceQuery } = require('../db');

async function qbSeedBatch(req, res) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    let uid;
    try {
      uid = jwt.verify(token, process.env.JWT_SECRET).sub;
    } catch {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const staffRes = await serviceQuery('SELECT public.qb_is_staff($1) AS is_staff', [uid]);
    if (!staffRes.rows[0]?.is_staff) {
      return res.status(403).json({ error: 'Forbidden: admin/instructor only' });
    }

    const { rows } = req.body || {};
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'missing rows' });
    }

    const columns = ['subject_id', 'topic_id', 'difficulty', 'question_type', 'question_text', 'options', 'correct_answer', 'explanation', 'points', 'tags', 'source', 'created_by'];
    const results = [];

    for (let i = 0; i < rows.length; i += 200) {
      const chunk = rows.slice(i, i + 200);
      try {
        const values = [];
        const params = [];
        chunk.forEach((row, idx) => {
          const base = idx * columns.length;
          values.push(`(${columns.map((_, ci) => `$${base + ci + 1}`).join(',')})`);
          columns.forEach((col) => {
            let v = row[col] ?? null;
            if (col === 'options' && v != null) v = JSON.stringify(v);
            if (col === 'created_by' && v == null) v = uid;
            params.push(v);
          });
        });
        const result = await withRequestContext({ role: 'authenticated', sub: uid }, (client) =>
          client.query(`INSERT INTO public.qb_questions (${columns.join(',')}) VALUES ${values.join(',')}`, params)
        );
        results.push({ from: i, to: i + chunk.length, inserted: result.rowCount, error: null });
      } catch (err) {
        results.push({ from: i, to: i + chunk.length, inserted: 0, error: err.message });
        break;
      }
    }

    res.json({ ok: true, results, total: rows.length });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
}

module.exports = { qbSeedBatch };
