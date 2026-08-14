// Ported from supabase/functions/edumail-imap-sync/index.ts (Deno -> Node).
// The original hand-rolled the IMAP protocol directly over Deno.TlsConn plus
// its own MIME parser (no imapflow/node-imap dependency) -- ported as
// faithfully as possible onto Node's `tls` module + the same string-based
// MIME parsing logic, rather than swapping in a new npm IMAP library, to
// keep behavior identical. Uses serviceQuery() (service_role bypass, same
// as the original's admin client) -- see db/13.
const tls = require('tls');
const jwt = require('jsonwebtoken');
const { TextDecoder } = require('util');
const { serviceQuery } = require('../db');

const IMAP_HOST = 'mail.onlinetextileschool.com';
const IMAP_PORT = 993;

// ============ IMAP CLIENT ============
let tagCounter = 0;
function nextTag() {
  tagCounter++;
  return `A${String(tagCounter).padStart(4, '0')}`;
}

function readUntilTag(socket, tag) {
  return new Promise((resolve, reject) => {
    let result = '';
    const onData = (chunk) => {
      result += chunk.toString('latin1');
      if (result.includes(`\r\n${tag} OK`) || result.includes(`\r\n${tag} NO`) || result.includes(`\r\n${tag} BAD`)) {
        cleanup();
        resolve(result);
      }
    };
    const onError = (err) => { cleanup(); reject(err); };
    const onClose = () => { cleanup(); resolve(result); };
    function cleanup() {
      socket.removeListener('data', onData);
      socket.removeListener('error', onError);
      socket.removeListener('close', onClose);
    }
    socket.on('data', onData);
    socket.on('error', onError);
    socket.on('close', onClose);
  });
}

function readGreeting(socket) {
  return new Promise((resolve) => {
    socket.once('data', (chunk) => resolve(chunk.toString('latin1')));
  });
}

async function imapCommand(socket, command) {
  const tag = nextTag();
  socket.write(`${tag} ${command}\r\n`, 'latin1');
  return readUntilTag(socket, tag);
}

function imapConnect(email, password) {
  return new Promise((resolve, reject) => {
    const socket = tls.connect({ host: IMAP_HOST, port: IMAP_PORT }, async () => {
      try {
        await readGreeting(socket);
        await imapCommand(socket, `LOGIN "${email}" "${password}"`);
        resolve(socket);
      } catch (err) {
        socket.destroy();
        reject(err);
      }
    });
    socket.once('error', reject);
  });
}

// ============ MIME PARSING ============

function stripImapEnvelope(raw) {
  const literalMatch = raw.match(/\{(\d+)\}\r\n/);
  if (literalMatch) {
    const start = literalMatch.index + literalMatch[0].length;
    const size = parseInt(literalMatch[1], 10);
    return raw.substring(start, start + size);
  }
  let s = raw.replace(/^\* \d+ FETCH \([^\r\n]*\r\n/, '');
  s = s.replace(/\r\n\)\r\nA\d{4} (OK|NO|BAD)[\s\S]*$/, '');
  s = s.replace(/\)\r\nA\d{4} (OK|NO|BAD)[\s\S]*$/, '');
  return s;
}

function splitHeadersBody(rfc822) {
  const idx = rfc822.search(/\r?\n\r?\n/);
  if (idx === -1) return { headersRaw: rfc822, body: '' };
  const sep = rfc822.match(/\r?\n\r?\n/)[0];
  return { headersRaw: rfc822.substring(0, idx), body: rfc822.substring(idx + sep.length) };
}

function parseHeaders(headersRaw) {
  const headers = {};
  const unfolded = headersRaw.replace(/\r?\n[ \t]+/g, ' ');
  for (const line of unfolded.split(/\r?\n/)) {
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    const name = line.substring(0, colon).trim().toLowerCase();
    const value = line.substring(colon + 1).trim();
    headers[name] = value;
  }
  return headers;
}

function parseContentType(value) {
  if (!value) return { type: 'text/plain', params: {} };
  const parts = value.split(';').map((s) => s.trim());
  const type = parts[0].toLowerCase();
  const params = {};
  for (let i = 1; i < parts.length; i++) {
    const eq = parts[i].indexOf('=');
    if (eq === -1) continue;
    const k = parts[i].substring(0, eq).trim().toLowerCase();
    let v = parts[i].substring(eq + 1).trim();
    if (v.startsWith('"') && v.endsWith('"')) v = v.substring(1, v.length - 1);
    params[k] = v;
  }
  return { type, params };
}

function decodeEncodedWords(s) {
  if (!s) return '';
  return s.replace(/=\?([^?]+)\?([QqBb])\?([^?]*)\?=/g, (_, charset, enc, text) => {
    try {
      let bytes;
      if (enc.toUpperCase() === 'B') {
        bytes = Buffer.from(text.replace(/\s+/g, ''), 'base64');
      } else {
        const decoded = text.replace(/_/g, ' ').replace(/=([0-9A-Fa-f]{2})/g, (_m, h) => String.fromCharCode(parseInt(h, 16)));
        bytes = Buffer.from(decoded, 'latin1');
      }
      return new TextDecoder(charset.toLowerCase()).decode(bytes);
    } catch {
      return text;
    }
  }).replace(/\?=\s+=\?/g, '?==?');
}

