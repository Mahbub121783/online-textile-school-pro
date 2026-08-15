// Ported from supabase/functions/r2-presign/index.ts (Deno -> Node), plus a
// real chunked-upload implementation (see below) that the original port was
// missing -- any file over 4.5MB (most real ebook PDFs) went through
// useFileUpload.ts's uploadToR2Chunked() path, which called actions this
// file never implemented, always failing with "Invalid or not-yet-ported
// action". Implemented as genuine S3 multipart upload against R2.
const {
  S3Client, PutObjectCommand, ListObjectsV2Command, HeadObjectCommand,
  CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand, AbortMultipartUploadCommand,
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const jwt = require('jsonwebtoken');
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

// In-memory part tracking for in-flight multipart uploads (uploadId -> state).
// Chunks are uploaded sequentially by the frontend within one file's upload,
// and this Node app runs as a single process on this hosting tier, so this
// is safe; an upload that's abandoned mid-flight just leaks one small map
// entry until the process restarts (not worth a DB table for this).
const multipartState = new Map();

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

    if (action === 'chunked-init') {
      const { file_name, file_type, file_size } = req.body;
      if (!file_name) return res.status(400).json({ error: 'file_name required' });
      const selectedAccount = await selectAccount();
      const fileKey = generateFileKey(file_name);
      try {
        const s3 = buildS3Client(selectedAccount);
        const created = await s3.send(new CreateMultipartUploadCommand({
          Bucket: selectedAccount.bucket_name,
          Key: fileKey,
          ContentType: file_type || 'application/octet-stream',
        }));
        multipartState.set(created.UploadId, { parts: [], accountId: selectedAccount.id, fileKey, fileSize: file_size });
        return res.json({ uploadId: created.UploadId, fileKey, accountId: selectedAccount.id });
      } catch (err) {
        return res.status(500).json({ error: 'Failed to start chunked upload: ' + err.message });
      }
    }

    if (action === 'chunked-complete') {
      const { upload_id, file_key, account_id } = req.body;
      if (!upload_id || !file_key || !account_id) return res.status(400).json({ error: 'upload_id, file_key and account_id required' });
      const state = multipartState.get(upload_id);
      if (!state) return res.status(400).json({ error: 'Unknown or expired upload session -- please retry the upload' });
      try {
        const accRes = await serviceQuery('SELECT * FROM public.cloudflare_r2_accounts WHERE id = $1', [account_id]);
        const account = accRes.rows[0];
        if (!account) return res.status(404).json({ error: 'Account not found' });
        const s3 = buildS3Client(account);
        const sortedParts = [...state.parts].sort((a, b) => a.PartNumber - b.PartNumber);
        await s3.send(new CompleteMultipartUploadCommand({
          Bucket: account.bucket_name,
          Key: file_key,
          UploadId: upload_id,
          MultipartUpload: { Parts: sortedParts },
        }));
        multipartState.delete(upload_id);
        await updateRoundRobinAndCount(account);
        const publicDomain = account.public_domain_url.replace(/\/+$/, '');
        const publicUrl = `${publicDomain}/${file_key}`;
        return res.json({ url: publicUrl, source: 'r2', accountId: account.id, fileKey: file_key });
      } catch (err) {
        multipartState.delete(upload_id);
        try {
          const accRes = await serviceQuery('SELECT * FROM public.cloudflare_r2_accounts WHERE id = $1', [account_id]);
          const account = accRes.rows[0];
          if (account) {
            const s3 = buildS3Client(account);
            await s3.send(new AbortMultipartUploadCommand({ Bucket: account.bucket_name, Key: file_key, UploadId: upload_id }));
          }
        } catch { /* best-effort cleanup */ }
        return res.status(500).json({ error: `Failed to finalize upload: ${err.message}` });
      }
    }

    res.status(400).json({ error: 'Invalid or not-yet-ported action' });
  } catch (err) {
    console.error('r2-presign error:', err);
    res.status(500).json({ error: err.message || 'Internal error' });
  }
}

// Raw-binary upload endpoints (mounted under /functions/v1/uploads with
// express.raw()) -- replace the old base64-in-JSON 'proxy-upload' and
// 'chunked-upload' actions above. Sending the actual file bytes instead of a
// base64 string wrapped in JSON avoids the 33% size inflation and the
// JSON.parse-of-a-huge-string cost on every request, and lets the frontend
// track real upload progress via XMLHttpRequest's upload.onprogress (fetch,
// which supabase-js's functions.invoke() uses internally, has no reliable
// upload-progress API).

async function r2UploadSingle(req, res) {
  try {
    const userId = requireUser(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const fileName = decodeURIComponent(req.headers['x-file-name'] || '');
    const fileType = req.headers['x-file-type'] || 'application/octet-stream';
    const buffer = req.body;
    if (!fileName || !Buffer.isBuffer(buffer) || !buffer.length) {
      return res.status(400).json({ error: 'x-file-name header and a non-empty body are required' });
    }

    const selectedAccount = await selectAccount();
    const fileKey = generateFileKey(fileName);
    try {
      const s3 = buildS3Client(selectedAccount);
      await s3.send(new PutObjectCommand({ Bucket: selectedAccount.bucket_name, Key: fileKey, Body: buffer, ContentType: fileType }));
      await updateRoundRobinAndCount(selectedAccount);
      const publicDomain = selectedAccount.public_domain_url.replace(/\/+$/, '');
      return res.json({ url: `${publicDomain}/${fileKey}`, source: 'r2', accountId: selectedAccount.id, fileKey });
    } catch (err) {
      return res.status(500).json({ error: 'Server-side upload to R2 failed: ' + err.message });
    }
  } catch (err) {
    console.error('r2-upload-single error:', err);
    res.status(500).json({ error: err.message || 'Internal error' });
  }
}

async function r2UploadChunk(req, res) {
  try {
    const userId = requireUser(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const uploadId = req.headers['x-upload-id'];
    const fileKey = req.headers['x-file-key'];
    const accountId = req.headers['x-account-id'];
    const chunkIndex = parseInt(req.headers['x-chunk-index'], 10);
    const buffer = req.body;
    if (!uploadId || !fileKey || !accountId || Number.isNaN(chunkIndex) || !Buffer.isBuffer(buffer) || !buffer.length) {
      return res.status(400).json({ error: 'x-upload-id, x-file-key, x-account-id, x-chunk-index headers and a non-empty body are required' });
    }

    const state = multipartState.get(uploadId);
    if (!state) return res.status(400).json({ error: 'Unknown or expired upload session -- please retry the upload' });

    try {
      const accRes = await serviceQuery('SELECT * FROM public.cloudflare_r2_accounts WHERE id = $1', [accountId]);
      const account = accRes.rows[0];
      if (!account) return res.status(404).json({ error: 'Account not found' });
      const s3 = buildS3Client(account);
      const partNumber = chunkIndex + 1;
      const result = await s3.send(new UploadPartCommand({
        Bucket: account.bucket_name,
        Key: fileKey,
        UploadId: uploadId,
        PartNumber: partNumber,
        Body: buffer,
      }));
      state.parts.push({ PartNumber: partNumber, ETag: result.ETag });
      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: `Chunk ${chunkIndex + 1} upload failed: ${err.message}` });
    }
  } catch (err) {
    console.error('r2-upload-chunk error:', err);
    res.status(500).json({ error: err.message || 'Internal error' });
  }
}

module.exports = { r2Presign, r2UploadSingle, r2UploadChunk };
