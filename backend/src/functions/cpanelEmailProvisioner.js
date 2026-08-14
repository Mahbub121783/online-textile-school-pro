// Ported from supabase/functions/cpanel-email-provisioner/index.ts (Deno -> Node).
// The original always used the service-role Supabase admin client (RLS
// bypassed entirely), so this port uses serviceQuery() throughout and
// replicates the same manual authorization checks the original did in code
// (isAdmin / self-service change-password). db/13 added the missing
// service_role policy on institutional_email_requests that this relies on.
const fetch = require('node-fetch');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { serviceQuery } = require('../db');
const { sendSmtpEmail } = require('./sendSmtpEmail');

function generatePassword(length = 14) {
  const chars = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%';
  let out = '';
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) out += chars[bytes[i] % chars.length];
  return out;
}

async function cpanelRequest(endpoint) {
  const cpanelHost = process.env.CPANEL_HOSTNAME;
  const cpanelUser = process.env.CPANEL_USERNAME;
  const cpanelToken = process.env.CPANEL_API_TOKEN;
  if (!cpanelHost || !cpanelUser || !cpanelToken) {
    throw new Error('cPanel API not configured (CPANEL_HOSTNAME/CPANEL_USERNAME/CPANEL_API_TOKEN)');
  }

  const url = `https://${cpanelHost}:2083/execute/${endpoint}`;
  const resp = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `cpanel ${cpanelUser}:${cpanelToken}` },
  });
  const data = await resp.json();
  if (!resp.ok || data?.errors?.length > 0 || data?.status === 0) {
    throw new Error(data?.errors?.[0] || data?.messages?.[0] || 'cPanel API error');
  }
  return data;
}

function calculateValidity(enrollments) {
  const paidEnrollments = enrollments.filter((e) => e.payment_id);
  const now = new Date();
  const validFrom = now.toISOString();
  const count = Math.max(1, paidEnrollments.length);
  const validUntil = new Date(now);
  validUntil.setMonth(validUntil.getMonth() + count * 6);
  return { validFrom, validUntil: validUntil.toISOString() };
}

async function getUserInfo(userId) {
  const profileRes = await serviceQuery('SELECT full_name FROM public.user_profiles WHERE id = $1', [userId]);
  const authRes = await serviceQuery('SELECT email FROM auth.users WHERE id = $1', [userId]);
  return { profile: profileRes.rows[0], authEmail: authRes.rows[0]?.email };
}

async function sendEmailSafe(recipientEmail, subject, body) {
  const fakeReq = { body: { recipientEmail, subject, body } };
  const fakeRes = { json: () => {}, status: () => fakeRes };
  try {
    await sendSmtpEmail(fakeReq, fakeRes);
  } catch (_) { /* mirrors original's swallowed try/catch around email sends */ }
}

async function notifyAdmins(type, title, message, link) {
  try {
    await serviceQuery('SELECT public.notify_admins($1, $2, $3, $4)', [type, title, message, link]);
  } catch (_) { /* best-effort, matches original */ }
}

