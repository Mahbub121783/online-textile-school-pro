import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const adminKey = req.headers.get("x-admin-key");
    if (adminKey !== Deno.env.get("SEED_ADMIN_KEY")) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });
    }
    const body = await req.json();
    const items: any[] = body.items || [];
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Resolve slugs to ids once
    const { data: subjects } = await supabase.from("qb_subjects").select("id,slug");
    const { data: topics } = await supabase.from("qb_topics").select("id,slug");
    const sMap = new Map((subjects || []).map((s: any) => [s.slug, s.id]));
    const tMap = new Map((topics || []).map((t: any) => [t.slug, t.id]));

    const rows = items.map((it) => ({
      subject_id: sMap.get(it.s),
      topic_id: tMap.get(it.t),
      difficulty: it.d,
      question_type: "multiple_choice",
      question_text: it.q,
      options: it.o,
      correct_answer: it.c,
      explanation: it.e,
      points: it.p,
      source: "ai",
      is_active: true,
    })).filter(r => r.subject_id && r.topic_id);

    const { error, count } = await supabase.from("qb_questions").insert(rows, { count: "exact" });
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
    return new Response(JSON.stringify({ inserted: count, total: rows.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders });
  }
});
