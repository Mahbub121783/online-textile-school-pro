// Ported from supabase/functions/meta-capi/index.ts (Deno -> Node).
const crypto = require('crypto');
const fetch = require('node-fetch');

const PIXEL_ID = process.env.META_PIXEL_ID || '';
const ACCESS_TOKEN = process.env.META_CAPI_ACCESS_TOKEN || '';
const GRAPH_URL = `https://graph.facebook.com/v19.0/${PIXEL_ID}/events`;

function sha256(value) {
  return crypto.createHash('sha256').update(String(value).trim().toLowerCase()).digest('hex');
}

function hashIfPresent(v) {
  if (!v || typeof v !== 'string' || !v.trim()) return undefined;
  return sha256(v);
}

async function metaCapi(req, res) {
  if (!PIXEL_ID || !ACCESS_TOKEN) {
    return res.status(500).json({ error: 'Meta CAPI not configured (missing META_PIXEL_ID or META_CAPI_ACCESS_TOKEN)' });
  }

  try {
    const { event_name, event_id, event_source_url, custom_data = {}, user_data = {}, test_event_code } = req.body || {};
    if (!event_name) return res.status(400).json({ error: 'event_name required' });

    const xff = req.headers['x-forwarded-for'] || '';
    const clientIp = (Array.isArray(xff) ? xff[0] : xff).split(',')[0].trim() || req.headers['cf-connecting-ip'] || req.ip;
    const userAgent = user_data.client_user_agent || req.headers['user-agent'];

    const hashedUser = {
      em: hashIfPresent(user_data.email),
      ph: hashIfPresent(user_data.phone?.replace(/[^\d]/g, '')),
      fn: hashIfPresent(user_data.firstName),
      ln: hashIfPresent(user_data.lastName),
      external_id: hashIfPresent(user_data.externalId),
      fbp: user_data.fbp || undefined,
      fbc: user_data.fbc || undefined,
      client_ip_address: clientIp,
      client_user_agent: userAgent,
    };
    Object.keys(hashedUser).forEach((k) => hashedUser[k] === undefined && delete hashedUser[k]);

    const eventPayload = {
      event_name,
      event_time: Math.floor(Date.now() / 1000),
      action_source: 'website',
      event_id: event_id || crypto.randomUUID(),
      event_source_url,
      user_data: hashedUser,
      custom_data,
    };

    const fbBody = { data: [eventPayload] };
    if (test_event_code) fbBody.test_event_code = test_event_code;

    const fbRes = await fetch(`${GRAPH_URL}?access_token=${encodeURIComponent(ACCESS_TOKEN)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fbBody),
    });
    const fbJson = await fbRes.json().catch(() => ({}));

    if (!fbRes.ok) {
      console.error('Meta CAPI error:', fbJson);
      return res.status(502).json({ error: fbJson, status: fbRes.status });
    }

    res.json({ success: true, fb: fbJson, event_id: eventPayload.event_id });
  } catch (e) {
    console.error('meta-capi exception:', e);
    res.status(500).json({ error: e.message || 'unknown error' });
  }
}

module.exports = { metaCapi };
