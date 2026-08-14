// New endpoint set replacing the client-side order-completion logic that
// used to live entirely in Checkout.tsx / AdminOrders.tsx. Found via audit
// to be exploitable (client could self-mark an order 'completed', tamper
// with total/prices, or call credit_wallet/debit_wallet directly with an
// arbitrary _user_id) and, independently, largely non-functional (RLS
// blocked the referral_rewards/coupon_usages/ebook_access_tokens writes
// those flows depended on). All order completion now happens here, server
// side, via serviceQuery (elevated), with prices/coupon re-validated
// against the real DB rather than trusting whatever the client sent at
// order-creation time.
const jwt = require('jsonwebtoken');
const { serviceQuery } = require('../db');

function requireAuth(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return null;
  try {
    return jwt.verify(token, process.env.JWT_SECRET).sub;
  } catch {
    return null;
  }
}

async function isAdmin(userId) {
  const r = await serviceQuery(
    "SELECT (has_role($1,'admin') OR has_role($1,'super_admin')) AS ok",
    [userId]
  );
  return !!r.rows[0]?.ok;
}

function isCouponCurrentlyValid(coupon, subtotal) {
  if (!coupon || !coupon.is_active) return false;
  const now = new Date();
  if (coupon.valid_from && new Date(coupon.valid_from) > now) return false;
  if (coupon.valid_until && new Date(coupon.valid_until) < now) return false;
  if (coupon.usage_limit != null && Number(coupon.used_count || 0) >= Number(coupon.usage_limit)) return false;
  if (coupon.min_order_amount != null && subtotal < Number(coupon.min_order_amount)) return false;
  return true;
}

function computeDiscount(coupon, subtotal) {
  if (coupon.discount_type === 'percentage') {
    let d = (subtotal * Number(coupon.discount_value || 0)) / 100;
    if (coupon.max_discount_amount != null) d = Math.min(d, Number(coupon.max_discount_amount));
    return Math.round(d);
  }
  return Math.min(Number(coupon.discount_value || 0), subtotal);
}

// Recomputes the real, trustworthy subtotal/discount/total for an order
// from the live courses/ebooks catalog and the coupon's actual current DB
// state -- never from order_items.price or orders.total, both of which
// were found to be entirely client-controlled at order-creation time.
// Exported so processPayment.js (UddoktaPay) can also charge the verified
// amount instead of whatever `amount` the client claimed at checkout.
async function computeRealOrderTotal(order) {
  const itemsRes = await serviceQuery(
    'SELECT id, item_id, item_type, price FROM public.order_items WHERE order_id = $1',
    [order.id]
  );
  const items = itemsRes.rows;
  if (items.length === 0) { const e = new Error('Order has no items'); e.status = 400; throw e; }

  // 'tokens' (practice-credit top-ups) have no catalog row to check
  // against, so those are trusted as-is (fixed-package amounts, low risk).
  let subtotal = 0;
  const priced = [];
  for (const item of items) {
    let realPrice = Number(item.price) || 0;
    if (item.item_type === 'course') {
      const r = await serviceQuery('SELECT price, discount_price, instructor_id, revenue_share_pct, title, slug FROM public.courses WHERE id = $1', [item.item_id]);
      const c = r.rows[0];
      if (!c) { const e = new Error('Course no longer exists'); e.status = 400; throw e; }
      realPrice = Number(c.discount_price ?? c.price ?? 0);
      priced.push({ ...item, realPrice, course: c });
    } else if (item.item_type === 'ebook') {
      const r = await serviceQuery('SELECT price, discount_price, title FROM public.ebooks WHERE id = $1', [item.item_id]);
      const eb = r.rows[0];
      if (!eb) { const e = new Error('Ebook no longer exists'); e.status = 400; throw e; }
      realPrice = Number(eb.discount_price ?? eb.price ?? 0);
      priced.push({ ...item, realPrice });
    } else {
      priced.push({ ...item, realPrice });
    }
    subtotal += realPrice;
  }

  let discount = 0;
  let validCouponId = null;
  if (order.coupon_code) {
    const cr = await serviceQuery('SELECT * FROM public.coupons WHERE code = $1', [order.coupon_code]);
    const coupon = cr.rows[0];
    if (coupon) {
      let perUserOk = true;
      if (coupon.per_user_limit != null) {
        const uc = await serviceQuery(
          'SELECT COUNT(*)::int AS n FROM public.coupon_usage WHERE coupon_id = $1 AND user_id = $2',
          [coupon.id, order.user_id]
        );
        perUserOk = Number(uc.rows[0]?.n || 0) < Number(coupon.per_user_limit);
      }
      if (perUserOk && isCouponCurrentlyValid(coupon, subtotal)) {
        discount = computeDiscount(coupon, subtotal);
        validCouponId = coupon.id;
      }
    }
  }

  const total = Math.max(subtotal - discount, 0);
  return { subtotal, discount, total, validCouponId, priced };
}

