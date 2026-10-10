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
const tls = require('tls');
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
// Mirrors src/lib/campusSubdomain.ts's RESERVED_SUBDOMAINS -- that copy is
// purely client-side SPA routing logic and never stopped a reserved slug
// from being saved or provisioned. This is the copy that actually gates the
// real `uapi SubDomain addsubdomain` call, backed by a DB CHECK constraint
// (db/85-block-reserved-subdomains.sql) as the final enforcement layer.
const RESERVED_SUBDOMAINS = new Set(['www', 'api', 'mail', 'cpanel', 'webmail', 'autodiscover', 'ftp', 'admin']);

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


// This hosting account is shared/reseller-tier: many unrelated cPanel
// accounts' sites sit behind the same IP. A freshly `addsubdomain`-ed host
// has no SSL cert of its own until AutoSSL actually issues and installs
// one (minutes to a few hours later, not instant even after kicking a
// scan) -- and until then, an HTTPS request's TLS handshake has no
// matching vhost cert to present, so Apache falls back to whatever
// certificate/vhost is configured as the IP's default. On this box that
// default is a *different customer's unrelated site* (confirmed live: a
// freshly-approved campus briefly served a totally unrelated domain's
// homepage, not a cert-warning page -- checkUrlReachable's plain
// HEAD-200-or-not check can't tell that apart from the real thing, since
// the wrong site still answers 200).
//
// The only reliable signal is the TLS certificate itself: does it actually
// cover this hostname? If not, whatever answered isn't our site yet, no
// matter what status code it returned.
function checkCertMatchesHost(hostname, timeoutMs = 8000) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (ok) => { if (!settled) { settled = true; resolve(ok); } };
    const socket = tls.connect(
      { host: hostname, port: 443, servername: hostname, timeout: timeoutMs, rejectUnauthorized: false },
      () => {
        const cert = socket.getPeerCertificate();
        socket.end();
        const names = (cert?.subjectaltname || '')
          .split(',')
          .map((s) => s.trim().replace(/^DNS:/, ''));
        finish(names.includes(hostname));
      }
    );
    socket.on('error', () => finish(false));
    socket.on('timeout', () => { socket.destroy(); finish(false); });
  });
}

const SSL_PENDING_MESSAGE = "SSL certificate is being issued for this subdomain automatically -- this is normal for a brand-new subdomain and usually takes a few minutes to a few hours. It will go live on its own once ready; no action needed.";

