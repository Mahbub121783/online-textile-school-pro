// Ported from supabase/functions/send-smtp-email/index.ts (Deno -> Node).
// Business logic (templates, placeholder substitution, branded HTML wrapper)
// is unchanged; SMTP sending uses nodemailer instead of denomailer, and DB
// access uses `serviceQuery` (elevated context) instead of the supabase-js admin client.
const nodemailer = require('nodemailer');
const { serviceQuery } = require('../db');

const DEFAULT_TEMPLATES = {
  order_confirmation: {
    subject: 'Order Confirmed — #{{order_id}}',
    body: `<h2 style="margin:0 0 16px">Thank you for your order, {{user_name}}!</h2>
<p>Your order <strong>#{{order_id}}</strong> has been confirmed.</p>
<table style="width:100%;border-collapse:collapse;margin:16px 0">
<tr style="background:#f0f0f0"><td style="padding:8px;font-weight:bold">Items</td><td style="padding:8px">{{order_items}}</td></tr>
<tr><td style="padding:8px;font-weight:bold">Total</td><td style="padding:8px">{{order_total}}</td></tr>
<tr style="background:#f0f0f0"><td style="padding:8px;font-weight:bold">Payment</td><td style="padding:8px">{{payment_method}}</td></tr>
<tr><td style="padding:8px;font-weight:bold">Invoice</td><td style="padding:8px">{{invoice_number}}</td></tr>
</table>
<p>If you have any questions, contact us at {{support_email}}.</p>`,
  },
  order_cancellation: {
    subject: 'Order Cancelled — #{{order_id}}',
    body: `<h2 style="margin:0 0 16px">Order Cancelled</h2><p>Hi {{user_name}}, your order <strong>#{{order_id}}</strong> has been cancelled.</p><p><strong>Reason:</strong> {{reason}}</p><p>If this was a mistake, please contact {{support_email}}.</p>`,
  },
  instructor_approved: {
    subject: 'Congratulations! You are now an Instructor',
    body: `<h2 style="margin:0 0 16px">Welcome to Our Instructor Team!</h2><p>Dear {{user_name}},</p><p>Your instructor application has been <strong>approved</strong>. You can now create courses and start teaching.</p><p><a href="{{login_url}}" style="display:inline-block;padding:12px 24px;background:#1a365d;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold">Go to Dashboard</a></p>`,
  },
  instructor_rejected: {
    subject: 'Instructor Application Update',
    body: `<h2 style="margin:0 0 16px">Application Update</h2><p>Dear {{user_name}},</p><p>After careful review, we were unable to approve your instructor application at this time.</p><p><strong>Reason:</strong> {{reason}}</p><p>Feel free to reapply or contact {{support_email}} for more information.</p>`,
  },
  student_approved: {
    subject: 'Account Approved — Start Learning!',
    body: `<h2 style="margin:0 0 16px">Your Account is Approved!</h2><p>Hi {{user_name}}, your student account has been approved. You can now enroll in courses.</p><p><a href="{{login_url}}" style="display:inline-block;padding:12px 24px;background:#1a365d;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold">Login Now</a></p>`,
  },
  student_rejected: {
    subject: 'Account Registration Update',
    body: `<h2 style="margin:0 0 16px">Registration Update</h2><p>Dear {{user_name}}, we were unable to approve your registration at this time.</p><p><strong>Reason:</strong> {{reason}}</p><p>Please contact {{support_email}} if you have questions.</p>`,
  },
  password_reset: {
    subject: 'Reset Your Password — Code Inside',
    body: `<h2 style="margin:0 0 16px">Password Reset Request</h2><p>Hi {{user_name}}, we received a request to reset your password. You have <strong>two ways</strong> to continue:</p><h3 style="margin:24px 0 8px;font-size:15px;color:#1a365d">Option 1 — Enter this 6-digit code</h3><div style="margin:8px 0 24px;padding:20px;background:#f5f5f5;border-radius:8px;text-align:center"><div style="font-size:32px;letter-spacing:8px;font-weight:bold;color:#1a365d;font-family:monospace">{{otp_code}}</div></div><h3 style="margin:24px 0 8px;font-size:15px;color:#1a365d">Option 2 — Click this secure link</h3><p style="margin:8px 0 16px;text-align:center"><a href="{{reset_link}}" style="display:inline-block;padding:14px 28px;background:#1a365d;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold;font-size:15px">Reset My Password</a></p><p style="color:#666;font-size:12px;word-break:break-all;text-align:center">If the button doesn't work, copy this link:<br/><a href="{{reset_link}}" style="color:#1a365d">{{reset_link}}</a></p><p style="margin-top:24px">Both options expire in <strong>{{expires_in}}</strong> and can only be used once.</p><p style="color:#888;font-size:13px;margin-top:16px;border-top:1px solid #eee;padding-top:16px">If you didn't request this, please ignore this email — your password will not be changed.</p>`,
  },
  welcome_email: {
    subject: 'Welcome to {{site_name}}!',
    body: `<h2 style="margin:0 0 16px">Welcome, {{user_name}}! 🎉</h2><p>Thank you for joining <strong>{{site_name}}</strong>. We're thrilled to have you!</p><p>Your Student ID: <strong>{{user_roll_id}}</strong></p><p><a href="{{login_url}}" style="display:inline-block;padding:12px 24px;background:#1a365d;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold">Explore Courses</a></p>`,
  },
  enrollment_confirmation: {
    subject: 'Enrolled in {{course_name}}',
    body: `<h2 style="margin:0 0 16px">Enrollment Confirmed!</h2><p>Hi {{user_name}}, you have been successfully enrolled in <strong>{{course_name}}</strong>.</p><p><a href="{{course_url}}" style="display:inline-block;padding:12px 24px;background:#1a365d;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold">Start Learning</a></p>`,
  },
  certificate_issued: {
    subject: 'Your Certificate is Ready — {{course_name}}',
    body: `<h2 style="margin:0 0 16px">Congratulations, {{user_name}}! 🏆</h2><p>You have earned a certificate for completing <strong>{{course_name}}</strong>.</p><p>Certificate No: <strong>{{certificate_number}}</strong></p><p><a href="{{certificate_download_url}}" style="display:inline-block;padding:12px 24px;background:#1a365d;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold">Download Certificate</a></p>`,
  },
  registration_approved: {
    subject: 'Registration Approved',
    body: `<h2 style="margin:0 0 16px">Registration Approved!</h2><p>Hi {{user_name}}, your <strong>{{registration_type}}</strong> registration has been approved.</p><p><a href="{{login_url}}" style="display:inline-block;padding:12px 24px;background:#1a365d;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold">Login Now</a></p>`,
  },
  registration_rejected: {
    subject: 'Registration Update',
    body: `<h2 style="margin:0 0 16px">Registration Update</h2><p>Dear {{user_name}}, your <strong>{{registration_type}}</strong> registration could not be approved.</p><p><strong>Reason:</strong> {{reason}}</p><p>Contact {{support_email}} for assistance.</p>`,
  },
  push_notification: {
    subject: '{{notification_title}}',
    body: `<h2 style="margin:0 0 16px">{{notification_title}}</h2><p>Hi {{user_name}},</p><p>{{notification_body}}</p><p><a href="{{action_url}}" style="display:inline-block;padding:12px 24px;background:#1a365d;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold">View Details</a></p>`,
  },
  account_suspended: {
    subject: 'Account Suspended',
    body: `<h2 style="margin:0 0 16px;color:#c53030">Account Suspended</h2><p>Dear {{user_name}}, your account has been suspended.</p><p><strong>Reason:</strong> {{reason}}</p><p>Please contact <a href="mailto:{{support_email}}">{{support_email}}</a> for more information.</p>`,
  },
  payment_received: {
    subject: 'Payment Received — {{amount}}',
    body: `<h2 style="margin:0 0 16px">Payment Received ✓</h2><p>Hi {{user_name}}, we have received your payment of <strong>{{amount}}</strong> via {{payment_method}}.</p><p>Invoice: <strong>{{invoice_number}}</strong></p><p><a href="{{invoice_url}}" style="display:inline-block;padding:12px 24px;background:#1a365d;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold">View Invoice</a></p>`,
  },
  refund_processed: {
    subject: 'Refund Processed — {{amount}}',
    body: `<h2 style="margin:0 0 16px">Refund Processed</h2><p>Hi {{user_name}}, a refund of <strong>{{amount}}</strong> for order <strong>#{{order_id}}</strong> has been processed.</p><p>The amount will be credited within 5-7 business days.</p>`,
  },
  ebook_purchase: {
    subject: 'Ebook Purchase Confirmed — {{ebook_title}}',
    body: `<h2 style="margin:0 0 16px">Ebook Purchase Confirmed!</h2><p>Hi {{user_name}}, you have purchased <strong>{{ebook_title}}</strong> by {{ebook_author}}.</p><p><a href="{{ebook_download_url}}" style="display:inline-block;padding:12px 24px;background:#1a365d;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold">Read Now</a></p>`,
  },
  ebook_download: {
    subject: 'Your Ebook Download Link — {{ebook_title}}',
    body: `<h2 style="margin:0 0 16px">Your Ebook is Ready</h2><p>Hi {{user_name}}, here's your download link for <strong>{{ebook_title}}</strong>.</p><p><a href="{{ebook_download_url}}" style="display:inline-block;padding:12px 24px;background:#1a365d;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold">Download Ebook</a></p><p style="color:#888;font-size:13px">This link is for your personal use only.</p>`,
  },
  user_registration: {
    subject: 'Welcome to {{site_name}} — Account Created',
    body: `<h2 style="margin:0 0 16px">Account Created Successfully!</h2><p>Hi {{user_name}}, your account at <strong>{{site_name}}</strong> has been created.</p><p>Your Roll ID: <strong>{{user_roll_id}}</strong></p><p><a href="{{login_url}}" style="display:inline-block;padding:12px 24px;background:#1a365d;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold">Login to Your Account</a></p>`,
  },
  course_completion: {
    subject: 'Congratulations! You Completed {{course_name}}',
    body: `<h2 style="margin:0 0 16px">Course Completed! 🎓</h2><p>Dear {{user_name}}, congratulations on completing <strong>{{course_name}}</strong>!</p><p>Your certificate is ready for download.</p><p><a href="{{certificate_download_url}}" style="display:inline-block;padding:12px 24px;background:#1a365d;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold">Get Certificate</a></p>`,
  },
  assignment_submitted: {
    subject: 'Assignment Submitted Successfully',
    body: `<h2 style="margin:0 0 16px">Assignment Submitted</h2><p>Hi {{user_name}}, your assignment for <strong>{{course_name}}</strong> has been submitted successfully.</p><p>Your instructor will review and grade it shortly.</p>`,
  },
  quiz_completed: {
    subject: 'Quiz Results — {{course_name}}',
    body: `<h2 style="margin:0 0 16px">Quiz Completed!</h2><p>Hi {{user_name}}, you have completed the quiz for <strong>{{course_name}}</strong>.</p><p>Check your dashboard for detailed results.</p><p><a href="{{login_url}}" style="display:inline-block;padding:12px 24px;background:#1a365d;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold">View Results</a></p>`,
  },
  wallet_credit: {
    subject: 'Wallet Credited — {{amount}}',
    body: `<h2 style="margin:0 0 16px">Wallet Credited ✓</h2><p>Hi {{user_name}}, <strong>{{amount}}</strong> has been added to your wallet.</p><p>You can use this balance for course enrollments and ebook purchases.</p>`,
  },
  wallet_debit: {
    subject: 'Wallet Debit — {{amount}}',
    body: `<h2 style="margin:0 0 16px">Wallet Debit</h2><p>Hi {{user_name}}, <strong>{{amount}}</strong> has been deducted from your wallet.</p><p>Check your wallet history for details.</p>`,
  },
  id_card_issued: {
    subject: 'Your Student ID Card is Ready',
    body: `<h2 style="margin:0 0 16px">Student ID Card Issued 🎫</h2><p>Hi {{user_name}}, your student ID card has been generated.</p><p>Roll ID: <strong>{{user_roll_id}}</strong></p><p><a href="{{login_url}}" style="display:inline-block;padding:12px 24px;background:#1a365d;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold">View ID Card</a></p>`,
  },
  workshop_registration: {
    subject: 'Workshop Registration Confirmed — {{workshop_title}}',
    body: `<h2 style="margin:0 0 16px">Registration Confirmed!</h2><p>Hi {{user_name}}, you are registered for <strong>{{workshop_title}}</strong>.</p><table style="margin:16px 0;border-collapse:collapse"><tr><td style="padding:6px 14px 6px 0;font-weight:bold">Registration #</td><td style="padding:6px 0">{{registration_number}}</td></tr><tr><td style="padding:6px 14px 6px 0;font-weight:bold">Date</td><td style="padding:6px 0">{{workshop_date}}</td></tr><tr><td style="padding:6px 14px 6px 0;font-weight:bold">Time</td><td style="padding:6px 0">{{workshop_time}}</td></tr></table><p>We'll send the live link before the session.</p>`,
  },
  workshop_live_link: {
    subject: 'Live Session Link — {{workshop_title}}',
    body: `<h2 style="margin:0 0 16px">Your Live Session Link 🎥</h2><p>Hi {{user_name}}, your live session for <strong>{{workshop_title}}</strong> is starting at <strong>{{start_time}}</strong>.</p><p style="margin:24px 0"><a href="{{meet_link}}" style="display:inline-block;padding:12px 24px;background:#1a365d;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold">Join Live Session</a></p><p style="color:#888;font-size:13px">Link: <a href="{{meet_link}}">{{meet_link}}</a></p>`,
  },
};

