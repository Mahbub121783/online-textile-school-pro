import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/* ─── Default template definitions (used when no DB template exists) ─── */
const DEFAULT_TEMPLATES: Record<string, { subject: string; body: string }> = {
  order_confirmation: {
    subject: "Order Confirmed — #{{order_id}}",
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
    subject: "Order Cancelled — #{{order_id}}",
    body: `<h2 style="margin:0 0 16px">Order Cancelled</h2><p>Hi {{user_name}}, your order <strong>#{{order_id}}</strong> has been cancelled.</p><p><strong>Reason:</strong> {{reason}}</p><p>If this was a mistake, please contact {{support_email}}.</p>`,
  },
  instructor_approved: {
    subject: "Congratulations! You are now an Instructor",
    body: `<h2 style="margin:0 0 16px">Welcome to Our Instructor Team!</h2><p>Dear {{user_name}},</p><p>Your instructor application has been <strong>approved</strong>. You can now create courses and start teaching.</p><p><a href="{{login_url}}" style="display:inline-block;padding:12px 24px;background:#1a365d;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold">Go to Dashboard</a></p>`,
  },
  instructor_rejected: {
    subject: "Instructor Application Update",
    body: `<h2 style="margin:0 0 16px">Application Update</h2><p>Dear {{user_name}},</p><p>After careful review, we were unable to approve your instructor application at this time.</p><p><strong>Reason:</strong> {{reason}}</p><p>Feel free to reapply or contact {{support_email}} for more information.</p>`,
  },
  student_approved: {
    subject: "Account Approved — Start Learning!",
    body: `<h2 style="margin:0 0 16px">Your Account is Approved!</h2><p>Hi {{user_name}}, your student account has been approved. You can now enroll in courses.</p><p><a href="{{login_url}}" style="display:inline-block;padding:12px 24px;background:#1a365d;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold">Login Now</a></p>`,
  },
  student_rejected: {
    subject: "Account Registration Update",
    body: `<h2 style="margin:0 0 16px">Registration Update</h2><p>Dear {{user_name}}, we were unable to approve your registration at this time.</p><p><strong>Reason:</strong> {{reason}}</p><p>Please contact {{support_email}} if you have questions.</p>`,
  },
  password_reset: {
    subject: "Reset Your Password",
    body: `<h2 style="margin:0 0 16px">Password Reset Request</h2><p>Hi {{user_name}}, we received a request to reset your password.</p><p><a href="{{reset_link}}" style="display:inline-block;padding:12px 24px;background:#1a365d;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold">Reset Password</a></p><p style="color:#888;font-size:13px">If you didn't request this, please ignore this email.</p>`,
  },
  welcome_email: {
    subject: "Welcome to {{site_name}}!",
    body: `<h2 style="margin:0 0 16px">Welcome, {{user_name}}! 🎉</h2><p>Thank you for joining <strong>{{site_name}}</strong>. We're thrilled to have you!</p><p>Your Student ID: <strong>{{user_roll_id}}</strong></p><p><a href="{{login_url}}" style="display:inline-block;padding:12px 24px;background:#1a365d;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold">Explore Courses</a></p>`,
  },
  enrollment_confirmation: {
    subject: "Enrolled in {{course_name}}",
    body: `<h2 style="margin:0 0 16px">Enrollment Confirmed!</h2><p>Hi {{user_name}}, you have been successfully enrolled in <strong>{{course_name}}</strong>.</p><p><a href="{{course_url}}" style="display:inline-block;padding:12px 24px;background:#1a365d;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold">Start Learning</a></p>`,
  },
  certificate_issued: {
    subject: "Your Certificate is Ready — {{course_name}}",
    body: `<h2 style="margin:0 0 16px">Congratulations, {{user_name}}! 🏆</h2><p>You have earned a certificate for completing <strong>{{course_name}}</strong>.</p><p>Certificate No: <strong>{{certificate_number}}</strong></p><p><a href="{{certificate_download_url}}" style="display:inline-block;padding:12px 24px;background:#1a365d;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold">Download Certificate</a></p>`,
  },
  registration_approved: {
    subject: "Registration Approved",
    body: `<h2 style="margin:0 0 16px">Registration Approved!</h2><p>Hi {{user_name}}, your <strong>{{registration_type}}</strong> registration has been approved.</p><p><a href="{{login_url}}" style="display:inline-block;padding:12px 24px;background:#1a365d;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold">Login Now</a></p>`,
  },
  registration_rejected: {
    subject: "Registration Update",
    body: `<h2 style="margin:0 0 16px">Registration Update</h2><p>Dear {{user_name}}, your <strong>{{registration_type}}</strong> registration could not be approved.</p><p><strong>Reason:</strong> {{reason}}</p><p>Contact {{support_email}} for assistance.</p>`,
  },
  push_notification: {
    subject: "{{notification_title}}",
    body: `<h2 style="margin:0 0 16px">{{notification_title}}</h2><p>Hi {{user_name}},</p><p>{{notification_body}}</p><p><a href="{{action_url}}" style="display:inline-block;padding:12px 24px;background:#1a365d;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold">View Details</a></p>`,
  },
  account_suspended: {
    subject: "Account Suspended",
    body: `<h2 style="margin:0 0 16px;color:#c53030">Account Suspended</h2><p>Dear {{user_name}}, your account has been suspended.</p><p><strong>Reason:</strong> {{reason}}</p><p>Please contact <a href="mailto:{{support_email}}">{{support_email}}</a> for more information.</p>`,
  },
  payment_received: {
    subject: "Payment Received — {{amount}}",
    body: `<h2 style="margin:0 0 16px">Payment Received ✓</h2><p>Hi {{user_name}}, we have received your payment of <strong>{{amount}}</strong> via {{payment_method}}.</p><p>Invoice: <strong>{{invoice_number}}</strong></p><p><a href="{{invoice_url}}" style="display:inline-block;padding:12px 24px;background:#1a365d;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold">View Invoice</a></p>`,
  },
  refund_processed: {
    subject: "Refund Processed — {{amount}}",
    body: `<h2 style="margin:0 0 16px">Refund Processed</h2><p>Hi {{user_name}}, a refund of <strong>{{amount}}</strong> for order <strong>#{{order_id}}</strong> has been processed.</p><p>The amount will be credited within 5-7 business days.</p>`,
  },
  ebook_purchase: {
    subject: "Ebook Purchase Confirmed — {{ebook_title}}",
    body: `<h2 style="margin:0 0 16px">Ebook Purchase Confirmed!</h2><p>Hi {{user_name}}, you have purchased <strong>{{ebook_title}}</strong> by {{ebook_author}}.</p><p><a href="{{ebook_download_url}}" style="display:inline-block;padding:12px 24px;background:#1a365d;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold">Read Now</a></p>`,
  },
  ebook_download: {
    subject: "Your Ebook Download Link — {{ebook_title}}",
    body: `<h2 style="margin:0 0 16px">Your Ebook is Ready</h2><p>Hi {{user_name}}, here's your download link for <strong>{{ebook_title}}</strong>.</p><p><a href="{{ebook_download_url}}" style="display:inline-block;padding:12px 24px;background:#1a365d;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold">Download Ebook</a></p><p style="color:#888;font-size:13px">This link is for your personal use only.</p>`,
  },
  user_registration: {
    subject: "Welcome to {{site_name}} — Account Created",
    body: `<h2 style="margin:0 0 16px">Account Created Successfully!</h2><p>Hi {{user_name}}, your account at <strong>{{site_name}}</strong> has been created.</p><p>Your Roll ID: <strong>{{user_roll_id}}</strong></p><p><a href="{{login_url}}" style="display:inline-block;padding:12px 24px;background:#1a365d;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold">Login to Your Account</a></p>`,
  },
  course_completion: {
    subject: "Congratulations! You Completed {{course_name}}",
    body: `<h2 style="margin:0 0 16px">Course Completed! 🎓</h2><p>Dear {{user_name}}, congratulations on completing <strong>{{course_name}}</strong>!</p><p>Your certificate is ready for download.</p><p><a href="{{certificate_download_url}}" style="display:inline-block;padding:12px 24px;background:#1a365d;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold">Get Certificate</a></p>`,
  },
  assignment_submitted: {
    subject: "Assignment Submitted Successfully",
    body: `<h2 style="margin:0 0 16px">Assignment Submitted</h2><p>Hi {{user_name}}, your assignment for <strong>{{course_name}}</strong> has been submitted successfully.</p><p>Your instructor will review and grade it shortly.</p>`,
  },
  quiz_completed: {
    subject: "Quiz Results — {{course_name}}",
    body: `<h2 style="margin:0 0 16px">Quiz Completed!</h2><p>Hi {{user_name}}, you have completed the quiz for <strong>{{course_name}}</strong>.</p><p>Check your dashboard for detailed results.</p><p><a href="{{login_url}}" style="display:inline-block;padding:12px 24px;background:#1a365d;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold">View Results</a></p>`,
  },
  wallet_credit: {
    subject: "Wallet Credited — {{amount}}",
    body: `<h2 style="margin:0 0 16px">Wallet Credited ✓</h2><p>Hi {{user_name}}, <strong>{{amount}}</strong> has been added to your wallet.</p><p>You can use this balance for course enrollments and ebook purchases.</p>`,
  },
  wallet_debit: {
    subject: "Wallet Debit — {{amount}}",
    body: `<h2 style="margin:0 0 16px">Wallet Debit</h2><p>Hi {{user_name}}, <strong>{{amount}}</strong> has been deducted from your wallet.</p><p>Check your wallet history for details.</p>`,
  },
  id_card_issued: {
    subject: "Your Student ID Card is Ready",
    body: `<h2 style="margin:0 0 16px">Student ID Card Issued 🎫</h2><p>Hi {{user_name}}, your student ID card has been generated.</p><p>Roll ID: <strong>{{user_roll_id}}</strong></p><p><a href="{{login_url}}" style="display:inline-block;padding:12px 24px;background:#1a365d;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold">View ID Card</a></p>`,
  },
};