// Core, shared, idempotent order-completion logic.
async function finalizeOrder({ orderId, callerUserId, admin, chargeWallet }) {
  const orderRes = await serviceQuery('SELECT * FROM public.orders WHERE id = $1', [orderId]);
  const order = orderRes.rows[0];
  if (!order) { const e = new Error('Order not found'); e.status = 404; throw e; }
  if (!admin && order.user_id !== callerUserId) { const e = new Error('Not your order'); e.status = 403; throw e; }
  if (order.status !== 'pending') {
    // Idempotent: a retried/duplicate call is a no-op, not an error --
    // closes the double-completion / double-credit race noted in the audit.
    return { alreadyCompleted: true, total: Number(order.total) };
  }

  const { discount, total, validCouponId, priced } = await computeRealOrderTotal(order);

  if (chargeWallet) {
    const debitRes = await serviceQuery('SELECT public.debit_wallet($1, $2, $3, $4) AS ok', [
      order.user_id, total, `Payment for order ${String(orderId).slice(0, 8)}`, orderId,
    ]);
    if (!debitRes.rows[0]?.ok) { const e = new Error('Insufficient wallet balance'); e.status = 400; throw e; }
  }

  await serviceQuery(
    "UPDATE public.orders SET status = 'completed', total = $1, discount_amount = $2 WHERE id = $3",
    [total, discount, orderId]
  );
  await serviceQuery(
    "UPDATE public.invoices SET payment_status = 'paid', paid_at = now(), total = $1, discount_amount = $2 WHERE order_id = $3",
    [total, discount, orderId]
  ).catch(() => {});

  for (const item of priced) {
    if (item.item_type === 'course') {
      await serviceQuery(
        `INSERT INTO public.enrollments (user_id, course_id, payment_id) VALUES ($1, $2, $3)
         ON CONFLICT (user_id, course_id) DO NOTHING`,
        [order.user_id, item.item_id, orderId]
      ).catch(() => {});

      const course = item.course;
      if (course?.instructor_id) {
        const sharePct = Number(course.revenue_share_pct ?? 70);
        const instructorAmount = (item.realPrice * sharePct) / 100;
        if (instructorAmount > 0) {
          await serviceQuery('SELECT public.credit_wallet($1, $2, $3, $4)', [
            course.instructor_id, instructorAmount, `Revenue from order ${String(orderId).slice(0, 8)}`, orderId,
          ]).catch((e) => console.warn('instructor credit_wallet failed:', e.message));
        }
      }
    } else if (item.item_type === 'tokens' || item.item_type === 'practice_credits') {
      const credits = Math.round(item.realPrice * 2);
      if (credits > 0) {
        await serviceQuery('SELECT public.qb_credit_paid_tokens_admin($1, $2, $3)', [order.user_id, credits, orderId])
          .catch((e) => console.warn('practice credit grant failed:', e.message));
      }
    }
    // ebook: no separate grant needed -- access is derived dynamically from
    // order_items + orders.status='completed' (see ebookSecureAccess.js).
  }

  if (validCouponId) {
    await serviceQuery(
      'INSERT INTO public.coupon_usage (coupon_id, user_id, order_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
      [validCouponId, order.user_id, orderId]
    ).catch(() => {});
    await serviceQuery('UPDATE public.coupons SET used_count = COALESCE(used_count, 0) + 1 WHERE id = $1', [validCouponId]).catch(() => {});
  }

  const profRes = await serviceQuery('SELECT referred_by FROM public.user_profiles WHERE id = $1', [order.user_id]);
  const referredBy = profRes.rows[0]?.referred_by;
  if (referredBy) {
    const upd = await serviceQuery(
      "UPDATE public.referral_rewards SET status = 'credited', reward_amount = 50, credited_at = now() WHERE referred_id = $1 AND status = 'pending' RETURNING id",
      [order.user_id]
    );
    if (upd.rows.length > 0) {
      await serviceQuery('SELECT public.credit_wallet($1, $2, $3, $4)', [
        referredBy, 50, `Referral reward for order ${String(orderId).slice(0, 8)}`, orderId,
      ]).catch((e) => console.warn('referral credit_wallet failed:', e.message));
    }
  }

  return { alreadyCompleted: false, total };
}

