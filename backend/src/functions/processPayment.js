// Ported from supabase/functions/process-payment/index.ts (Deno -> Node).
// UddoktaPay gateway integration; business logic unchanged, DB access via
// `serviceQuery` (elevated context), auth via our own JWT instead of supabase-js.
const fetch = require('node-fetch');
const jwt = require('jsonwebtoken');
const { serviceQuery } = require('../db');
const { sendSmtpEmail } = require('./sendSmtpEmail');
const { computeRealOrderTotal } = require('./checkoutFinalize');

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

// Re-verifies invoice_id directly against UddoktaPay's own API (never trusts
// a webhook payload's claimed status), and if genuinely COMPLETED, marks the
// order complete and fans out enrollments/instructor revenue/referral
// reward/coupon usage -- all from the recomputed real catalog price, not
// whatever order_items.price the client set at checkout. Shared by both the
// client-triggered 'verify' action (browser redirect back from the gateway)
// and the server-to-server webhook (covers the case where the user closes
// the tab before the redirect completes).
async function verifyAndCompleteUddoktaPay(invoiceId, apiKey) {
  const gatewayRes = await serviceQuery(
    "SELECT credentials FROM public.payment_gateways WHERE gateway_name = 'uddoktapay' AND is_active = true"
  );
  const apiUrl = gatewayRes.rows[0]?.credentials?.api_url || 'https://sandbox.uddoktapay.com/api';

  const verifyRes = await fetch(`${apiUrl}/verify-payment`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'RT-UDDOKTAPAY-API-KEY': apiKey },
    body: JSON.stringify({ invoice_id: invoiceId }),
  });
  const verifyData = await verifyRes.json();
  if (verifyData.status !== 'COMPLETED') return { status: verifyData.status || 'PENDING' };

  const orderRes = await serviceQuery('SELECT * FROM public.orders WHERE payment_reference = $1', [invoiceId]);
  const order = orderRes.rows[0];
  if (!order || order.status === 'completed') return { status: 'COMPLETED', invoice_id: invoiceId };

  // Recompute the real total/discount from the live catalog + coupon state
  // rather than trusting order_items.price (client-set at checkout time).
  const { discount, total: realTotal, validCouponId, priced } = await computeRealOrderTotal(order);

  await serviceQuery(
    "UPDATE public.orders SET status = 'completed', payment_reference = $1, total = $2, discount_amount = $3 WHERE id = $4",
    [invoiceId, realTotal, discount, order.id]
  );
  await serviceQuery(
    "UPDATE public.invoices SET payment_status = 'paid', paid_at = now(), total = $1, discount_amount = $2 WHERE order_id = $3",
    [realTotal, discount, order.id]
  ).catch(() => {});
  if (validCouponId) {
    await serviceQuery(
      'INSERT INTO public.coupon_usage (coupon_id, user_id, order_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
      [validCouponId, order.user_id, order.id]
    ).catch(() => {});
    await serviceQuery('UPDATE public.coupons SET used_count = COALESCE(used_count, 0) + 1 WHERE id = $1', [validCouponId]).catch(() => {});
  }

  const userRes = await serviceQuery('SELECT email FROM auth.users WHERE id = $1', [order.user_id]);
  const userEmail = userRes.rows[0]?.email;
  const profRes = await serviceQuery('SELECT full_name, referred_by FROM public.user_profiles WHERE id = $1', [order.user_id]);
  const userName = profRes.rows[0]?.full_name || 'Student';
  const siteUrl = process.env.SITE_URL || 'https://www.onlinetextileschool.com';

  if (userEmail) {
    sendEmailFireAndForget({
      templateKey: 'payment_received', recipientEmail: userEmail,
      placeholders: { user_name: userName, amount: String(realTotal ?? ''), payment_method: 'UddoktaPay', invoice_number: invoiceId, invoice_url: `${siteUrl}/dashboard/invoices` },
    });
  }

  for (const item of priced) {
    if (item.item_type === 'course') {
      await serviceQuery(
        `INSERT INTO public.enrollments (user_id, course_id, payment_id) VALUES ($1, $2, $3)
         ON CONFLICT (user_id, course_id) DO NOTHING`,
        [order.user_id, item.item_id, order.id]
      );

      const course = item.course;
      if (userEmail && course) {
        sendEmailFireAndForget({
          templateKey: 'enrollment_confirmation', recipientEmail: userEmail,
          placeholders: { user_name: userName, course_name: course.title, course_url: `${siteUrl}/courses/${course.slug}` },
        });
      }

      if (course?.instructor_id) {
        const sharePct = Number(course.revenue_share_pct ?? 70);
        const instructorAmount = (item.realPrice * sharePct) / 100;
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
    } else if (item.item_type === 'practice_credits' || item.item_type === 'tokens') {
      const credits = Math.round(item.realPrice * 2);
      if (credits > 0) {
        await serviceQuery('SELECT public.qb_credit_paid_tokens_admin($1, $2, $3)', [order.user_id, credits, order.id])
          .catch((e) => console.warn('practice credit grant failed:', e.message));
      }
    }
  }

  const referredBy = profRes.rows[0]?.referred_by;
  if (referredBy) {
    const upd = await serviceQuery(
      "UPDATE public.referral_rewards SET status = 'credited', reward_amount = 50, credited_at = now() WHERE referred_id = $1 AND status = 'pending' RETURNING id",
      [order.user_id]
    );
    if (upd.rows.length > 0) {
      await serviceQuery('SELECT public.credit_wallet($1, $2, $3, $4)', [
        referredBy, 50, `Referral reward for order ${String(order.id).slice(0, 8)}`, order.id,
      ]).catch((e) => console.warn('referral credit_wallet failed:', e.message));
    }
  }

  return { status: 'COMPLETED', invoice_id: invoiceId };
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
      const result = await verifyAndCompleteUddoktaPay(invoice_id, apiKey);
      return res.json(result);
    }

    // ── CREATE new payment ──
    const { orderId, customerName, customerEmail, metadata } = req.body || {};
    if (!orderId) return res.status(400).json({ error: 'orderId required' });
    if (!apiKey) return res.status(500).json({ error: 'Payment gateway not configured' });

    const orderRowRes = await serviceQuery('SELECT * FROM public.orders WHERE id = $1 AND user_id = $2', [orderId, userId]);
    const orderRow = orderRowRes.rows[0];
    if (!orderRow) return res.status(404).json({ error: 'Order not found' });
    // Never trust the client-supplied `amount` -- recompute from the real
    // catalog/coupon state so the gateway invoice is created for the true
    // price (previously a tampered request could open a real payment
    // gateway invoice for an arbitrary, much lower amount).
    const { total: amount } = await computeRealOrderTotal(orderRow);
    if (amount <= 0) return res.status(400).json({ error: 'Order total is zero; use the free/wallet checkout path instead' });

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

// POST /functions/v1/process-payment-webhook -- UddoktaPay's server-to-server
// callback (was registered as webhook_url at checkout creation time, but the
// route never existed -- order completion depended entirely on the browser
// successfully redirecting back and calling 'verify'; if the user closed the
// tab or the redirect failed, the order stayed 'pending' forever with no
// reconciliation). No auth header from UddoktaPay, so the payload is never
// trusted directly -- it's only used to learn which invoice_id to
// independently re-verify against UddoktaPay's own API.
async function processPaymentWebhook(req, res) {
  try {
    const apiKey = process.env.UDDOKTAPAY_API_KEY;
    const invoiceId = req.body?.invoice_id || req.body?.metadata?.invoice_id;
    if (!invoiceId || !apiKey) return res.status(200).json({ received: true });
    await verifyAndCompleteUddoktaPay(invoiceId, apiKey);
    res.status(200).json({ received: true });
  } catch (err) {
    console.error('process-payment-webhook error:', err);
    res.status(200).json({ received: true }); // always 200 so the gateway doesn't retry-storm us
  }
}

module.exports = { processPayment, processPaymentWebhook };
