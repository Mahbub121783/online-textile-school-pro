// Ported from supabase/functions/r2-presign/index.ts (Deno -> Node).
// Actions ported: test, presign, complete, proxy-upload (the ones actually
// used by the frontend). Chunked upload (large-file >4.5MB path) is NOT
// ported yet -- Express's json limit is already raised to 10mb in app.js,
// which covers most uploads; revisit chunked upload if a >10MB file breaks.
const { S3Client, PutObjectCommand, ListObjectsV2Command, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { serviceQuery } = require('../db');

function buildS3Client(account) {
  return new S3Client({
    region: 'auto',
    endpoint: account.endpoint_url,
    credentials: { accessKeyId: account.access_key_id, secretAccessKey: account.secret_access_key },
  });
}

function generateFileKey(fileName) {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 100);
  return `uploads/${timestamp}-${random}-${safeName}`;
}

async function selectAccount() {
  const accountsRes = await serviceQuery("SELECT * FROM public.cloudflare_r2_accounts WHERE status = 'active' ORDER BY created_at ASC");
  const accounts = accountsRes.rows;
  if (!accounts.length) throw new Error('No active R2 accounts configured');

  const rrRes = await serviceQuery('SELECT last_account_id FROM public.r2_round_robin_state WHERE id = 1');
  const lastId = rrRes.rows[0]?.last_account_id;

  let selectedAccount;
  if (!lastId) {
    selectedAccount = accounts[0];
  } else {
    const lastIndex = accounts.findIndex((a) => a.id === lastId);
    const nextIndex = (lastIndex + 1) % accounts.length;
    selectedAccount = accounts[nextIndex];
  }
  return selectedAccount;
}

async function updateRoundRobinAndCount(account) {
  await serviceQuery('UPDATE public.r2_round_robin_state SET last_account_id = $1, updated_at = now() WHERE id = 1', [account.id]);
  await serviceQuery('UPDATE public.cloudflare_r2_accounts SET upload_count = coalesce(upload_count,0) + 1, last_used_at = now(), updated_at = now() WHERE id = $1', [account.id]);
}

async function r2Presign(req, res) {
  try {
    const { action } = req.body || {};

    if (action === 'test') {
      const { account_id } = req.body;
      if (!account_id) return res.status(400).json({ error: 'account_id required' });
      const accRes = await serviceQuery('SELECT * FROM public.cloudflare_r2_accounts WHERE id = $1', [account_id]);
      const account = accRes.rows[0];
      if (!account) return res.status(404).json({ error: 'Account not found', success: false });
      try {
        const s3 = buildS3Client(account);
        await s3.send(new ListObjectsV2Command({ Bucket: account.bucket_name, MaxKeys: 1 }));
        await serviceQuery("UPDATE public.cloudflare_r2_accounts SET status = 'active', updated_at = now() WHERE id = $1", [account_id]);
        return res.json({ success: true, message: 'Connection verified' });
      } catch (err) {
        await serviceQuery("UPDATE public.cloudflare_r2_accounts SET status = 'error', updated_at = now() WHERE id = $1", [account_id]);
        return res.json({ success: false, error: err.message || 'Connection failed' });
      }
    }

    if (action === 'presign') {
      const { file_name, file_type } = req.body;
      if (!file_name || !file_type) return res.status(400).json({ error: 'file_name and file_type required' });
      const selectedAccount = await selectAccount();
      const fileKey = generateFileKey(file_name);
      try {
        const s3 = buildS3Client(selectedAccount);
        const command = new PutObjectCommand({ Bucket: selectedAccount.bucket_name, Key: fileKey, ContentType: file_type });
        const presignedUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });
        const publicDomain = selectedAccount.public_domain_url.replace(/\/+$/, '');
        const publicUrl = `${publicDomain}/${fileKey}`;
        await serviceQuery('UPDATE public.r2_round_robin_state SET last_account_id = $1, updated_at = now() WHERE id = 1', [selectedAccount.id]);
        return res.json({ presignedUrl, publicUrl, accountId: selectedAccount.id, fileKey, corsRequired: true });
      } catch (err) {
        return res.status(500).json({ error: 'Failed to generate presigned URL: ' + err.message });
      }
    }

    if (action === 'complete') {
      const { account_id, file_key } = req.body;
      if (!account_id || !file_key) return res.status(400).json({ error: 'account_id and file_key required' });
      const accRes = await serviceQuery('SELECT * FROM public.cloudflare_r2_accounts WHERE id = $1', [account_id]);
      const account = accRes.rows[0];
      if (!account) return res.status(404).json({ error: 'Account not found' });
      try {
        const s3 = buildS3Client(account);
        await s3.send(new HeadObjectCommand({ Bucket: account.bucket_name, Key: file_key }));
        await serviceQuery('UPDATE public.cloudflare_r2_accounts SET upload_count = coalesce(upload_count,0) + 1, last_used_at = now(), updated_at = now() WHERE id = $1', [account_id]);
        return res.json({ success: true });
      } catch (err) {
        return res.status(400).json({ error: 'Upload was not confirmed in R2.', details: err.message });
      }
    }

    if (action === 'proxy-upload') {
      const { file_base64, file_name, file_type } = req.body;
      if (!file_base64 || !file_name) return res.status(400).json({ error: 'file_base64 and file_name required' });
      const selectedAccount = await selectAccount();
      const fileKey = generateFileKey(file_name);
      try {
        const s3 = buildS3Client(selectedAccount);
        const fileBytes = Buffer.from(file_base64, 'base64');
        const contentType = file_type || 'application/octet-stream';
        await s3.send(new PutObjectCommand({ Bucket: selectedAccount.bucket_name, Key: fileKey, Body: fileBytes, ContentType: contentType }));
        await updateRoundRobinAndCount(selectedAccount);
        const publicDomain = selectedAccount.public_domain_url.replace(/\/+$/, '');
        const publicUrl = `${publicDomain}/${fileKey}`;
        return res.json({ url: publicUrl, source: 'r2', accountId: selectedAccount.id, fileKey });
      } catch (err) {
        return res.status(500).json({ error: 'Server-side upload to R2 failed: ' + err.message });
      }
    }

    res.status(400).json({ error: 'Invalid or not-yet-ported action' });
  } catch (err) {
    console.error('r2-presign error:', err);
    res.status(500).json({ error: err.message || 'Internal error' });
  }
}

module.exports = { r2Presign };
