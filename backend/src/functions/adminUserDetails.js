// New endpoint (no Supabase-era equivalent): auth.users (email, phone,
// last_sign_in_at) is not exposed via the REST shim at all -- the admin
// Users page could only ever show what's mirrored onto user_profiles.
// Needed so admins can see a student's actual signup email/contact info,
// not just their (often-empty) profile phone field.
const jwt = require('jsonwebtoken');
const { serviceQuery } = require('../db');

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

// POST { userIds: string[] } -> { [id]: { email, phone_confirmed_at, last_sign_in_at, created_at } }
async function adminListUserAuth(req, res) {
  try {
    const userId = requireUser(req);
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const roleRes = await serviceQuery(
      "SELECT (has_role($1,'admin') OR has_role($1,'super_admin')) AS ok",
      [userId]
    );
    if (!roleRes.rows[0]?.ok) return res.status(403).json({ message: 'Admin only' });

    const { userIds } = req.body || {};
    if (!Array.isArray(userIds) || userIds.length === 0 || userIds.length > 200) {
      return res.status(400).json({ message: 'userIds must be a non-empty array (max 200)' });
    }

    const result = await serviceQuery(
      `SELECT id, email, last_sign_in_at, created_at, banned_until
       FROM auth.users WHERE id = ANY($1::uuid[])`,
      [userIds]
    );
    const map = {};
    for (const row of result.rows) {
      map[row.id] = {
        email: row.email,
        last_sign_in_at: row.last_sign_in_at,
        created_at: row.created_at,
        banned_until: row.banned_until,
      };
    }
    res.json(map);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
}

module.exports = { adminListUserAuth };
