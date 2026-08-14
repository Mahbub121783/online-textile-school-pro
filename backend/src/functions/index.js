const express = require('express');
const { sendSmtpEmail } = require('./sendSmtpEmail');
const { passwordResetRequest, passwordResetVerify } = require('./passwordReset');
const { processPayment } = require('./processPayment');
const { r2Presign } = require('./r2Presign');
const { ebookGenerateToken, ebookStream } = require('./ebookSecureAccess');
const { sitemap } = require('./sitemap');
const { ogMeta } = require('./ogMeta');
const { handleUnsubscribe } = require('./handleUnsubscribe');
const { indexnowPing } = require('./indexnowPing');
const { pushSubscribe, pushUnsubscribe, pushSend } = require('./push');
const { workshopReminderCron } = require('./workshopReminderCron');
const { unrepliedMessageReminder } = require('./unrepliedMessageReminder');
const { internalCron } = require('./internalCron');
const { validateDriveLink } = require('./validateDriveLink');
const { sendSms } = require('./sendSms');
const { metaCapi } = require('./metaCapi');
const { aiTutor } = require('./aiTutor');
const { aiIndexBuilder } = require('./aiIndexBuilder');
const { qbAiGenerate } = require('./qbAiGenerate');
const { cloudinaryProxy } = require('./cloudinaryProxy');
const { qbSeedBatch } = require('./qbSeedBatch');
const { cpanelEmailProvisioner } = require('./cpanelEmailProvisioner');
const { edumailClient } = require('./edumailClient');
const { edumailImapSync } = require('./edumailImapSync');

const router = express.Router();

router.post('/send-smtp-email', sendSmtpEmail);
router.post('/password-reset-request', passwordResetRequest);
router.post('/password-reset-verify', passwordResetVerify);
router.post('/process-payment', processPayment);
router.post('/r2-presign', r2Presign);
router.get('/sitemap', sitemap);
router.get('/og-meta', ogMeta);
router.get('/handle-unsubscribe', handleUnsubscribe);
router.post('/indexnow-ping', indexnowPing);
router.post('/push-subscribe', pushSubscribe);
router.post('/push-unsubscribe', pushUnsubscribe);
router.post('/push-send', pushSend);
router.all('/workshop-reminder-cron', workshopReminderCron);
router.all('/unreplied-message-reminder', unrepliedMessageReminder);
router.all('/internal-cron', internalCron);
router.post('/validate-drive-link', validateDriveLink);
router.post('/send-sms', sendSms);
router.post('/meta-capi', metaCapi);
router.post('/ai-tutor', aiTutor);
router.post('/ai-index-builder', aiIndexBuilder);
router.post('/qb-ai-generate', qbAiGenerate);
router.post('/cloudinary-proxy', cloudinaryProxy);
router.post('/qb-seed-batch', qbSeedBatch);
router.post('/cpanel-email-provisioner', cpanelEmailProvisioner);
router.post('/edumail-client', edumailClient);
router.post('/edumail-imap-sync', edumailImapSync);

// ebook-secure-access: GET for streaming (PDF.js range requests), POST for
// generate_token -- same path, dispatched by method (matches the original
// Deno function's single-endpoint design).
router.get('/ebook-secure-access', (req, res) => {
  if (req.query.action === 'stream') return ebookStream(req, res);
  res.status(400).json({ error: 'Invalid GET action' });
});
router.post('/ebook-secure-access', (req, res) => {
  if (req.body?.action === 'generate_token') return ebookGenerateToken(req, res);
  res.status(400).json({ error: 'Invalid action' });
});

router.use((req, res) => res.status(404).json({ error: 'Function not found or not yet ported' }));

module.exports = router;
