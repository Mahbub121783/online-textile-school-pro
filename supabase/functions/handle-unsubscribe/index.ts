import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

serve(async (req) => {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  if (!token) {
    return new Response(htmlPage("Invalid Link", "This unsubscribe link is invalid or expired.", "#e53e3e"), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
      status: 400,
    });
  }

  // Look up the token
  const { data: record } = await supabase
    .from("email_unsubscribes")
    .select("*")
    .eq("token", token)
    .maybeSingle();

  if (!record) {
    return new Response(htmlPage("Invalid Link", "This unsubscribe link is invalid or expired.", "#e53e3e"), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
      status: 404,
    });
  }

  if (record.unsubscribed_at) {
    return new Response(htmlPage("Already Unsubscribed", `<strong>${record.email}</strong> has already been unsubscribed.`, "#718096"), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  // Mark as unsubscribed
  await supabase
    .from("email_unsubscribes")
    .update({ unsubscribed_at: new Date().toISOString() })
    .eq("token", token);

  return new Response(htmlPage("Unsubscribed Successfully", `<strong>${record.email}</strong> has been unsubscribed from our mailing list. You will no longer receive emails from us.`, "#38a169"), {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
});

function htmlPage(title: string, message: string, accentColor: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:Arial,Helvetica,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;">
  <div style="background:#fff;border-radius:12px;padding:48px 40px;max-width:480px;width:90%;text-align:center;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
    <div style="width:64px;height:64px;border-radius:50%;background:${accentColor};margin:0 auto 24px;display:flex;align-items:center;justify-content:center;">
      <span style="color:#fff;font-size:28px;font-weight:bold;">${title.includes("Success") ? "✓" : title.includes("Already") ? "—" : "✕"}</span>
    </div>
    <h1 style="margin:0 0 16px;font-size:24px;color:#2d3748;">${title}</h1>
    <p style="margin:0;color:#718096;font-size:15px;line-height:1.6;">${message}</p>
  </div>
</body>
</html>`;
}
