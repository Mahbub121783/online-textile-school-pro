// Public, unauthenticated lookup used by the QR code printed on the student
// ID card and on enrollment/verification letters. Deliberately returns only
// non-sensitive fields (no email/phone/address/DOB) since anyone with the
// card number can query this -- that's the point, it's how a third party
// (e.g. a SheerID reviewer) independently confirms the document is genuine.
const { serviceQuery } = require('../db');

async function verifyStudent(req, res) {
  try {
    const code = String(req.query.code || '').trim();
    if (!code) return res.status(400).json({ found: false, error: 'code is required' });

    const { rows } = await serviceQuery(
      `SELECT sc.card_number, sc.valid_from, sc.valid_until, sc.is_active, sc.created_at,
              up.full_name, up.roll_id, up.department, up.campus
       FROM public.student_id_cards sc
       JOIN public.user_profiles up ON up.id = sc.user_id
       WHERE sc.card_number = $1
       LIMIT 1`,
      [code]
    );
    const row = rows[0];
    if (!row) return res.json({ found: false });

    const settingsRes = await serviceQuery('SELECT university_name, location FROM public.id_card_settings LIMIT 1');
    const settings = settingsRes.rows[0] || {};

    const expired = new Date(row.valid_until) < new Date();
    res.json({
      found: true,
      full_name: row.full_name,
      roll_id: row.roll_id,
      department: row.department || row.campus || null,
      card_number: row.card_number,
      university_name: settings.university_name || 'Online Textile School',
      location: settings.location || null,
      status: !row.is_active ? 'revoked' : expired ? 'expired' : 'active',
      valid_from: row.valid_from,
      valid_until: row.valid_until,
      issued_at: row.created_at || row.valid_from,
    });
  } catch (e) {
    res.status(500).json({ found: false, error: e.message });
  }
}

module.exports = { verifyStudent };
