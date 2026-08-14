// Ported from supabase/functions/push-subscribe, push-unsubscribe, and
// push-send (Deno -> Node), combined into one module since they share the
// same VAPID setup and are all small.
const jwt = require('jsonwebtoken');
const webpush = require('web-push');
const { serviceQuery } = require('../db');

const VAPID_PUBLIC = 'BJdE7YoRjgxTFKdSwatdxWNKLCXIiy6SSxV9cF_GOSgzF4mVZ9T25XLbGXjMfd8i34-t0yPq64eKxKWpBlrU8js';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@onlinetextileschool.com';

if (VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
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

async function pushSubscribe(req, res) {
  const userId = requireUser(req);
  if (!userId) return res.status(401).json({ error: 'unauthorized' });

  const sub = req.body?.subscription;
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
    return res.status(400).json({ error: 'invalid subscription' });
  }

  try {
    await serviceQuery(
      `INSERT INTO public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent, platform, last_seen_at)
       VALUES ($1, $2, $3, $4, $5, $6, now())
       ON CONFLICT (endpoint) DO UPDATE SET user_id = $1, p256dh = $3, auth = $4, user_agent = $5, platform = $6, last_seen_at = now()`,
      [userId, sub.endpoint, sub.keys.p256dh, sub.keys.auth, req.body?.user_agent ?? null, req.body?.platform ?? null]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
}

async function pushUnsubscribe(req, res) {
  const userId = requireUser(req);
  if (!userId) return res.status(401).json({ error: 'unauthorized' });

  const endpoint = req.body?.endpoint;
  if (!endpoint) return res.status(400).json({ error: 'missing endpoint' });

  try {
    await serviceQuery('DELETE FROM public.push_subscriptions WHERE user_id = $1 AND endpoint = $2', [userId, endpoint]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
}

async function pushSend(req, res) {
  try {
    const body = req.body || {};
    if (!body?.payload?.title) return res.status(400).json({ error: 'missing payload.title' });
    if (!VAPID_PRIVATE) return res.status(500).json({ error: 'Push notifications not configured (VAPID_PRIVATE_KEY missing)' });

    const ids = body.user_ids || (body.user_id ? [body.user_id] : []);
    if (ids.length === 0) return res.status(400).json({ error: 'no recipients' });

    let allowedIds = ids;
    if (body.category) {
      const prefs = await serviceQuery(`SELECT user_id, ${body.category} AS pref FROM public.notification_preferences WHERE user_id = ANY($1)`, [ids]);
      const prefMap = new Map(prefs.rows.map((p) => [p.user_id, p.pref]));
      allowedIds = ids.filter((id) => prefMap.get(id) !== false);
    }

    if (allowedIds.length === 0) return res.json({ ok: true, sent: 0 });

    const subsRes = await serviceQuery('SELECT id, endpoint, p256dh, auth FROM public.push_subscriptions WHERE user_id = ANY($1)', [allowedIds]);
    const subs = subsRes.rows;

    let sent = 0;
    let failed = 0;
    const stalePruneIds = [];

    await Promise.all(subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(body.payload));
        sent++;
      } catch (err) {
        failed++;
        if (err?.statusCode === 404 || err?.statusCode === 410) stalePruneIds.push(s.id);
      }
    }));

    if (stalePruneIds.length) {
      await serviceQuery('DELETE FROM public.push_subscriptions WHERE id = ANY($1)', [stalePruneIds]);
    }

    res.json({ ok: true, sent, failed, pruned: stalePruneIds.length });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
}

module.exports = { pushSubscribe, pushUnsubscribe, pushSend };
