import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function generatePassword(length = 14): string {
  const chars = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%";
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => chars[b % chars.length]).join("");
}

async function cpanelRequest(endpoint: string) {
  const cpanelHost = Deno.env.get("CPANEL_HOSTNAME")!;
  const cpanelUser = Deno.env.get("CPANEL_USERNAME")!;
  const cpanelToken = Deno.env.get("CPANEL_API_TOKEN")!;

  const url = `https://${cpanelHost}:2083/execute/${endpoint}`;
  const resp = await fetch(url, {
    method: "GET",
    headers: { Authorization: `cpanel ${cpanelUser}:${cpanelToken}` },
  });
  const data = await resp.json();
  if (!resp.ok || data?.errors?.length > 0 || data?.status === 0) {
    throw new Error(data?.errors?.[0] || data?.messages?.[0] || "cPanel API error");
  }
  return data;
}

function calculateValidity(enrollments: any[]): { validFrom: string; validUntil: string } {
  const paidEnrollments = enrollments.filter((e: any) => e.payment_id);
  const now = new Date();
  const validFrom = now.toISOString();
  const count = Math.max(1, paidEnrollments.length);
  const validUntil = new Date(now);
  validUntil.setMonth(validUntil.getMonth() + count * 6);
  return { validFrom, validUntil: validUntil.toISOString() };
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

    const { data: emailReq, error: fetchErr } = await sb
      .from("institutional_email_requests")
      .select("*")
      .eq("id", requestId)
      .single();

    if (fetchErr || !emailReq) {
      return new Response(JSON.stringify({ error: "Request not found" }), { status: 404, headers: corsHeaders });
    }

    const emailParts = emailReq.requested_email.split("@");
    const localPart = emailParts[0];
    const domain = emailParts[1] || "onlinetextileschool.com";

    // Helper to get user profile and auth email
    const getUserInfo = async () => {
      const { data: profile } = await sb.from("user_profiles").select("full_name").eq("id", emailReq.user_id).single();
      const { data: authUser } = await sb.auth.admin.getUserById(emailReq.user_id);
      return { profile, authEmail: authUser?.user?.email };
    };

    // ========== REJECT ==========
    if (action === "reject") {
      await sb.from("institutional_email_requests").update({
        status: "rejected",
        admin_notes: adminNotes || null,
        approved_by: user.id,
        approved_at: new Date().toISOString(),
      }).eq("id", requestId);

      const { profile, authEmail } = await getUserInfo();
      if (authEmail) {
        try {
          await sb.functions.invoke("send-smtp-email", {
            body: {
              recipientEmail: authEmail,
              subject: "Institutional Email Request - Rejected",
              body: `<p>Dear ${profile?.full_name || "Student"},</p>
                <p>Your request for institutional email <strong>${emailReq.requested_email}</strong> has been rejected.</p>
                ${adminNotes ? `<p><strong>Reason:</strong> ${adminNotes}</p>` : ""}
                <p>If you have questions, please contact the administration.</p>`,
            },
          });
        } catch (_) {}
      }

      return new Response(JSON.stringify({ success: true, status: "rejected" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ========== APPROVE ==========
    if (action === "approve") {
      if (emailReq.status !== "pending") {
        return new Response(JSON.stringify({ error: "Request already processed" }), { status: 400, headers: corsHeaders });
      }

      const password = generatePassword(14);

      try {
        await cpanelRequest(`Email/add_pop?email=${encodeURIComponent(localPart)}&password=${encodeURIComponent(password)}&domain=${encodeURIComponent(domain)}&quota=512`);
      } catch (err: any) {
        await sb.from("institutional_email_requests").update({
          status: "failed",
          admin_notes: `cPanel error: ${err.message}`,
          approved_by: user.id,
          approved_at: new Date().toISOString(),
        }).eq("id", requestId);
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Calculate validity based on enrollments
      const { data: enrollments } = await sb.from("enrollments").select("id, enrolled_at, payment_id").eq("user_id", emailReq.user_id);
      const { validFrom, validUntil } = calculateValidity(enrollments || []);

      await sb.from("institutional_email_requests").update({
        status: "approved",
        current_password: password,
        generated_password: "***sent-via-email***",
        admin_notes: adminNotes || null,
        approved_by: user.id,
        approved_at: new Date().toISOString(),
        valid_from: validFrom,
        valid_until: validUntil,
      }).eq("id", requestId);

      const { profile, authEmail } = await getUserInfo();
      if (authEmail) {
        try {
          await sb.functions.invoke("send-smtp-email", {
            body: {
              recipientEmail: authEmail,
              subject: "🎉 Your Institutional Email is Ready!",
              body: `<p>Dear ${profile?.full_name || "Student"},</p>
                <p>Your institutional email account has been created successfully!</p>
                <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:16px;margin:16px 0;">
                  <p><strong>Email:</strong> ${emailReq.requested_email}</p>
                  <p><strong>Password:</strong> ${password}</p>
                  <p><strong>Valid Until:</strong> ${new Date(validUntil).toLocaleDateString()}</p>
                  <p><strong>Webmail:</strong> <a href="https://premium.us10.svlogins.com:2096">https://premium.us10.svlogins.com:2096</a></p>
                </div>
                <p>⚠️ <strong>Please change your password after first login for security.</strong></p>
                <p><strong>IMAP Settings:</strong></p>
                <ul><li>Server: mail.onlinetextileschool.com</li><li>Port: 993 (SSL)</li><li>Username: ${emailReq.requested_email}</li></ul>
                <p><strong>SMTP Settings:</strong></p>
                <ul><li>Server: mail.onlinetextileschool.com</li><li>Port: 465 (SSL)</li><li>Username: ${emailReq.requested_email}</li></ul>`,
            },
          });
        } catch (_) {}
      }

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

    // ========== BLOCK ==========
    if (action === "block") {
      try {
        await cpanelRequest(`Email/suspend_login?email=${encodeURIComponent(localPart)}%40${encodeURIComponent(domain)}`);
      } catch (err: any) {
        return new Response(JSON.stringify({ error: `Block failed: ${err.message}` }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      await sb.from("institutional_email_requests").update({
        is_blocked: true,
        blocked_at: new Date().toISOString(),
        admin_notes: adminNotes || emailReq.admin_notes,
      }).eq("id", requestId);

      return new Response(JSON.stringify({ success: true, action: "blocked" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ========== UNBLOCK ==========
    if (action === "unblock") {
      try {
        await cpanelRequest(`Email/unsuspend_login?email=${encodeURIComponent(localPart)}%40${encodeURIComponent(domain)}`);
      } catch (err: any) {
        return new Response(JSON.stringify({ error: `Unblock failed: ${err.message}` }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      await sb.from("institutional_email_requests").update({
        is_blocked: false,
        blocked_at: null,
        admin_notes: adminNotes || emailReq.admin_notes,
      }).eq("id", requestId);

      return new Response(JSON.stringify({ success: true, action: "unblocked" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ========== RESET PASSWORD ==========
    if (action === "reset-password") {
      const newPassword = generatePassword(14);
      try {
        await cpanelRequest(`Email/passwd_pop?email=${encodeURIComponent(localPart)}%40${encodeURIComponent(domain)}&password=${encodeURIComponent(newPassword)}`);
      } catch (err: any) {
        return new Response(JSON.stringify({ error: `Password reset failed: ${err.message}` }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      await sb.from("institutional_email_requests").update({
        current_password: newPassword,
        last_password_reset_at: new Date().toISOString(),
      }).eq("id", requestId);

      const { profile, authEmail } = await getUserInfo();
      if (authEmail) {
        try {
          await sb.functions.invoke("send-smtp-email", {
            body: {
              recipientEmail: authEmail,
              subject: "🔑 Institutional Email Password Reset",
              body: `<p>Dear ${profile?.full_name || "Student"},</p>
                <p>Your institutional email password has been reset by an administrator.</p>
                <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:16px;margin:16px 0;">
                  <p><strong>Email:</strong> ${emailReq.requested_email}</p>
                  <p><strong>New Password:</strong> ${newPassword}</p>
                </div>
                <p>⚠️ Please change your password after login.</p>`,
            },
          });
        } catch (_) {}
      }

      return new Response(JSON.stringify({ success: true, action: "password-reset", password: newPassword }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ========== DELETE ==========
    if (action === "delete") {
      try {
        await cpanelRequest(`Email/delete_pop?email=${encodeURIComponent(localPart)}%40${encodeURIComponent(domain)}`);
      } catch (err: any) {
        // If already deleted on cPanel, just proceed
        console.warn("cPanel delete warning:", err.message);
      }

      await sb.from("institutional_email_requests").update({
        status: "expired",
        admin_notes: adminNotes || "Account deleted by admin",
        is_blocked: true,
      }).eq("id", requestId);

      return new Response(JSON.stringify({ success: true, action: "deleted" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ========== CHECK USAGE ==========
    if (action === "check-usage") {
      try {
        const data = await cpanelRequest(`Email/get_disk_usage?user=${encodeURIComponent(localPart)}%40${encodeURIComponent(domain)}`);
        const diskUsed = data?.data?.disk_used || data?.result?.data?.disk_used || 0;

        await sb.from("institutional_email_requests").update({
          disk_usage_bytes: parseInt(diskUsed) || 0,
        }).eq("id", requestId);

        return new Response(JSON.stringify({ success: true, disk_usage_bytes: diskUsed }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: `Usage check failed: ${err.message}` }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), { status: 400, headers: corsHeaders });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
