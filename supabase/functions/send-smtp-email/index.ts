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

  const logoHtml = logoUrl
    ? `<img src="${logoUrl}" alt="${fromName}" style="max-height:60px;max-width:200px;" />`
    : `<span style="font-size:22px;font-weight:bold;color:#ffffff;">${fromName}</span>`;

  const socialLinks: string[] = [];
  if (websiteUrl) socialLinks.push(`<a href="${websiteUrl}" style="color:#ffffff;text-decoration:underline;margin:0 8px;">Website</a>`);
  if (facebookUrl) socialLinks.push(`<a href="${facebookUrl}" style="color:#ffffff;text-decoration:underline;margin:0 8px;">Facebook</a>`);
  if (youtubeUrl) socialLinks.push(`<a href="${youtubeUrl}" style="color:#ffffff;text-decoration:underline;margin:0 8px;">YouTube</a>`);

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f4f7;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7;">
<tr><td align="center" style="padding:24px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
  <!-- Header -->
  <tr>
    <td align="center" style="background-color:${brandColor};padding:24px 32px;">
      ${logoHtml}
    </td>
  </tr>
  <!-- Body -->
  <tr>
    <td style="padding:32px 32px 24px 32px;color:#333333;font-size:15px;line-height:1.6;">
      ${body}
    </td>
  </tr>
  <!-- Footer -->
  <tr>
    <td style="background-color:${brandColor};padding:20px 32px;text-align:center;">
      ${socialLinks.length > 0 ? `<p style="margin:0 0 12px 0;">${socialLinks.join("")}</p>` : ""}
      <p style="margin:0;color:rgba(255,255,255,0.85);font-size:12px;line-height:1.5;">${footerText}</p>
    </td>
  </tr>
</table>
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