// Returns true if the subdomain is confirmed actually serving under its own
// matching certificate right now, false if it's still mid-provisioning
// (expected for a while after creation -- see checkCertMatchesHost above).
// Never silently marks a campus "live" without this check: doing so was
// the bug -- notifying the owner "you're live!" while the public URL could
// still be showing a stranger's unrelated website underneath.
async function provisionSubdomain(campus) {
  if (!SLUG_RE.test(campus.subdomain_slug)) throw new Error('Invalid subdomain slug');
  if (RESERVED_SUBDOMAINS.has(campus.subdomain_slug)) throw new Error(`"${campus.subdomain_slug}" is a reserved subdomain and can't be provisioned`);
  try {
    await runUapi([
      'SubDomain', 'addsubdomain',
      `domain=${campus.subdomain_slug}`,
      `rootdomain=${ROOT_DOMAIN}`,
      `dir=${ROOT_DOMAIN}`, // reuse the main site's existing docroot -- no new deploy/process
    ]);
  } catch (e) {
    // A retry (admin "Retry Subdomain Setup", or the auto-verify cron) calls
    // this a second time for a subdomain whose DNS entry was already created
    // by an earlier call that merely hadn't passed the SSL cert-check yet --
    // that's not a failure, it's the expected state. Only re-throw for a
    // genuinely different error.
    if (!/already exists/i.test(e.message)) throw e;
  }
  // Kick AutoSSL immediately instead of waiting for its next scheduled
  // scan -- fire-and-forget (account-wide cert scan can take a while;
  // approval shouldn't block on it), best-effort only. Doesn't make the
  // cert appear instantly, just shortens the wait.
  runUapi(['SSL', 'start_autossl_check']).catch(() => {});

  const hostname = `${campus.subdomain_slug}.${ROOT_DOMAIN}`;
  const live = await checkCertMatchesHost(hostname);
  if (live) {
    await serviceQuery(
      "UPDATE public.campus_onboard_requests SET subdomain_provisioned=true, subdomain_provisioned_at=now(), subdomain_error=NULL WHERE id=$1",
      [campus.id]
    );
  } else {
    await serviceQuery(
      "UPDATE public.campus_onboard_requests SET subdomain_provisioned=false, subdomain_error=$1 WHERE id=$2",
      [SSL_PENDING_MESSAGE, campus.id]
    );
  }
  return live;
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
    if (RESERVED_SUBDOMAINS.has(slug)) return res.status(400).json({ error: `"${slug}" is a reserved subdomain and can't be used` });
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

  const notifyOwner = async (message) => {
    if (!campus.submitted_by) return;
    await serviceQuery(
      `INSERT INTO public.notifications (user_id, type, title, message, link)
       VALUES ($1, 'campus_approved', '🎉 Campus Approved!', $2, '/dashboard/campus')`,
      [campus.submitted_by, message]
    ).catch(() => {});
  };

  try {
    const live = await provisionSubdomain(campus);
    if (live) {
      await notifyOwner(`${campus.campus_name} is live at ${campus.subdomain_slug}.${ROOT_DOMAIN} — manage your portfolio from your dashboard.`);
      res.json({ success: true, subdomain: `${campus.subdomain_slug}.${ROOT_DOMAIN}` });
    } else {
      // Not an error -- genuinely expected for a brand-new subdomain (see
      // provisionSubdomain). A background check promotes it to live
      // automatically and sends the real "you're live" notification once
      // the certificate is actually ready -- see
      // campusAutoVerifyPendingSubdomains.
      await notifyOwner(`${campus.campus_name} was approved! Your subdomain ${campus.subdomain_slug}.${ROOT_DOMAIN} is being set up and will go live automatically within a few minutes to a few hours.`);
      res.json({ success: true, subdomainPending: true, subdomain: `${campus.subdomain_slug}.${ROOT_DOMAIN}` });
    }
  } catch (err) {
    // Approval itself already succeeded and committed -- record the
    // provisioning failure so the admin can retry via campus-provision-subdomain
    // instead of leaving the request stuck. This is a real failure (e.g. the
    // uapi addsubdomain call itself failed), distinct from the normal
    // "SSL still pending" case handled above.
    await serviceQuery('UPDATE public.campus_onboard_requests SET subdomain_error=$1 WHERE id=$2', [err.message, id]).catch(() => {});
    await notifyOwner(`${campus.campus_name} was approved, but automatic subdomain setup hit an error (${err.message}). An admin will retry it shortly.`);
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
  const upd = await serviceQuery(
    "UPDATE public.campus_onboard_requests SET status='rejected', rejection_reason=$1, reviewed_by=$2, reviewed_at=now() WHERE id=$3 AND status='pending' RETURNING *",
    [reason || null, adminId, id]
  );
  const campus = upd.rows[0];
  if (campus?.submitted_by) {
    await serviceQuery(
      `INSERT INTO public.notifications (user_id, type, title, message, link)
       VALUES ($1, 'campus_rejected', 'Campus Request Rejected', $2, '/campus-onboard/register')`,
      [campus.submitted_by, `Your request for "${campus.campus_name}" was not approved.${reason ? ` Reason: ${reason}` : ''} You're welcome to review and resubmit.`]
    ).catch(() => {});
  }
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
    const live = await provisionSubdomain(campus);
    res.json(live
      ? { success: true, subdomain: `${campus.subdomain_slug}.${ROOT_DOMAIN}` }
      : { success: true, subdomainPending: true, subdomain: `${campus.subdomain_slug}.${ROOT_DOMAIN}` });
  } catch (err) {
    await serviceQuery('UPDATE public.campus_onboard_requests SET subdomain_error=$1 WHERE id=$2', [err.message, id]).catch(() => {});
    res.status(500).json({ error: `Subdomain provisioning failed: ${err.message}` });
  }
}

