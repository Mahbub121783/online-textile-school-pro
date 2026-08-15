// Ported from supabase/functions/cloudinary-proxy/index.ts (Deno -> Node).
const fetch = require('node-fetch');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { serviceQuery } = require('../db');

function sha1Hex(message) {
  return crypto.createHash('sha1').update(message).digest('hex');
}

function buildSignedParams(params, apiSecret) {
  const sorted = Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join('&');
  return sha1Hex(`${sorted}${apiSecret}`);
}

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

async function getAccount(category) {
  const catRes = await serviceQuery(
    `SELECT * FROM public.cloudinary_accounts WHERE status = 'active' AND file_category = $1 ORDER BY is_primary DESC LIMIT 1`,
    [category]
  );
  if (catRes.rows.length) return catRes.rows[0];

  const primaryRes = await serviceQuery(`SELECT * FROM public.cloudinary_accounts WHERE status = 'active' AND is_primary = true LIMIT 1`);
  if (primaryRes.rows.length) return primaryRes.rows[0];

  const anyRes = await serviceQuery(`SELECT * FROM public.cloudinary_accounts WHERE status = 'active' LIMIT 1`);
  return anyRes.rows[0] || null;
}

async function handleTest(body) {
  const { account_id } = body;
  if (!account_id) return { status: 400, body: { error: 'account_id required' } };

  const accRes = await serviceQuery('SELECT * FROM public.cloudinary_accounts WHERE id = $1', [account_id]);
  const account = accRes.rows[0];
  if (!account) return { status: 404, body: { error: 'Account not found', success: false } };

  try {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = sha1Hex(`timestamp=${timestamp}${account.api_secret}`);

    const res = await fetch(`https://api.cloudinary.com/v1_1/${account.cloud_name}/image/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        file: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
        api_key: account.api_key, timestamp, signature, folder: '_test',
      }),
    });
    const result = await res.json();

    if (result.error) {
      await serviceQuery(`UPDATE public.cloudinary_accounts SET status = 'error', updated_at = now() WHERE id = $1`, [account_id]);
      return { status: 200, body: { success: false, error: result.error.message } };
    }
    await serviceQuery(`UPDATE public.cloudinary_accounts SET status = 'active', updated_at = now() WHERE id = $1`, [account_id]);
    return { status: 200, body: { success: true, message: 'Connection verified' } };
  } catch (err) {
    await serviceQuery(`UPDATE public.cloudinary_accounts SET status = 'error', updated_at = now() WHERE id = $1`, [account_id]);
    return { status: 200, body: { success: false, error: err.message || 'Connection failed' } };
  }
}

async function handleFetchUrl(body) {
  const { remote_url, file_name, file_type, folder: folderOverride, public_id } = body;
  if (!remote_url) return { status: 400, body: { error: 'remote_url required' } };

  let parsedUrl;
  try { parsedUrl = new URL(remote_url); } catch { return { status: 400, body: { error: 'Invalid remote_url' } }; }
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    return { status: 400, body: { error: 'remote_url must use http or https' } };
  }

  const account = await getAccount('images');
  if (!account) return { status: 400, body: { error: 'No active Cloudinary accounts configured' } };

  try {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const folder = folderOverride || 'uploads/avatars';
    const publicIdBase = (public_id || file_name || parsedUrl.pathname.split('/').pop() || 'image')
      .replace(/\.[a-zA-Z0-9]+$/, '')
      .replace(/[^a-zA-Z0-9/_-]/g, '_')
      .slice(0, 100) || 'image';

    const signParams = { folder, public_id: publicIdBase, timestamp, overwrite: 'true', invalidate: 'true', unique_filename: 'false', use_filename: 'false' };
    const signature = buildSignedParams(signParams, account.api_secret);

    const isVideo = (file_type || '').startsWith('video/');
    const resourceType = isVideo ? 'video' : 'image';

    const formData = new URLSearchParams({ file: parsedUrl.toString(), api_key: account.api_key, signature, ...signParams });

    const res = await fetch(`https://api.cloudinary.com/v1_1/${account.cloud_name}/${resourceType}/upload`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: formData,
    });
    const result = await res.json();

    if (result.error) {
      console.error('Cloudinary fetch-url error:', result.error);
      return { status: 500, body: { error: result.error.message || 'Remote import failed' } };
    }

    return { status: 200, body: { url: result.secure_url, publicId: result.public_id, source: 'cloudinary', fallbackUrl: result.secure_url, accountId: account.id } };
  } catch (err) {
    console.error('Cloudinary fetch-url error:', err);
    return { status: 500, body: { error: err.message || 'Remote import failed' } };
  }
}

