import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    const entries: { entity_type: string; entity_id: string; title: string; content_summary: string; keywords: string[]; metadata: Record<string, any> }[] = [];

    // Index courses
    const { data: courses } = await sb.from("courses").select("id, title, short_description, description, difficulty_level, language, slug").eq("is_published", true);
    for (const c of courses || []) {
      entries.push({
        entity_type: "course",
        entity_id: c.id,
        title: c.title || "",
        content_summary: [c.short_description, c.description].filter(Boolean).join(" ").slice(0, 2000),
        keywords: [c.difficulty_level, c.language, "course"].filter(Boolean) as string[],
        metadata: { slug: c.slug, difficulty: c.difficulty_level },
      });
    }

    // Index lessons
    const { data: lessons } = await sb.from("lessons").select("id, title, content, video_url, course_id");
    for (const l of lessons || []) {
      entries.push({
        entity_type: "lesson",
        entity_id: l.id,
        title: l.title || "",
        content_summary: (l.content || "").slice(0, 2000),
        keywords: ["lesson"],
        metadata: { course_id: l.course_id, has_video: !!l.video_url },
      });
    }

    // Index ebooks
    const { data: ebooks } = await sb.from("ebooks").select("id, title, description, author, tags, slug").eq("is_published", true);
    for (const e of ebooks || []) {
      entries.push({
        entity_type: "ebook",
        entity_id: e.id,
        title: e.title || "",
        content_summary: (e.description || "").slice(0, 2000),
        keywords: [...(e.tags || []), "ebook", e.author].filter(Boolean) as string[],
        metadata: { slug: e.slug, author: e.author },
      });
    }

    // Index quizzes
    const { data: quizzes } = await sb.from("quizzes").select("id, title, description, course_id");
    for (const q of quizzes || []) {
      entries.push({
        entity_type: "quiz",
        entity_id: q.id,
        title: q.title || "",
        content_summary: (q.description || "").slice(0, 2000),
        keywords: ["quiz", "assessment"],
        metadata: { course_id: q.course_id },
      });
    }

    // Index assignments
    const { data: assignments } = await sb.from("assignments").select("id, title, description, instructions, course_id");
    for (const a of assignments || []) {
      entries.push({
        entity_type: "assignment",
        entity_id: a.id,
        title: a.title || "",
        content_summary: [a.description, a.instructions].filter(Boolean).join(" ").slice(0, 2000),
        keywords: ["assignment"],
        metadata: { course_id: a.course_id },
      });
    }

    // Index events
    const { data: events } = await sb.from("events").select("id, title, description, event_type, event_date");
    for (const ev of events || []) {
      entries.push({
        entity_type: "event",
        entity_id: ev.id,
        title: ev.title || "",
        content_summary: (ev.description || "").slice(0, 2000),
        keywords: ["event", ev.event_type].filter(Boolean) as string[],
        metadata: { event_date: ev.event_date, event_type: ev.event_type },
      });
    }

    // Upsert all entries
    let indexed = 0;
    for (const entry of entries) {
      const { error } = await sb.from("ai_search_index").upsert(entry, { onConflict: "entity_type,entity_id" });
      if (!error) indexed++;
    }

    return new Response(JSON.stringify({ success: true, indexed, total: entries.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-index-builder error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
