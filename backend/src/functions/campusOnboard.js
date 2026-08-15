// Campus Onboarding: admin review + real subdomain provisioning.
// Provisioning calls cPanel's `uapi` CLI directly (the Node app runs as
// the same Linux account as an SSH session would, so it has the same
// uapi access) -- the new subdomain points at the SAME docroot as the
// main site (no separate deploy/Node process per campus), so this never
// grows the process count. This is a genuinely hard-to-reverse action
// (this cPanel account/version exposes no uapi subdomain-removal
// function -- confirmed by testing), so it's a distinct, explicit admin
// action taken only after approval, never automatic.
const { execFile } = require('child_process');
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

const ROOT_DOMAIN = process.env.CAMPUS_ROOT_DOMAIN || 'onlinetextileschool.com';
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

function runUapi(args) {
  return new Promise((resolve, reject) => {
    execFile('uapi', ['--output=json', ...args], { timeout: 20000 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message));
      try {
        const parsed = JSON.parse(stdout);
        if (parsed.result?.status !== 1) {
          return reject(new Error((parsed.result?.errors || []).join('; ') || 'uapi call failed'));
        }
        resolve(parsed.result);
      } catch (e) {
        reject(new Error(`uapi returned non-JSON output: ${stdout.slice(0, 300)}`));
      }
    });
  });
}

async function provisionSubdomain(campus) {
  if (!SLUG_RE.test(campus.subdomain_slug)) throw new Error('Invalid subdomain slug');
  await runUapi([
    'SubDomain', 'addsubdomain',
    `domain=${campus.subdomain_slug}`,
    `rootdomain=${ROOT_DOMAIN}`,
    `dir=${ROOT_DOMAIN}`, // reuse the main site's existing docroot -- no new deploy/process
  ]);
  await serviceQuery(
    "UPDATE public.campus_onboard_requests SET subdomain_provisioned=true, subdomain_provisioned_at=now(), subdomain_error=NULL WHERE id=$1",
    [campus.id]
  );
}

// POST /functions/v1/campus-approve { id, subdomainSlug? }
// Auto-provisions the real subdomain as part of approval (removal isn't
// possible on this cPanel account tier, so if the slug is being changed it
// must happen here, before the subdomain is ever created -- see the
// campusProvisionSubdomain doc comment below).
async function campusApprove(req, res) {
  const adminId = requireAuth(req);
  if (!adminId) return res.status(401).json({ error: 'Unauthorized' });
  if (!(await isAdmin(adminId))) return res.status(403).json({ error: 'Admin only' });
  const { id, subdomainSlug } = req.body || {};
  if (!id) return res.status(400).json({ error: 'id required' });

  if (subdomainSlug) {
    const slug = String(subdomainSlug).toLowerCase().trim();
    if (!SLUG_RE.test(slug)) return res.status(400).json({ error: 'Invalid subdomain slug' });
    const clash = await serviceQuery(
      'SELECT id FROM public.campus_onboard_requests WHERE subdomain_slug = $1 AND id <> $2',
      [slug, id]
    );
    if (clash.rows.length > 0) return res.status(400).json({ error: 'That subdomain name is already taken' });
    await serviceQuery('UPDATE public.campus_onboard_requests SET subdomain_slug = $1 WHERE id = $2', [slug, id]);
  }

  const upd = await serviceQuery(
    "UPDATE public.campus_onboard_requests SET status='approved', reviewed_by=$1, reviewed_at=now() WHERE id=$2 AND status='pending' RETURNING *",
    [adminId, id]
  );
  const campus = upd.rows[0];
  if (!campus) return res.status(404).json({ error: 'Request not found or already processed' });

  try {
    await provisionSubdomain(campus);
    res.json({ success: true, subdomain: `${campus.subdomain_slug}.${ROOT_DOMAIN}` });
  } catch (err) {
    // Approval itself already succeeded and committed -- record the
    // provisioning failure so the admin can retry via campus-provision-subdomain
    // instead of leaving the request stuck.
    await serviceQuery('UPDATE public.campus_onboard_requests SET subdomain_error=$1 WHERE id=$2', [err.message, id]).catch(() => {});
    res.json({ success: true, subdomainError: err.message });
  }
}

