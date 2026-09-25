// Round 4: average/standard-difficulty (basic + intermediate mix, no advanced)
// MCQs across Spinning, Weaving, Dyeing & Finishing, Wet Processing -- 200 each.
// Usage: node build.cjs <subject_key>
const fs = require('fs');
const path = require('path');

const SUBJECT_IDS = {
  spinning: '9dc3ade3-26ea-41fa-a83f-95a7440889b8',
  weaving: '4b495e60-fc2b-4165-a0c7-e0b144e931f7',
  dyeing_finishing: '9e3b3072-3153-414d-b2d7-1bf0789002ac',
  wet_processing: '33333333-3333-3333-3333-333333333333',
};

// Allow _p2.._p9 follow-up files per subject (same pattern as prior rounds --
// once a base file is deployed, further additions go in a new file so
// re-running the base build+deploy never re-inserts already-live rows).
for (const base of Object.keys(SUBJECT_IDS)) {
  for (let i = 2; i <= 9; i++) SUBJECT_IDS[`${base}_p${i}`] = SUBJECT_IDS[base];
}

const key = process.argv[2];
if (!key || !SUBJECT_IDS[key]) {
  console.error('Usage: node build.cjs <' + Object.keys(SUBJECT_IDS).join('|') + '>');
  process.exit(1);
}

const existingRaw = fs.readFileSync(path.join(__dirname, 'existing_all_clean.txt'), 'utf8');
const existingNorm = new Set(
  existingRaw.split('\n').filter(Boolean).map((l) => l.split('||').slice(1).join('||').trim().toLowerCase())
);

const dataFile = path.join(__dirname, key + '.cjs');
const questions = require(dataFile);

function sqlStr(s) {
  return "'" + String(s).replace(/'/g, "''") + "'";
}
function sqlJsonbArr(arr) {
  return "'" + JSON.stringify(arr).replace(/'/g, "''") + "'::jsonb";
}
function sqlTextArr(arr) {
  const body = arr.map((s) => '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"').join(',');
  return "'{" + body.replace(/'/g, "''") + "}'::text[]";
}

const seenNew = new Set();
const errors = [];
const rows = [];

questions.forEach((q, i) => {
  const norm = q.q.trim().toLowerCase();
  if (existingNorm.has(norm)) errors.push(`[${i}] duplicates EXISTING db question: ${q.q}`);
  if (seenNew.has(norm)) errors.push(`[${i}] duplicate WITHIN new batch: ${q.q}`);
  seenNew.add(norm);

  if (!Array.isArray(q.options) || q.options.length !== 4) errors.push(`[${i}] must have exactly 4 options: ${q.q}`);
  const uniqOpts = new Set(q.options.map((o) => o.trim().toLowerCase()));
  if (uniqOpts.size !== 4) errors.push(`[${i}] options not unique: ${q.q}`);
  if (!q.options.includes(q.correct)) errors.push(`[${i}] correct_answer not literally in options: ${q.q}`);
  if (q.difficulty !== 'basic' && q.difficulty !== 'intermediate') {
    errors.push(`[${i}] this round must be difficulty='basic'|'intermediate' only (average/standard, no advanced): ${q.q}`);
  }
  if (!q.exp || q.exp.length < 15) errors.push(`[${i}] explanation missing/too short: ${q.q}`);

  const points = q.difficulty === 'intermediate' ? 2 : 1;
  rows.push({ ...q, points });
});

if (errors.length) {
  console.error(`${errors.length} VALIDATION ERRORS:\n` + errors.join('\n'));
  process.exit(1);
}

console.log(`${key}: ${rows.length} questions validated OK.`);

const subjectId = SUBJECT_IDS[key];
let sql = `SELECT set_config('request.jwt.claim.role','service_role',false);\nSELECT set_config('request.jwt.claim.sub','f49d6153-1835-4455-81f3-2918d5d3484e',false);\nBEGIN;\n`;
const BATCH = 25;
for (let b = 0; b < rows.length; b += BATCH) {
  const chunk = rows.slice(b, b + BATCH);
  sql += `INSERT INTO public.qb_questions (subject_id, difficulty, question_type, question_text, options, correct_answer, explanation, points, tags) VALUES\n`;
  sql += chunk
    .map(
      (r) =>
        `(${sqlStr(subjectId)}, ${sqlStr(r.difficulty)}, 'multiple_choice', ${sqlStr(r.q)}, ${sqlJsonbArr(r.options)}, ${sqlStr(r.correct)}, ${sqlStr(r.exp)}, ${r.points}, ${sqlTextArr(r.tags || [])})`
    )
    .join(',\n');
  sql += ';\n';
}
sql += `COMMIT;\n`;

const outFile = path.join(__dirname, key + '.sql');
fs.writeFileSync(outFile, sql, 'utf8');
console.log('SQL written to', outFile);
