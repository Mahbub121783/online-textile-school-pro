// Ported from supabase/functions/unreplied-message-reminder/index.ts (Deno -> Node).
// Intended to be hit by a cPanel Cron Job every ~5 minutes.
const { serviceQuery } = require('../db');
const { sendSmtpEmail } = require('./sendSmtpEmail');

function buildReminderEmail(senderName, preview) {
  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
      <div style="background:#0ea5e9;color:#fff;padding:16px 24px;border-radius:8px 8px 0 0;">
        <h2 style="margin:0;font-size:18px;">💬 You have an unreplied message</h2>
      </div>
      <div style="background:#f8fafc;padding:24px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;">
        <p style="color:#334155;font-size:14px;line-height:1.6;margin:0 0 8px;">
          <strong>${senderName}</strong> sent you a message over 5 minutes ago that you haven't replied to yet:
        </p>
        <blockquote style="background:#fff;border-left:4px solid #0ea5e9;padding:12px 16px;margin:16px 0;border-radius:0 6px 6px 0;">
          <p style="color:#475569;font-size:14px;margin:0;font-style:italic;">"${preview}"</p>
        </blockquote>
        <a href="https://www.onlinetextileschool.com/dashboard/chat" style="display:inline-block;background:#0ea5e9;color:#fff;padding:10px 24px;border-radius:6px;text-decoration:none;font-size:14px;margin-top:8px;">Reply Now</a>
      </div>
      <p style="color:#94a3b8;font-size:11px;text-align:center;margin-top:16px;">Online Textile School — Chat Reminder</p>
    </div>
  `;
}

async function unrepliedMessageReminder(req, res) {
  try {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    const msgsRes = await serviceQuery(
      `SELECT id, sender_id, receiver_id, message, created_at FROM public.chat_messages
       WHERE created_at < $1 AND created_at > $2 AND deleted_at IS NULL ORDER BY created_at DESC`,
      [fiveMinutesAgo, tenMinutesAgo]
    );
    const unrepliedMessages = msgsRes.rows;

    if (unrepliedMessages.length === 0) return res.json({ processed: 0 });

    const receiverMap = new Map();

    for (const msg of unrepliedMessages) {
      const countRes = await serviceQuery(
        `SELECT count(*) FROM public.chat_messages WHERE sender_id = $1 AND receiver_id = $2 AND created_at > $3 AND deleted_at IS NULL`,
        [msg.receiver_id, msg.sender_id, msg.created_at]
      );
      const count = Number(countRes.rows[0].count);
      if (count === 0 && !receiverMap.has(msg.receiver_id)) {
        receiverMap.set(msg.receiver_id, { senderId: msg.sender_id, message: msg.message, createdAt: msg.created_at });
      }
    }

    let sentCount = 0;

    for (const [receiverId, info] of receiverMap) {
      const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      const existingRes = await serviceQuery(
        `SELECT count(*) FROM public.notifications WHERE user_id = $1 AND type = 'unreplied_message' AND created_at > $2`,
        [receiverId, thirtyMinAgo]
      );
      if (Number(existingRes.rows[0].count) > 0) continue;

      const senderRes = await serviceQuery('SELECT full_name FROM public.user_profiles WHERE id = $1', [info.senderId]);
      const senderName = senderRes.rows[0]?.full_name || 'Someone';
      const preview = info.message.length > 80 ? info.message.slice(0, 80) + '…' : info.message;

      await serviceQuery(
        `INSERT INTO public.notifications (user_id, type, title, message, link, metadata) VALUES ($1, $2, $3, $4, $5, $6)`,
        [receiverId, 'unreplied_message', `💬 Unreplied message from ${senderName}`, `You have an unreplied message: "${preview}"`, '/dashboard/chat', JSON.stringify({ sender_id: info.senderId })]
      );

      try {
        const emailReqRes = await serviceQuery(
          `SELECT requested_email FROM public.institutional_email_requests WHERE user_id = $1 AND status = 'approved' LIMIT 1`,
          [receiverId]
        );
        const recipientEmail = emailReqRes.rows[0]?.requested_email;

        if (recipientEmail) {
          const unsubRes = await serviceQuery(
            `SELECT count(*) FROM public.email_unsubscribes WHERE email = $1 AND unsubscribed_at IS NOT NULL`,
            [recipientEmail]
          );
          if (Number(unsubRes.rows[0].count) === 0) {
            const fakeReq = {
              body: {
                recipientEmail,
                subject: `💬 Unreplied message from ${senderName}`,
                body: buildReminderEmail(senderName, preview),
                metadata: { notification_type: 'unreplied_message', user_id: receiverId },
              },
            };
            const fakeRes = { json: () => {}, status: () => fakeRes };
            await sendSmtpEmail(fakeReq, fakeRes);
          }
        }
      } catch (emailErr) {
        console.error('Failed to send reminder email:', emailErr.message);
      }

      sentCount++;
    }

    res.json({ processed: unrepliedMessages.length, sent: sentCount });
  } catch (err) {
    console.error('Unreplied message reminder error:', err);
    res.status(500).json({ error: String(err.message || err) });
  }
}

module.exports = { unrepliedMessageReminder };
