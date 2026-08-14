// Two problems this closes, both found during live testing:
//
// 1. Answer leak: QuizPlayer.tsx used to fetch quiz_questions with a plain
//    REST select, which (per quiz_questions RLS) returns the full row --
//    correct_answer, explanation, and sequence_items (the correct order for
//    `sequence`-type questions) -- straight into the Network tab before the
//    student answers anything.
// 2. Timer bypass: the countdown was purely a client React state
//    (`setTimeLeft(quiz.time_limit_minutes * 60)` on mount), so refreshing
//    the page reset it to the full duration every time -- unlimited time on
//    a "timed" quiz.
//
// This endpoint is now the sole way QuizPlayer.tsx gets questions to take a
// quiz: it strips correct_answer/explanation, shuffles sequence_items per
// question, and persists a `started_at` server-side (a quiz_attempts row
// with completed_at = NULL) that a page refresh resumes from instead of
// resetting. submitQuizAttempt.js enforces the deadline against that same
// started_at.
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

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function startQuizAttempt(req, res) {
  try {
    const userId = requireUser(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { quiz_id } = req.body || {};
    if (!quiz_id) return res.status(400).json({ error: 'quiz_id is required' });

    const quizRes = await serviceQuery('SELECT * FROM public.quizzes WHERE id = $1', [quiz_id]);
    const quiz = quizRes.rows[0];
    if (!quiz) return res.status(404).json({ error: 'Quiz not found' });

    // Same entitlement check as submitQuizAttempt.js (independent quiz,
    // enrolled student, or staff).
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

    const limitMs = quiz.time_limit_minutes ? Number(quiz.time_limit_minutes) * 60 * 1000 : null;

    // Resume an in-progress attempt if one exists; expire it first if its
    // time limit has already passed (counts it toward max_attempts instead
    // of leaving it dangling forever).
    let attempt = (await serviceQuery(
      'SELECT * FROM public.quiz_attempts WHERE quiz_id = $1 AND user_id = $2 AND completed_at IS NULL ORDER BY started_at DESC LIMIT 1',
      [quiz_id, userId]
    )).rows[0];

    if (attempt && limitMs) {
      const deadline = new Date(attempt.started_at).getTime() + limitMs;
      if (Date.now() > deadline) {
        await serviceQuery(
          `UPDATE public.quiz_attempts SET completed_at = $2, score = 0, total_points = 0, percentage = 0, passed = false
           WHERE id = $1`,
          [attempt.id, new Date(deadline).toISOString()]
        );
        attempt = null;
      }
    }

    if (!attempt && quiz.max_attempts) {
      const countRes = await serviceQuery(
        'SELECT count(*) FROM public.quiz_attempts WHERE quiz_id = $1 AND user_id = $2 AND completed_at IS NOT NULL',
        [quiz_id, userId]
      );
      if (parseInt(countRes.rows[0].count, 10) >= quiz.max_attempts) {
        return res.status(403).json({ error: `Maximum attempts (${quiz.max_attempts}) reached for this quiz` });
      }
    }

    if (!attempt) {
      attempt = (await serviceQuery(
        `INSERT INTO public.quiz_attempts (quiz_id, user_id, started_at, completed_at)
         VALUES ($1, $2, now(), NULL) RETURNING *`,
        [quiz_id, userId]
      )).rows[0];
    }

    const questionsRes = await serviceQuery('SELECT * FROM public.quiz_questions WHERE quiz_id = $1 ORDER BY sort_order', [quiz_id]);
    const questions = questionsRes.rows.map((q) => ({
      id: q.id,
      quiz_id: q.quiz_id,
      question_text: q.question_text,
      question_type: q.question_type,
      options: q.options,
      sequence_items: q.question_type === 'sequence' && Array.isArray(q.sequence_items) ? shuffle(q.sequence_items) : q.sequence_items,
      points: q.points,
      timer_seconds: q.timer_seconds,
      image_url: q.image_url,
      is_instruction: q.is_instruction,
      sort_order: q.sort_order,
    }));

    res.json({
      attempt_id: attempt.id,
      started_at: attempt.started_at,
      time_limit_minutes: quiz.time_limit_minutes,
      questions,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

module.exports = { startQuizAttempt };
