// Ported from supabase/functions/indexnow-ping/index.ts (Deno -> Node).
const fetch = require('node-fetch');

const SITE_HOST = 'onlinetextileschool.com';
const SITE_URL = `https://${SITE_HOST}`;
const SITEMAP_URL = `${SITE_URL}/sitemap.xml`;

async function indexnowPing(req, res) {
  try {
    const body = req.body || {};
    const paths = Array.isArray(body.paths) ? body.paths : [];
    const urls = paths
      .filter((p) => typeof p === 'string')
      .map((p) => (p.startsWith('http') ? p : `${SITE_URL}${p.startsWith('/') ? '' : '/'}${p}`));

    const results = {};
    const indexNowKey = process.env.INDEXNOW_KEY;

    if (indexNowKey && urls.length > 0) {
      try {
        const r = await fetch('https://api.indexnow.org/indexnow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify({ host: SITE_HOST, key: indexNowKey, keyLocation: `${SITE_URL}/${indexNowKey}.txt`, urlList: urls }),
        });
        results.indexnow = { status: r.status, ok: r.ok };
      } catch (e) {
        results.indexnow = { error: String(e) };
      }
    } else {
      results.indexnow = { skipped: indexNowKey ? 'no urls' : 'no key' };
    }

    try {
      const g = await fetch(`https://www.google.com/ping?sitemap=${encodeURIComponent(SITEMAP_URL)}`);
      results.google = { status: g.status };
    } catch (e) {
      results.google = { error: String(e) };
    }

    try {
      const b = await fetch(`https://www.bing.com/ping?sitemap=${encodeURIComponent(SITEMAP_URL)}`);
      results.bing = { status: b.status };
    } catch (e) {
      results.bing = { error: String(e) };
    }

    res.json({ ok: true, urls, results });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}

module.exports = { indexnowPing };
