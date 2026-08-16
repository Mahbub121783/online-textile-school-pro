// Fabric Library initiative: central hanger catalog/stock (admin-only
// writes, gated further by fabric_hanger_adjust_stock itself requiring a
// service_role-origin caller -- see db/56), and per-campus library
// records/distributions. Follows the exact conventions of campusOnboard.js:
// local requireAuth/isAdmin helpers (not shared middleware), serviceQuery
// for all writes, an EDITABLE_FIELDS allowlist for generic field updates.
const jwt = require('jsonwebtoken');
const { serviceQuery, withRequestContext } = require('../db');

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

// POST /functions/v1/fabric-hanger-create { name, fabric_type?, code?, description?, image_url? }
async function fabricHangerCreate(req, res) {
  const adminId = requireAuth(req);
  if (!adminId) return res.status(401).json({ error: 'Unauthorized' });
  if (!(await isAdmin(adminId))) return res.status(403).json({ error: 'Admin only' });
  const { name, fabric_type, code, description, image_url } = req.body || {};
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'name required' });

  const r = await serviceQuery(
    `INSERT INTO public.fabric_hangers (name, fabric_type, code, description, image_url, created_by)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [name.trim(), fabric_type || null, code || null, description || null, image_url || null, adminId]
  );
  res.json({ success: true, hanger: r.rows[0] });
}

const HANGER_EDITABLE_FIELDS = new Set(['name', 'fabric_type', 'code', 'description', 'image_url']);
// POST /functions/v1/fabric-hanger-update { id, ...fields }
async function fabricHangerUpdate(req, res) {
  const adminId = requireAuth(req);
  if (!adminId) return res.status(401).json({ error: 'Unauthorized' });
  if (!(await isAdmin(adminId))) return res.status(403).json({ error: 'Admin only' });
  const { id, ...fields } = req.body || {};
  if (!id) return res.status(400).json({ error: 'id required' });

  const cols = Object.keys(fields).filter((k) => HANGER_EDITABLE_FIELDS.has(k));
  if (cols.length === 0) return res.status(400).json({ error: 'No editable fields provided' });
  const setClause = cols.map((c, i) => `"${c}" = $${i + 2}`).join(', ');
  const values = cols.map((c) => fields[c]);
  await serviceQuery(`UPDATE public.fabric_hangers SET ${setClause} WHERE id = $1`, [id, ...values]);
  res.json({ success: true });
}

// POST /functions/v1/fabric-stock-receive { hanger_id, quantity, note? }
// Records new stock arriving from a supplier into the central pool.
async function fabricStockReceive(req, res) {
  const adminId = requireAuth(req);
  if (!adminId) return res.status(401).json({ error: 'Unauthorized' });
  if (!(await isAdmin(adminId))) return res.status(403).json({ error: 'Admin only' });
  const { hanger_id, quantity, note } = req.body || {};
  const qty = Number(quantity);
  if (!hanger_id || !Number.isInteger(qty) || qty <= 0) {
    return res.status(400).json({ error: 'hanger_id and a positive integer quantity are required' });
  }

  try {
    const r = await serviceQuery(
      'SELECT public.fabric_hanger_adjust_stock($1, $2, $3, $4, $5, $6) AS new_stock',
      [hanger_id, qty, 'received', null, note || null, adminId]
    );
    res.json({ success: true, new_stock: r.rows[0].new_stock });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

// POST /functions/v1/fabric-distribute { campus_id, hanger_id, quantity, note? }
// Sends hangers from central stock to an approved campus -- creates the
// distribution row and decrements stock atomically in one transaction, so
// the ledger and the distribution record can never disagree.
async function fabricDistribute(req, res) {
  const adminId = requireAuth(req);
  if (!adminId) return res.status(401).json({ error: 'Unauthorized' });
  if (!(await isAdmin(adminId))) return res.status(403).json({ error: 'Admin only' });
  const { campus_id, hanger_id, quantity, note } = req.body || {};
  const qty = Number(quantity);
  if (!campus_id || !hanger_id || !Number.isInteger(qty) || qty <= 0) {
    return res.status(400).json({ error: 'campus_id, hanger_id and a positive integer quantity are required' });
  }

  const campusRes = await serviceQuery('SELECT status FROM public.campus_onboard_requests WHERE id = $1', [campus_id]);
  const campus = campusRes.rows[0];
  if (!campus) return res.status(404).json({ error: 'Campus not found' });
  if (campus.status !== 'approved') return res.status(400).json({ error: 'Campus must be an approved, onboarded campus first' });

  try {
    const distribution = await withRequestContext({ role: 'service_role' }, async (client) => {
      await client.query(
        'SELECT public.fabric_hanger_adjust_stock($1, $2, $3, $4, $5, $6)',
        [hanger_id, -qty, 'distributed', campus_id, note || null, adminId]
      );
      const ins = await client.query(
        `INSERT INTO public.campus_fabric_hanger_distributions (campus_id, hanger_id, quantity, note, distributed_by)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [campus_id, hanger_id, qty, note || null, adminId]
      );
      return ins.rows[0];
    });
    res.json({ success: true, distribution });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