// POST /functions/v1/campus-reject { id, reason }
async function campusReject(req, res) {
  const adminId = requireAuth(req);
  if (!adminId) return res.status(401).json({ error: 'Unauthorized' });
  if (!(await isAdmin(adminId))) return res.status(403).json({ error: 'Admin only' });
  const { id, reason } = req.body || {};
  if (!id) return res.status(400).json({ error: 'id required' });
  await serviceQuery(
    "UPDATE public.campus_onboard_requests SET status='rejected', rejection_reason=$1, reviewed_by=$2, reviewed_at=now() WHERE id=$3 AND status='pending'",
    [reason || null, adminId, id]
  );
  res.json({ success: true });
}

// POST /functions/v1/campus-provision-subdomain { id }
// Retry path -- campus-approve auto-provisions now, but this stays
// available for when that provisioning step failed (network blip, uapi
// hiccup) and needs a manual retry without re-running the whole approval.
async function campusProvisionSubdomain(req, res) {
  const adminId = requireAuth(req);
  if (!adminId) return res.status(401).json({ error: 'Unauthorized' });
  if (!(await isAdmin(adminId))) return res.status(403).json({ error: 'Admin only' });
  const { id } = req.body || {};
  if (!id) return res.status(400).json({ error: 'id required' });

  const r = await serviceQuery('SELECT * FROM public.campus_onboard_requests WHERE id = $1', [id]);
  const campus = r.rows[0];
  if (!campus) return res.status(404).json({ error: 'Campus request not found' });
  if (campus.status !== 'approved') return res.status(400).json({ error: 'Campus must be approved first' });
  if (campus.subdomain_provisioned) return res.status(400).json({ error: 'Subdomain already provisioned' });

  try {
    await provisionSubdomain(campus);
    res.json({ success: true, subdomain: `${campus.subdomain_slug}.${ROOT_DOMAIN}` });
  } catch (err) {
    await serviceQuery('UPDATE public.campus_onboard_requests SET subdomain_error=$1 WHERE id=$2', [err.message, id]).catch(() => {});
    res.status(500).json({ error: `Subdomain provisioning failed: ${err.message}` });
  }
}

// POST /functions/v1/campus-update { id, ...fields }
// Deep-edit capability for admins/super_admins -- correct any detail on an
// already-submitted (pending, approved, or rejected) campus request,
// including its public subdomain-portfolio content.
const EDITABLE_FIELDS = new Set([
  'campus_name', 'area', 'facilities', 'description', 'student_count',
  'departments', 'logo_url', 'contact_name', 'contact_email', 'contact_phone',
]);
async function campusUpdate(req, res) {
  const adminId = requireAuth(req);
  if (!adminId) return res.status(401).json({ error: 'Unauthorized' });
  if (!(await isAdmin(adminId))) return res.status(403).json({ error: 'Admin only' });
  const { id, ...fields } = req.body || {};
  if (!id) return res.status(400).json({ error: 'id required' });

  const cols = Object.keys(fields).filter((k) => EDITABLE_FIELDS.has(k));
  if (cols.length === 0) return res.status(400).json({ error: 'No editable fields provided' });

  const setClause = cols.map((c, i) => `"${c}" = $${i + 2}`).join(', ');
  const values = cols.map((c) => fields[c]);
  await serviceQuery(
    `UPDATE public.campus_onboard_requests SET ${setClause} WHERE id = $1`,
    [id, ...values]
  );
  res.json({ success: true });
}

module.exports = { campusApprove, campusReject, campusProvisionSubdomain, campusUpdate };
