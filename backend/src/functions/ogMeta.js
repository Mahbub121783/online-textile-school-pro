// Ported from supabase/functions/og-meta/index.ts (Deno -> Node).
const { serviceQuery } = require('../db');

const SITE_URL = 'https://onlinetextileschool.com';
const SITE_NAME = 'Online Textile School';
const DEFAULT_DESC = "Bangladesh's premier online learning platform for textile engineering. Courses in Spinning, Weaving, Dyeing, Knitting, Garments Technology and more.";
const DEFAULT_IMAGE = `${SITE_URL}/og-default.png`;

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function truncate(s, n = 200) {
  const clean = String(s ?? '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  return clean.length > n ? clean.slice(0, n - 1) + '…' : clean;
}

function normalizeImageUrl(url) {
  if (!url || typeof url !== 'string') return DEFAULT_IMAGE;
  let clean = url.trim();
  if (!clean) return DEFAULT_IMAGE;
  if (clean.startsWith('//')) clean = 'https:' + clean;
  else if (clean.startsWith('/')) clean = SITE_URL + clean;
  else if (!/^https?:\/\//i.test(clean)) clean = SITE_URL + '/' + clean;
  if (clean.includes('res.cloudinary.com') && clean.includes('/upload/')) {
    if (!/\/upload\/[^/]*[wh]_\d+/.test(clean)) {
      clean = clean.replace('/upload/', '/upload/c_fill,w_1200,h_630,q_auto,f_auto/');
    }
  }
  return clean;
}

function renderHtml(m) {
  const title = escapeHtml(m.title);
  const desc = escapeHtml(m.description);
  const image = escapeHtml(m.image);
  const url = escapeHtml(m.url);
  const type = escapeHtml(m.type || 'website');

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
<meta property="og:image:type" content="image/jpeg" />
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
}

const SECTION_QUERIES = {
  courses: {
    sql: 'SELECT title, short_description, description, og_image_url, thumbnail_url, meta_title, meta_description FROM public.courses WHERE slug = $1 OR id::text = $1 LIMIT 1',
    map: (data) => ({
      title: `${data.meta_title || data.title} — ${SITE_NAME}`,
      description: truncate(data.meta_description || data.short_description || data.description || DEFAULT_DESC),
      image: normalizeImageUrl(data.og_image_url || data.thumbnail_url),
      type: 'article',
    }),
  },
  workshops: {
    sql: 'SELECT title, short_description, description, thumbnail_url, banner_url, meta_title, meta_description, og_image_url FROM public.workshops WHERE slug = $1 OR id::text = $1 LIMIT 1',
    map: (data) => ({
      title: `${data.meta_title || data.title} — ${SITE_NAME}`,
      description: truncate(data.meta_description || data.short_description || data.description || DEFAULT_DESC),
      image: normalizeImageUrl(data.og_image_url || data.banner_url || data.thumbnail_url),
      type: 'article',
    }),
  },
  ebooks: {
    sql: 'SELECT title, description, cover_url, meta_title, meta_description, og_image_url FROM public.ebooks WHERE slug = $1 OR id::text = $1 LIMIT 1',
    map: (data) => ({
      title: `${data.meta_title || data.title} — ${SITE_NAME}`,
      description: truncate(data.meta_description || data.description || DEFAULT_DESC),
      image: normalizeImageUrl(data.og_image_url || data.cover_url),
      type: 'book',
    }),
  },
  research: {
    sql: 'SELECT title, abstract, cover_image_url, meta_title, meta_description, og_image_url FROM public.research_papers WHERE id::text = $1 LIMIT 1',
    map: (data) => ({
      title: `${data.meta_title || data.title} — ${SITE_NAME}`,
      description: truncate(data.meta_description || data.abstract || DEFAULT_DESC),
      image: normalizeImageUrl(data.og_image_url || data.cover_image_url),
      type: 'article',
    }),
  },
  internships: {
    sql: 'SELECT title, description, company, meta_title, meta_description, og_image_url FROM public.internships WHERE id::text = $1 LIMIT 1',
    map: (data) => ({
      title: `${data.meta_title || data.title}${data.company ? ` at ${data.company}` : ''} — ${SITE_NAME}`,
      description: truncate(data.meta_description || data.description || DEFAULT_DESC),
      image: normalizeImageUrl(data.og_image_url) || DEFAULT_IMAGE,
      type: 'article',
    }),
  },
  'learning-paths': {
    sql: 'SELECT title, description, thumbnail_url, meta_title, meta_description, og_image_url FROM public.learning_paths WHERE slug = $1 OR id::text = $1 LIMIT 1',
    map: (data) => ({
      title: `${data.meta_title || data.title} — ${SITE_NAME}`,
      description: truncate(data.meta_description || data.description || DEFAULT_DESC),
      image: normalizeImageUrl(data.og_image_url || data.thumbnail_url),
      type: 'article',
    }),
  },
  blog: {
    sql: 'SELECT title, excerpt, featured_image_url, content, meta_title, meta_description, og_image_url FROM public.posts WHERE slug = $1 OR id::text = $1 LIMIT 1',
    map: (data) => ({
      title: `${data.meta_title || data.title} — ${SITE_NAME}`,
      description: truncate(data.meta_description || data.excerpt || data.content || DEFAULT_DESC),
      image: normalizeImageUrl(data.og_image_url || data.featured_image_url),
      type: 'article',
    }),
  },
};
SECTION_QUERIES.posts = SECTION_QUERIES.blog;

async function ogMeta(req, res) {
  try {
    const path = req.query.path || '/';
    const fullUrl = SITE_URL + path;

    let meta = { title: SITE_NAME, description: DEFAULT_DESC, image: DEFAULT_IMAGE, url: fullUrl, type: 'website' };

    const parts = path.split('/').filter(Boolean);
    const section = parts[0];
    const identifier = parts[1];

    if (section && identifier && SECTION_QUERIES[section]) {
      try {
        const q = SECTION_QUERIES[section];
        const result = await serviceQuery(q.sql, [identifier]);
        if (result.rows[0]) {
          meta = { ...q.map(result.rows[0]), url: fullUrl };
        }
      } catch (err) {
        console.error('og-meta lookup error:', err);
      }
    }

    res.set('Content-Type', 'text/html; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=300, s-maxage=600');
    res.send(renderHtml(meta));
  } catch (e) {
    console.error('og-meta fatal error:', e);
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.send(renderHtml({ title: SITE_NAME, description: DEFAULT_DESC, image: DEFAULT_IMAGE, url: SITE_URL }));
  }
}

module.exports = { ogMeta };
