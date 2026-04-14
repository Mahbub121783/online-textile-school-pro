import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const SITE_URL = "https://onlinetextileschool.com";

serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    const now = new Date().toISOString().split("T")[0];

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
      { loc: "/forum", priority: "0.7", changefreq: "daily" },
      { loc: "/register", priority: "0.5", changefreq: "monthly" },
      { loc: "/login", priority: "0.3", changefreq: "monthly" },
      { loc: "/become-instructor", priority: "0.6", changefreq: "monthly" },
      { loc: "/privacy", priority: "0.3", changefreq: "yearly" },
      { loc: "/terms", priority: "0.3", changefreq: "yearly" },
    ];

    let urls = staticPages.map(
      (p) =>
        `  <url>\n    <loc>${SITE_URL}${p.loc}</loc>\n    <lastmod>${now}</lastmod>\n    <changefreq>${p.changefreq}</changefreq>\n    <priority>${p.priority}</priority>\n  </url>`
    );

    // Dynamic: Courses
    const { data: courses } = await sb
      .from("courses")
      .select("slug, updated_at")
      .eq("is_published", true);
    for (const c of courses || []) {
      const lastmod = c.updated_at?.split("T")[0] || now;
      urls.push(
        `  <url>\n    <loc>${SITE_URL}/courses/${c.slug}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>`
      );
    }

    // Dynamic: Ebooks
    const { data: ebooks } = await sb
      .from("ebooks")
      .select("slug, created_at")
      .eq("is_published", true);
    for (const e of ebooks || []) {
      const lastmod = e.created_at?.split("T")[0] || now;
      urls.push(
        `  <url>\n    <loc>${SITE_URL}/ebooks/${e.slug}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.7</priority>\n  </url>`
      );
    }

    // Dynamic: Blog posts
    const { data: posts } = await sb
      .from("posts")
      .select("slug, updated_at")
      .eq("status", "published");
    for (const p of posts || []) {
      const lastmod = p.updated_at?.split("T")[0] || now;
      urls.push(
        `  <url>\n    <loc>${SITE_URL}/blog/${p.slug}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n  </url>`
      );
    }

    // Dynamic: Learning paths
    const { data: paths } = await sb
      .from("learning_paths")
      .select("slug, updated_at")
      .eq("is_published", true);
    for (const lp of paths || []) {
      const lastmod = lp.updated_at?.split("T")[0] || now;
      urls.push(
        `  <url>\n    <loc>${SITE_URL}/learning-paths/${lp.slug}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n  </url>`
      );
    }

    // Dynamic: CMS pages
    const { data: pages } = await sb
      .from("pages")
      .select("slug, updated_at")
      .eq("status", "published");
    for (const pg of pages || []) {
      urls.push(
        `  <url>\n    <loc>${SITE_URL}/page/${pg.slug}</loc>\n    <lastmod>${pg.updated_at?.split("T")[0] || now}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.5</priority>\n  </url>`
      );
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
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