// Raw-binary counterpart to handleUpload() above (mounted under
// /functions/v1/uploads/cloudinary with express.raw()). The base64 data-URI
// path used by handleUpload() inflates payload size ~33% and JSON.parses the
// whole thing server-side; sending real multipart/form-data with the raw
// buffer avoids both and lets the frontend track real progress via XHR.
async function handleUploadRaw(req, res) {
  const userId = requireUser(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const buffer = req.body;
  if (!Buffer.isBuffer(buffer) || !buffer.length) return res.status(400).json({ error: 'A non-empty file body is required' });

  const fileType = req.headers['x-file-type'] || 'application/octet-stream';
  const publicId = req.headers['x-public-id'] ? decodeURIComponent(req.headers['x-public-id']) : undefined;
  const folderOverride = req.headers['x-folder'] ? decodeURIComponent(req.headers['x-folder']) : undefined;
  const overwrite = req.headers['x-overwrite'];

  let category = 'images';
  if (fileType.startsWith('video/')) category = 'video';
  else if (fileType === 'application/pdf' || fileType.includes('document')) category = 'documents';

  const account = await getAccount(category);
  if (!account) return res.status(400).json({ error: 'No active Cloudinary accounts configured' });

  try {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const folder = folderOverride || 'uploads';

    const signParams = { folder, timestamp };
    if (publicId) {
      signParams.public_id = publicId;
      signParams.overwrite = overwrite === 'false' ? 'false' : 'true';
      signParams.invalidate = 'true';
      signParams.unique_filename = 'false';
      signParams.use_filename = 'false';
    }
    const signature = buildSignedParams(signParams, account.api_secret);

    // node-fetch v2 (imported as `fetch` above) only understands the
    // `form-data` npm package for multipart bodies, not the native
    // FormData/Blob globals -- use Node's own built-in fetch (global since
    // Node 18) here instead, which handles them correctly.
    const form = new FormData();
    form.append('file', new Blob([buffer], { type: fileType }));
    form.append('api_key', account.api_key);
    form.append('signature', signature);
    Object.entries(signParams).forEach(([k, v]) => form.append(k, String(v)));

    const cRes = await globalThis.fetch(`https://api.cloudinary.com/v1_1/${account.cloud_name}/auto/upload`, {
      method: 'POST',
      body: form,
    });
    const result = await cRes.json();

    if (result.error) {
      console.error('Cloudinary raw upload error:', result.error);
      return res.status(500).json({ error: result.error.message || 'Upload failed' });
    }

    return res.json({ url: result.secure_url, publicId: result.public_id, source: 'cloudinary', fallbackUrl: result.secure_url, accountId: account.id });
  } catch (err) {
    console.error('Cloudinary raw upload error:', err);
    res.status(500).json({ error: err.message || 'Upload failed' });
  }
}

async function cloudinaryProxy(req, res) {
  try {
    const userId = requireUser(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const body = req.body || {};
    const { action } = body;

    let result;
    if (action === 'test') result = await handleTest(body);
    else if (action === 'fetch-url') result = await handleFetchUrl(body);
    else return res.status(400).json({ error: 'Invalid action' });

    res.status(result.status).json(result.body);
  } catch (err) {
    console.error('cloudinary-proxy error:', err);
    res.status(500).json({ error: err.message || 'Internal error' });
  }
}

module.exports = { cloudinaryProxy, handleUploadRaw };
