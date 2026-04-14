import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // User client for auth
    const userClient = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    // Service client for DB operations
    const adminClient = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const { action, ...params } = body;

    // Get user's institutional email credentials
    const { data: emailReq } = await adminClient
      .from("institutional_email_requests")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "approved")
      .limit(1)
      .single();

    if (!emailReq && action !== "check-status") {
      return new Response(JSON.stringify({ error: "No active institutional email" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    switch (action) {
      case "send-message": {
        const { to, cc, bcc, subject, body_html, attachments = [] } = params;
        const toEmails = to.split(",").map((e: string) => e.trim()).filter(Boolean);
        const ccEmails = cc ? cc.split(",").map((e: string) => e.trim()).filter(Boolean) : [];
        const bccEmails = bcc ? bcc.split(",").map((e: string) => e.trim()).filter(Boolean) : [];

        // Send via SMTP through cPanel
        const cpanelHost = Deno.env.get("CPANEL_HOSTNAME");
        const cpanelUser = Deno.env.get("CPANEL_USERNAME");
        const cpanelToken = Deno.env.get("CPANEL_API_TOKEN");

        if (!cpanelHost || !cpanelUser || !cpanelToken) {
          throw new Error("cPanel credentials not configured");
        }

        // Use cPanel's email sending via UAPI
        // For actual SMTP sending, we use the platform's send-smtp-email function
        // but with the user's institutional email as the from address
        const smtpResult = await adminClient.functions.invoke("send-smtp-email", {
          body: {
            recipientEmail: toEmails[0],
            subject: subject,
            body: body_html,
            metadata: {
              from_override: emailReq.requested_email,
              cc: ccEmails,
              bcc: bccEmails,
              source: "edumail",
            },
          },
        });

        // Save sent message locally
        const sentMsg = {
          owner_id: user.id,
          folder: "sent",
          from_email: emailReq.requested_email,
          to_emails: toEmails,
          cc_emails: ccEmails,
          bcc_emails: bccEmails,
          subject: subject || "",
          body_html: body_html || "",
          body_text: (body_html || "").replace(/<[^>]*>/g, ""),
          is_read: true,
          has_attachments: attachments.length > 0,
          attachments: attachments,
          sent_at: new Date().toISOString(),
        };

        await adminClient.from("edumail_messages").insert(sentMsg);

        // Also save a copy in recipient's inbox if they're on the platform
        for (const recipientEmail of toEmails) {
          const { data: recipientReq } = await adminClient
            .from("institutional_email_requests")
            .select("user_id")
            .eq("requested_email", recipientEmail)
            .eq("status", "approved")
            .limit(1)
            .single();

          if (recipientReq) {
            await adminClient.from("edumail_messages").insert({
              owner_id: recipientReq.user_id,
              folder: "inbox",
              from_email: emailReq.requested_email,
              to_emails: toEmails,
              cc_emails: ccEmails,
              subject: subject || "",
              body_html: body_html || "",
              body_text: (body_html || "").replace(/<[^>]*>/g, ""),
              is_read: false,
              has_attachments: attachments.length > 0,
              attachments: attachments,
              sent_at: new Date().toISOString(),
              thread_id: sentMsg.owner_id, // simplified threading
            });
          }
        }

        // Auto-save contacts
        for (const email of [...toEmails, ...ccEmails]) {
          await adminClient.from("edumail_contacts").upsert(
            { user_id: user.id, email, display_name: email.split("@")[0] },
            { onConflict: "user_id,email" }
          );
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "recall-message": {
        const { message_id } = params;
        // Only allow recall within 5 minutes and for internal messages
        const { data: msg } = await adminClient
          .from("edumail_messages")
          .select("*")
          .eq("id", message_id)
          .eq("owner_id", user.id)
          .eq("folder", "sent")
          .single();

        if (!msg) throw new Error("Message not found");

        const sentTime = new Date(msg.sent_at).getTime();
        if (Date.now() - sentTime > 5 * 60 * 1000) {
          throw new Error("Recall window expired (5 minutes)");
        }

        // Mark sender's copy as recalled
        await adminClient.from("edumail_messages")
          .update({ recalled_at: new Date().toISOString() })
          .eq("id", message_id);

        // Remove from recipients' inboxes (internal only)
        const toEmails = msg.to_emails || [];
        for (const recipientEmail of toEmails) {
          if (recipientEmail.endsWith("@onlinetextileschool.com")) {
            const { data: recipientReq } = await adminClient
              .from("institutional_email_requests")
              .select("user_id")
              .eq("requested_email", recipientEmail)
              .eq("status", "approved")
              .single();

            if (recipientReq) {
              await adminClient.from("edumail_messages")
                .update({ recalled_at: new Date().toISOString(), folder: "trash" })
                .eq("owner_id", recipientReq.user_id)
                .eq("from_email", emailReq.requested_email)
                .eq("subject", msg.subject)
                .is("recalled_at", null);
            }
          }
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "check-status": {
        return new Response(JSON.stringify({
          has_email: !!emailReq,
          email: emailReq?.requested_email,
          status: emailReq?.status,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400,
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
