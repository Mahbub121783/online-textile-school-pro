// Ported from supabase/functions/process-payment/index.ts (Deno -> Node).
// UddoktaPay gateway integration; business logic unchanged, DB access via
// `serviceQuery` (elevated context), auth via our own JWT instead of supabase-js.
const fetch = require('node-fetch');
const jwt = require('jsonwebtoken');
const { serviceQuery } = require('../db');
const { sendSmtpEmail } = require('./sendSmtpEmail');

async function sendEmailFireAndForget(body) {
  const fakeReq = { body };
  const fakeRes = { json: () => {}, status: () => fakeRes };
  try { await sendSmtpEmail(fakeReq, fakeRes); } catch (e) { console.warn('email failed:', e.message); }
}

function requireAuth(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return null;
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    return payload.sub;
  } catch {
    return null;
  }
}

async function processPayment(req, res) {
  const userId = requireAuth(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { action } = req.body || {};
    const apiKey = process.env.UDDOKTAPAY_API_KEY;

    if (action === 'verify') {
      const { invoice_id } = req.body;
      if (!invoice_id) return res.status(400).json({ error: 'invoice_id required' });
      if (!apiKey) return res.status(500).json({ error: 'Payment gateway not configured' });

      const gatewayRes = await serviceQuery(
        "SELECT credentials FROM public.payment_gateways WHERE gateway_name = 'uddoktapay' AND is_active = true"
      );
      const apiUrl = gatewayRes.rows[0]?.credentials?.api_url || 'https://sandbox.uddoktapay.com/api';

      const verifyRes = await fetch(`${apiUrl}/verify-payment`, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'RT-UDDOKTAPAY-API-KEY': apiKey },
        body: JSON.stringify({ invoice_id }),
      });
      const verifyData = await verifyRes.json();

      if (verifyData.status === 'COMPLETED') {
        const orderRes = await serviceQuery('SELECT id, user_id, status, total FROM public.orders WHERE payment_reference = $1', [invoice_id]);
        const order = orderRes.rows[0];

        if (order && order.status !== 'completed') {
          await serviceQuery("UPDATE public.orders SET status = 'completed', payment_reference = $1 WHERE id = $2", [invoice_id, order.id]);
          await serviceQuery("UPDATE public.invoices SET payment_status = 'paid', paid_at = now() WHERE order_id = $1", [order.id]);

          const itemsRes = await serviceQuery('SELECT item_id, item_type, price FROM public.order_items WHERE order_id = $1', [order.id]);
          const orderItems = itemsRes.rows;

          const userRes = await serviceQuery('SELECT email FROM auth.users WHERE id = $1', [order.user_id]);
          const userEmail = userRes.rows[0]?.email;
          const profRes = await serviceQuery('SELECT full_name, referred_by FROM public.user_profiles WHERE id = $1', [order.user_id]);
          const userName = profRes.rows[0]?.full_name || 'Student';
          const siteUrl = process.env.SITE_URL || 'https://www.onlinetextileschool.com';

          if (userEmail) {
            sendEmailFireAndForget({
              templateKey: 'payment_received', recipientEmail: userEmail,
              placeholders: { user_name: userName, amount: String(order.total ?? ''), payment_method: 'UddoktaPay', invoice_number: invoice_id, invoice_url: `${siteUrl}/dashboard/invoices` },
            });
          }

          for (const item of orderItems) {
            if (item.item_type === 'course') {
              await serviceQuery(
                `INSERT INTO public.enrollments (user_id, course_id, payment_id) VALUES ($1, $2, $3)
                 ON CONFLICT (user_id, course_id) DO NOTHING`,
                [order.user_id, item.item_id, order.id]
              );

              const courseRes = await serviceQuery('SELECT instructor_id, revenue_share_pct, title, slug FROM public.courses WHERE id = $1', [item.item_id]);
              const course = courseRes.rows[0];

              if (userEmail && course) {
                sendEmailFireAndForget({
                  templateKey: 'enrollment_confirmation', recipientEmail: userEmail,
                  placeholders: { user_name: userName, course_name: course.title, course_url: `${siteUrl}/courses/${course.slug}` },
                });
              }

              if (course?.instructor_id) {
                const sharePct = Number(course.revenue_share_pct ?? 70);
                const instructorAmount = (Number(item.price) * sharePct) / 100;
                if (instructorAmount > 0) {
                  await serviceQuery('SELECT public.credit_wallet($1, $2, $3, $4)', [
                    course.instructor_id, instructorAmount, `Revenue from order ${String(order.id).slice(0, 8)}`, order.id,
                  ]).catch((e) => console.warn('credit_wallet failed:', e.message));
                }
              }
            } else if (item.item_type === 'ebook') {
              const ebookRes = await serviceQuery('SELECT title, author, slug FROM public.ebooks WHERE id = $1', [item.item_id]);
              const ebook = ebookRes.rows[0];
              if (userEmail && ebook) {
                sendEmailFireAndForget({
                  templateKey: 'ebook_purchase', recipientEmail: userEmail,
                  placeholders: { user_name: userName, ebook_title: ebook.title, ebook_author: ebook.author || 'Author', ebook_download_url: `${siteUrl}/ebooks/${ebook.slug}` },
                });
              }
            } else if (item.item_type === 'practice_credits') {
              const credits = Math.round(Number(item.price) * 2);
              if (credits > 0) {
                await serviceQuery('SELECT public.qb_credit_paid_tokens_admin($1, $2, $3)', [order.user_id, credits, order.id])
                  .catch((e) => console.warn('practice credit grant failed:', e.message));
              }
            }
          }

          const referredBy = profRes.rows[0]?.referred_by;
          if (referredBy) {
            await serviceQuery(
              "UPDATE public.referral_rewards SET status = 'credited', reward_amount = 50, credited_at = now() WHERE referred_id = $1 AND status = 'pending'",
              [order.user_id]
            );
            await serviceQuery('SELECT public.credit_wallet($1, $2, $3, $4)', [
              referredBy, 50, `Referral reward for order ${String(order.id).slice(0, 8)}`, order.id,
            ]).catch((e) => console.warn('referral credit_wallet failed:', e.message));
          }
        }

        return res.json({ status: 'COMPLETED', invoice_id });
      }

      return res.json({ status: verifyData.status || 'PENDING' });
    }

    // ── CREATE new payment ──
    const { orderId, amount, customerName, customerEmail, metadata } = req.body || {};
    if (!orderId || !amount) return res.status(400).json({ error: 'orderId and amount required' });
    if (!apiKey) return res.status(500).json({ error: 'Payment gateway not configured' });

    const gatewayRes = await serviceQuery(
      "SELECT credentials FROM public.payment_gateways WHERE gateway_name = 'uddoktapay' AND is_active = true"
    );
    const gateway = gatewayRes.rows[0];
    if (!gateway) return res.status(400).json({ error: 'UddoktaPay gateway not active' });

    const apiUrl = gateway.credentials?.api_url || 'https://sandbox.uddoktapay.com/api';
    const siteUrl = process.env.SITE_URL || 'https://www.onlinetextileschool.com';
    const apiBase = process.env.API_URL || 'https://api.onlinetextileschool.com';

    const checkoutRes = await fetch(`${apiUrl}/checkout-v2`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'RT-UDDOKTAPAY-API-KEY': apiKey },
      body: JSON.stringify({
        full_name: customerName || 'Customer',
        email: customerEmail || 'customer@example.com',
        amount: amount.toString(),
        metadata: { order_id: orderId, user_id: userId, ...(metadata || {}) },
        redirect_url: `${siteUrl}/payment/success?invoice_id=`,
        cancel_url: `${siteUrl}/payment/cancel`,
        webhook_url: `${apiBase}/functions/v1/process-payment-webhook`,
      }),
    });
    const checkoutData = await checkoutRes.json();

    if (checkoutData.payment_url) {
      await serviceQuery('UPDATE public.orders SET payment_reference = $1 WHERE id = $2', [checkoutData.invoice_id, orderId]);
      return res.json({ payment_url: checkoutData.payment_url, invoice_id: checkoutData.invoice_id });
    }

    res.status(400).json({ error: checkoutData.message || 'Failed to create payment' });
  } catch (err) {
    console.error('process-payment error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
}

module.exports = { processPayment };
