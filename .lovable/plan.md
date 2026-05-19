# Add 800 Practice Questions Across 4 New Departments

## Target departments (already exist as empty `qb_subjects`)

| Subject | Slug | Questions |
|---|---|---|
| Spinning | `spinning` | 200 |
| Weaving | `weaving` | 200 |
| Knitting | `knitting` | 200 |
| Garments Technology | `garments-technology` | 200 |

**Total: 800 MCQs** added to the existing `qb_questions` table — Practice Arena (Mixed + Department exams) will automatically pick them up since the home page already lists all `is_active` subjects.

## Difficulty distribution (per subject, balanced)

- **Basic — 80 questions (40%)**: definitions, terminology, fundamental facts
- **Intermediate — 80 questions (40%)**: applied calculations, process selection, troubleshooting
- **Advanced — 40 questions (20%)**: analytical, multi-step problems, standards & specs

→ 200 questions × 4 subjects = **800 total**.

## Question structure

Each row in `qb_questions`:

```
subject_id      → uuid of target subject
question_text   → English MCQ stem
question_type   → 'mcq'
options         → jsonb array of 4 options
correct_answer  → string matching one option
explanation     → 1-2 sentence factual rationale
points          → 1 (basic) / 2 (intermediate) / 3 (advanced)
difficulty      → 'basic' | 'intermediate' | 'advanced'
is_active       → true
```

## Content coverage per subject

**Spinning (200)**
Fiber properties, ginning, blowroom, carding, drawing, combing, roving, ring frame, rotor/OE spinning, air-jet, count systems (Ne/Nm/Tex/Denier), TPI/TM, yarn defects (Uster, neps, thick/thin), winding & clearing.

**Weaving (200)**
Warping (sectional/direct), sizing recipes & add-on, drawing-in, loom types (shuttle, projectile, rapier, air-jet, water-jet), shedding (tappet/dobby/jacquard), picking, beating, let-off/take-up, weave structures (plain, twill, satin, derivatives), fabric calculations (GSM, EPI/PPI, cover factor, crimp).

**Knitting (200)**
Weft vs warp knitting, needle types (latch/compound/bearded), single/double jersey, interlock, rib, purl, terry, fleece, warp knitting (tricot, raschel), CPI/WPI, stitch length, tightness factor, GSM, knitting faults (drop stitch, hole, barré).

**Garments Technology (200)**
Pattern making, marker efficiency, cutting (CAM, band knife), sewing machines (lockstitch, overlock, flatlock, bartack, buttonhole), SPI, seam types (ISO 4916), stitch types (ISO 4915), needle & thread selection, pressing, finishing, fusing, QC (AQL 2.5/4.0), industrial engineering (SMV, line balancing, efficiency).

## Implementation

### Single migration file

`supabase/migrations/<timestamp>_seed_4_dept_questions.sql`

Structure:

```text
-- Resolve subject ids
WITH s AS (
  SELECT id, slug FROM qb_subjects
  WHERE slug IN ('spinning','weaving','knitting','garments-technology')
)
INSERT INTO qb_questions
  (subject_id, question_text, question_type, options,
   correct_answer, explanation, points, difficulty, is_active)
VALUES
  ((SELECT id FROM s WHERE slug='spinning'),
   'In ring spinning, twist per inch (TPI) for combed cotton yarn of Ne 40 typically lies around …',
   'mcq',
   '["18","22","26","32"]'::jsonb,
   '26',
   'Standard TM for combed Ne 40 ≈ 4.0, giving TPI ≈ 4.0·√40 ≈ 25.3 (≈26).',
   2, 'intermediate', true),
  -- … 799 more rows
;
```

All 800 inserts go in ONE multi-row `INSERT` (Postgres handles this fine; file size ~600 KB). Single transaction → atomic, fast, no per-row overhead.

### Why a single seed migration (not AI generation)

- **Instant & deterministic** — no edge-function runs, no API cost, no provider failure risk.
- **Free-tier friendly** — one migration, ~800 rows on an indexed table = trivial CPU/storage.
- **Auditable** — content reviewable in the migration file before approval.
- **Reuses everything** — no schema changes, no RLS changes, no new functions.

### No schema changes required

`qb_questions` already has every column needed. RLS already allows authenticated users to read active questions and admins to insert. Existing token system, negative marking, leaderboard, and mixed-exam picker will automatically include the new questions.

## Verification after migration

1. `SELECT subject_id, difficulty, COUNT(*) FROM qb_questions GROUP BY 1,2` — confirm 80/80/40 per new subject.
2. Open `/practice` → 4 new subject cards now show "200 questions".
3. Start a Mixed exam → questions from new subjects appear.

## Out of scope

- Bengali translations (English only, matching existing 3198 questions).
- Image-based questions.
- Short-answer / true-false types (all 800 are 4-option MCQs).
- New subjects/categories — uses the 4 empty subjects already in the DB.
