// Admin-only wallet operations. Needed once credit_wallet/debit_wallet were
// locked to service_role-origin-only (db/29, closing a live fund-mint/drain
// exploit) -- these admin UI actions (manual balance adjustment, approving
// a withdrawal request) used to call those RPCs directly from the browser,
// which now always fails, so they need a trusted backend hop instead.
// Withdrawal-request deletion is also moved here: wallet_transactions has
// no DELETE policy at all, so the admin UI's "delete the request row after
// approving" step was silently failing too (the row never disappeared).
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
  const r = await serviceQuery("SELECT (has_role($1,'admin') OR has_role($1,'super_admin')) AS ok", [userId]);
  return !!r.rows[0]?.ok;
}

// POST /functions/v1/admin-wallet-adjust { userId, type: 'credit'|'debit', amount, description }
async function adminWalletAdjust(req, res) {
  const adminId = requireAuth(req);
  if (!adminId) return res.status(401).json({ error: 'Unauthorized' });
  if (!(await isAdmin(adminId))) return res.status(403).json({ error: 'Admin only' });

  const { userId, type, amount, description } = req.body || {};
  const amt = Number(amount);
  if (!userId || !['credit', 'debit'].includes(type) || !amt || amt <= 0) {
    return res.status(400).json({ error: 'userId, type (credit|debit), and a positive amount are required' });
  }

  const fn = type === 'credit' ? 'credit_wallet' : 'debit_wallet';
  const ref = `admin-${Date.now()}`;
  const result = await serviceQuery(`SELECT public.${fn}($1, $2, $3, $4) AS ok`, [
    userId, amt, description || `Admin ${type}`, null,
  ]).catch((e) => { throw { status: 500, message: e.message }; });

  if (type === 'debit' && result.rows[0]?.ok === false) {
    return res.status(400).json({ error: 'Insufficient balance' });
  }
  res.json({ success: true });
}

// POST /functions/v1/admin-approve-withdrawal { transactionId }
async function adminApproveWithdrawal(req, res) {
  const adminId = requireAuth(req);
  if (!adminId) return res.status(401).json({ error: 'Unauthorized' });
  if (!(await isAdmin(adminId))) return res.status(403).json({ error: 'Admin only' });

  const { transactionId } = req.body || {};
  if (!transactionId) return res.status(400).json({ error: 'transactionId required' });

  const txRes = await serviceQuery(
    `SELECT wt.*, w.user_id FROM public.wallet_transactions wt
     JOIN public.wallets w ON w.id = wt.wallet_id
     WHERE wt.id = $1 AND wt.type = 'withdrawal_request'`,
    [transactionId]
  );
  const tx = txRes.rows[0];
  if (!tx) return res.status(404).json({ error: 'Withdrawal request not found' });

  const debitRes = await serviceQuery('SELECT public.debit_wallet($1, $2, $3, $4) AS ok', [
    tx.user_id, tx.amount, `Withdrawal processed: ${tx.description || ''}`.trim(), `wd-${tx.id}`,
  ]);
  if (!debitRes.rows[0]?.ok) {
    return res.status(400).json({ error: 'Insufficient wallet balance -- withdrawal was NOT processed' });
  }

  await serviceQuery('DELETE FROM public.wallet_transactions WHERE id = $1', [transactionId]);
  res.json({ success: true });
}

// POST /functions/v1/admin-reject-withdrawal { transactionId }
async function adminRejectWithdrawal(req, res) {
  const adminId = requireAuth(req);
  if (!adminId) return res.status(401).json({ error: 'Unauthorized' });
  if (!(await isAdmin(adminId))) return res.status(403).json({ error: 'Admin only' });

  const { transactionId } = req.body || {};
  if (!transactionId) return res.status(400).json({ error: 'transactionId required' });

  await serviceQuery("DELETE FROM public.wallet_transactions WHERE id = $1 AND type = 'withdrawal_request'", [transactionId]);
  res.json({ success: true });
}

module.exports = { adminWalletAdjust, adminApproveWithdrawal, adminRejectWithdrawal };
