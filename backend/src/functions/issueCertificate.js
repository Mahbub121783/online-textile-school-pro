// New: server-side certificate auto-issuance. useEnrollments.ts's
// autoIssueCertificate() used to insert into `certificates` directly under
// the STUDENT's own session -- but that table's INSERT policy has always
// correctly required service_role/admin/instructor/super_admin, so this
// silently failed (error swallowed by console.error) for every student on
// every course completion. Ported the exact same eligibility logic here,
// running under serviceQuery so it can actually issue -- while still
// verifying completion/score server-side so a student can't call this to
// forge a certificate they haven't earned.
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

async function issueCertificate(req, res) {
  try {
    const userId = requireUser(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { course_id: courseId } = req.body || {};
    if (!courseId) return res.status(400).json({ error: 'course_id is required' });

    const existingRes = await serviceQuery('SELECT id FROM public.certificates WHERE user_id = $1 AND course_id = $2', [userId, courseId]);
    if (existingRes.rows.length > 0) return res.json({ already_issued: true, certificate: existingRes.rows[0] });

    const enrollRes = await serviceQuery('SELECT progress_pct FROM public.enrollments WHERE user_id = $1 AND course_id = $2', [userId, courseId]);
    const enrollment = enrollRes.rows[0];
    if (!enrollment || (enrollment.progress_pct || 0) < 100) {
      return res.status(400).json({ error: 'Course not yet completed' });
    }

    const courseRes = await serviceQuery('SELECT id, title, cert_template_id FROM public.courses WHERE id = $1', [courseId]);
    const course = courseRes.rows[0];
    if (!course) return res.status(404).json({ error: 'Course not found' });

    let scorePercentage = null;
    let templateSnapshot = null;

    if (course.cert_template_id) {
      const tmplRes = await serviceQuery('SELECT * FROM public.certificate_templates WHERE id = $1', [course.cert_template_id]);
      const template = tmplRes.rows[0];
      templateSnapshot = template || null;

      if (template?.download_rule === 'gradebook_pass') {
        const quizzesRes = await serviceQuery(
          'SELECT id, pass_percentage FROM public.quizzes WHERE course_id = $1 AND is_published = true',
          [courseId]
        );
        const quizzes = quizzesRes.rows;
        if (quizzes.length > 0) {
          const attemptsRes = await serviceQuery(
            `SELECT quiz_id, percentage FROM public.quiz_attempts WHERE user_id = $1 AND quiz_id = ANY($2) ORDER BY percentage DESC`,
            [userId, quizzes.map((q) => q.id)]
          );
          const bestScores = new Map();
          for (const a of attemptsRes.rows) {
            if (!bestScores.has(a.quiz_id) || Number(a.percentage) > bestScores.get(a.quiz_id)) {
              bestScores.set(a.quiz_id, Number(a.percentage) || 0);
            }
          }
          const avgScore = quizzes.reduce((sum, q) => sum + (bestScores.get(q.id) || 0), 0) / quizzes.length;
          scorePercentage = Math.round(avgScore);
          const minScore = template.min_score_pct ?? 60;
          if (avgScore < minScore) {
            return res.status(400).json({ error: `Not eligible yet -- average quiz score ${scorePercentage}% is below the required ${minScore}%` });
          }
        }
      }
    }

    const certNumber = `CERT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    const insertRes = await serviceQuery(
      `INSERT INTO public.certificates (user_id, course_id, certificate_number, score_percentage, template_snapshot, issued_at)
       VALUES ($1, $2, $3, $4, $5, now())
       ON CONFLICT (user_id, course_id) WHERE course_id IS NOT NULL DO NOTHING
       RETURNING *`,
      [userId, courseId, certNumber, scorePercentage, JSON.stringify(templateSnapshot || {})]
    );

    if (insertRes.rows.length === 0) {
      // Lost a race to a concurrent request; fetch the winner's row instead.
      const raceRes = await serviceQuery('SELECT * FROM public.certificates WHERE user_id = $1 AND course_id = $2', [userId, courseId]);
      return res.json({ already_issued: true, certificate: raceRes.rows[0] });
    }

    await serviceQuery(
      `INSERT INTO public.notifications (user_id, type, title, message, link)
       VALUES ($1, 'certificate', '🎉 Certificate Earned!', $2, '/dashboard/certificates')`,
      [userId, `Congratulations! You earned a certificate for completing "${course.title}".`]
    );

    res.json({ already_issued: false, certificate: insertRes.rows[0] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

module.exports = { issueCertificate };
