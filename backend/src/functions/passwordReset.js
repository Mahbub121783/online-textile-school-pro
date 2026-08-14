// Ported from supabase/functions/password-reset-request/index.ts and
// password-reset-verify/index.ts (Deno -> Node). Uses `serviceQuery` (elevated context)
// (service-level access) instead of the supabase-js admin client.
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { serviceQuery } = require('../db');

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function randomToken(len = 48) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = crypto.randomBytes(len);
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

async function passwordResetRequest(req, res) {
  try {
    const emailRaw = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (!emailRaw || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw) || emailRaw.length > 255) {
      return res.status(400).json({ error: 'Invalid email' });
    }

    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const countRes = await serviceQuery(
      'SELECT count(*) FROM public.password_reset_codes WHERE email = $1 AND created_at >= $2',
      [emailRaw, fifteenMinAgo]
    );
    if (Number(countRes.rows[0].count) >= 3) return res.json({ success: true });

    let userId = null;
    let userName = null;
    try {
      const lookup = await serviceQuery('SELECT * FROM public.find_auth_user_by_email($1)', [emailRaw]);
      const row = lookup.rows[0];
      if (row?.user_id) {
        userId = row.user_id;
        userName = row.full_name || null;
      }
    } catch (e) {
      console.error('find_auth_user_by_email failed', e);
    }

    if (userId) {
      const code = String(Math.floor(100000 + Math.random() * 900000));
      const codeHash = sha256(code);
      const linkToken = randomToken(48);
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

      await serviceQuery(
        `INSERT INTO public.password_reset_codes (user_id, email, code_hash, link_token, expires_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, emailRaw, codeHash, linkToken, expiresAt]
      ).catch((e) => console.error('insert code failed', e));

      const siteUrl = (process.env.SITE_URL || 'https://www.onlinetextileschool.com').replace(/\/+$/, '');
      const resetLink = `${siteUrl}/reset-password?token=${encodeURIComponent(linkToken)}&email=${encodeURIComponent(emailRaw)}`;

      try {
        const { sendSmtpEmail } = require('./sendSmtpEmail');
        const fakeReq = { body: { templateKey: 'password_reset', recipientEmail: emailRaw, placeholders: { user_name: userName || 'there', otp_code: code, reset_link: resetLink, expires_in: '15 minutes' } } };
        const fakeRes = { json: () => {}, status: () => fakeRes };
        await sendSmtpEmail(fakeReq, fakeRes);
      } catch (e) {
        console.error('send-smtp-email failed', e);
      }
    }

    res.json({ success: true });
  } catch (e) {
    console.error('password-reset-request error', e);
    res.json({ success: true });
  }
}

async function passwordResetVerify(req, res) {
  try {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const code = typeof req.body?.code === 'string' ? req.body.code.trim() : '';
    const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
    const newPassword = typeof req.body?.new_password === 'string' ? req.body.new_password : '';

    if (newPassword.length < 6 || newPassword.length > 200) {
      return res.status(400).json({ error: 'weak_password', message: 'Password must be at least 6 characters' });
    }

    let row = null;

    if (token) {
      const r = await serviceQuery(
        'SELECT * FROM public.password_reset_codes WHERE link_token = $1 AND used_at IS NULL LIMIT 1',
        [token]
      );
      row = r.rows[0] || null;
      if (!row) return res.status(400).json({ error: 'invalid_token', message: 'This reset link is invalid or already used.' });
    } else {
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: 'invalid_email', message: 'Invalid email' });
      }
      if (!/^\d{6}$/.test(code)) {
        return res.status(400).json({ error: 'invalid_code', message: 'Code must be 6 digits' });
      }
      const r = await serviceQuery(
        'SELECT * FROM public.password_reset_codes WHERE email = $1 AND used_at IS NULL ORDER BY created_at DESC LIMIT 1',
        [email]
      );
      row = r.rows[0] || null;
      if (!row) return res.status(400).json({ error: 'invalid_code', message: 'Invalid or expired code' });
    }

    if (row.locked_at) return res.status(400).json({ error: 'too_many_attempts', message: 'Too many attempts. Please request a new code.' });
    if (new Date(row.expires_at).getTime() < Date.now()) return res.status(400).json({ error: 'expired', message: 'Code has expired. Please request a new one.' });
    if ((row.attempts ?? 0) >= 5) {
      await serviceQuery('UPDATE public.password_reset_codes SET locked_at = now() WHERE id = $1', [row.id]);
      return res.status(400).json({ error: 'too_many_attempts', message: 'Too many attempts. Please request a new code.' });
    }

    if (!token) {
      const codeHash = sha256(code);
      if (codeHash !== row.code_hash) {
        const nextAttempts = (row.attempts ?? 0) + 1;
        if (nextAttempts >= 5) {
          await serviceQuery('UPDATE public.password_reset_codes SET attempts = $1, locked_at = now() WHERE id = $2', [nextAttempts, row.id]);
          return res.status(400).json({ error: 'too_many_attempts', message: 'Too many attempts. Please request a new code.' });
        }
        await serviceQuery('UPDATE public.password_reset_codes SET attempts = $1 WHERE id = $2', [nextAttempts, row.id]);
        return res.status(400).json({ error: 'invalid_code', message: `Invalid code. ${5 - nextAttempts} attempts left.` });
      }
    }

    if (!row.user_id) return res.status(400).json({ error: 'invalid_code', message: 'Invalid code' });

    const hash = await bcrypt.hash(newPassword, 10);
    await serviceQuery('UPDATE auth.users SET encrypted_password = $1, updated_at = now() WHERE id = $2', [hash, row.user_id]);

    await serviceQuery('UPDATE public.password_reset_codes SET used_at = now() WHERE id = $1', [row.id]);
    await serviceQuery('UPDATE public.password_reset_codes SET used_at = now() WHERE email = $1 AND used_at IS NULL', [row.email]);

    res.json({ success: true });
  } catch (e) {
    console.error('password-reset-verify error', e);
    res.status(500).json({ error: 'server_error', message: e.message });
  }
}

module.exports = { passwordResetRequest, passwordResetVerify };
