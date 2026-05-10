// Send a Web Push notification to a user (or all subscriptions matching a filter).
// Designed to be called from other edge functions (cron jobs etc) using SUPABASE_SERVICE_ROLE_KEY,
// or from authenticated admins.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import webpush from "https://esm.sh/web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const VAPID_PUBLIC = "BK_3WnSi0YgfRqoi9F2xZ3f8NltbxsC7685HVb7JwQAgw_GVagA6zoF2EQaFyyn7WADsrT-gQd3SFdARBvyZ2JY";
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY") || "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@onlinetextileschool.com";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

interface SendBody {
  user_id?: string;
  user_ids?: string[];
  category?:
    | "workshop_reminders"
    | "class_reminders"
    | "live_class_alerts"
    | "assignment_due"
    | "new_messages"
    | "marketing";
  payload: {
    title: string;
    body?: string;
    url?: string;
    icon?: string;
    image?: string;
    tag?: string;
    actions?: Array<{ action: string; title: string }>;
    data?: Record<string, unknown>;
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = (await req.json()) as SendBody;
    if (!body?.payload?.title) {
      return new Response(JSON.stringify({ error: "missing payload.title" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const ids = body.user_ids || (body.user_id ? [body.user_id] : []);
    if (ids.length === 0) {
      return new Response(JSON.stringify({ error: "no recipients" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Filter by category preference if specified
    let allowedIds = ids;
    if (body.category) {
      const { data: prefs } = await admin
        .from("notification_preferences")
        .select(`user_id, ${body.category}`)
        .in("user_id", ids);
      const prefMap = new Map(prefs?.map((p: any) => [p.user_id, p[body.category!]]) || []);
      allowedIds = ids.filter((id) => prefMap.get(id) !== false); // default true if no row
    }

    if (allowedIds.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: subs } = await admin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .in("user_id", allowedIds);

    let sent = 0;
    let failed = 0;
    const stalePruneIds: string[] = [];

    await Promise.all(
      (subs || []).map(async (s: any) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            JSON.stringify(body.payload)
          );
          sent++;
        } catch (err: any) {
          failed++;
          if (err?.statusCode === 404 || err?.statusCode === 410) {
            stalePruneIds.push(s.id);
          }
        }
      })
    );

    if (stalePruneIds.length) {
      await admin.from("push_subscriptions").delete().in("id", stalePruneIds);
    }

    return new Response(JSON.stringify({ ok: true, sent, failed, pruned: stalePruneIds.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
