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

async function handleUpload(body) {
  const { file_base64, file_type, public_id, folder: folderOverride, overwrite } = body;
  if (!file_base64) return { status: 400, body: { error: 'file_base64 required' } };

  let category = 'images';
  if (file_type?.startsWith('video/')) category = 'video';
  else if (file_type === 'application/pdf' || file_type?.includes('document')) category = 'documents';

  const account = await getAccount(category);
  if (!account) return { status: 400, body: { error: 'No active Cloudinary accounts configured' } };

  try {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const folder = folderOverride || 'uploads';

    const signParams = { folder, timestamp };
    if (public_id) {
      signParams.public_id = public_id;
      signParams.overwrite = overwrite === false ? 'false' : 'true';
      signParams.invalidate = 'true';
      signParams.unique_filename = 'false';
      signParams.use_filename = 'false';
    }

    const signature = buildSignedParams(signParams, account.api_secret);
    const mimeType = file_type || 'application/octet-stream';
    const dataUri = `data:${mimeType};base64,${file_base64}`;

    const formData = new URLSearchParams({ file: dataUri, api_key: account.api_key, timestamp, signature, ...signParams });

    const res = await fetch(`https://api.cloudinary.com/v1_1/${account.cloud_name}/auto/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData,
    });
    const result = await res.json();

    if (result.error) {
      console.error('Cloudinary upload error:', result.error);
      return { status: 500, body: { error: result.error.message || 'Upload failed' } };
    }

    return { status: 200, body: { url: result.secure_url, publicId: result.public_id, source: 'cloudinary', fallbackUrl: result.secure_url, accountId: account.id } };
  } catch (err) {
    console.error('Cloudinary upload error:', err);
    return { status: 500, body: { error: err.message || 'Upload failed' } };
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

async function cloudinaryProxy(req, res) {
  try {
    const userId = requireUser(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const body = req.body || {};
    const { action } = body;

    let result;
    if (action === 'test') result = await handleTest(body);
    else if (action === 'upload') result = await handleUpload(body);
    else if (action === 'fetch-url') result = await handleFetchUrl(body);
    else return res.status(400).json({ error: 'Invalid action' });

    res.status(result.status).json(result.body);
  } catch (err) {
    console.error('cloudinary-proxy error:', err);
    res.status(500).json({ error: err.message || 'Internal error' });
  }
}

module.exports = { cloudinaryProxy };