// POST /functions/v1/checkout-wallet { orderId } -- student pays with wallet balance.
async function checkoutWallet(req, res) {
  const userId = requireAuth(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const { orderId } = req.body || {};
  if (!orderId) return res.status(400).json({ error: 'orderId required' });
  try {
    const result = await finalizeOrder({ orderId, callerUserId: userId, admin: false, chargeWallet: true });
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
}

// POST /functions/v1/checkout-free { orderId } -- order total is genuinely
// 0 after real-catalog-price + coupon recomputation (free course, or a
// 100%-off coupon). No wallet debit.
async function checkoutFree(req, res) {
  const userId = requireAuth(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const { orderId } = req.body || {};
  if (!orderId) return res.status(400).json({ error: 'orderId required' });
  try {
    const result = await finalizeOrder({ orderId, callerUserId: userId, admin: false, chargeWallet: false });
    if (!result.alreadyCompleted && result.total > 0) {
      // Recomputed total turned out non-zero (client under-priced/tampered
      // the order) -- do not grant access, order stays pending for a real
      // payment method instead.
      return res.status(400).json({ error: 'Order total is not zero; use a payment method' });
    }
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
}

// POST /functions/v1/checkout-admin-approve { orderId } -- admin confirms a
// manually-verified (bKash/Nagad/Rocket/bank send-money) payment.
async function checkoutAdminApprove(req, res) {
  const userId = requireAuth(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  if (!(await isAdmin(userId))) return res.status(403).json({ error: 'Admin only' });
  const { orderId } = req.body || {};
  if (!orderId) return res.status(400).json({ error: 'orderId required' });
  try {
    const result = await finalizeOrder({ orderId, callerUserId: userId, admin: true, chargeWallet: false });
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
}

// POST /functions/v1/checkout-admin-reject { orderId, reason } -- admin
// rejects a manual payment claim (bad/fake transaction ID etc).
async function checkoutAdminReject(req, res) {
  const userId = requireAuth(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  if (!(await isAdmin(userId))) return res.status(403).json({ error: 'Admin only' });
  const { orderId, reason } = req.body || {};
  if (!orderId) return res.status(400).json({ error: 'orderId required' });
  await serviceQuery("UPDATE public.orders SET status = 'rejected' WHERE id = $1 AND status = 'pending'", [orderId]);
  await serviceQuery(
    "UPDATE public.invoices SET payment_status = 'rejected' WHERE order_id = $1",
    [orderId]
  ).catch(() => {});
  if (reason) {
    await serviceQuery(
      `INSERT INTO public.notifications (user_id, type, title, message, link)
       SELECT user_id, 'order', 'Order Rejected', $2, '/dashboard/orders' FROM public.orders WHERE id = $1`,
      [orderId, `Your order was rejected: ${reason}`]
    ).catch(() => {});
  }
  res.json({ success: true });
}

module.exports = { checkoutWallet, checkoutFree, checkoutAdminApprove, checkoutAdminReject, computeRealOrderTotal };
