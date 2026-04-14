import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sendViaUserSmtp(
  fromEmail: string,
  password: string,
  to: string[],
  cc: string[],
  bcc: string[],
  subject: string,
  bodyHtml: string
): Promise<boolean> {
  try {
    const client = new SMTPClient({
      connection: {
        hostname: "mail.onlinetextileschool.com",
        port: 465,
        auth: { username: fromEmail, password },
        tls: true,
      },
    });

    const toStr = to.join(", ");
    const sendOpts: any = {
      from: fromEmail,
      to: toStr,
      subject: subject || "(No Subject)",
      content: "auto",
      html: bodyHtml || "",
    };
    if (cc.length) sendOpts.cc = cc.join(", ");
    if (bcc.length) sendOpts.bcc = bcc.join(", ");

    await client.send(sendOpts);
    await client.close();
    return true;
  } catch (err) {
    console.error("User SMTP send failed:", err);
    return false;
  }
}

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

    const userClient = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

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

        // Send via user's own SMTP credentials (direct from their mailbox)
        const userPassword = emailReq.current_password;
        let sentOk = false;

        if (userPassword) {
          sentOk = await sendViaUserSmtp(
            emailReq.requested_email,
            userPassword,
            toEmails,
            ccEmails,
            bccEmails,
            subject || "",
            body_html || ""
          );
        }

        // Fallback: use platform SMTP with from_override
        if (!sentOk) {
          console.log("Falling back to platform SMTP with from_override");
          try {
            await adminClient.functions.invoke("send-smtp-email", {
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
            sentOk = true;
          } catch (fallbackErr) {
            console.error("Fallback SMTP also failed:", fallbackErr);
          }
        }

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
              thread_id: sentMsg.owner_id,
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

        return new Response(JSON.stringify({ success: true, sent_direct: sentOk }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "recall-message": {
        const { message_id } = params;
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

        await adminClient.from("edumail_messages")
          .update({ recalled_at: new Date().toISOString() })
          .eq("id", message_id);

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