function decodeQuotedPrintable(s) {
  const cleaned = s.replace(/=\r?\n/g, '');
  const out = [];
  for (let i = 0; i < cleaned.length; i++) {
    if (cleaned[i] === '=' && i + 2 < cleaned.length) {
      const hex = cleaned.substring(i + 1, i + 3);
      if (/^[0-9A-Fa-f]{2}$/.test(hex)) {
        out.push(parseInt(hex, 16));
        i += 2;
        continue;
      }
    }
    out.push(cleaned.charCodeAt(i) & 0xff);
  }
  return new Uint8Array(out);
}

function decodeBase64Bytes(s) {
  try {
    return new Uint8Array(Buffer.from(s.replace(/\s+/g, ''), 'base64'));
  } catch {
    return new Uint8Array(0);
  }
}

function bodyToBytes(bodyStr, encoding) {
  const enc = (encoding || '7bit').toLowerCase();
  if (enc === 'base64') return decodeBase64Bytes(bodyStr);
  if (enc === 'quoted-printable') return decodeQuotedPrintable(bodyStr);
  const out = new Uint8Array(bodyStr.length);
  for (let i = 0; i < bodyStr.length; i++) out[i] = bodyStr.charCodeAt(i) & 0xff;
  return out;
}

function decodeBytes(bytes, charset) {
  try {
    return new TextDecoder(charset.toLowerCase() || 'utf-8').decode(bytes);
  } catch {
    return new TextDecoder('utf-8').decode(bytes);
  }
}

function parsePart(rfc822) {
  const { headersRaw, body } = splitHeadersBody(rfc822);
  const headers = parseHeaders(headersRaw);
  const ct = parseContentType(headers['content-type'] || 'text/plain');
  const cd = parseContentType(headers['content-disposition'] || '');
  const transferEncoding = (headers['content-transfer-encoding'] || '7bit').toLowerCase();
  const charset = ct.params.charset || 'utf-8';
  const filename = cd.params.filename || ct.params.name || '';
  const disposition = cd.type || '';

  const part = { headers, body: new Uint8Array(0), contentType: ct.type, charset, transferEncoding, disposition, filename };

  if (ct.type.startsWith('multipart/') && ct.params.boundary) {
    const boundary = ct.params.boundary;
    const delim = `--${boundary}`;
    const parts = [];
    let rest = body;
    const firstIdx = rest.indexOf(delim);
    if (firstIdx !== -1) rest = rest.substring(firstIdx + delim.length);
    while (true) {
      if (rest.startsWith('--')) break;
      const nlMatch = rest.match(/\r?\n/);
      if (!nlMatch) break;
      rest = rest.substring(rest.search(/\r?\n/) + nlMatch[0].length);
      const nextIdx = rest.indexOf(`\r\n${delim}`);
      const altIdx = rest.indexOf(`\n${delim}`);
      let endIdx = nextIdx;
      let skip = `\r\n${delim}`.length;
      if (endIdx === -1 || (altIdx !== -1 && altIdx < endIdx)) {
        endIdx = altIdx;
        skip = `\n${delim}`.length;
      }
      if (endIdx === -1) break;
      const partRaw = rest.substring(0, endIdx);
      parts.push(parsePart(partRaw));
      rest = rest.substring(endIdx + skip);
      if (rest.startsWith('--')) break;
    }
    part.parts = parts;
  } else {
    part.body = bodyToBytes(body, transferEncoding);
  }
  return part;
}

function collectContent(part, out) {
  if (part.parts && part.parts.length > 0) {
    for (const p of part.parts) collectContent(p, out);
    return;
  }
  if (part.disposition === 'attachment' || (part.filename && !part.contentType.startsWith('text/'))) {
    out.attachments.push({ name: part.filename || 'attachment', size: part.body.length, contentType: part.contentType });
    return;
  }
  if (part.contentType === 'text/html' && !out.html) {
    out.html = decodeBytes(part.body, part.charset);
  } else if (part.contentType === 'text/plain' && !out.text) {
    out.text = decodeBytes(part.body, part.charset);
  } else if (part.contentType.startsWith('text/') && !out.text) {
    out.text = decodeBytes(part.body, part.charset);
  }
}

function extractAddresses(headerValue) {
  if (!headerValue) return [];
  const decoded = decodeEncodedWords(headerValue);
  const emailRegex = /[\w.+-]+@[\w.-]+\.\w+/g;
  return decoded.match(emailRegex) || [];
}

function parseRfc822(rfc822) {
  const root = parsePart(rfc822);
  const fromRaw = root.headers['from'] || '';
  const toRaw = root.headers['to'] || '';
  const ccRaw = root.headers['cc'] || '';
  const subjectRaw = root.headers['subject'] || '';
  const dateRaw = root.headers['date'] || '';

  const collected = { html: '', text: '', attachments: [] };
  collectContent(root, collected);

  return {
    from: extractAddresses(fromRaw)[0] || decodeEncodedWords(fromRaw),
    to: extractAddresses(toRaw),
    cc: extractAddresses(ccRaw),
    subject: decodeEncodedWords(subjectRaw) || '(No Subject)',
    date: dateRaw,
    bodyHtml: collected.html,
    bodyText: collected.text,
    attachments: collected.attachments,
  };
}

