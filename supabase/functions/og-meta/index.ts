// OG meta tag edge function — serves crawler-friendly HTML with correct Open Graph tags
// Used by social media bots (WhatsApp, Facebook, Twitter, LinkedIn, Telegram) to render link previews
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SITE_URL = "https://onlinetextileschool.com";
const SITE_NAME = "Online Textile School";
const DEFAULT_DESC = "Bangladesh's premier online learning platform for textile engineering. Courses in Spinning, Weaving, Dyeing, Knitting, Garments Technology and more.";
const DEFAULT_IMAGE = `${SITE_URL}/og-default.png`;

const escapeHtml = (s: string) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const truncate = (s: string, n = 200) => {
  const clean = String(s ?? "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
  return clean.length > n ? clean.slice(0, n - 1) + "…" : clean;
};

interface MetaPayload {
  title: string;
  description: string;
  image: string;
  url: string;
  type?: string;
}

const renderHtml = (m: MetaPayload) => {
  const title = escapeHtml(m.title);
  const desc = escapeHtml(m.description);
  const image = escapeHtml(m.image);
  const url = escapeHtml(m.url);
  const type = escapeHtml(m.type || "website");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>${title}</title>
<meta name="description" content="${desc}" />

<meta property="og:type" content="${type}" />
<meta property="og:site_name" content="${SITE_NAME}" />
<meta property="og:title" content="${title}" />
<meta property="og:description" content="${desc}" />
<meta property="og:url" content="${url}" />
<meta property="og:image" content="${image}" />
<meta property="og:image:secure_url" content="${image}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:alt" content="${title}" />

<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${title}" />
<meta name="twitter:description" content="${desc}" />
<meta name="twitter:image" content="${image}" />

<link rel="canonical" href="${url}" />
<meta http-equiv="refresh" content="0; url=${url}" />
</head>
<body>
<h1>${title}</h1>
<p>${desc}</p>
<p><a href="${url}">Continue to ${SITE_NAME}</a></p>
</body>
</html>`;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const path = url.searchParams.get("path") || "/";
    const fullUrl = SITE_URL + path;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Defaults
    let meta: MetaPayload = {
      title: SITE_NAME,
      description: DEFAULT_DESC,
      image: DEFAULT_IMAGE,
      url: fullUrl,
      type: "website",
    };

    // Parse path: /<section>/<slug-or-id>
    const parts = path.split("/").filter(Boolean);
    const section = parts[0];
    const identifier = parts[1];

    if (section && identifier) {
      try {
        if (section === "courses") {
          const { data } = await supabase
            .from("courses")
            .select("title, short_description, description, og_image_url, thumbnail_url, meta_title, meta_description")
            .or(`slug.eq.${identifier},id.eq.${identifier}`)
            .maybeSingle();
          if (data) {
            meta = {
              title: `${data.meta_title || data.title} — ${SITE_NAME}`,
              description: truncate(data.meta_description || data.short_description || data.description || DEFAULT_DESC),
              image: data.og_image_url || data.thumbnail_url || DEFAULT_IMAGE,
              url: fullUrl,
              type: "article",
            };
          }
        } else if (section === "workshops") {
          const { data } = await supabase
            .from("workshops")
            .select("title, short_description, description, thumbnail_url, banner_url")
            .or(`slug.eq.${identifier},id.eq.${identifier}`)
            .maybeSingle();
          if (data) {
            meta = {
              title: `${data.title} — ${SITE_NAME}`,
              description: truncate(data.short_description || data.description || DEFAULT_DESC),
              image: (data as any).banner_url || data.thumbnail_url || DEFAULT_IMAGE,
              url: fullUrl,
              type: "article",
            };
          }
        } else if (section === "ebooks") {
          const { data } = await supabase
            .from("ebooks")
            .select("title, description, cover_url")
            .or(`slug.eq.${identifier},id.eq.${identifier}`)
            .maybeSingle();
          if (data) {
            meta = {
              title: `${data.title} — ${SITE_NAME}`,
              description: truncate(data.description || DEFAULT_DESC),
              image: data.cover_url || DEFAULT_IMAGE,
              url: fullUrl,
              type: "book",
            };
          }
        } else if (section === "research") {
          const { data } = await supabase
            .from("research_papers")
            .select("title, abstract")
            .eq("id", identifier)
            .maybeSingle();
          if (data) {
            meta = {
              title: `${data.title} — ${SITE_NAME}`,
              description: truncate(data.abstract || DEFAULT_DESC),
              image: DEFAULT_IMAGE,
              url: fullUrl,
              type: "article",
            };
          }
        } else if (section === "internships") {
          const { data } = await supabase
            .from("internships")
            .select("title, description, company")
            .eq("id", identifier)
            .maybeSingle();
          if (data) {
            meta = {
              title: `${data.title}${data.company ? ` at ${data.company}` : ""} — ${SITE_NAME}`,
              description: truncate(data.description || DEFAULT_DESC),
              image: DEFAULT_IMAGE,
              url: fullUrl,
              type: "article",
            };
          }
        } else if (section === "blog" || section === "posts") {
          const { data } = await supabase
            .from("posts")
            .select("title, excerpt, featured_image_url, content")
            .or(`slug.eq.${identifier},id.eq.${identifier}`)
            .maybeSingle();
          if (data) {
            meta = {
              title: `${data.title} — ${SITE_NAME}`,
              description: truncate((data as any).excerpt || (data as any).content || DEFAULT_DESC),
              image: (data as any).featured_image_url || DEFAULT_IMAGE,
              url: fullUrl,
              type: "article",
            };
          }
        }
      } catch (err) {
        console.error("og-meta lookup error:", err);
      }
    }

    return new Response(renderHtml(meta), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=300, s-maxage=600",
      },
    });
  } catch (e) {
    console.error("og-meta fatal error:", e);
    return new Response(
      renderHtml({
        title: SITE_NAME,
        description: DEFAULT_DESC,
        image: DEFAULT_IMAGE,
        url: SITE_URL,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" } }
    );
  }
});
