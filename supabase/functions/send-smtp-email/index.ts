import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    // Fetch SMTP settings
    const smtpKeys = ["smtp_host", "smtp_port", "smtp_user", "smtp_pass", "smtp_encryption", "smtp_from_email", "smtp_from_name"];
    const { data: settings } = await supabase.from("site_settings").select("key, value").in("key", smtpKeys);
    const cfg: Record<string, string> = {};
    settings?.forEach((s: any) => { cfg[s.key] = s.value ?? ""; });

    if (!cfg.smtp_host || !cfg.smtp_user) {
      // Log failure
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

    // Send via SMTP
    const port = parseInt(cfg.smtp_port || "465", 10);
    const tls = cfg.smtp_encryption === "ssl" || port === 465;

    const client = new SMTPClient({
      connection: {
        hostname: cfg.smtp_host,
        port,
        tls,
        auth: {
          username: cfg.smtp_user,
          password: cfg.smtp_pass,
        },
      },
    });

    try {
      await client.send({
        from: cfg.smtp_from_email ? `${cfg.smtp_from_name || "Online Textile School"} <${cfg.smtp_from_email}>` : cfg.smtp_user,
        to: recipientEmail,
        subject: emailSubject,
        content: "auto",
        html: emailBody,
      });

      await client.close();

      // Log success
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
