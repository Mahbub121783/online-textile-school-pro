// Ported from supabase/functions/ai-index-builder/index.ts (Deno -> Node).
// Rebuilds ai_search_index, the full-text-search table ai-tutor queries for
// platform-content context. Triggered by Admin -> AI Chatbot -> "Rebuild
// Index" button (pure REST call, already works -- see AdminAiChatbot.tsx).
//
// Column corrections vs. the original source (verified against the live
// reconstructed schema, not supabase/types.ts): lessons has no `content`
// column (it's `description`) and no direct `course_id` (only
// `section_id` -- course_id is derived via a join through course_sections,
// same relationship lessons' own RLS policy relies on). quizzes has
// `pass_percentage`, not `passing_score` (same mismatch found earlier while
// porting ai-tutor's platform-context query).
const { serviceQuery } = require('../db');

async function aiIndexBuilder(req, res) {
  try {
    const entries = [];

    const courses = await serviceQuery(
      `SELECT id, title, short_description, description, difficulty_level, language, slug, price, discount_price, category_id, total_lessons, total_duration_minutes
       FROM public.courses WHERE is_published = true`
    );
    for (const c of courses.rows) {
      entries.push({
        entity_type: 'course',
        entity_id: c.id,
        title: c.title || '',
        content_summary: [c.short_description, c.description, `Difficulty: ${c.difficulty_level}`, `Lessons: ${c.total_lessons}`, `Duration: ${c.total_duration_minutes} min`, `Price: ${c.discount_price || c.price || 'Free'} BDT`].filter(Boolean).join(' | ').slice(0, 3000),
        keywords: [c.difficulty_level, c.language, 'course', 'enroll', 'learn'].filter(Boolean),
        metadata: { slug: c.slug, difficulty: c.difficulty_level, price: c.price, discount_price: c.discount_price, total_lessons: c.total_lessons },
      });
    }

    const lessons = await serviceQuery(
      `SELECT l.id, l.title, l.description, l.video_url, cs.course_id, l.section_id, l.duration_minutes, l.sort_order
       FROM public.lessons l JOIN public.course_sections cs ON cs.id = l.section_id`
    );
    for (const l of lessons.rows) {
      entries.push({
        entity_type: 'lesson',
        entity_id: l.id,
        title: l.title || '',
        content_summary: (l.description || '').slice(0, 3000),
        keywords: ['lesson', 'learn', 'video', 'study'],
        metadata: { course_id: l.course_id, section_id: l.section_id, has_video: !!l.video_url, duration: l.duration_minutes },
      });
    }

    const sections = await serviceQuery('SELECT id, title, description, course_id FROM public.course_sections');
    for (const s of sections.rows) {
      entries.push({
        entity_type: 'section',
        entity_id: s.id,
        title: s.title || '',
        content_summary: (s.description || '').slice(0, 2000),
        keywords: ['section', 'module', 'chapter'],
        metadata: { course_id: s.course_id },
      });
    }

    const ebooks = await serviceQuery(
      `SELECT id, title, description, author, tags, slug, price, discount_price, page_count, file_format, sub_writers, seo_keywords
       FROM public.ebooks WHERE is_published = true`
    );
    for (const e of ebooks.rows) {
      entries.push({
        entity_type: 'ebook',
        entity_id: e.id,
        title: e.title || '',
        content_summary: [e.description, `Author: ${e.author}`, `Pages: ${e.page_count}`, `Format: ${e.file_format}`, e.seo_keywords].filter(Boolean).join(' | ').slice(0, 3000),
        keywords: [...(e.tags || []), 'ebook', 'book', 'read', 'download', e.author, ...(e.sub_writers || [])].filter(Boolean),
        metadata: { slug: e.slug, author: e.author, price: e.price, page_count: e.page_count },
      });
    }

    const quizzes = await serviceQuery('SELECT id, title, description, course_id, pass_percentage, time_limit_minutes FROM public.quizzes');
    for (const q of quizzes.rows) {
      entries.push({
        entity_type: 'quiz',
        entity_id: q.id,
        title: q.title || '',
        content_summary: [q.description, `Passing: ${q.pass_percentage}%`, `Time: ${q.time_limit_minutes} min`].filter(Boolean).join(' | ').slice(0, 2000),
        keywords: ['quiz', 'assessment', 'exam', 'test'],
        metadata: { course_id: q.course_id, pass_percentage: q.pass_percentage },
      });
    }

    const assignments = await serviceQuery('SELECT id, title, description, instructions, course_id, max_score, due_days FROM public.assignments');
    for (const a of assignments.rows) {
      entries.push({
        entity_type: 'assignment',
        entity_id: a.id,
        title: a.title || '',
        content_summary: [a.description, a.instructions, `Max Score: ${a.max_score}`, `Due: ${a.due_days} days`].filter(Boolean).join(' | ').slice(0, 2000),
        keywords: ['assignment', 'homework', 'submission', 'task'],
        metadata: { course_id: a.course_id, max_score: a.max_score },
      });
    }

    const events = await serviceQuery('SELECT id, title, description, event_type, event_date, link FROM public.events');
    for (const ev of events.rows) {
      entries.push({
        entity_type: 'event',
        entity_id: ev.id,
        title: ev.title || '',
        content_summary: [ev.description, `Date: ${ev.event_date}`, `Type: ${ev.event_type}`].filter(Boolean).join(' | ').slice(0, 2000),
        keywords: ['event', ev.event_type, 'upcoming', 'seminar', 'workshop'].filter(Boolean),
        metadata: { event_date: ev.event_date, event_type: ev.event_type, link: ev.link },
      });
    }

    const posts = await serviceQuery('SELECT id, title, content, view_count FROM public.forum_posts LIMIT 200');
    for (const p of posts.rows) {
      entries.push({
        entity_type: 'forum_post',
        entity_id: p.id,
        title: p.title || '',
        content_summary: (p.content || '').slice(0, 2000),
        keywords: ['forum', 'discussion', 'community', 'question', 'answer'],
        metadata: { view_count: p.view_count },
      });
    }

    const siteContent = await serviceQuery('SELECT id, page_key, section_key, content FROM public.site_content');
    for (const sc of siteContent.rows) {
      const contentStr = typeof sc.content === 'string' ? sc.content : JSON.stringify(sc.content);
      entries.push({
        entity_type: 'page',
        entity_id: sc.id,
        title: `${sc.page_key} - ${sc.section_key}`,
        content_summary: contentStr.slice(0, 2000),
        keywords: ['page', sc.page_key, sc.section_key, 'info', 'about'],
        metadata: { page_key: sc.page_key, section_key: sc.section_key },
      });
    }

    const faculty = await serviceQuery('SELECT id, name, department, designation, specialization, bio FROM public.faculty_members WHERE is_active = true');
    for (const f of faculty.rows) {
      entries.push({
        entity_type: 'faculty',
        entity_id: f.id,
        title: f.name || '',
        content_summary: [f.designation, f.department, f.specialization, f.bio].filter(Boolean).join(' | ').slice(0, 2000),
        keywords: ['faculty', 'teacher', 'instructor', 'professor', f.department, f.specialization].filter(Boolean),
        metadata: { department: f.department, designation: f.designation },
      });
    }

    let indexed = 0;
    for (let i = 0; i < entries.length; i += 20) {
      const batch = entries.slice(i, i + 20);
      try {
        const values = [];
        const params = [];
        batch.forEach((e, idx) => {
          const base = idx * 6;
          values.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6})`);
          params.push(e.entity_type, e.entity_id, e.title, e.content_summary, e.keywords, JSON.stringify(e.metadata));
        });
        await serviceQuery(
          `INSERT INTO public.ai_search_index (entity_type, entity_id, title, content_summary, keywords, metadata)
           VALUES ${values.join(',')}
           ON CONFLICT (entity_type, entity_id) DO UPDATE SET
             title = EXCLUDED.title, content_summary = EXCLUDED.content_summary,
             keywords = EXCLUDED.keywords, metadata = EXCLUDED.metadata`,
          params
        );
        indexed += batch.length;
      } catch (err) {
        console.error('Upsert batch error:', err.message);
      }
    }

    res.json({ success: true, indexed, total: entries.length, types: [...new Set(entries.map((e) => e.entity_type))] });
  } catch (e) {
    console.error('ai-index-builder error:', e);
    res.status(500).json({ error: e.message || 'Unknown error' });
  }
}

module.exports = { aiIndexBuilder };
