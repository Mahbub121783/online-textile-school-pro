// Ported from supabase/functions/edumail-client/index.ts (Deno -> Node).
// Uses serviceQuery() throughout (matching the original's service-role admin
// client, which bypassed RLS) -- db/13 added the service_role policies this
// relies on for institutional_email_requests/edumail_messages/edumail_contacts.
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
const { serviceQuery } = require('../db');
const { sendSmtpEmail } = require('./sendSmtpEmail');

async function sendViaUserSmtp(fromEmail, password, to, cc, bcc, subject, bodyHtml) {
  try {
    const transporter = nodemailer.createTransport({
      host: 'mail.onlinetextileschool.com',
      port: 465,
      secure: true,
      auth: { user: fromEmail, pass: password },
    });
    await transporter.sendMail({
      from: fromEmail,
      to: to.join(', '),
      cc: cc.length ? cc.join(', ') : undefined,
      bcc: bcc.length ? bcc.join(', ') : undefined,
      subject: subject || '(No Subject)',
      html: bodyHtml || '',
    });
    return true;
  } catch (err) {
    console.error('User SMTP send failed:', err.message);
    return false;
  }
}

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

async function edumailClient(req, res) {
  try {
    const userId = requireUser(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { action, ...params } = req.body || {};

    const emailReqRes = await serviceQuery(
      `SELECT * FROM public.institutional_email_requests WHERE user_id = $1 AND status = 'approved' LIMIT 1`,
      [userId]
    );
    const emailReq = emailReqRes.rows[0];

    if (!emailReq && action !== 'check-status') {
      return res.status(400).json({ error: 'No active institutional email' });
    }

    if (action === 'send-message') {
      const { to, cc, bcc, subject, body_html, attachments = [] } = params;
      const toEmails = (to || '').split(',').map((e) => e.trim()).filter(Boolean);
      const ccEmails = cc ? cc.split(',').map((e) => e.trim()).filter(Boolean) : [];
      const bccEmails = bcc ? bcc.split(',').map((e) => e.trim()).filter(Boolean) : [];

      const userPassword = emailReq.current_password;
      let sentOk = false;
      if (userPassword) {
        sentOk = await sendViaUserSmtp(emailReq.requested_email, userPassword, toEmails, ccEmails, bccEmails, subject || '', body_html || '');
      }

      if (!sentOk) {
        console.log('Falling back to platform SMTP with from_override');
        try {
          const fakeReq = {
            body: {
              recipientEmail: toEmails[0],
              subject,
              body: body_html,
              metadata: { from_override: emailReq.requested_email, cc: ccEmails, bcc: bccEmails, source: 'edumail' },
            },
          };
          const fakeRes = { json: () => {}, status: () => fakeRes };
          await sendSmtpEmail(fakeReq, fakeRes);
          sentOk = true;
        } catch (fallbackErr) {
          console.error('Fallback SMTP also failed:', fallbackErr.message);
        }
      }

      const sentAt = new Date().toISOString();
      const bodyText = (body_html || '').replace(/<[^>]*>/g, '');
      const sentMsgRes = await serviceQuery(
        `INSERT INTO public.edumail_messages
          (owner_id, folder, from_email, to_emails, cc_emails, bcc_emails, subject, body_html, body_text, is_read, has_attachments, attachments, sent_at)
         VALUES ($1, 'sent', $2, $3, $4, $5, $6, $7, $8, true, $9, $10, $11)
         RETURNING id`,
        [userId, emailReq.requested_email, toEmails, ccEmails, bccEmails, subject || '', body_html || '', bodyText, attachments.length > 0, JSON.stringify(attachments), sentAt]
      );
      const sentMsgId = sentMsgRes.rows[0].id;

      for (const recipientEmail of toEmails) {
        const recipientReqRes = await serviceQuery(
          `SELECT user_id FROM public.institutional_email_requests WHERE requested_email = $1 AND status = 'approved' LIMIT 1`,
          [recipientEmail]
        );
        const recipientReq = recipientReqRes.rows[0];
        if (recipientReq) {
          await serviceQuery(
            `INSERT INTO public.edumail_messages
              (owner_id, folder, from_email, to_emails, cc_emails, subject, body_html, body_text, is_read, has_attachments, attachments, sent_at, thread_id)
             VALUES ($1, 'inbox', $2, $3, $4, $5, $6, $7, false, $8, $9, $10, $11)`,
            [recipientReq.user_id, emailReq.requested_email, toEmails, ccEmails, subject || '', body_html || '', bodyText, attachments.length > 0, JSON.stringify(attachments), sentAt, sentMsgId]
          );
        }
      }

      for (const email of [...toEmails, ...ccEmails]) {
        await serviceQuery(
          `INSERT INTO public.edumail_contacts (user_id, email, display_name)
           VALUES ($1, $2, $3)
           ON CONFLICT (user_id, email) DO NOTHING`,
          [userId, email, email.split('@')[0]]
        );
      }

      return res.json({ success: true, sent_direct: sentOk });
    }

    if (action === 'recall-message') {
      const { message_id } = params;
      const msgRes = await serviceQuery(
        `SELECT * FROM public.edumail_messages WHERE id = $1 AND owner_id = $2 AND folder = 'sent'`,
        [message_id, userId]
      );
      const msg = msgRes.rows[0];
      if (!msg) return res.status(500).json({ error: 'Message not found' });

      const sentTime = new Date(msg.sent_at).getTime();
      if (Date.now() - sentTime > 5 * 60 * 1000) {
        return res.status(500).json({ error: 'Recall window expired (5 minutes)' });
      }

      await serviceQuery(`UPDATE public.edumail_messages SET recalled_at = now() WHERE id = $1`, [message_id]);

      const toEmails = msg.to_emails || [];
      for (const recipientEmail of toEmails) {
        if (recipientEmail.endsWith('@onlinetextileschool.com')) {
          const recipientReqRes = await serviceQuery(
            `SELECT user_id FROM public.institutional_email_requests WHERE requested_email = $1 AND status = 'approved' LIMIT 1`,
            [recipientEmail]
          );
          const recipientReq = recipientReqRes.rows[0];
          if (recipientReq) {
            await serviceQuery(
              `UPDATE public.edumail_messages
               SET recalled_at = now(), folder = 'trash'
               WHERE owner_id = $1 AND from_email = $2 AND subject = $3 AND recalled_at IS NULL`,
              [recipientReq.user_id, emailReq.requested_email, msg.subject]
            );
          }
        }
      }

      return res.json({ success: true });
    }

    if (action === 'check-status') {
      return res.json({
        has_email: !!emailReq,
        email: emailReq?.requested_email,
        status: emailReq?.status,
      });
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { edumailClient };
