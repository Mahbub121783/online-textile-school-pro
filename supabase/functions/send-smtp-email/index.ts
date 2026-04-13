import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function buildBrandedHtml(body: string, branding: Record<string, string>) {
  const brandColor = branding.email_brand_color || "#1a365d";
  const logoUrl = branding.email_logo_url || "";
  const footerText = (branding.email_footer_text || "© Online Textile School. All rights reserved.").replace(/\n/g, "<br>");
  const websiteUrl = branding.email_website_url || "";
  const facebookUrl = branding.email_facebook_url || "";
  const youtubeUrl = branding.email_youtube_url || "";
  const fromName = branding.smtp_from_name || "Online Textile School";

  // Robust logo: use explicit width/height, display block, and border=0 for maximum email client compatibility
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
    <td align="center" style="padding:16px 32px 28px 32px;">
      <p style="margin:0;color:#a0aec0;font-size:12px;line-height:1.6;">${footerText}</p>
    </td>
  </tr>

</table>
<!-- End Main Card -->

</td></tr>
</table>
</body>
</html>`;
}

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

    if (templateKey && !customBody) {
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

    // Wrap body in branded template
    const brandedHtml = buildBrandedHtml(emailBody, cfg);

    // Determine SMTP connection settings
    const port = parseInt(cfg.smtp_port || "465", 10);
    const encryption = cfg.smtp_encryption || "ssl";

    // SSL (implicit TLS on port 465) vs STARTTLS (port 587) vs none
    const useTls = encryption === "ssl" || port === 465;
    const useStartTls = encryption === "tls";

    const connectionConfig: any = {
      hostname: cfg.smtp_host,
      port,
      auth: {
        username: cfg.smtp_user,
        password: cfg.smtp_pass,
      },
    };

    if (useTls) {
      connectionConfig.tls = true;
    } else if (useStartTls) {
      connectionConfig.tls = false;
      // denomailer handles STARTTLS upgrade automatically when tls is false on port 587
    } else {
      connectionConfig.tls = false;
    }

    const client = new SMTPClient({ connection: connectionConfig });

    try {
      await client.send({
        from: cfg.smtp_from_email
          ? `${cfg.smtp_from_name || "Online Textile School"} <${cfg.smtp_from_email}>`
          : cfg.smtp_user,
        to: recipientEmail,
        subject: emailSubject,
        content: "auto",
        html: brandedHtml,
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
      await client.close().catch(() => {});

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
