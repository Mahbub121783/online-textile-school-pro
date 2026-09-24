// Round 2: extremely hard (advanced-only) MCQs across ALL 13 subjects.
// Usage: node build.cjs <subject_key>
const fs = require('fs');
const path = require('path');

const SUBJECT_IDS = {
  yarn: '11111111-1111-1111-1111-111111111111',
  fabric_manufacturing: '22222222-2222-2222-2222-222222222222',
  wet_processing: '33333333-3333-3333-3333-333333333333',
  apparel_management: '44444444-4444-4444-4444-444444444444',
  dyeing_finishing: '9e3b3072-3153-414d-b2d7-1bf0789002ac',
  spinning: '9dc3ade3-26ea-41fa-a83f-95a7440889b8',
  weaving: '4b495e60-fc2b-4165-a0c7-e0b144e931f7',
  merchandising: '8b81a645-306d-4cc1-962a-ab597d640fe5',
  garments_technology: '3c09b2b2-10bd-4e1e-a51d-661d013948bc',
  quality_control: '969f50f3-57d6-4bcd-8791-00db118d9ba0',
  knitting: '0a50ae12-e000-4b92-a5e9-3735064814d2',
  textile_management: 'ddedfe3c-fe07-4167-b56f-656c9fb89f5e',
  yarn_technology: 'e512054c-240f-461d-9ccd-e6cc5c9e6411',
  weaving_p2: '4b495e60-fc2b-4165-a0c7-e0b144e931f7',
  knitting_p2: '0a50ae12-e000-4b92-a5e9-3735064814d2',
  wet_processing_p2: '33333333-3333-3333-3333-333333333333',
  quality_control_p2: '969f50f3-57d6-4bcd-8791-00db118d9ba0',
  garments_technology_p2: '3c09b2b2-10bd-4e1e-a51d-661d013948bc',
  textile_management_p2: 'ddedfe3c-fe07-4167-b56f-656c9fb89f5e',
  yarn_technology_p2: 'e512054c-240f-461d-9ccd-e6cc5c9e6411',
  merchandising_p2: '8b81a645-306d-4cc1-962a-ab597d640fe5',
  spinning_p3: '9dc3ade3-26ea-41fa-a83f-95a7440889b8',
  weaving_p3: '4b495e60-fc2b-4165-a0c7-e0b144e931f7',
  knitting_p3: '0a50ae12-e000-4b92-a5e9-3735064814d2',
  wet_processing_p3: '33333333-3333-3333-3333-333333333333',
  quality_control_p3: '969f50f3-57d6-4bcd-8791-00db118d9ba0',
  garments_technology_p3: '3c09b2b2-10bd-4e1e-a51d-661d013948bc',
  textile_management_p3: 'ddedfe3c-fe07-4167-b56f-656c9fb89f5e',
  yarn_technology_p3: 'e512054c-240f-461d-9ccd-e6cc5c9e6411',
  merchandising_p3: '8b81a645-306d-4cc1-962a-ab597d640fe5',
  apparel_management_p2: '44444444-4444-4444-4444-444444444444',
  dyeing_finishing_p2: '9e3b3072-3153-414d-b2d7-1bf0789002ac',
  fabric_manufacturing_p2: '22222222-2222-2222-2222-222222222222',
  yarn_p2: '11111111-1111-1111-1111-111111111111',
  spinning_p4: '9dc3ade3-26ea-41fa-a83f-95a7440889b8',
  weaving_p4: '4b495e60-fc2b-4165-a0c7-e0b144e931f7',
  knitting_p4: '0a50ae12-e000-4b92-a5e9-3735064814d2',
  wet_processing_p4: '33333333-3333-3333-3333-333333333333',
  quality_control_p4: '969f50f3-57d6-4bcd-8791-00db118d9ba0',
  garments_technology_p4: '3c09b2b2-10bd-4e1e-a51d-661d013948bc',
  textile_management_p4: 'ddedfe3c-fe07-4167-b56f-656c9fb89f5e',
  yarn_technology_p4: 'e512054c-240f-461d-9ccd-e6cc5c9e6411',
  merchandising_p4: '8b81a645-306d-4cc1-962a-ab597d640fe5',
  spinning_p5: '9dc3ade3-26ea-41fa-a83f-95a7440889b8',
  weaving_p5: '4b495e60-fc2b-4165-a0c7-e0b144e931f7',
  knitting_p5: '0a50ae12-e000-4b92-a5e9-3735064814d2',
  wet_processing_p5: '33333333-3333-3333-3333-333333333333',
  quality_control_p5: '969f50f3-57d6-4bcd-8791-00db118d9ba0',
  garments_technology_p5: '3c09b2b2-10bd-4e1e-a51d-661d013948bc',
  textile_management_p5: 'ddedfe3c-fe07-4167-b56f-656c9fb89f5e',
  yarn_technology_p5: 'e512054c-240f-461d-9ccd-e6cc5c9e6411',
  merchandising_p5: '8b81a645-306d-4cc1-962a-ab597d640fe5',
  yarn_p3: '11111111-1111-1111-1111-111111111111',
  fabric_manufacturing_p3: '22222222-2222-2222-2222-222222222222',
  dyeing_finishing_p3: '9e3b3072-3153-414d-b2d7-1bf0789002ac',
  apparel_management_p3: '44444444-4444-4444-4444-444444444444',
  yarn_p4: '11111111-1111-1111-1111-111111111111',
  fabric_manufacturing_p4: '22222222-2222-2222-2222-222222222222',
};

const key = process.argv[2];
if (!key || !SUBJECT_IDS[key]) {
  console.error('Usage: node build.cjs <' + Object.keys(SUBJECT_IDS).join('|') + '>');
  process.exit(1);
}

const existingRaw = fs.readFileSync(
  'C:\\Users\\Mahbub\\AppData\\Local\\Temp\\claude\\d--Desktop-ots-new\\3df15fab-9fd3-4460-bb5c-24283746c76f\\scratchpad\\existing_all13_clean.txt',
  'utf8'
);
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
  if (q.difficulty !== 'advanced') errors.push(`[${i}] this round must be difficulty='advanced' only: ${q.q}`);
  if (!q.exp || q.exp.length < 15) errors.push(`[${i}] explanation missing/too short: ${q.q}`);
  if (q.exp && !q.exp.includes(q.correct.slice(0, Math.min(20, q.correct.length)))) {
    // soft check only (not pushed to errors): explanation should reference the answer
  }

  const points = 3;
  rows.push({ ...q, points });
});

if (errors.length) {
  console.error(`${errors.length} VALIDATION ERRORS:\n` + errors.join('\n'));
  process.exit(1);
}

console.log(`${key}: ${rows.length} questions validated OK (all advanced).`);

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
