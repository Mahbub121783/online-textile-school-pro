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

async function localUpload(req, res) {
  try {
    const userId = requireUser(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { file_base64, file_type } = req.body || {};
    if (!file_base64) return res.status(400).json({ error: 'file_base64 required' });

    const ext = ALLOWED_TYPES[(file_type || '').toLowerCase()];
    if (!ext) return res.status(400).json({ error: 'Only image uploads are allowed via local storage (jpeg/png/gif/webp/svg/bmp)' });

    const buffer = Buffer.from(file_base64, 'base64');
    if (buffer.length > MAX_BYTES) return res.status(400).json({ error: 'Image exceeds 8MB local-storage limit' });

    const now = new Date();
    const subdir = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    const dir = path.join(UPLOAD_ROOT, subdir);
    fs.mkdirSync(dir, { recursive: true });

    const fileName = `${crypto.randomBytes(16).toString('hex')}.${ext}`;
    fs.writeFileSync(path.join(dir, fileName), buffer);

    const publicUrl = `${process.env.API_URL || 'https://api.onlinetextileschool.com'}/uploads/${subdir}/${fileName}`;
    res.json({ url: publicUrl, source: 'local' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

module.exports = { localUpload };
