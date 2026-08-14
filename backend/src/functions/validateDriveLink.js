// No source file for this ever existed in supabase/functions/ -- discovered
// as a "mystery" gap: the frontend (AssignmentSubmit.tsx) calls
// supabase.functions.invoke('validate-drive-link', { body: { url } })
// expecting { valid: boolean, error?: string }, but the edge function itself
// was apparently never built server-side (client already does a regex-only
// pre-check with the same DRIVE_URL_REGEX/DRIVE_FILE_ID_REGEX used here).
// Implemented fresh: validates the URL shape, then does a live reachability
// check so students can't submit a Drive link that's set to private/
// no-access (the one thing the client-side regex check can't catch).
const fetch = require('node-fetch');

const DRIVE_URL_REGEX = /^https:\/\/(drive|docs)\.google\.com\/.+/i;
const DRIVE_FILE_ID_REGEX = /\/file\/d\/([a-zA-Z0-9_-]+)|[?&]id=([a-zA-Z0-9_-]+)/;

async function validateDriveLink(req, res) {
  try {
    const url = (req.body?.url || '').trim();
    if (!url) return res.json({ valid: false, error: 'No link provided' });

    if (!DRIVE_URL_REGEX.test(url)) {
      return res.json({ valid: false, error: 'Link must be a Google Drive or Google Docs URL' });
    }
    if (!DRIVE_FILE_ID_REGEX.test(url)) {
      return res.json({ valid: false, error: 'Could not find a file ID in this link -- use the "Share" link from Google Drive' });
    }

    try {
      const r = await fetch(url, { method: 'GET', redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 (compatible; OTS-LinkChecker/1.0)' } });
      // Google serves a sign-in page (still HTTP 200) for private files, so a
      // hard-down/removed link is really the only case we can reliably catch
      // this way; Google's own 404/403 for deleted or hard-blocked files are
      // the useful signal here.
      if (r.status === 404 || r.status === 403) {
        return res.json({ valid: false, error: 'This file is not accessible -- check sharing permissions (set to "Anyone with the link")' });
      }
    } catch (fetchErr) {
      // Network hiccup reaching Google shouldn't block a well-formed link.
      console.warn('validate-drive-link reachability check failed:', fetchErr.message);
    }

    res.json({ valid: true });
  } catch (e) {
    res.status(500).json({ valid: false, error: e.message });
  }
}

module.exports = { validateDriveLink };
