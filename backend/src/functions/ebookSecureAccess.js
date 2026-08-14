// Ported from supabase/functions/ebook-secure-access/index.ts (Deno -> Node).
// Actions ported: generate_token (POST) and stream (GET, used by PDF.js for
// range-based incremental loading). Legacy POST stream_file not ported
// (frontend only uses GET streaming).
const crypto = require('crypto');
const fetch = require('node-fetch');
const jwt = require('jsonwebtoken');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { serviceQuery } = require('../db');

function requireUser(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return null;
  try {
    return jwt.verify(token, process.env.JWT_SECRET).sub;
  } catch {
    return null;
  }
}

function isR2Url(url) {
  try {
    const hostname = new URL(url).hostname;
    return hostname.includes('r2.cloudflarestorage.com') || hostname.includes('r2.dev') || hostname.includes('pub-');
  } catch {
    return false;
  }
}

async function fetchFromR2Direct(fileUrl, rangeHeader) {
  const accountsRes = await serviceQuery("SELECT * FROM public.cloudflare_r2_accounts WHERE status = 'active'");
  const accounts = accountsRes.rows;
  if (!accounts.length) throw new Error('No active R2 accounts found');

  const urlObj = new URL(fileUrl);
  const urlPath = urlObj.pathname.replace(/^\//, '');
  let matchedAccount = accounts.find((a) => {
    try { return urlObj.hostname === new URL(a.public_domain_url).hostname; } catch { return false; }
  });
  if (!matchedAccount) matchedAccount = accounts[0];

  const s3 = new S3Client({
    region: 'auto',
    endpoint: matchedAccount.endpoint_url,
    credentials: { accessKeyId: matchedAccount.access_key_id, secretAccessKey: matchedAccount.secret_access_key },
  });
  const commandInput = { Bucket: matchedAccount.bucket_name, Key: urlPath };
  if (rangeHeader) commandInput.Range = rangeHeader;

  const s3Response = await s3.send(new GetObjectCommand(commandInput));
  if (!s3Response.Body) throw new Error('S3 returned empty body');

  return {
    stream: s3Response.Body,
    contentType: s3Response.ContentType || 'application/pdf',
    contentLength: s3Response.ContentLength,
    contentRange: s3Response.ContentRange,
    status: s3Response.ContentRange ? 206 : 200,
  };
}

async function ebookGenerateToken(req, res) {
  const userId = requireUser(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { ebook_id } = req.body || {};
  if (!ebook_id) return res.status(400).json({ error: 'ebook_id required' });

  const purchaseRes = await serviceQuery(
    `SELECT oi.id FROM public.order_items oi
     JOIN public.orders o ON o.id = oi.order_id
     WHERE oi.item_type = 'ebook' AND oi.item_id = $1 AND o.user_id = $2 AND o.status = 'completed'
     LIMIT 1`,
    [ebook_id, userId]
  );
  if (!purchaseRes.rows[0]) return res.status(403).json({ error: 'You have not purchased this ebook' });

  const ebookRes = await serviceQuery(
    `SELECT e.title, e.file_format, f.file_url FROM public.ebooks e
     LEFT JOIN public.ebook_secure_files f ON f.ebook_id = e.id WHERE e.id = $1`,
    [ebook_id]
  );
  const ebook = ebookRes.rows[0];
  if (!ebook?.file_url || !ebook.file_url.trim()) {
    return res.status(422).json({ error: 'EBOOK_FILE_MISSING', message: "This eBook is not ready yet — the publisher has not uploaded the PDF file. Please contact support and we'll fix it for you." });
  }

  const tokenValue = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

  await serviceQuery(
    'INSERT INTO public.ebook_access_tokens (ebook_id, user_id, token, expires_at, used) VALUES ($1, $2, $3, $4, false)',
    [ebook_id, userId, tokenValue, expiresAt]
  );
  await serviceQuery('SELECT public.increment_ebook_download($1)', [ebook_id]).catch(() => {});

  let fileFormat = ebook.file_format || 'pdf';
  if (!ebook.file_format && ebook.file_url) {
    const ext = (ebook.file_url.split('.').pop() || '').toLowerCase().split('?')[0];
    if (['pdf', 'epub', 'doc', 'docx'].includes(ext)) fileFormat = ext;
  }

  res.json({ token: tokenValue, expires_at: expiresAt, title: ebook.title || 'eBook', file_format: fileFormat });
}

async function ebookStream(req, res) {
  const userId = requireUser(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { ebook_id, token } = req.query;
  if (!ebook_id || !token) return res.status(400).json({ error: 'ebook_id and token required' });

  const tokenRes = await serviceQuery(
    `SELECT * FROM public.ebook_access_tokens WHERE ebook_id = $1 AND user_id = $2 AND token = $3 AND expires_at > now() LIMIT 1`,
    [ebook_id, userId, token]
  );
  if (!tokenRes.rows[0]) return res.status(403).json({ error: 'Invalid or expired token' });

  const ebookRes = await serviceQuery(
    `SELECT f.file_url, e.title FROM public.ebooks e
     LEFT JOIN public.ebook_secure_files f ON f.ebook_id = e.id WHERE e.id = $1`,
    [ebook_id]
  );
  const ebook = ebookRes.rows[0];
  if (!ebook?.file_url || !ebook.file_url.trim()) {
    return res.status(422).json({ error: 'EBOOK_FILE_MISSING', message: "This eBook is not ready yet — the publisher has not uploaded the PDF file. Please contact support and we'll fix it for you." });
  }

  const fileUrl = ebook.file_url;
  const isR2 = isR2Url(fileUrl);
  const rangeHeader = req.headers.range || '';

  let publicResponse = null;
  let fetchError = null;
  try {
    const fetchHeaders = { 'Accept-Encoding': 'identity' };
    if (rangeHeader) fetchHeaders.Range = rangeHeader;
    publicResponse = await fetch(fileUrl, { headers: fetchHeaders });
    if (!publicResponse.ok && publicResponse.status !== 206) {
      fetchError = `Public fetch failed: HTTP ${publicResponse.status}`;
      publicResponse = null;
    }
  } catch (e) {
    fetchError = `Public fetch error: ${e.message}`;
    publicResponse = null;
  }

  if (publicResponse) {
    res.status(publicResponse.status === 206 ? 206 : 200);
    res.setHeader('Content-Type', publicResponse.headers.get('content-type') || 'application/pdf');
    res.setHeader('X-Ebook-Title', encodeURIComponent(ebook.title || 'eBook'));
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', 'inline');
    const cl = publicResponse.headers.get('content-length');
    const cr = publicResponse.headers.get('content-range');
    if (cl) res.setHeader('Content-Length', cl);
    if (cr) res.setHeader('Content-Range', cr);
    res.setHeader('Accept-Ranges', publicResponse.headers.get('accept-ranges') || 'bytes');
    return publicResponse.body.pipe(res);
  }

  if (isR2) {
    try {
      const r2 = await fetchFromR2Direct(fileUrl, rangeHeader);
      res.status(r2.status);
      res.setHeader('Content-Type', r2.contentType);
      res.setHeader('X-Ebook-Title', encodeURIComponent(ebook.title || 'eBook'));
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Disposition', 'inline');
      if (r2.contentLength) res.setHeader('Content-Length', String(r2.contentLength));
      if (r2.contentRange) res.setHeader('Content-Range', r2.contentRange);
      res.setHeader('Accept-Ranges', 'bytes');
      return r2.stream.pipe(res);
    } catch (e) {
      return res.status(502).json({ error: 'Failed to fetch ebook file from R2', details: `Public: ${fetchError}. S3: ${e.message}`, storage: 'r2' });
    }
  }

  res.status(502).json({ error: 'Failed to fetch ebook file', details: fetchError || 'Unknown error', storage: 'unknown' });
}

module.exports = { ebookGenerateToken, ebookStream };
