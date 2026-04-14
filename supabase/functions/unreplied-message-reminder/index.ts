import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    // Find messages sent more than 5 min ago but less than 10 min ago
    // where the receiver has not replied yet and no reminder was sent
    const { data: unrepliedMessages, error: fetchError } = await supabase
      .from("chat_messages")
      .select("id, sender_id, receiver_id, message, created_at")
      .lt("created_at", fiveMinutesAgo)
      .gt("created_at", tenMinutesAgo)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (fetchError) {
      console.error("Error fetching messages:", fetchError);
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!unrepliedMessages || unrepliedMessages.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Group by receiver_id to avoid duplicate reminders
    const receiverMap = new Map<string, { senderId: string; message: string; createdAt: string }>();

    for (const msg of unrepliedMessages) {
      // Check if receiver has replied after this message
      const { count } = await supabase
        .from("chat_messages")
        .select("id", { count: "exact", head: true })
        .eq("sender_id", msg.receiver_id)
        .eq("receiver_id", msg.sender_id)
        .gt("created_at", msg.created_at)
        .is("deleted_at", null);

      if ((count ?? 0) === 0 && !receiverMap.has(msg.receiver_id)) {
        receiverMap.set(msg.receiver_id, {
          senderId: msg.sender_id,
          message: msg.message,
          createdAt: msg.created_at,
        });
      }
    }

    let sentCount = 0;

    for (const [receiverId, info] of receiverMap) {
      // Check if we already sent a reminder for this conversation recently (last 30 min)
      const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      const { count: existingReminder } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", receiverId)
        .eq("type", "unreplied_message")
        .gt("created_at", thirtyMinAgo);

      if ((existingReminder ?? 0) > 0) continue;

      // Get sender name
      const { data: senderProfile } = await supabase
        .from("user_profiles")
        .select("full_name")
        .eq("id", info.senderId)
        .single();

      const senderName = senderProfile?.full_name || "Someone";
      const preview = info.message.length > 80 ? info.message.slice(0, 80) + "…" : info.message;

      // Create in-app notification
      await supabase.from("notifications").insert({
        user_id: receiverId,
        type: "unreplied_message",
        title: `💬 Unreplied message from ${senderName}`,
        message: `You have an unreplied message: "${preview}"`,
        link: "/dashboard/chat",
        metadata: { sender_id: info.senderId },
      });

      // Try to send email
      try {
        // Get receiver's institutional email
        const { data: emailReq } = await supabase
          .from("institutional_email_requests")
          .select("requested_email")
          .eq("user_id", receiverId)
          .eq("status", "approved")
          .limit(1);

        const recipientEmail = (emailReq as any)?.[0]?.requested_email;

        if (recipientEmail) {
          // Check unsubscribe
          const { count: unsub } = await supabase
            .from("email_unsubscribes")
            .select("id", { count: "exact", head: true })
            .eq("email", recipientEmail)
            .not("unsubscribed_at", "is", null);

          if ((unsub ?? 0) === 0) {
            await supabase.functions.invoke("send-smtp-email", {
              body: {
                recipientEmail,
                subject: `💬 Unreplied message from ${senderName}`,
                body: buildReminderEmail(senderName, preview),
                metadata: { notification_type: "unreplied_message", user_id: receiverId },
              },
            });
          }
        }
      } catch (emailErr) {
        console.error("Failed to send reminder email:", emailErr);
      }

      sentCount++;
    }

    console.log(`Processed ${unrepliedMessages.length} messages, sent ${sentCount} reminders`);

    return new Response(JSON.stringify({ processed: unrepliedMessages.length, sent: sentCount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Unreplied message reminder error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function buildReminderEmail(senderName: string, preview: string): string {
  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
      <div style="background:#0ea5e9;color:#fff;padding:16px 24px;border-radius:8px 8px 0 0;">
        <h2 style="margin:0;font-size:18px;">💬 You have an unreplied message</h2>
      </div>
      <div style="background:#f8fafc;padding:24px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;">
        <p style="color:#334155;font-size:14px;line-height:1.6;margin:0 0 8px;">
          <strong>${senderName}</strong> sent you a message over 5 minutes ago that you haven't replied to yet:
        </p>
        <blockquote style="background:#fff;border-left:4px solid #0ea5e9;padding:12px 16px;margin:16px 0;border-radius:0 6px 6px 0;">
          <p style="color:#475569;font-size:14px;margin:0;font-style:italic;">"${preview}"</p>
        </blockquote>
        <a href="https://learn-textile-hub.lovable.app/dashboard" style="display:inline-block;background:#0ea5e9;color:#fff;padding:10px 24px;border-radius:6px;text-decoration:none;font-size:14px;margin-top:8px;">Reply Now</a>
      </div>
      <p style="color:#94a3b8;font-size:11px;text-align:center;margin-top:16px;">Online Textile School — Chat Reminder</p>
    </div>
  `;
}
