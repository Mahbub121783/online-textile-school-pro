// Ported from supabase/functions/handle-unsubscribe/index.ts (Deno -> Node).
const { serviceQuery } = require('../db');

function htmlPage(title, message, accentColor) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:Arial,Helvetica,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;">
  <div style="background:#fff;border-radius:12px;padding:48px 40px;max-width:480px;width:90%;text-align:center;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
    <div style="width:64px;height:64px;border-radius:50%;background:${accentColor};margin:0 auto 24px;display:flex;align-items:center;justify-content:center;">
      <span style="color:#fff;font-size:28px;font-weight:bold;">${title.includes('Success') ? '✓' : title.includes('Already') ? '—' : '✕'}</span>
    </div>
    <h1 style="margin:0 0 16px;font-size:24px;color:#2d3748;">${title}</h1>
    <p style="margin:0;color:#718096;font-size:15px;line-height:1.6;">${message}</p>
  </div>
</body>
</html>`;
}

async function handleUnsubscribe(req, res) {
  const token = req.query.token;
  res.set('Content-Type', 'text/html; charset=utf-8');

  if (!token) {
    return res.status(400).send(htmlPage('Invalid Link', 'This unsubscribe link is invalid or expired.', '#e53e3e'));
  }

  const result = await serviceQuery('SELECT * FROM public.email_unsubscribes WHERE token = $1', [token]);
  const record = result.rows[0];

  if (!record) {
    return res.status(404).send(htmlPage('Invalid Link', 'This unsubscribe link is invalid or expired.', '#e53e3e'));
  }

  if (record.unsubscribed_at) {
    return res.send(htmlPage('Already Unsubscribed', `<strong>${record.email}</strong> has already been unsubscribed.`, '#718096'));
  }

  await serviceQuery('UPDATE public.email_unsubscribes SET unsubscribed_at = now() WHERE token = $1', [token]);

  res.send(htmlPage('Unsubscribed Successfully', `<strong>${record.email}</strong> has been unsubscribed from our mailing list. You will no longer receive emails from us.`, '#38a169'));
}

module.exports = { handleUnsubscribe };