// POST /functions/v1/fabric-library-start { campus_id, summary? }
// Admin decides to start a fabric library at an approved campus.
async function fabricLibraryStart(req, res) {
  const adminId = requireAuth(req);
  if (!adminId) return res.status(401).json({ error: 'Unauthorized' });
  if (!(await isAdmin(adminId))) return res.status(403).json({ error: 'Admin only' });
  const { campus_id, summary } = req.body || {};
  if (!campus_id) return res.status(400).json({ error: 'campus_id required' });

  const campusRes = await serviceQuery('SELECT status FROM public.campus_onboard_requests WHERE id = $1', [campus_id]);
  const campus = campusRes.rows[0];
  if (!campus) return res.status(404).json({ error: 'Campus not found' });
  if (campus.status !== 'approved') return res.status(400).json({ error: 'Campus must be an approved, onboarded campus first' });

  const existing = await serviceQuery('SELECT id FROM public.campus_fabric_libraries WHERE campus_id = $1', [campus_id]);
  if (existing.rows.length > 0) return res.status(400).json({ error: 'This campus already has a fabric library' });

  const r = await serviceQuery(
    `INSERT INTO public.campus_fabric_libraries (campus_id, summary, created_by) VALUES ($1, $2, $3) RETURNING *`,
    [campus_id, summary || null, adminId]
  );
  res.json({ success: true, library: r.rows[0] });
}

// POST /functions/v1/fabric-library-set-status { id, status }
// Admin override for ongoing/completed (owners can also self-report via
// fabric-library-update below).
async function fabricLibrarySetStatus(req, res) {
  const adminId = requireAuth(req);
  if (!adminId) return res.status(401).json({ error: 'Unauthorized' });
  if (!(await isAdmin(adminId))) return res.status(403).json({ error: 'Admin only' });
  const { id, status } = req.body || {};
  if (!id || !['ongoing', 'completed'].includes(status)) {
    return res.status(400).json({ error: 'id and a valid status (ongoing|completed) are required' });
  }
  await serviceQuery(
    `UPDATE public.campus_fabric_libraries
     SET status = $1, completed_at = CASE WHEN $1 = 'completed' THEN now() ELSE NULL END
     WHERE id = $2`,
    [status, id]
  );
  res.json({ success: true });
}

const LIBRARY_EDITABLE_FIELDS = new Set(['summary', 'cover_image_url', 'status']);
// POST /functions/v1/fabric-library-update { id, ...fields }
// Owner-or-admin: lets the campus owner maintain their own library
// (progress notes, cover photo) and self-report completion, once admin has
// started it for their campus.
async function fabricLibraryUpdate(req, res) {
  const userId = requireAuth(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const { id, ...fields } = req.body || {};
  if (!id) return res.status(400).json({ error: 'id required' });

  const ownerCheck = await serviceQuery(
    `SELECT l.id, c.submitted_by FROM public.campus_fabric_libraries l
     JOIN public.campus_onboard_requests c ON c.id = l.campus_id
     WHERE l.id = $1`,
    [id]
  );
  const row = ownerCheck.rows[0];
  if (!row) return res.status(404).json({ error: 'Fabric library not found' });
  const isOwner = row.submitted_by === userId;
  if (!isOwner && !(await isAdmin(userId))) return res.status(403).json({ error: 'Admin or campus owner only' });

  if ('status' in fields && !['ongoing', 'completed'].includes(fields.status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  const cols = Object.keys(fields).filter((k) => LIBRARY_EDITABLE_FIELDS.has(k));
  if (cols.length === 0) return res.status(400).json({ error: 'No editable fields provided' });
  const setClause = cols.map((c, i) => `"${c}" = $${i + 2}`).join(', ');
  const values = cols.map((c) => fields[c]);
  let sql = `UPDATE public.campus_fabric_libraries SET ${setClause}`;
  if ('status' in fields) {
    sql += `, completed_at = CASE WHEN $${cols.indexOf('status') + 2} = 'completed' THEN now() ELSE NULL END`;
  }
  sql += ' WHERE id = $1';
  await serviceQuery(sql, [id, ...values]);
  res.json({ success: true });
}

module.exports = {
  fabricHangerCreate, fabricHangerUpdate, fabricStockReceive, fabricDistribute,
  fabricLibraryStart, fabricLibrarySetStatus, fabricLibraryUpdate,
};
