import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { rows } = await req.json();
    if (!Array.isArray(rows)) return new Response(JSON.stringify({ error: "rows required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    // resolve subject_id once per topic_id
    const topicIds = [...new Set(rows.map((r: any) => r.topic_id))];
    const { data: topics, error: tErr } = await sb.from("qb_topics").select("id,subject_id").in("id", topicIds);
    if (tErr) throw tErr;
    const map = new Map(topics!.map((t: any) => [t.id, t.subject_id]));
    const payload = rows.map((r: any) => ({
      topic_id: r.topic_id,
      subject_id: map.get(r.topic_id),
      difficulty: r.difficulty || "advanced",
      question_type: "multiple_choice",
      question_text: r.q,
      options: r.o,
      correct_answer: r.c,
      explanation: r.e,
      points: r.points || 3,
      source: "ai",
      is_active: true,
    }));
    const { error } = await sb.from("qb_questions").insert(payload);
    if (error) throw error;
    return new Response(JSON.stringify({ inserted: payload.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
