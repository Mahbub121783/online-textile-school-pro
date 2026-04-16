// IndexNow ping — instantly notifies Bing/Yandex/Seznam when content is published.
// Also pings Google & Bing legacy sitemap endpoints for full coverage.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SITE_HOST = "onlinetextileschool.com";
const SITE_URL = `https://${SITE_HOST}`;
const SITEMAP_URL = `${SITE_URL}/sitemap.xml`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const paths: string[] = Array.isArray(body.paths) ? body.paths : [];
    const urls = paths
      .filter((p) => typeof p === "string")
      .map((p) => (p.startsWith("http") ? p : `${SITE_URL}${p.startsWith("/") ? "" : "/"}${p}`));

    const results: Record<string, unknown> = {};
    const indexNowKey = Deno.env.get("INDEXNOW_KEY");

    // 1. IndexNow (Bing, Yandex, Seznam, Naver)
    if (indexNowKey && urls.length > 0) {
      try {
        const r = await fetch("https://api.indexnow.org/indexnow", {
          method: "POST",
          headers: { "Content-Type": "application/json; charset=utf-8" },
          body: JSON.stringify({
            host: SITE_HOST,
            key: indexNowKey,
            keyLocation: `${SITE_URL}/${indexNowKey}.txt`,
            urlList: urls,
          }),
        });
        results.indexnow = { status: r.status, ok: r.ok };
      } catch (e) {
        results.indexnow = { error: String(e) };
      }
    } else {
      results.indexnow = { skipped: indexNowKey ? "no urls" : "no key" };
    }

    // 2. Google sitemap ping (legacy but still works)
    try {
      const g = await fetch(`https://www.google.com/ping?sitemap=${encodeURIComponent(SITEMAP_URL)}`);
      results.google = { status: g.status };
    } catch (e) {
      results.google = { error: String(e) };
    }

    // 3. Bing sitemap ping
    try {
      const b = await fetch(`https://www.bing.com/ping?sitemap=${encodeURIComponent(SITEMAP_URL)}`);
      results.bing = { status: b.status };
    } catch (e) {
      results.bing = { error: String(e) };
    }

    return new Response(JSON.stringify({ ok: true, urls, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