function generateToken() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 32; i++) token += chars[Math.floor(Math.random() * chars.length)];
  return token;
}

async function getOrCreateUnsubToken(email) {
  const existing = await serviceQuery('SELECT token FROM public.email_unsubscribes WHERE email = $1', [email]);
  if (existing.rows[0]) return existing.rows[0].token;
  const token = generateToken();
  await serviceQuery('INSERT INTO public.email_unsubscribes (email, token) VALUES ($1, $2)', [email, token]);
  return token;
}

function buildBrandedHtml(body, branding, unsubscribeUrl) {
  const brandColor = branding.email_brand_color || '#1a365d';
  const logoUrl = branding.email_logo_url || '';
  const footerText = (branding.email_footer_text || '© Online Textile School. All rights reserved.').replace(/\n/g, '<br>');
  const websiteUrl = branding.email_website_url || '';
  const facebookUrl = branding.email_facebook_url || '';
  const youtubeUrl = branding.email_youtube_url || '';
  const fromName = branding.smtp_from_name || 'Online Textile School';

  const logoHtml = logoUrl
    ? `<img src="${logoUrl}" alt="${fromName}" width="180" height="50" border="0" style="display:block;margin:0 auto;max-width:180px;height:auto;outline:none;text-decoration:none;" />`
    : `<span style="font-size:20px;font-weight:700;color:${brandColor};letter-spacing:0.5px;">${fromName}</span>`;

  const socialLinks = [];
  if (websiteUrl) socialLinks.push(`<a href="${websiteUrl}" style="color:${brandColor};text-decoration:none;font-weight:600;margin:0 10px;font-size:13px;">Website</a>`);
  if (facebookUrl) socialLinks.push(`<a href="${facebookUrl}" style="color:${brandColor};text-decoration:none;font-weight:600;margin:0 10px;font-size:13px;">Facebook</a>`);
  if (youtubeUrl) socialLinks.push(`<a href="${youtubeUrl}" style="color:${brandColor};text-decoration:none;font-weight:600;margin:0 10px;font-size:13px;">YouTube</a>`);

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="x-apple-disable-message-reformatting" />
  <title>${fromName}</title>
</head>
<body style="margin:0;padding:0;background-color:#f0f2f5;font-family:Arial,Helvetica,sans-serif;-webkit-font-smoothing:antialiased;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f0f2f5;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.06);">
  <tr><td align="center" style="background-color:#ffffff;padding:28px 32px 20px 32px;border-bottom:1px solid #e8e8e8;">${logoHtml}</td></tr>
  <tr><td style="background-color:${brandColor};height:4px;font-size:0;line-height:0;">&nbsp;</td></tr>
  <tr><td style="padding:32px 36px 28px 36px;color:#2d3748;font-size:15px;line-height:1.7;">${body}</td></tr>
  <tr><td style="padding:0 36px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-top:1px solid #edf0f3;height:1px;font-size:0;line-height:0;">&nbsp;</td></tr></table></td></tr>
  ${socialLinks.length > 0 ? `<tr><td align="center" style="padding:20px 32px 8px 32px;">${socialLinks.join('&nbsp;&nbsp;·&nbsp;&nbsp;')}</td></tr>` : ''}
  <tr><td align="center" style="padding:16px 32px 12px 32px;"><p style="margin:0;color:#a0aec0;font-size:12px;line-height:1.6;">${footerText}</p></td></tr>
  <tr><td align="center" style="padding:0 32px 28px 32px;"><a href="${unsubscribeUrl}" style="color:#a0aec0;font-size:11px;text-decoration:underline;">Unsubscribe from these emails</a></td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

async function logEmail(fields) {
  await serviceQuery(
    `INSERT INTO public.email_logs (recipient, subject, template_key, status, error_message, metadata)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [fields.recipient, fields.subject, fields.template_key, fields.status, fields.error_message || null, fields.metadata ? JSON.stringify(fields.metadata) : null]
  );
}

async function sendSmtpEmail(req, res) {
  try {
    const { templateKey, recipientEmail, placeholders, subject: customSubject, body: customBody, metadata } = req.body || {};

    if (!recipientEmail) return res.status(400).json({ error: 'recipientEmail is required' });

    const unsub = await serviceQuery('SELECT unsubscribed_at FROM public.email_unsubscribes WHERE email = $1', [recipientEmail]);
    if (unsub.rows[0]?.unsubscribed_at) {
      await logEmail({ recipient: recipientEmail, subject: customSubject || templateKey || 'Unknown', template_key: templateKey || 'custom', status: 'blocked', error_message: 'Recipient has unsubscribed', metadata });
      return res.status(200).json({ error: 'Recipient has unsubscribed' });
    }

    const allKeys = ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_encryption', 'smtp_from_email', 'smtp_from_name', 'email_logo_url', 'email_brand_color', 'email_footer_text', 'email_website_url', 'email_facebook_url', 'email_youtube_url'];
    const settingsRes = await serviceQuery('SELECT key, value FROM public.site_settings WHERE key = ANY($1)', [allKeys]);
    const cfg = {};
    settingsRes.rows.forEach((s) => { cfg[s.key] = s.value ?? ''; });

    if (!cfg.smtp_host || !cfg.smtp_user) {
      await logEmail({ recipient: recipientEmail, subject: customSubject || templateKey || 'Unknown', template_key: templateKey || 'custom', status: 'failed', error_message: 'SMTP not configured', metadata });
      return res.status(500).json({ error: 'SMTP not configured' });
    }

    let emailSubject = customSubject || '';
    let emailBody = customBody || '';

    if (templateKey) {
      if (!customBody) {
        const settingKey = `email_template_${templateKey}`;
        const tmplRes = await serviceQuery('SELECT value FROM public.site_settings WHERE key = $1', [settingKey]);
        if (tmplRes.rows[0]?.value) {
          try {
            const parsed = JSON.parse(tmplRes.rows[0].value);
            emailSubject = emailSubject || parsed.subject || '';
            emailBody = parsed.body || '';
          } catch { /* ignore */ }
        }
      }
      if (!emailBody && DEFAULT_TEMPLATES[templateKey]) {
        const def = DEFAULT_TEMPLATES[templateKey];
        emailSubject = emailSubject || def.subject;
        emailBody = def.body;
      }
    }

    if (placeholders && typeof placeholders === 'object') {
      for (const [key, val] of Object.entries(placeholders)) {
        const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
        emailSubject = emailSubject.replace(regex, String(val));
        emailBody = emailBody.replace(regex, String(val));
      }
    }

    if (!emailSubject && !emailBody) {
      await logEmail({ recipient: recipientEmail, subject: 'Empty', template_key: templateKey || 'custom', status: 'failed', error_message: 'No subject or body content', metadata });
      return res.status(400).json({ error: 'No email content' });
    }

    const unsubToken = await getOrCreateUnsubToken(recipientEmail);
    const unsubscribeUrl = `${process.env.API_URL || 'https://api.onlinetextileschool.com'}/functions/v1/handle-unsubscribe?token=${unsubToken}`;
    emailBody = emailBody.replace(/\{\{unsubscribe_url\}\}/g, unsubscribeUrl);
    const brandedHtml = buildBrandedHtml(emailBody, cfg, unsubscribeUrl);

    const port = parseInt(cfg.smtp_port || '465', 10);
    const encryption = cfg.smtp_encryption || 'ssl';
    const secure = encryption === 'ssl' || port === 465;

    const transporter = nodemailer.createTransport({
      host: cfg.smtp_host,
      port,
      secure,
      auth: { user: cfg.smtp_user, pass: cfg.smtp_pass },
    });

    const fromOverride = metadata?.from_override;
    const fromAddress = fromOverride || (cfg.smtp_from_email ? `${cfg.smtp_from_name || 'Online Textile School'} <${cfg.smtp_from_email}>` : cfg.smtp_user);

    try {
      await transporter.sendMail({
        from: fromAddress,
        to: recipientEmail,
        subject: emailSubject,
        html: brandedHtml,
        headers: {
          'List-Unsubscribe': `<${unsubscribeUrl}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      });

      await logEmail({ recipient: recipientEmail, subject: emailSubject, template_key: templateKey || 'custom', status: 'sent', metadata });
      res.json({ success: true });
    } catch (smtpError) {
      await logEmail({ recipient: recipientEmail, subject: emailSubject, template_key: templateKey || 'custom', status: 'failed', error_message: smtpError.message, metadata });
      res.status(500).json({ error: smtpError.message });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { sendSmtpEmail };
