// Central email + mobile-push fan-out for every row inserted into
// public.notifications. Rather than teaching each of the ~20 call sites
// across the app (order events, approvals, new messages, certificates...)
// to separately integrate with SMTP and web-push, this hooks into the one
// choke point they already all go through: db/49's trigger already fires
// pg_notify('ots_realtime', ...) on every notifications INSERT (for the
// real-time bell icon), and db/59 widened that payload to carry enough
// (title/message/link/type) to also build an email and a push payload from
// it directly, with no extra DB round trip. realtime.js's existing LISTEN
// handler calls fanOutNotification() below for every such event.
const webpush = require('web-push');
const { serviceQuery } = require('./db');
const { sendSmtpEmail } = require('./functions/sendSmtpEmail');

const VAPID_PUBLIC = 'BJdE7YoRjgxTFKdSwatdxWNKLCXIiy6SSxV9cF_GOSgzF4mVZ9T25XLbGXjMfd8i34-t0yPq64eKxKWpBlrU8js';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@onlinetextileschool.com';
if (VAPID_PRIVATE) webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

const SITE_URL = process.env.FRONTEND_URL || 'https://onlinetextileschool.com';

async function sendEmailFireAndForget(body) {
  const fakeReq = { body };
  const fakeRes = { json: () => {}, status: () => fakeRes };
  try { await sendSmtpEmail(fakeReq, fakeRes); } catch (e) { console.warn('[notify] email failed:', e.message); }
}

// notification_preferences only has a handful of specific category columns
// (workshop_reminders, class_reminders, live_class_alerts, assignment_due,
// new_messages, marketing) -- gate push by one of those when the
// notification's free-text `type` clearly maps to it, and leave everything
// else (orders, approvals, wallet, certificates -- all transactional)
// ungated, matching how push.js's admin pushSend already treats `category`.
function typeToPreferenceCategory(type) {
  if (!type) return null;
  const t = String(type).toLowerCase();
  if (t.includes('workshop')) return 'workshop_reminders';
  if (t.includes('live_class')) return 'live_class_alerts';
  if (t.includes('class_reminder')) return 'class_reminders';
  if (t.includes('assignment')) return 'assignment_due';
  if (t.includes('message') || t.includes('chat')) return 'new_messages';
  return null;
}

async function sendPushToUser(userId, payload, category) {
  if (!VAPID_PRIVATE) return;
  try {
    if (category) {
      const pref = await serviceQuery(
        `SELECT ${category} AS pref FROM public.notification_preferences WHERE user_id = $1`,
        [userId]
      );
      if (pref.rows[0]?.pref === false) return;
    }

    const subsRes = await serviceQuery(
      'SELECT id, endpoint, p256dh, auth FROM public.push_subscriptions WHERE user_id = $1',
      [userId]
    );
    if (subsRes.rows.length === 0) return;

    const stalePruneIds = [];
    await Promise.all(subsRes.rows.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload));
      } catch (err) {
        if (err?.statusCode === 404 || err?.statusCode === 410) stalePruneIds.push(s.id);
      }
    }));
    if (stalePruneIds.length) {
      await serviceQuery('DELETE FROM public.push_subscriptions WHERE id = ANY($1)', [stalePruneIds]);
    }
  } catch (e) {
    console.warn('[notify] push failed:', e.message);
  }
}

// Called from realtime.js for every 'notification' event on the
// ots_realtime channel. `already_emailed` lets a caller that already sent
// its own well-crafted transactional email (e.g. processPayment.js's
// payment_received/enrollment_confirmation templates) opt the generic
// email out for that one row while still getting push + the in-app row --
// set it via metadata: { already_emailed: true } on the notifications insert.
async function fanOutNotification({ user_id, type, title, message, link, already_emailed }) {
  if (!user_id) return;
  try {
    const userRes = await serviceQuery(
      `SELECT au.email, COALESCE(up.full_name, 'there') AS full_name
       FROM auth.users au LEFT JOIN public.user_profiles up ON up.id = au.id
       WHERE au.id = $1`,
      [user_id]
    );
    const u = userRes.rows[0];
    if (!u) return;

    const actionUrl = link ? `${SITE_URL}${link.startsWith('/') ? '' : '/'}${link}` : SITE_URL;

    if (u.email && !already_emailed) {
      sendEmailFireAndForget({
        templateKey: 'push_notification',
        recipientEmail: u.email,
        placeholders: {
          notification_title: title,
          user_name: u.full_name,
          notification_body: message,
          action_url: actionUrl,
        },
        metadata: { notification_type: type },
      });
    }

    sendPushToUser(user_id, { title, body: message, url: actionUrl, tag: type }, typeToPreferenceCategory(type));
  } catch (e) {
    console.warn('[notify] fanOutNotification failed:', e.message);
  }
}

module.exports = { fanOutNotification, sendPushToUser, sendEmailFireAndForget };
