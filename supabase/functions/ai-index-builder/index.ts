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

    // Index courses with full detail
    const { data: courses } = await sb.from("courses").select("id, title, short_description, description, difficulty_level, language, slug, price, discount_price, category_id, total_lessons, total_duration_minutes").eq("is_published", true);
    for (const c of courses || []) {
      entries.push({
        entity_type: "course",
        entity_id: c.id,
        title: c.title || "",
        content_summary: [c.short_description, c.description, `Difficulty: ${c.difficulty_level}`, `Lessons: ${c.total_lessons}`, `Duration: ${c.total_duration_minutes} min`, `Price: ${c.discount_price || c.price || 'Free'} BDT`].filter(Boolean).join(" | ").slice(0, 3000),
        keywords: [c.difficulty_level, c.language, "course", "enroll", "learn"].filter(Boolean) as string[],
        metadata: { slug: c.slug, difficulty: c.difficulty_level, price: c.price, discount_price: c.discount_price, total_lessons: c.total_lessons },
      });
    }

    // Index lessons with section context
    const { data: lessons } = await sb.from("lessons").select("id, title, content, video_url, course_id, section_id, duration_minutes, sort_order");
    for (const l of lessons || []) {
      entries.push({
        entity_type: "lesson",
        entity_id: l.id,
        title: l.title || "",
        content_summary: (l.content || "").slice(0, 3000),
        keywords: ["lesson", "learn", "video", "study"].filter(Boolean),
        metadata: { course_id: l.course_id, section_id: l.section_id, has_video: !!l.video_url, duration: l.duration_minutes },
      });
    }

    // Index course sections
    const { data: sections } = await sb.from("course_sections").select("id, title, description, course_id");
    for (const s of sections || []) {
      entries.push({
        entity_type: "section",
        entity_id: s.id,
        title: s.title || "",
        content_summary: (s.description || "").slice(0, 2000),
        keywords: ["section", "module", "chapter"],
        metadata: { course_id: s.course_id },
      });
    }

    // Index ebooks with full metadata
    const { data: ebooks } = await sb.from("ebooks").select("id, title, description, author, tags, slug, price, discount_price, page_count, file_format, sub_writers, seo_keywords").eq("is_published", true);
    for (const e of ebooks || []) {
      entries.push({
        entity_type: "ebook",
        entity_id: e.id,
        title: e.title || "",
        content_summary: [e.description, `Author: ${e.author}`, `Pages: ${e.page_count}`, `Format: ${e.file_format}`, e.seo_keywords].filter(Boolean).join(" | ").slice(0, 3000),
        keywords: [...(e.tags || []), "ebook", "book", "read", "download", e.author, ...(e.sub_writers || [])].filter(Boolean) as string[],
        metadata: { slug: e.slug, author: e.author, price: e.price, page_count: e.page_count },
      });
    }

    // Index quizzes
    const { data: quizzes } = await sb.from("quizzes").select("id, title, description, course_id, passing_score, time_limit_minutes");
    for (const q of quizzes || []) {
      entries.push({
        entity_type: "quiz",
        entity_id: q.id,
        title: q.title || "",
        content_summary: [q.description, `Passing: ${q.passing_score}%`, `Time: ${q.time_limit_minutes} min`].filter(Boolean).join(" | ").slice(0, 2000),
        keywords: ["quiz", "assessment", "exam", "test"],
        metadata: { course_id: q.course_id, passing_score: q.passing_score },
      });
    }

    // Index assignments
    const { data: assignments } = await sb.from("assignments").select("id, title, description, instructions, course_id, max_score, due_days");
    for (const a of assignments || []) {
      entries.push({
        entity_type: "assignment",
        entity_id: a.id,
        title: a.title || "",
        content_summary: [a.description, a.instructions, `Max Score: ${a.max_score}`, `Due: ${a.due_days} days`].filter(Boolean).join(" | ").slice(0, 2000),
        keywords: ["assignment", "homework", "submission", "task"],
        metadata: { course_id: a.course_id, max_score: a.max_score },
      });
    }

    // Index events
    const { data: events } = await sb.from("events").select("id, title, description, event_type, event_date, link");
    for (const ev of events || []) {
      entries.push({
        entity_type: "event",
        entity_id: ev.id,
        title: ev.title || "",
        content_summary: [ev.description, `Date: ${ev.event_date}`, `Type: ${ev.event_type}`].filter(Boolean).join(" | ").slice(0, 2000),
        keywords: ["event", ev.event_type, "upcoming", "seminar", "workshop"].filter(Boolean) as string[],
        metadata: { event_date: ev.event_date, event_type: ev.event_type, link: ev.link },
      });
    }

    // Index forum posts (knowledge sharing)
    const { data: posts } = await sb.from("forum_posts").select("id, title, content, view_count").limit(200);
    for (const p of posts || []) {
      entries.push({
        entity_type: "forum_post",
        entity_id: p.id,
        title: p.title || "",
        content_summary: (p.content || "").slice(0, 2000),
        keywords: ["forum", "discussion", "community", "question", "answer"],
        metadata: { view_count: p.view_count },
      });
    }

    // Index site content pages
    const { data: siteContent } = await sb.from("site_content").select("id, page_key, section_key, content");
    for (const sc of siteContent || []) {
      const contentStr = typeof sc.content === "string" ? sc.content : JSON.stringify(sc.content);
      entries.push({
        entity_type: "page",
        entity_id: sc.id,
        title: `${sc.page_key} - ${sc.section_key}`,
        content_summary: contentStr.slice(0, 2000),
        keywords: ["page", sc.page_key, sc.section_key, "info", "about"],
        metadata: { page_key: sc.page_key, section_key: sc.section_key },
      });
    }

    // Index faculty members
    const { data: faculty } = await sb.from("faculty_members").select("id, name, department, designation, specialization, bio").eq("is_active", true);
    for (const f of faculty || []) {
      entries.push({
        entity_type: "faculty",
        entity_id: f.id,
        title: f.name || "",
        content_summary: [f.designation, f.department, f.specialization, f.bio].filter(Boolean).join(" | ").slice(0, 2000),
        keywords: ["faculty", "teacher", "instructor", "professor", f.department, f.specialization].filter(Boolean) as string[],
        metadata: { department: f.department, designation: f.designation },
      });
    }

    // Upsert all entries
    let indexed = 0;
    // Process in batches of 20 for efficiency
    for (let i = 0; i < entries.length; i += 20) {
      const batch = entries.slice(i, i + 20);
      const { error } = await sb.from("ai_search_index").upsert(batch, { onConflict: "entity_type,entity_id" });
      if (!error) indexed += batch.length;
      else console.error("Upsert batch error:", error);
    }

    return new Response(JSON.stringify({ success: true, indexed, total: entries.length, types: [...new Set(entries.map(e => e.entity_type))] }), {
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
