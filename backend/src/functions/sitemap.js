// Ported from supabase/functions/sitemap/index.ts (Deno -> Node).
const { serviceQuery } = require('../db');

const SITE_URL = 'https://onlinetextileschool.com';

function escapeXml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function absolute(u) {
  if (!u) return '';
  if (u.startsWith('http')) return u;
  if (u.startsWith('//')) return 'https:' + u;
  return `${SITE_URL}${u.startsWith('/') ? '' : '/'}${u}`;
}

function buildUrl(loc, lastmod, changefreq, priority, image, imageTitle) {
  let block = `  <url>\n    <loc>${escapeXml(loc)}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>`;
  if (image) {
    block += `\n    <image:image>\n      <image:loc>${escapeXml(absolute(image))}</image:loc>`;
    if (imageTitle) block += `\n      <image:title>${escapeXml(imageTitle)}</image:title>`;
    block += `\n    </image:image>`;
  }
  block += `\n  </url>`;
  return block;
}

async function sitemap(req, res) {
  try {
    const now = new Date().toISOString().split('T')[0];

    const staticPages = [
      { loc: '/', priority: '1.0', changefreq: 'daily' },
      { loc: '/courses', priority: '0.9', changefreq: 'daily' },
      { loc: '/ebooks', priority: '0.8', changefreq: 'weekly' },
      { loc: '/blog', priority: '0.8', changefreq: 'daily' },
      { loc: '/events', priority: '0.7', changefreq: 'weekly' },
      { loc: '/about', priority: '0.6', changefreq: 'monthly' },
      { loc: '/contact', priority: '0.6', changefreq: 'monthly' },
      { loc: '/faculty', priority: '0.6', changefreq: 'monthly' },
      { loc: '/departments', priority: '0.6', changefreq: 'monthly' },
      { loc: '/internships', priority: '0.7', changefreq: 'weekly' },
      { loc: '/research-papers', priority: '0.7', changefreq: 'weekly' },
      { loc: '/virtual-labs', priority: '0.7', changefreq: 'weekly' },
      { loc: '/learning-paths', priority: '0.8', changefreq: 'weekly' },
      { loc: '/workshops', priority: '0.7', changefreq: 'weekly' },
      { loc: '/forum', priority: '0.7', changefreq: 'daily' },
      { loc: '/register', priority: '0.5', changefreq: 'monthly' },
      { loc: '/login', priority: '0.3', changefreq: 'monthly' },
      { loc: '/become-instructor', priority: '0.6', changefreq: 'monthly' },
      { loc: '/privacy', priority: '0.3', changefreq: 'yearly' },
      { loc: '/terms', priority: '0.3', changefreq: 'yearly' },
    ];

    const urls = staticPages.map((p) => buildUrl(`${SITE_URL}${p.loc}`, now, p.changefreq, p.priority));

    const courses = await serviceQuery('SELECT slug, updated_at, title, thumbnail_url, og_image_url FROM public.courses WHERE is_published = true');
    for (const c of courses.rows) {
      urls.push(buildUrl(`${SITE_URL}/courses/${c.slug}`, c.updated_at ? c.updated_at.toISOString().split('T')[0] : now, 'weekly', '0.8', c.og_image_url || c.thumbnail_url, c.title));
    }

    const ebooks = await serviceQuery('SELECT slug, created_at, title, cover_url, og_image_url FROM public.ebooks WHERE is_published = true');
    for (const e of ebooks.rows) {
      urls.push(buildUrl(`${SITE_URL}/ebooks/${e.slug}`, e.created_at ? e.created_at.toISOString().split('T')[0] : now, 'monthly', '0.7', e.og_image_url || e.cover_url, e.title));
    }

    const posts = await serviceQuery("SELECT slug, updated_at, title, featured_image_url, og_image_url FROM public.posts WHERE status = 'published'");
    for (const p of posts.rows) {
      urls.push(buildUrl(`${SITE_URL}/blog/${p.slug}`, p.updated_at ? p.updated_at.toISOString().split('T')[0] : now, 'weekly', '0.7', p.og_image_url || p.featured_image_url, p.title));
    }

    const paths = await serviceQuery('SELECT slug, updated_at, title, thumbnail_url, og_image_url FROM public.learning_paths WHERE is_published = true');
    for (const lp of paths.rows) {
      urls.push(buildUrl(`${SITE_URL}/learning-paths/${lp.slug}`, lp.updated_at ? lp.updated_at.toISOString().split('T')[0] : now, 'weekly', '0.7', lp.og_image_url || lp.thumbnail_url, lp.title));
    }

    const workshops = await serviceQuery("SELECT slug, updated_at, title, thumbnail_url, og_image_url FROM public.workshops WHERE status = 'published'");
    for (const w of workshops.rows) {
      urls.push(buildUrl(`${SITE_URL}/workshops/${w.slug}`, w.updated_at ? w.updated_at.toISOString().split('T')[0] : now, 'weekly', '0.7', w.og_image_url || w.thumbnail_url, w.title));
    }

    const research = await serviceQuery("SELECT id, updated_at, title, cover_image_url, og_image_url FROM public.research_papers WHERE status = 'published'");
    for (const r of research.rows) {
      urls.push(buildUrl(`${SITE_URL}/research/${r.id}`, r.updated_at ? r.updated_at.toISOString().split('T')[0] : now, 'monthly', '0.7', r.og_image_url || r.cover_image_url, r.title));
    }

    const internships = await serviceQuery('SELECT id, updated_at, title FROM public.internships WHERE is_published = true');
    for (const i of internships.rows) {
      urls.push(buildUrl(`${SITE_URL}/internships/${i.id}`, i.updated_at ? i.updated_at.toISOString().split('T')[0] : now, 'weekly', '0.6'));
    }

    const faculty = await serviceQuery('SELECT id, updated_at, name, photo_url FROM public.faculty_members WHERE is_active = true');
    for (const f of faculty.rows) {
      urls.push(buildUrl(`${SITE_URL}/faculty#${f.id}`, f.updated_at ? f.updated_at.toISOString().split('T')[0] : now, 'monthly', '0.4', f.photo_url, f.name));
    }

    const pages = await serviceQuery("SELECT slug, updated_at FROM public.pages WHERE status = 'published'");
    for (const pg of pages.rows) {
      urls.push(buildUrl(`${SITE_URL}/page/${pg.slug}`, pg.updated_at ? pg.updated_at.toISOString().split('T')[0] : now, 'monthly', '0.5'));
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${urls.join('\n')}\n</urlset>`;

    res.set('Content-Type', 'application/xml');
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(xml);
  } catch (e) {
    console.error('sitemap error:', e);
    res.status(500).send('Error generating sitemap');
  }
}

module.exports = { sitemap };
