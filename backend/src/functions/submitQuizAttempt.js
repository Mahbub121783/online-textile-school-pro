// New feature: authoritative server-side quiz scoring. QuizPlayer.tsx used
// to compute score/percentage/passed client-side and insert the result
// directly, which the old RLS policy allowed with any submitted values --
// a student could fabricate a passing score (also undermining certificate
// auto-issuance, which checks quiz_attempts for gradebook_pass templates).
// db/18 locked quiz_attempts INSERT down to service_role only; this
// endpoint is now the sole path that can create an attempt row. Uses
// serviceQuery throughout (RLS bypass), so it must replicate the
// enrollment/entitlement check the client-side fetch used to get for free
// from RLS, and also enforces max_attempts (previously cosmetic-only).
const jwt = require('jsonwebtoken');
const { serviceQuery } = require('../db');

function requireUser(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return null;
  try {
    return jwt.verify(token, process.env.JWT_SECRET).sub;
  } catch {
    return null;
  }
}

function normalizeSet(str) {
  return (str || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .sort();
}

function scoreQuestion(question, rawUserAnswer) {
  if (question.is_instruction) return { points: 0, earned: 0, correct: true };
  const points = Number(question.points) || 1;
  const negMarks = Number(question.negative_marks) || 0;
  const userAns = (rawUserAnswer || '').trim().toLowerCase();
  const correctAns = (question.correct_answer || '').trim().toLowerCase();

  let correct;
  if (question.question_type === 'sequence') {
    const seqItems = Array.isArray(question.sequence_items) ? question.sequence_items.map((s) => String(s).toLowerCase()) : [];
    const userSeq = userAns ? userAns.split('|||') : [];
    correct = userSeq.length > 0 && JSON.stringify(userSeq) === JSON.stringify(seqItems);
  } else if (question.question_type === 'checkbox') {
    const userSet = normalizeSet(rawUserAnswer);
    const correctSet = normalizeSet(question.correct_answer);
    correct = userSet.length > 0 && JSON.stringify(userSet) === JSON.stringify(correctSet);
  } else {
    correct = !!userAns && userAns === correctAns;
  }

  if (correct) return { points, earned: points, correct: true };
  if (userAns && negMarks > 0) return { points, earned: -negMarks, correct: false };
  return { points, earned: 0, correct: false };
}

async function submitQuizAttempt(req, res) {
  try {
    const userId = requireUser(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { quiz_id, answers, time_spent_seconds } = req.body || {};
    if (!quiz_id || typeof answers !== 'object' || answers === null) {
      return res.status(400).json({ error: 'quiz_id and answers are required' });
    }

    const quizRes = await serviceQuery('SELECT * FROM public.quizzes WHERE id = $1', [quiz_id]);
    const quiz = quizRes.rows[0];
    if (!quiz) return res.status(404).json({ error: 'Quiz not found' });

    // Replicate the entitlement check RLS would otherwise apply for a
    // direct client read (independent quiz, enrolled student, or staff).
    if (quiz.course_id) {
      const staffRes = await serviceQuery(
        "SELECT public.has_role($1,'admin') OR public.has_role($1,'super_admin') OR public.can_manage_course($2) AS is_staff",
        [userId, quiz.course_id]
      );
      if (!staffRes.rows[0]?.is_staff) {
        const enrollRes = await serviceQuery(
          'SELECT 1 FROM public.enrollments WHERE course_id = $1 AND user_id = $2 LIMIT 1',
          [quiz.course_id, userId]
        );
        if (enrollRes.rows.length === 0) return res.status(403).json({ error: 'Not entitled to take this quiz' });
      }
    }

    if (quiz.max_attempts) {
      const countRes = await serviceQuery(
        'SELECT count(*) FROM public.quiz_attempts WHERE quiz_id = $1 AND user_id = $2 AND completed_at IS NOT NULL',
        [quiz_id, userId]
      );
      if (parseInt(countRes.rows[0].count, 10) >= quiz.max_attempts) {
        return res.status(403).json({ error: `Maximum attempts (${quiz.max_attempts}) reached for this quiz` });
      }
    }

    const questionsRes = await serviceQuery('SELECT * FROM public.quiz_questions WHERE quiz_id = $1 ORDER BY sort_order', [quiz_id]);
    const questions = questionsRes.rows;
    if (questions.length === 0) return res.status(400).json({ error: 'This quiz has no questions' });

    let score = 0;
    let totalPoints = 0;
    const perQuestion = [];
    for (const q of questions) {
      const result = scoreQuestion(q, answers[q.id]);
      if (!q.is_instruction) {
        totalPoints += result.points;
        score += result.earned;
      }
      perQuestion.push({ question_id: q.id, is_correct: result.correct });
    }
    score = Math.max(0, score);
    const percentage = totalPoints > 0 ? Math.round((score / totalPoints) * 100) : 0;
    const passed = percentage >= (quiz.pass_percentage || 60);

    const insertRes = await serviceQuery(
      `INSERT INTO public.quiz_attempts (quiz_id, user_id, answers, score, total_points, percentage, passed, completed_at, time_spent_seconds)
       VALUES ($1, $2, $3, $4, $5, $6, $7, now(), $8)
       RETURNING *`,
      [quiz_id, userId, JSON.stringify(answers), score, totalPoints, percentage, passed, time_spent_seconds || null]
    );

    res.json({ ...insertRes.rows[0], per_question: perQuestion });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

module.exports = { submitQuizAttempt };
