// Blood bank heartbeat, hit by a cPanel cron every 5 minutes:
// 1) blood_escalate_requests() expires stale requests and alerts the next
//    batch of donors for requests still short of donors (sooner for
//    critical ones) -- see db/97-blood-bank.sql.
// 2) Emails every donor alert that hasn't been emailed yet. In-app
//    notifications are written instantly by the SQL dispatch; email can't be
//    sent from SQL here (no pg_net), so it's queued via emailed_at instead.
const { serviceQuery } = require('../db');
const { sendSmtpEmail } = require('./sendSmtpEmail');

const SITE = 'https://www.onlinetextileschool.com';
const MAX_EMAILS_PER_RUN = 60;

async function sendEmail(body) {
  let failed = false;
  const fakeRes = { json: () => {}, status: (code) => { if (code >= 400) failed = true; return fakeRes; } };
  try {
    await sendSmtpEmail({ body }, fakeRes);
    return !failed;
  } catch (e) {
    console.warn('blood bank alert email failed:', e.message);
    return false;
  }
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function bloodBankCron(req, res) {
  const secret = req.headers['x-cron-secret'] || req.query.secret;
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  try {
    const esc = await serviceQuery('SELECT public.blood_escalate_requests() AS result');

    const queue = await serviceQuery(
      `SELECT x.id, x.distance_km, r.id AS request_id, r.blood_group, r.units, r.hospital, r.urgency, r.needed_by,
              d.blood_group AS donor_group, u.email, up.full_name
         FROM public.blood_request_responses x
         JOIN public.blood_requests r ON r.id = x.request_id
         JOIN public.blood_donors d ON d.id = x.donor_id
         JOIN public.user_profiles up ON up.id = d.user_id
         JOIN auth.users u ON u.id = d.user_id
        WHERE x.emailed_at IS NULL AND x.status = 'notified' AND x.round > 0
          AND x.notified_at > now() - interval '2 hours' AND r.status = 'approved'
        ORDER BY CASE r.urgency WHEN 'critical' THEN 0 WHEN 'urgent' THEN 1 ELSE 2 END, x.notified_at
        LIMIT $1`,
      [MAX_EMAILS_PER_RUN]
    );

    let emailed = 0;
    for (const row of queue.rows) {
      const km = row.distance_km != null ? `${Number(row.distance_km).toFixed(1)} km from you` : 'near you';
      const link = `${SITE}/dashboard/blood-bank?tab=nearby&request=${row.request_id}`;
      const critical = row.urgency === 'critical';
      const ok = await sendEmail({
        recipientEmail: row.email,
        subject: `${critical ? '🚨 CRITICAL: ' : '🩸 '}${row.blood_group} blood needed ${km}`,
        body: `
          <p>Dear ${escapeHtml(row.full_name || 'donor')},</p>
          <p>${critical ? '<strong>This is a critical request.</strong> ' : ''}A patient needs
             <strong>${escapeHtml(row.units)} bag(s) of ${escapeHtml(row.blood_group)}</strong> blood at
             <strong>${escapeHtml(row.hospital)}</strong>, ${escapeHtml(km)}. Your ${escapeHtml(row.donor_group)} blood is compatible.</p>
          ${row.needed_by ? `<p>Needed by: ${escapeHtml(new Date(row.needed_by).toLocaleString('en-GB', { timeZone: 'Asia/Dhaka' }))}</p>` : ''}
          <p><a href="${link}" style="display:inline-block;padding:12px 22px;background:#c0392b;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold">Accept or decline</a></p>
          <p style="color:#666;font-size:13px">The patient's contact number is shared with you as soon as you accept.
             Not available right now? You can switch your availability off from the Blood Bank page.</p>`,
        metadata: { kind: 'blood_bank_alert', request_id: row.request_id },
      });
      // Marked even on failure so a broken mailbox can't retry-loop every
      // 5 minutes; the in-app notification was already delivered.
      await serviceQuery('UPDATE public.blood_request_responses SET emailed_at = now() WHERE id = $1', [row.id]);
      if (ok) emailed++;
    }

    res.json({ ok: true, escalation: esc.rows[0]?.result, emailed, queued: queue.rows.length });
  } catch (e) {
    console.error('bloodBankCron error:', e);
    res.status(500).json({ error: e.message });
  }
}

module.exports = { bloodBankCron };
