import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function generatePassword(length = 12): string {
  const chars = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%";
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => chars[b % chars.length]).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseServiceKey);

    // Verify caller is admin
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const { data: roles } = await sb.from("user_roles").select("role").eq("user_id", user.id);
    const isAdmin = roles?.some((r: any) => r.role === "admin" || r.role === "super_admin");
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });
    }

    const { requestId, action, adminNotes } = await req.json();
    if (!requestId || !action) {
      return new Response(JSON.stringify({ error: "requestId and action required" }), { status: 400, headers: corsHeaders });
    }

    // Fetch the request
    const { data: emailReq, error: fetchErr } = await sb
      .from("institutional_email_requests")
      .select("*")
      .eq("id", requestId)
      .single();

    if (fetchErr || !emailReq) {
      return new Response(JSON.stringify({ error: "Request not found" }), { status: 404, headers: corsHeaders });
    }

    if (emailReq.status !== "pending") {
      return new Response(JSON.stringify({ error: "Request already processed" }), { status: 400, headers: corsHeaders });
    }

    if (action === "reject") {
      await sb.from("institutional_email_requests").update({
        status: "rejected",
        admin_notes: adminNotes || null,
        approved_by: user.id,
        approved_at: new Date().toISOString(),
      }).eq("id", requestId);

      // Send rejection email
      const { data: profile } = await sb.from("user_profiles").select("full_name").eq("id", emailReq.user_id).single();
      const { data: authUser } = await sb.auth.admin.getUserById(emailReq.user_id);
      if (authUser?.user?.email) {
        try {
          await sb.functions.invoke("send-smtp-email", {
            body: {
              recipientEmail: authUser.user.email,
              subject: "Institutional Email Request - Rejected",
              body: `<p>Dear ${profile?.full_name || "Student"},</p>
                <p>Your request for institutional email <strong>${emailReq.requested_email}</strong> has been rejected.</p>
                ${adminNotes ? `<p><strong>Reason:</strong> ${adminNotes}</p>` : ""}
                <p>If you have questions, please contact the administration.</p>`,
            },
          });
        } catch (_) { /* non-critical */ }
      }

      return new Response(JSON.stringify({ success: true, status: "rejected" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "approve") {
      const password = generatePassword(14);
      const cpanelHost = Deno.env.get("CPANEL_HOSTNAME")!;
      const cpanelUser = Deno.env.get("CPANEL_USERNAME")!;
      const cpanelToken = Deno.env.get("CPANEL_API_TOKEN")!;

      // Extract local part from requested email
      const emailParts = emailReq.requested_email.split("@");
      const localPart = emailParts[0];
      const domain = emailParts[1] || "onlinetextileschool.com";

      // Call cPanel UAPI to create email account
      const cpanelUrl = `https://${cpanelHost}:2083/execute/Email/add_pop?email=${encodeURIComponent(localPart)}&password=${encodeURIComponent(password)}&domain=${encodeURIComponent(domain)}&quota=512`;

      const cpanelResp = await fetch(cpanelUrl, {
        method: "GET",
        headers: {
          Authorization: `cpanel ${cpanelUser}:${cpanelToken}`,
        },
      });

      const cpanelData = await cpanelResp.json();

      if (!cpanelResp.ok || cpanelData?.errors?.length > 0 || cpanelData?.status === 0) {
        const errMsg = cpanelData?.errors?.[0] || cpanelData?.messages?.[0] || "cPanel API error";
        await sb.from("institutional_email_requests").update({
          status: "failed",
          admin_notes: `cPanel error: ${errMsg}`,
          approved_by: user.id,
          approved_at: new Date().toISOString(),
        }).eq("id", requestId);

        return new Response(JSON.stringify({ error: errMsg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Success — update DB (don't store plaintext password permanently)
      await sb.from("institutional_email_requests").update({
        status: "approved",
        generated_password: "***sent-via-email***",
        admin_notes: adminNotes || null,
        approved_by: user.id,
        approved_at: new Date().toISOString(),
      }).eq("id", requestId);

      // Send credentials email
      const { data: profile } = await sb.from("user_profiles").select("full_name").eq("id", emailReq.user_id).single();
      const { data: authUser } = await sb.auth.admin.getUserById(emailReq.user_id);
      if (authUser?.user?.email) {
        try {
          await sb.functions.invoke("send-smtp-email", {
            body: {
              recipientEmail: authUser.user.email,
              subject: "🎉 Your Institutional Email is Ready!",
              body: `<p>Dear ${profile?.full_name || "Student"},</p>
                <p>Your institutional email account has been created successfully!</p>
                <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:16px;margin:16px 0;">
                  <p><strong>Email:</strong> ${emailReq.requested_email}</p>
                  <p><strong>Password:</strong> ${password}</p>
                  <p><strong>Webmail:</strong> <a href="https://premium.us10.svlogins.com:2096">https://premium.us10.svlogins.com:2096</a></p>
                </div>
                <p>⚠️ <strong>Please change your password after first login for security.</strong></p>
                <p><strong>IMAP Settings:</strong></p>
                <ul>
                  <li>Server: mail.onlinetextileschool.com</li>
                  <li>Port: 993 (SSL)</li>
                  <li>Username: ${emailReq.requested_email}</li>
                </ul>
                <p><strong>SMTP Settings:</strong></p>
                <ul>
                  <li>Server: mail.onlinetextileschool.com</li>
                  <li>Port: 465 (SSL)</li>
                  <li>Username: ${emailReq.requested_email}</li>
                </ul>`,
            },
          });
        } catch (_) { /* non-critical */ }
      }

      // Notify admins
      try {
        await sb.rpc("notify_admins", {
          _type: "email_provisioned",
          _title: "Email Provisioned",
          _message: `Institutional email ${emailReq.requested_email} created for ${profile?.full_name || "user"}.`,
          _link: "/admin/email-requests",
        });
      } catch (_) {}

      return new Response(JSON.stringify({ success: true, status: "approved", email: emailReq.requested_email }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), { status: 400, headers: corsHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
