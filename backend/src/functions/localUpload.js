// New feature (no Supabase-era equivalent): local, own-server image hosting
// via the app's file manager, requested as a redundancy option alongside
// Cloudinary/R2 -- images only, so it can never become a large-file/disk-
// quota risk on shared hosting. Used by useFileUpload.ts as an automatic
// fallback when the Cloudinary upload path fails (e.g. no active Cloudinary
// account configured), not as the default path.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const UPLOAD_ROOT = path.join(__dirname, '..', '..', 'public', 'uploads');
const ALLOWED_TYPES = {
  'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/gif': 'gif',
  'image/webp': 'webp', 'image/svg+xml': 'svg', 'image/bmp': 'bmp',
};
const MAX_BYTES = 8 * 1024 * 1024; // 8MB -- images only, keeps shared-hosting disk usage bounded

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

// Core disk-write logic, factored out so other handlers (the public,
// no-login registration-photo upload in cloudinaryProxy.js) can fall back
// to it directly -- mirrors useFileUpload.ts's own cloudinary-then-local
// fallback, just applied server-side for that one endpoint instead of
// requiring a second round trip from the browser.
function saveLocalFile(buffer, fileType) {
  const ext = ALLOWED_TYPES[(fileType || '').toLowerCase()];
  if (!ext) throw Object.assign(new Error('Only image uploads are allowed via local storage (jpeg/png/gif/webp/svg/bmp)'), { statusCode: 400 });
  if (!Buffer.isBuffer(buffer) || !buffer.length) throw Object.assign(new Error('A non-empty file body is required'), { statusCode: 400 });
  if (buffer.length > MAX_BYTES) throw Object.assign(new Error('Image exceeds 8MB local-storage limit'), { statusCode: 400 });

  const now = new Date();
  const subdir = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const dir = path.join(UPLOAD_ROOT, subdir);
  fs.mkdirSync(dir, { recursive: true });

  const fileName = `${crypto.randomBytes(16).toString('hex')}.${ext}`;
  fs.writeFileSync(path.join(dir, fileName), buffer);

  return `${process.env.API_URL || 'https://api.onlinetextileschool.com'}/uploads/${subdir}/${fileName}`;
}

// Raw-binary local-storage upload, mounted under
// /functions/v1/uploads/local with express.raw() -- avoids the base64 +
// JSON-body overhead so this fallback path doesn't die around the same size
// where the global express.json() limit and base64 inflation collide.
async function localUploadRaw(req, res) {
  try {
    const userId = requireUser(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const publicUrl = saveLocalFile(req.body, req.headers['x-file-type']);
    res.json({ url: publicUrl, source: 'local' });
  } catch (e) {
    res.status(e.statusCode || 500).json({ error: e.message });
  }
}

module.exports = { localUploadRaw, saveLocalFile };
