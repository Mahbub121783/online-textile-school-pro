// Ported from supabase/functions/send-sms/index.ts (Deno -> Node).
// The original was already a log-only stub -- no real SMS provider was ever
// wired, even on Supabase (see the TODO comment in the source). Preserves
// that exact behavior: logs to sms_logs and returns success. Wire a real
// provider (Twilio, BulkSMS BD, etc.) by adding SMS_API_KEY/SMS_API_URL to
// backend/.env and filling in the marked block below.
const { serviceQuery } = require('../db');

async function sendSms(req, res) {
  try {
    const { phone, message, templateKey, metadata } = req.body || {};
    if (!phone || !message) return res.status(400).json({ error: 'phone and message are required' });

    if (metadata?.user_id) {
      const profileRes = await serviceQuery('SELECT sms_opt_in FROM public.user_profiles WHERE id = $1', [metadata.user_id]);
      if (profileRes.rows[0]?.sms_opt_in === false) {
        return res.json({ success: false, reason: 'User opted out of SMS' });
      }
    }

    try {
      await serviceQuery(
        `INSERT INTO public.sms_logs (recipient_phone, message, template_key, status, user_id) VALUES ($1, $2, $3, 'pending', $4)`,
        [phone, message, templateKey || null, metadata?.user_id || null]
      );
    } catch (logErr) {
      console.error('SMS log error:', logErr.message);
    }

    // No SMS provider wired yet -- admin configures SMS_API_KEY/SMS_API_URL
    // in backend/.env, then this block sends for real and updates sms_logs.
    // const smsApiKey = process.env.SMS_API_KEY;
    // const smsApiUrl = process.env.SMS_API_URL;
    // if (smsApiKey && smsApiUrl) { ... }

    res.json({ success: true, message: 'SMS queued for delivery' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

module.exports = { sendSms };