/* ─── Helpers ─── */

function generateToken(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 32; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
}

async function getOrCreateUnsubToken(supabase: any, email: string): Promise<string> {
  const { data: existing } = await supabase
    .from("email_unsubscribes")
    .select("token, unsubscribed_at")
    .eq("email", email)
    .maybeSingle();
  if (existing) return existing.token;
  const token = generateToken();
  await supabase.from("email_unsubscribes").insert({ email, token });
  return token;
}

/* ─── Branded HTML wrapper ─── */

function buildBrandedHtml(body: string, branding: Record<string, string>, unsubscribeUrl: string) {
  const brandColor = branding.email_brand_color || "#1a365d";
  const logoUrl = branding.email_logo_url || "";
  const footerText = (branding.email_footer_text || "© Online Textile School. All rights reserved.").replace(/\n/g, "<br>");
  const websiteUrl = branding.email_website_url || "";
  const facebookUrl = branding.email_facebook_url || "";
  const youtubeUrl = branding.email_youtube_url || "";
  const fromName = branding.smtp_from_name || "Online Textile School";

  const logoHtml = logoUrl
    ? `<img src="${logoUrl}" alt="${fromName}" width="180" height="50" border="0" style="display:block;margin:0 auto;max-width:180px;height:auto;outline:none;text-decoration:none;" />`
    : `<span style="font-size:20px;font-weight:700;color:${brandColor};letter-spacing:0.5px;">${fromName}</span>`;

  const socialLinks: string[] = [];
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
  <!--[if mso]><style>table,td{font-family:Arial,Helvetica,sans-serif!important;}</style><![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#f0f2f5;font-family:Arial,Helvetica,sans-serif;-webkit-font-smoothing:antialiased;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f0f2f5;">
<tr><td align="center" style="padding:32px 16px;">

<!-- Main Card -->
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.06);">
  
  <!-- Logo Header -->
  <tr>
    <td align="center" style="background-color:#ffffff;padding:28px 32px 20px 32px;border-bottom:1px solid #e8e8e8;">
      ${logoHtml}
    </td>
  </tr>

  <!-- Accent Bar -->
  <tr>
    <td style="background-color:${brandColor};height:4px;font-size:0;line-height:0;">&nbsp;</td>
  </tr>

  <!-- Body Content -->
  <tr>
    <td style="padding:32px 36px 28px 36px;color:#2d3748;font-size:15px;line-height:1.7;">
      ${body}
    </td>
  </tr>

  <!-- Divider -->
  <tr>
    <td style="padding:0 36px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr><td style="border-top:1px solid #edf0f3;height:1px;font-size:0;line-height:0;">&nbsp;</td></tr>
      </table>
    </td>
  </tr>

  <!-- Social Links -->
  ${socialLinks.length > 0 ? `<tr>
    <td align="center" style="padding:20px 32px 8px 32px;">
      ${socialLinks.join("&nbsp;&nbsp;·&nbsp;&nbsp;")}
    </td>
  </tr>` : ""}

  <!-- Footer -->
  <tr>
    <td align="center" style="padding:16px 32px 12px 32px;">
      <p style="margin:0;color:#a0aec0;font-size:12px;line-height:1.6;">${footerText}</p>
    </td>
  </tr>

  <!-- Unsubscribe -->
  <tr>
    <td align="center" style="padding:0 32px 28px 32px;">
      <a href="${unsubscribeUrl}" style="color:#a0aec0;font-size:11px;text-decoration:underline;">Unsubscribe from these emails</a>
    </td>
  </tr>

</table>
<!-- End Main Card -->

</td></tr>
</table>
</body>
</html>`;
}

/* ─── Main handler ─── */

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { templateKey, recipientEmail, placeholders, subject: customSubject, body: customBody, metadata } = await req.json();

    if (!recipientEmail) {
      return new Response(JSON.stringify({ error: "recipientEmail is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if recipient has unsubscribed
    const { data: unsub } = await supabase
      .from("email_unsubscribes")
      .select("unsubscribed_at")
      .eq("email", recipientEmail)
      .maybeSingle();

    if (unsub?.unsubscribed_at) {
      await supabase.from("email_logs").insert({
        recipient: recipientEmail,
        subject: customSubject || templateKey || "Unknown",
        template_key: templateKey || "custom",
        status: "blocked",
        error_message: "Recipient has unsubscribed",
        metadata: metadata || null,
      });
      return new Response(JSON.stringify({ error: "Recipient has unsubscribed" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch SMTP + branding settings
    const allKeys = [
      "smtp_host", "smtp_port", "smtp_user", "smtp_pass", "smtp_encryption", "smtp_from_email", "smtp_from_name",
      "email_logo_url", "email_brand_color", "email_footer_text", "email_website_url", "email_facebook_url", "email_youtube_url",
    ];
    const { data: settings } = await supabase.from("site_settings").select("key, value").in("key", allKeys);
    const cfg: Record<string, string> = {};
    settings?.forEach((s: any) => { cfg[s.key] = s.value ?? ""; });

    if (!cfg.smtp_host || !cfg.smtp_user) {
      await supabase.from("email_logs").insert({
        recipient: recipientEmail,
        subject: customSubject || templateKey || "Unknown",
        template_key: templateKey || "custom",
        status: "failed",
        error_message: "SMTP not configured",
        metadata: metadata || null,
      });
      return new Response(JSON.stringify({ error: "SMTP not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve subject and body
    let emailSubject = customSubject || "";
    let emailBody = customBody || "";

    if (templateKey) {
      // Try DB template first
      if (!customBody) {
        const settingKey = `email_template_${templateKey}`;
        const { data: tmpl } = await supabase.from("site_settings").select("value").eq("key", settingKey).maybeSingle();
        if (tmpl?.value) {
          try {
            const parsed = JSON.parse(tmpl.value);
            emailSubject = emailSubject || parsed.subject || "";
            emailBody = parsed.body || "";
          } catch { /* ignore */ }
        }
      }

      // Fall back to built-in default template if DB had nothing
      if (!emailBody && DEFAULT_TEMPLATES[templateKey]) {
        const def = DEFAULT_TEMPLATES[templateKey];
        emailSubject = emailSubject || def.subject;
        emailBody = def.body;
      }
    }

    // Replace placeholders
    if (placeholders && typeof placeholders === "object") {
      for (const [key, val] of Object.entries(placeholders)) {
        const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g");
        emailSubject = emailSubject.replace(regex, String(val));
        emailBody = emailBody.replace(regex, String(val));
      }
    }

    if (!emailSubject && !emailBody) {
      await supabase.from("email_logs").insert({
        recipient: recipientEmail,
        subject: "Empty",
        template_key: templateKey || "custom",
        status: "failed",
        error_message: "No subject or body content",
        metadata: metadata || null,
      });
      return new Response(JSON.stringify({ error: "No email content" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate unsubscribe link
    const unsubToken = await getOrCreateUnsubToken(supabase, recipientEmail);
    const unsubscribeUrl = `${supabaseUrl}/functions/v1/handle-unsubscribe?token=${unsubToken}`;

    // Replace {{unsubscribe_url}} placeholder if used in body
    emailBody = emailBody.replace(/\{\{unsubscribe_url\}\}/g, unsubscribeUrl);

    // Wrap body in branded template with unsubscribe link
    const brandedHtml = buildBrandedHtml(emailBody, cfg, unsubscribeUrl);

    // Determine SMTP connection settings
    const port = parseInt(cfg.smtp_port || "465", 10);
    const encryption = cfg.smtp_encryption || "ssl";
    const useTls = encryption === "ssl" || port === 465;

    const connectionConfig: any = {
      hostname: cfg.smtp_host,
      port,
      auth: {
        username: cfg.smtp_user,
        password: cfg.smtp_pass,
      },
      tls: useTls,
    };

    const client = new SMTPClient({ connection: connectionConfig });

    try {
      // Support from_override for EduMail (institutional email sends)
      const fromOverride = metadata?.from_override;
      const fromAddress = fromOverride
        ? `${fromOverride}`
        : cfg.smtp_from_email
          ? `${cfg.smtp_from_name || "Online Textile School"} <${cfg.smtp_from_email}>`
          : cfg.smtp_user;

      await client.send({
        from: fromAddress,
        to: recipientEmail,
        subject: emailSubject,
        content: "auto",
        html: brandedHtml,
        headers: {
          "List-Unsubscribe": `<${unsubscribeUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          ...(metadata?.cc?.length ? {} : {}),
        },
      });

      await client.close();

      await supabase.from("email_logs").insert({
        recipient: recipientEmail,
        subject: emailSubject,
        template_key: templateKey || "custom",
        status: "sent",
        metadata: metadata || null,
      });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (smtpError: any) {
      try { await client.close(); } catch { /* ignore */ }

      await supabase.from("email_logs").insert({
        recipient: recipientEmail,
        subject: emailSubject,
        template_key: templateKey || "custom",
        status: "failed",
        error_message: smtpError.message || "SMTP send failed",
        metadata: metadata || null,
      });

      return new Response(JSON.stringify({ error: smtpError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
