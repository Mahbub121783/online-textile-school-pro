// Ported from supabase/functions/workshop-reminder-cron/index.ts (Deno -> Node).
// Intended to be hit by a cPanel Cron Job every ~10-15 min; also supports
// manual invocation with { workshop_id } from the admin panel.
const { serviceQuery } = require('../db');
const { sendSmtpEmail } = require('./sendSmtpEmail');

function fmtDhakaDateTime(startAtIso, endTimeStr) {
  const d = new Date(startAtIso);
  const dateStr = d.toLocaleString('en-US', {
    timeZone: 'Asia/Dhaka', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
  });
  return endTimeStr ? `${dateStr} (ends ${String(endTimeStr).slice(0, 5)})` : dateStr;
}

async function sendEmailFireAndForget(body) {
  const fakeReq = { body };
  const fakeRes = { json: () => {}, status: () => fakeRes };
  try {
    await sendSmtpEmail(fakeReq, fakeRes);
    return true;
  } catch (e) {
    console.warn('workshop reminder email failed:', e.message);
    return false;
  }
}

async function workshopReminderCron(req, res) {
  let forcedWorkshopId = null;
  if (req.method === 'POST' && req.body?.workshop_id && typeof req.body.workshop_id === 'string') {
    forcedWorkshopId = req.body.workshop_id;
  }

  let workshops;
  try {
    if (forcedWorkshopId) {
      const r = await serviceQuery(
        'SELECT id, title, slug, start_at, end_at, end_time, meet_link, reminder_sent_at, status FROM public.workshops WHERE id = $1 AND meet_link IS NOT NULL',
        [forcedWorkshopId]
      );
      workshops = r.rows;
    } else {
      const now = new Date();
      const in40min = new Date(now.getTime() + 40 * 60 * 1000);
      const r = await serviceQuery(
        `SELECT id, title, slug, start_at, end_at, end_time, meet_link, reminder_sent_at, status FROM public.workshops
         WHERE meet_link IS NOT NULL AND start_at >= $1 AND start_at <= $2 AND reminder_sent_at IS NULL AND status IN ('published','ongoing')`,
        [now.toISOString(), in40min.toISOString()]
      );
      workshops = r.rows;
    }
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }

  const results = [];

  for (const ws of workshops) {
    if (!ws.meet_link || !ws.start_at) continue;

    const regsRes = await serviceQuery(
      "SELECT email, full_name, user_id FROM public.workshop_registrations WHERE workshop_id = $1 AND status = 'registered'",
      [ws.id]
    );
    const regs = regsRes.rows;

    const startTime = fmtDhakaDateTime(ws.start_at, ws.end_time);
    let sent = 0;
    let failed = 0;

    await Promise.all(regs.map(async (r) => {
      if (!r.email) return;
      const ok = await sendEmailFireAndForget({
        templateKey: 'workshop_live_link',
        recipientEmail: r.email,
        placeholders: { user_name: r.full_name || 'Student', workshop_title: ws.title, start_time: startTime, meet_link: ws.meet_link },
      });
      if (ok) sent++; else failed++;
    }));

    if (sent > 0 || regs.length === 0) {
      await serviceQuery('UPDATE public.workshops SET reminder_sent_at = now() WHERE id = $1', [ws.id]);
    }

    try {
      const withUser = regs.filter((u) => u.user_id);
      if (withUser.length) {
        const values = [];
        const params = [];
        withUser.forEach((u, i) => {
          const base = i * 5;
          values.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`);
          params.push(u.user_id, 'workshop', `Workshop starting soon: ${ws.title}`, `Join the live session at ${startTime}. Tap to open the Meet link.`, ws.meet_link);
        });
        await serviceQuery(
          `INSERT INTO public.notifications (user_id, type, title, message, link) VALUES ${values.join(',')}`,
          params
        );
      }
    } catch (e) { /* non-critical */ }

    results.push({ workshop_id: ws.id, title: ws.title, total: regs.length, sent, failed });
  }

  res.json({ ok: true, processed: results.length, results });
}

module.exports = { workshopReminderCron };
