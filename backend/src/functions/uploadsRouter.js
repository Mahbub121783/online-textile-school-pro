// Dedicated raw-binary upload routes, mounted at /functions/v1/uploads
// BEFORE the generic /functions/v1 router (see app.js) so they get their own
// rate limit instead of sharing the 30-req/60s limit meant for email/SMS
// endpoints -- a single large chunked upload legitimately needs many
// sequential requests (one per 5MB chunk), which was blowing through that
// limit and aborting uploads over ~150MB partway through.
const express = require('express');
const rateLimit = require('express-rate-limit');
const { r2UploadSingle, r2UploadChunk } = require('./r2Presign');
const { handleUploadRaw: cloudinaryUploadRaw } = require('./cloudinaryProxy');
const { localUploadRaw } = require('./localUpload');

const router = express.Router();

const uploadLimiter = rateLimit({ windowMs: 60 * 1000, limit: 300, standardHeaders: true, legacyHeaders: false });
router.use(uploadLimiter);

const rawBody = (limit) => express.raw({ type: '*/*', limit });

router.post('/r2-single', rawBody('8mb'), r2UploadSingle);
router.post('/r2-chunk', rawBody('6mb'), r2UploadChunk);
router.post('/cloudinary', rawBody('20mb'), cloudinaryUploadRaw);
router.post('/local', rawBody('8mb'), localUploadRaw);

module.exports = router;