// ============ MAIN HANDLER ============

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

async function edumailImapSync(req, res) {
  try {
    const userId = requireUser(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const emailReqRes = await serviceQuery(
      `SELECT * FROM public.institutional_email_requests WHERE user_id = $1 AND status = 'approved' LIMIT 1`,
      [userId]
    );
    const emailReq = emailReqRes.rows[0];
    if (!emailReq || !emailReq.current_password) {
      return res.status(400).json({ error: 'No active institutional email or missing credentials' });
    }

    const resetRequested = !!(req.body && req.body.reset);
    if (resetRequested) {
      await serviceQuery(`DELETE FROM public.edumail_messages WHERE owner_id = $1 AND folder = 'inbox'`, [userId]);
      await serviceQuery(`UPDATE public.institutional_email_requests SET last_synced_uid = 0 WHERE id = $1`, [emailReq.id]);
      emailReq.last_synced_uid = 0;
    }

    const email = emailReq.requested_email;
    const password = emailReq.current_password;
    const lastSyncedUid = emailReq.last_synced_uid || 0;

    let socket = null;
    let newMessages = 0;

    try {
      tagCounter = 0;
      socket = await imapConnect(email, password);
      const selectResp = await imapCommand(socket, 'SELECT INBOX');
      const existsMatch = selectResp.match(/\* (\d+) EXISTS/);
      const totalMessages = existsMatch ? parseInt(existsMatch[1], 10) : 0;

      if (totalMessages === 0) {
        try { await imapCommand(socket, 'LOGOUT'); socket.destroy(); } catch { /* ignore */ }
        return res.json({ success: true, new_messages: 0, total: 0 });
      }

      const searchCmd = lastSyncedUid > 0 ? `UID SEARCH UID ${lastSyncedUid + 1}:*` : 'UID SEARCH ALL';
      const searchResp = await imapCommand(socket, searchCmd);
      const searchLine = searchResp.split('\r\n').find((l) => l.startsWith('* SEARCH'));
      const uids = [];
      if (searchLine) {
        const parts = searchLine.replace('* SEARCH', '').trim().split(/\s+/);
        for (const p of parts) {
          const uid = parseInt(p, 10);
          if (!isNaN(uid) && uid > lastSyncedUid) uids.push(uid);
        }
      }

      const uidsToFetch = uids.slice(-50);
      let maxUid = lastSyncedUid;

      for (const uid of uidsToFetch) {
        try {
          const fetchResp = await imapCommand(socket, `UID FETCH ${uid} (BODY[])`);
          const rfc822 = stripImapEnvelope(fetchResp);
          const parsed = parseRfc822(rfc822);

          if (parsed.from === email) {
            if (uid > maxUid) maxUid = uid;
            continue;
          }

          const existingRes = await serviceQuery(
            `SELECT id FROM public.edumail_messages WHERE owner_id = $1 AND from_email = $2 AND subject = $3 AND folder = 'inbox' LIMIT 1`,
            [userId, parsed.from, parsed.subject]
          );
          if (existingRes.rows.length > 0) {
            if (uid > maxUid) maxUid = uid;
            continue;
          }

          await serviceQuery(
            `INSERT INTO public.edumail_messages
              (owner_id, folder, from_email, to_emails, cc_emails, subject, body_html, body_text, is_read, has_attachments, attachments, sent_at)
             VALUES ($1, 'inbox', $2, $3, $4, $5, $6, $7, false, $8, $9, $10)`,
            [
              userId, parsed.from, parsed.to.length ? parsed.to : [email], parsed.cc, parsed.subject,
              parsed.bodyHtml, parsed.bodyText, parsed.attachments.length > 0, JSON.stringify(parsed.attachments),
              parsed.date ? new Date(parsed.date).toISOString() : new Date().toISOString(),
            ]
          );

          newMessages++;
          if (uid > maxUid) maxUid = uid;
        } catch (fetchErr) {
          console.error(`Error fetching UID ${uid}:`, fetchErr.message);
          if (uid > maxUid) maxUid = uid;
        }
      }

      if (maxUid > lastSyncedUid) {
        await serviceQuery(`UPDATE public.institutional_email_requests SET last_synced_uid = $1 WHERE id = $2`, [maxUid, emailReq.id]);
      }

      try { await imapCommand(socket, 'LOGOUT'); socket.destroy(); } catch { /* ignore */ }
    } catch (imapErr) {
      console.error('IMAP error:', imapErr.message);
      if (socket) { try { socket.destroy(); } catch { /* ignore */ } }
      return res.status(500).json({ error: `IMAP sync failed: ${imapErr.message}`, partial_sync: newMessages > 0, new_messages: newMessages });
    }

    res.json({ success: true, new_messages: newMessages });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { edumailImapSync };