async function cpanelEmailProvisioner(req, res) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    let userId;
    try {
      userId = jwt.verify(token, process.env.JWT_SECRET).sub;
    } catch {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const roleRes = await serviceQuery(
      "SELECT public.has_role($1, 'admin') OR public.has_role($1, 'super_admin') AS is_admin",
      [userId]
    );
    const isAdmin = !!roleRes.rows[0]?.is_admin;

    const { requestId, action, adminNotes } = req.body || {};
    if (!requestId || !action) return res.status(400).json({ error: 'requestId and action required' });

    if (!isAdmin && action !== 'change-password') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const emailReqRes = await serviceQuery('SELECT * FROM public.institutional_email_requests WHERE id = $1', [requestId]);
    const emailReq = emailReqRes.rows[0];
    if (!emailReq) return res.status(404).json({ error: 'Request not found' });

    const emailParts = emailReq.requested_email.split('@');
    const localPart = emailParts[0];
    const domain = emailParts[1] || 'onlinetextileschool.com';

    if (action === 'reject') {
      await serviceQuery(
        `UPDATE public.institutional_email_requests
         SET status = 'rejected', admin_notes = $1, approved_by = $2, approved_at = now()
         WHERE id = $3`,
        [adminNotes || null, userId, requestId]
      );
      const { profile, authEmail } = await getUserInfo(emailReq.user_id);
      if (authEmail) {
        await sendEmailSafe(authEmail, 'Institutional Email Request - Rejected',
          `<p>Dear ${profile?.full_name || 'Student'},</p><p>Your request for institutional email <strong>${emailReq.requested_email}</strong> has been rejected.</p>${adminNotes ? `<p><strong>Reason:</strong> ${adminNotes}</p>` : ''}<p>If you have questions, please contact the administration.</p>`);
      }
      return res.json({ success: true, status: 'rejected' });
    }

    if (action === 'approve') {
      if (emailReq.status !== 'pending') return res.status(400).json({ error: 'Request already processed' });

      const password = generatePassword(14);
      try {
        await cpanelRequest(`Email/add_pop?email=${encodeURIComponent(localPart)}&password=${encodeURIComponent(password)}&domain=${encodeURIComponent(domain)}&quota=512`);
      } catch (err) {
        await serviceQuery(
          `UPDATE public.institutional_email_requests SET status = 'failed', admin_notes = $1, approved_by = $2, approved_at = now() WHERE id = $3`,
          [`cPanel error: ${err.message}`, userId, requestId]
        );
        return res.status(500).json({ error: err.message });
      }

      const enrollRes = await serviceQuery('SELECT id, enrolled_at, payment_id FROM public.enrollments WHERE user_id = $1', [emailReq.user_id]);
      const { validFrom, validUntil } = calculateValidity(enrollRes.rows);

      await serviceQuery(
        `UPDATE public.institutional_email_requests
         SET status = 'approved', current_password = $1, generated_password = '***sent-via-email***',
             admin_notes = $2, approved_by = $3, approved_at = now(), valid_from = $4, valid_until = $5
         WHERE id = $6`,
        [password, adminNotes || null, userId, validFrom, validUntil, requestId]
      );

      const { profile, authEmail } = await getUserInfo(emailReq.user_id);
      if (authEmail) {
        await sendEmailSafe(authEmail, '🎉 Your Institutional Email is Ready!',
          `<p>Dear ${profile?.full_name || 'Student'},</p><p>Your institutional email account has been created successfully!</p>
          <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:16px;margin:16px 0;">
          <p><strong>Email:</strong> ${emailReq.requested_email}</p>
          <p><strong>Password:</strong> ${password}</p>
          <p><strong>Valid Until:</strong> ${new Date(validUntil).toLocaleDateString()}</p>
          <p><strong>Webmail:</strong> <a href="https://${process.env.CPANEL_HOSTNAME || ''}:2096">Webmail Login</a></p>
          </div>
          <p>⚠️ <strong>Please change your password after first login for security.</strong></p>
          <p><strong>IMAP Settings:</strong></p><ul><li>Server: mail.onlinetextileschool.com</li><li>Port: 993 (SSL)</li><li>Username: ${emailReq.requested_email}</li></ul>
          <p><strong>SMTP Settings:</strong></p><ul><li>Server: mail.onlinetextileschool.com</li><li>Port: 465 (SSL)</li><li>Username: ${emailReq.requested_email}</li></ul>`);
      }

      await notifyAdmins('email_provisioned', 'Email Provisioned', `Institutional email ${emailReq.requested_email} created for ${profile?.full_name || 'user'}.`, '/admin/email-requests');

      return res.json({ success: true, status: 'approved', email: emailReq.requested_email });
    }

    if (action === 'block') {
      try {
        await cpanelRequest(`Email/suspend_login?email=${encodeURIComponent(localPart)}%40${encodeURIComponent(domain)}`);
      } catch (err) {
        return res.status(500).json({ error: `Block failed: ${err.message}` });
      }
      await serviceQuery(
        `UPDATE public.institutional_email_requests SET is_blocked = true, blocked_at = now(), admin_notes = $1 WHERE id = $2`,
        [adminNotes || emailReq.admin_notes, requestId]
      );
      return res.json({ success: true, action: 'blocked' });
    }

    if (action === 'unblock') {
      try {
        await cpanelRequest(`Email/unsuspend_login?email=${encodeURIComponent(localPart)}%40${encodeURIComponent(domain)}`);
      } catch (err) {
        return res.status(500).json({ error: `Unblock failed: ${err.message}` });
      }
      await serviceQuery(
        `UPDATE public.institutional_email_requests SET is_blocked = false, blocked_at = NULL, admin_notes = $1 WHERE id = $2`,
        [adminNotes || emailReq.admin_notes, requestId]
      );
      return res.json({ success: true, action: 'unblocked' });
    }

    if (action === 'reset-password') {
      const newPassword = generatePassword(14);
      try {
        await cpanelRequest(`Email/passwd_pop?email=${encodeURIComponent(localPart)}%40${encodeURIComponent(domain)}&password=${encodeURIComponent(newPassword)}`);
      } catch (err) {
        return res.status(500).json({ error: `Password reset failed: ${err.message}` });
      }
      await serviceQuery(
        `UPDATE public.institutional_email_requests SET current_password = $1, last_password_reset_at = now() WHERE id = $2`,
        [newPassword, requestId]
      );
      const { profile, authEmail } = await getUserInfo(emailReq.user_id);
      if (authEmail) {
        await sendEmailSafe(authEmail, '🔑 Institutional Email Password Reset',
          `<p>Dear ${profile?.full_name || 'Student'},</p><p>Your institutional email password has been reset by an administrator.</p>
          <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:16px;margin:16px 0;">
          <p><strong>Email:</strong> ${emailReq.requested_email}</p><p><strong>New Password:</strong> ${newPassword}</p></div>
          <p>⚠️ Please change your password after login.</p>`);
      }
      return res.json({ success: true, action: 'password-reset', password: newPassword });
    }

    if (action === 'delete') {
      try {
        await cpanelRequest(`Email/delete_pop?email=${encodeURIComponent(localPart)}%40${encodeURIComponent(domain)}`);
      } catch (err) {
        console.warn('cPanel delete warning:', err.message);
      }
      await serviceQuery(
        `UPDATE public.institutional_email_requests SET status = 'expired', admin_notes = $1, is_blocked = true WHERE id = $2`,
        [adminNotes || 'Account deleted by admin', requestId]
      );
      return res.json({ success: true, action: 'deleted' });
    }

    if (action === 'check-usage') {
      try {
        const data = await cpanelRequest(`Email/get_disk_usage?user=${encodeURIComponent(localPart)}%40${encodeURIComponent(domain)}`);
        const diskUsed = data?.data?.disk_used || data?.result?.data?.disk_used || 0;
        await serviceQuery('UPDATE public.institutional_email_requests SET disk_usage_bytes = $1 WHERE id = $2', [parseInt(diskUsed, 10) || 0, requestId]);
        return res.json({ success: true, disk_usage_bytes: diskUsed });
      } catch (err) {
        return res.status(500).json({ error: `Usage check failed: ${err.message}` });
      }
    }

    if (action === 'change-password') {
      if (emailReq.user_id !== userId) return res.status(403).json({ error: 'You can only change your own email password' });
      if (emailReq.status !== 'approved') return res.status(400).json({ error: 'Email account is not active' });

      const lastReset = emailReq.last_password_reset_at ? new Date(emailReq.last_password_reset_at) : null;
      if (lastReset) {
        const cooldownMs = 15 * 24 * 60 * 60 * 1000;
        const elapsed = Date.now() - lastReset.getTime();
        if (elapsed < cooldownMs) {
          const daysLeft = Math.ceil((cooldownMs - elapsed) / (1000 * 60 * 60 * 24));
          return res.status(429).json({ error: `Password can be changed again in ${daysLeft} day(s)` });
        }
      }

      const newPassword = generatePassword(14);
      try {
        await cpanelRequest(`Email/passwd_pop?email=${encodeURIComponent(localPart)}%40${encodeURIComponent(domain)}&password=${encodeURIComponent(newPassword)}`);
      } catch (err) {
        return res.status(500).json({ error: `Password change failed: ${err.message}` });
      }
      await serviceQuery(
        `UPDATE public.institutional_email_requests SET current_password = $1, last_password_reset_at = now() WHERE id = $2`,
        [newPassword, requestId]
      );
      return res.json({ success: true, action: 'password-changed' });
    }

    return res.status(400).json({ error: 'Invalid action' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { cpanelEmailProvisioner };
