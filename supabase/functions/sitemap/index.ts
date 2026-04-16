import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const SITE_URL = "https://onlinetextileschool.com";

serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    const now = new Date().toISOString().split("T")[0];

    const escapeXml = (s: string) =>
      String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");

    const absolute = (u: string) => {
      if (!u) return "";
      if (u.startsWith("http")) return u;
      if (u.startsWith("//")) return "https:" + u;
      return `${SITE_URL}${u.startsWith("/") ? "" : "/"}${u}`;
    };

    const buildUrl = (
      loc: string,
      lastmod: string,
      changefreq: string,
      priority: string,
      image?: string,
      imageTitle?: string,
    ) => {
      let block = `  <url>\n    <loc>${escapeXml(loc)}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>`;
      if (image) {
        block += `\n    <image:image>\n      <image:loc>${escapeXml(absolute(image))}</image:loc>`;
        if (imageTitle) block += `\n      <image:title>${escapeXml(imageTitle)}</image:title>`;
        block += `\n    </image:image>`;
      }
      block += `\n  </url>`;
      return block;
    };

    // Static pages
    const staticPages = [
      { loc: "/", priority: "1.0", changefreq: "daily" },
      { loc: "/courses", priority: "0.9", changefreq: "daily" },
      { loc: "/ebooks", priority: "0.8", changefreq: "weekly" },
      { loc: "/blog", priority: "0.8", changefreq: "daily" },
      { loc: "/events", priority: "0.7", changefreq: "weekly" },
      { loc: "/about", priority: "0.6", changefreq: "monthly" },
      { loc: "/contact", priority: "0.6", changefreq: "monthly" },
      { loc: "/faculty", priority: "0.6", changefreq: "monthly" },
      { loc: "/departments", priority: "0.6", changefreq: "monthly" },
      { loc: "/internships", priority: "0.7", changefreq: "weekly" },
      { loc: "/research-papers", priority: "0.7", changefreq: "weekly" },
      { loc: "/virtual-labs", priority: "0.7", changefreq: "weekly" },
      { loc: "/learning-paths", priority: "0.8", changefreq: "weekly" },
      { loc: "/workshops", priority: "0.7", changefreq: "weekly" },
      { loc: "/forum", priority: "0.7", changefreq: "daily" },
      { loc: "/register", priority: "0.5", changefreq: "monthly" },
      { loc: "/login", priority: "0.3", changefreq: "monthly" },
      { loc: "/become-instructor", priority: "0.6", changefreq: "monthly" },
      { loc: "/privacy", priority: "0.3", changefreq: "yearly" },
      { loc: "/terms", priority: "0.3", changefreq: "yearly" },
    ];

    let urls = staticPages.map((p) =>
      buildUrl(`${SITE_URL}${p.loc}`, now, p.changefreq, p.priority),
    );

    // Courses
    const { data: courses } = await sb
      .from("courses")
      .select("slug, updated_at, title, thumbnail_url, og_image_url")
      .eq("is_published", true);
    for (const c of courses || []) {
      urls.push(
        buildUrl(
          `${SITE_URL}/courses/${c.slug}`,
          c.updated_at?.split("T")[0] || now,
          "weekly",
          "0.8",
          c.og_image_url || c.thumbnail_url,
          c.title,
        ),
      );
    }

    // Ebooks
    const { data: ebooks } = await sb
      .from("ebooks")
      .select("slug, created_at, title, cover_url, og_image_url")
      .eq("is_published", true);
    for (const e of ebooks || []) {
      urls.push(
        buildUrl(
          `${SITE_URL}/ebooks/${e.slug}`,
          e.created_at?.split("T")[0] || now,
          "monthly",
          "0.7",
          e.og_image_url || e.cover_url,
          e.title,
        ),
      );
    }

    // Blog posts
    const { data: posts } = await sb
      .from("posts")
      .select("slug, updated_at, title, featured_image_url, og_image_url")
      .eq("status", "published");
    for (const p of posts || []) {
      urls.push(
        buildUrl(
          `${SITE_URL}/blog/${p.slug}`,
          p.updated_at?.split("T")[0] || now,
          "weekly",
          "0.7",
          p.og_image_url || p.featured_image_url,
          p.title,
        ),
      );
    }

    // Learning paths
    const { data: paths } = await sb
      .from("learning_paths")
      .select("slug, updated_at, title, thumbnail_url, og_image_url")
      .eq("is_published", true);
    for (const lp of paths || []) {
      urls.push(
        buildUrl(
          `${SITE_URL}/learning-paths/${lp.slug}`,
          lp.updated_at?.split("T")[0] || now,
          "weekly",
          "0.7",
          lp.og_image_url || lp.thumbnail_url,
          lp.title,
        ),
      );
    }

    // Workshops
    const { data: workshops } = await sb
      .from("workshops")
      .select("slug, updated_at, title, thumbnail_url, og_image_url")
      .eq("status", "published");
    for (const w of workshops || []) {
      urls.push(
        buildUrl(
          `${SITE_URL}/workshops/${w.slug}`,
          w.updated_at?.split("T")[0] || now,
          "weekly",
          "0.7",
          w.og_image_url || w.thumbnail_url,
          w.title,
        ),
      );
    }

    // Research papers
    const { data: research } = await sb
      .from("research_papers")
      .select("id, updated_at, title, cover_image_url, og_image_url")
      .eq("status", "published");
    for (const r of research || []) {
      urls.push(
        buildUrl(
          `${SITE_URL}/research/${r.id}`,
          r.updated_at?.split("T")[0] || now,
          "monthly",
          "0.7",
          r.og_image_url || r.cover_image_url,
          r.title,
        ),
      );
    }

    // Internships
    const { data: internships } = await sb
      .from("internships")
      .select("id, updated_at, title")
      .eq("is_published", true);
    for (const i of internships || []) {
      urls.push(
        buildUrl(
          `${SITE_URL}/internships/${i.id}`,
          i.updated_at?.split("T")[0] || now,
          "weekly",
          "0.6",
        ),
      );
    }

    // Faculty
    const { data: faculty } = await sb
      .from("faculty_members")
      .select("id, updated_at, name, photo_url")
      .eq("is_active", true);
    for (const f of faculty || []) {
      urls.push(
        buildUrl(
          `${SITE_URL}/faculty#${f.id}`,
          f.updated_at?.split("T")[0] || now,
          "monthly",
          "0.4",
          f.photo_url,
          f.name,
        ),
      );
    }

    // CMS pages
    const { data: pages } = await sb
      .from("pages")
      .select("slug, updated_at")
      .eq("status", "published");
    for (const pg of pages || []) {
      urls.push(
        buildUrl(
          `${SITE_URL}/page/${pg.slug}`,
          pg.updated_at?.split("T")[0] || now,
          "monthly",
          "0.5",
        ),
      );
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls.join("\n")}
</urlset>`;

    return new Response(xml, {
      headers: {
        "Content-Type": "application/xml",
        "Cache-Control": "public, max-age=3600",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (e) {
    console.error("sitemap error:", e);
    return new Response("Error generating sitemap", { status: 500 });
  }
});