// POST /functions/v1/campus-update { id, ...fields }
// Deep-edit capability for admins/super_admins AND the campus's own
// requester (submitted_by) -- an approved campus's contact can correct
// their own hero/details/gallery without needing an admin to do it for
// them every time, while still being scoped to only their own campus.
const EDITABLE_FIELDS = new Set([
  'campus_name', 'area', 'facilities', 'description', 'student_count',
  'departments', 'logo_url', 'cover_image_url', 'contact_name', 'contact_email', 'contact_phone',
  'established_year', 'website_url', 'full_address', 'campus_type', 'highlights',
  'principal_name', 'principal_designation', 'principal_photo_url', 'principal_phone', 'principal_email',
  'verification_doc_url',
]);
async function campusUpdate(req, res) {
  const userId = requireAuth(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const { id, ...fields } = req.body || {};
  if (!id) return res.status(400).json({ error: 'id required' });

  const ownerCheck = await serviceQuery('SELECT submitted_by FROM public.campus_onboard_requests WHERE id = $1', [id]);
  const campusRow = ownerCheck.rows[0];
  if (!campusRow) return res.status(404).json({ error: 'Campus request not found' });
  const isOwner = campusRow.submitted_by === userId;
  if (!isOwner && !(await isAdmin(userId))) return res.status(403).json({ error: 'Admin or campus owner only' });

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

// POST /functions/v1/campus-verify { id, verified }
// Admin-only -- is_verified/verified_at aren't in campusUpdate's
// EDITABLE_FIELDS allowlist on purpose (an owner uploading their own
// verification_doc_url can't self-verify), mirroring campusApprove.
async function campusVerify(req, res) {
  const adminId = requireAuth(req);
  if (!adminId) return res.status(401).json({ error: 'Unauthorized' });
  if (!(await isAdmin(adminId))) return res.status(403).json({ error: 'Admin only' });
  const { id, verified } = req.body || {};
  if (!id) return res.status(400).json({ error: 'id required' });

  const upd = await serviceQuery(
    "UPDATE public.campus_onboard_requests SET is_verified=$1, verified_at=CASE WHEN $1 THEN now() ELSE NULL END WHERE id=$2 RETURNING submitted_by, campus_name",
    [!!verified, id]
  );
  const campus = upd.rows[0];
  if (!campus) return res.status(404).json({ error: 'Campus request not found' });

  if (campus.submitted_by && verified) {
    await serviceQuery(
      `INSERT INTO public.notifications (user_id, type, title, message, link)
       VALUES ($1, 'campus_verified', '✅ Campus Verified', $2, '/dashboard/campus')`,
      [campus.submitted_by, `${campus.campus_name} has been verified by Online Textile School.`]
    ).catch(() => {});
  }
  res.json({ success: true });
}

// POST /functions/v1/campus-remove-subdomain { id }
// This account's uapi genuinely has no SubDomain::delsubdomain (verified by
// listing every function it exposes) -- but cPanel's own browser UI can
// still remove a subdomain (the admin confirmed doing exactly this), which
// our tracking then has no way of finding out about on its own. This button
// makes a best-effort live removal attempt (in case a future account
// upgrade adds the API), but ALWAYS resets our own tracking regardless of
// whether that call succeeds, since "remove it" means "stop tracking it as
// live" either way.
async function campusRemoveSubdomain(req, res) {
  const adminId = requireAuth(req);
  if (!adminId) return res.status(401).json({ error: 'Unauthorized' });
  if (!(await isAdmin(adminId))) return res.status(403).json({ error: 'Admin only' });
  const { id } = req.body || {};
  if (!id) return res.status(400).json({ error: 'id required' });

  const r = await serviceQuery('SELECT * FROM public.campus_onboard_requests WHERE id = $1', [id]);
  const campus = r.rows[0];
  if (!campus) return res.status(404).json({ error: 'Campus request not found' });

  let liveRemoveOk = false;
  let liveRemoveError = null;
  if (campus.subdomain_slug) {
    try {
      await runUapi(['SubDomain', 'delsubdomain', `domain=${campus.subdomain_slug}.${ROOT_DOMAIN}`]);
      liveRemoveOk = true;
    } catch (err) {
      liveRemoveError = err.message;
    }
  }

  await serviceQuery(
    "UPDATE public.campus_onboard_requests SET subdomain_provisioned=false, subdomain_provisioned_at=NULL, subdomain_error=$1 WHERE id=$2",
    [liveRemoveOk ? null : `Removal via API not available on this hosting tier (${liveRemoveError || 'no delsubdomain function'}). Tracking has been reset -- verify it's actually removed in cPanel if you haven't already.`, id]
  );

  res.json({ success: true, liveRemoveOk, liveRemoveError });
}

// POST /functions/v1/campus-verify-subdomains
// Self-heal: HEAD-checks every campus we believe has a live subdomain and
// resets tracking for any that no longer resolve. Called from the admin
// page on load so a manual cPanel deletion never leaves stale "live" state
// showing to users who click through from the public campus list.
async function campusVerifySubdomains(req, res) {
  const adminId = requireAuth(req);
  if (!adminId) return res.status(401).json({ error: 'Unauthorized' });
  if (!(await isAdmin(adminId))) return res.status(403).json({ error: 'Admin only' });

  const r = await serviceQuery(
    "SELECT id, subdomain_slug FROM public.campus_onboard_requests WHERE status='approved' AND subdomain_provisioned=true"
  );
  const results = [];
  for (const row of r.rows) {
    // Cert-match, not just "something answered" -- see checkCertMatchesHost's
    // comment for why a plain reachability check can't tell our real site
    // apart from another customer's unrelated one answering on the same IP.
    const reachable = await checkCertMatchesHost(`${row.subdomain_slug}.${ROOT_DOMAIN}`);
    if (!reachable) {
      await serviceQuery(
        "UPDATE public.campus_onboard_requests SET subdomain_provisioned=false, subdomain_provisioned_at=NULL, subdomain_error=$1 WHERE id=$2",
        ['Auto-detected: subdomain no longer resolves (likely removed via cPanel outside this system).', row.id]
      );
    }
    results.push({ id: row.id, slug: row.subdomain_slug, reachable });
  }
  res.json({ success: true, results });
}

// ALL /functions/v1/campus-auto-verify-pending-subdomains?secret=...
// Cron-only (shared-secret gated, same convention as internal-cron), run
// every few minutes. Re-checks every campus still waiting on its SSL
// certificate (see provisionSubdomain/SSL_PENDING_MESSAGE) and promotes it
// to live -- with the real "you're live" notification -- the moment
// AutoSSL actually finishes, instead of requiring an admin to remember to
// click "Retry Subdomain Setup". Deliberately scoped to rows whose error
// is exactly the SSL-pending message, not just any subdomain_error, so a
// genuine uapi failure (bad slug, account quota, etc.) still surfaces to
// an admin instead of being silently retried forever.
async function campusAutoVerifyPendingSubdomains(req, res) {
  const secret = req.headers['x-cron-secret'] || req.query.secret;
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const r = await serviceQuery(
    `SELECT id, campus_name, subdomain_slug, submitted_by FROM public.campus_onboard_requests
     WHERE status='approved' AND subdomain_provisioned=false
       AND subdomain_slug IS NOT NULL AND subdomain_error = $1`,
    [SSL_PENDING_MESSAGE]
  );
  const results = [];
  for (const row of r.rows) {
    const hostname = `${row.subdomain_slug}.${ROOT_DOMAIN}`;
    const live = await checkCertMatchesHost(hostname);
    if (live) {
      await serviceQuery(
        "UPDATE public.campus_onboard_requests SET subdomain_provisioned=true, subdomain_provisioned_at=now(), subdomain_error=NULL WHERE id=$1",
        [row.id]
      );
      if (row.submitted_by) {
        await serviceQuery(
          `INSERT INTO public.notifications (user_id, type, title, message, link)
           VALUES ($1, 'campus_approved', '🎉 Your Campus Is Live!', $2, '/dashboard/campus')`,
          [row.submitted_by, `${row.campus_name} is now live at ${hostname} — manage your portfolio from your dashboard.`]
        ).catch(() => {});
      }
    }
    results.push({ id: row.id, slug: row.subdomain_slug, live });
  }
  res.json({ success: true, checked: results.length, promoted: results.filter((x) => x.live).length, results });
}

// POST /functions/v1/campus-transfer-lookup { campus_id, email }
// The campus owner searches for the user they want to hand ownership to.
// user_profiles has no email column (email lives on auth.users), and a
// plain user can't query auth.users directly, so this is a narrow,
// scoped-to-your-own-campus lookup rather than opening auth.users generally.
async function campusTransferLookup(req, res) {
  const userId = requireAuth(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const { campus_id, email } = req.body || {};
  if (!campus_id || !email) return res.status(400).json({ error: 'campus_id and email required' });

  const campusRes = await serviceQuery('SELECT submitted_by FROM public.campus_onboard_requests WHERE id = $1', [campus_id]);
  const campus = campusRes.rows[0];
  if (!campus) return res.status(404).json({ error: 'Campus not found' });
  if (campus.submitted_by !== userId && !(await isAdmin(userId))) return res.status(403).json({ error: 'Only the current owner or an admin can look up a transfer target' });

  const r = await serviceQuery(
    `SELECT u.id, p.full_name, p.avatar_url FROM auth.users u
     JOIN public.user_profiles p ON p.id = u.id
     WHERE lower(u.email) = lower($1)`,
    [String(email).trim()]
  );
  const target = r.rows[0];
  if (!target) return res.status(404).json({ error: 'No account found with that email' });
  if (target.id === campus.submitted_by) return res.status(400).json({ error: 'That user already owns this campus' });
  res.json({ id: target.id, full_name: target.full_name, avatar_url: target.avatar_url });
}

// POST /functions/v1/campus-transfer-approve { id }
// Admin-only: finalizes a pending ownership transfer by actually
// reassigning submitted_by. Regular owners can never do this directly --
// campus_onboard_requests' RLS policy only lets them update a row while
// submitted_by keeps equaling their own uid, so this has to run as
// service_role via a dedicated, admin-gated endpoint.
async function campusTransferApprove(req, res) {
  const adminId = requireAuth(req);
  if (!adminId) return res.status(401).json({ error: 'Unauthorized' });
  if (!(await isAdmin(adminId))) return res.status(403).json({ error: 'Admin only' });
  const { id } = req.body || {};
  if (!id) return res.status(400).json({ error: 'id required' });

  const r = await serviceQuery('SELECT * FROM public.campus_onboard_requests WHERE id = $1', [id]);
  const campus = r.rows[0];
  if (!campus) return res.status(404).json({ error: 'Campus request not found' });
  if (!campus.pending_owner_id) return res.status(400).json({ error: 'No pending ownership transfer for this campus' });

  await serviceQuery(
    `UPDATE public.campus_onboard_requests
     SET submitted_by = pending_owner_id, pending_owner_id = NULL, ownership_transfer_status = NULL, ownership_transfer_note = NULL, ownership_transfer_requested_at = NULL
     WHERE id = $1`,
    [id]
  );
  await serviceQuery(
    `INSERT INTO public.notifications (user_id, type, title, message, link)
     VALUES ($1, 'campus_ownership_transferred', '🏫 You Now Own This Campus', $2, '/dashboard/campus')`,
    [campus.pending_owner_id, `Ownership of ${campus.campus_name} has been transferred to you.`]
  ).catch(() => {});
  res.json({ success: true });
}

module.exports = {
  campusApprove, campusReject, campusProvisionSubdomain, campusUpdate, campusRemoveSubdomain, campusVerifySubdomains,
  campusAutoVerifyPendingSubdomains, campusTransferLookup, campusTransferApprove, campusVerify,
};
