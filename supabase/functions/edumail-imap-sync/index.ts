import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const IMAP_HOST = "mail.onlinetextileschool.com";
const IMAP_PORT = 993;

// ============ IMAP CLIENT ============
let tagCounter = 0;
function nextTag(): string {
  tagCounter++;
  return `A${String(tagCounter).padStart(4, "0")}`;
}

async function readUntilTag(conn: Deno.TlsConn, tag: string): Promise<string> {
  let result = "";
  const decoder = new TextDecoder("latin1"); // preserve bytes
  const buf = new Uint8Array(65536);
  while (true) {
    const n = await conn.read(buf);
    if (n === null) break;
    result += decoder.decode(buf.subarray(0, n));
    // Check last meaningful lines for completion
    if (
      result.includes(`\r\n${tag} OK`) ||
      result.includes(`\r\n${tag} NO`) ||
      result.includes(`\r\n${tag} BAD`)
    ) break;
  }
  return result;
}

async function imapConnect(email: string, password: string): Promise<Deno.TlsConn> {
  const conn = await Deno.connectTls({ hostname: IMAP_HOST, port: IMAP_PORT });
  // greeting
  const buf = new Uint8Array(4096);
  await conn.read(buf);
  await imapCommand(conn, `LOGIN "${email}" "${password}"`);
  return conn;
}

async function imapCommand(conn: Deno.TlsConn, command: string): Promise<string> {
  const tag = nextTag();
  await conn.write(new TextEncoder().encode(`${tag} ${command}\r\n`));
  return await readUntilTag(conn, tag);
}

// ============ MIME PARSING ============

interface ParsedPart {
  headers: Record<string, string>;
  body: Uint8Array;
  contentType: string;
  charset: string;
  transferEncoding: string;
  disposition: string;
  filename: string;
  parts?: ParsedPart[]; // multipart children
}

interface ParsedEmail {
  from: string;
  to: string[];
  cc: string[];
  subject: string;
  date: string;
  bodyHtml: string;
  bodyText: string;
  attachments: Array<{ name: string; size: number; contentType: string }>;
}

// Strip IMAP fetch envelope: "* N FETCH (BODY[] {SIZE}\r\n<RFC822>)\r\nTAG OK ..."
function stripImapEnvelope(raw: string): string {
  // Find the literal start: "{NNN}\r\n"
  const literalMatch = raw.match(/\{(\d+)\}\r\n/);
  if (literalMatch) {
    const start = literalMatch.index! + literalMatch[0].length;
    const size = parseInt(literalMatch[1]);
    return raw.substring(start, start + size);
  }
  // Fallback: strip leading "* N FETCH (...\r\n" and trailing ")\r\nA#### OK ..."
  let s = raw.replace(/^\* \d+ FETCH \([^\r\n]*\r\n/, "");
  s = s.replace(/\r\n\)\r\nA\d{4} (OK|NO|BAD)[\s\S]*$/, "");
  s = s.replace(/\)\r\nA\d{4} (OK|NO|BAD)[\s\S]*$/, "");
  return s;
}

function splitHeadersBody(rfc822: string): { headersRaw: string; body: string } {
  const idx = rfc822.search(/\r?\n\r?\n/);
  if (idx === -1) return { headersRaw: rfc822, body: "" };
  const sep = rfc822.match(/\r?\n\r?\n/)![0];
  return {
    headersRaw: rfc822.substring(0, idx),
    body: rfc822.substring(idx + sep.length),
  };
}

function parseHeaders(headersRaw: string): Record<string, string> {
  const headers: Record<string, string> = {};
  // Unfold: lines starting with whitespace continue previous
  const unfolded = headersRaw.replace(/\r?\n[ \t]+/g, " ");
  for (const line of unfolded.split(/\r?\n/)) {
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    const name = line.substring(0, colon).trim().toLowerCase();
    const value = line.substring(colon + 1).trim();
    headers[name] = value;
  }
  return headers;
}

function parseContentType(value: string): { type: string; params: Record<string, string> } {
  if (!value) return { type: "text/plain", params: {} };
  const parts = value.split(";").map((s) => s.trim());
  const type = parts[0].toLowerCase();
  const params: Record<string, string> = {};
  for (let i = 1; i < parts.length; i++) {
    const eq = parts[i].indexOf("=");
    if (eq === -1) continue;
    const k = parts[i].substring(0, eq).trim().toLowerCase();
    let v = parts[i].substring(eq + 1).trim();
    if (v.startsWith('"') && v.endsWith('"')) v = v.substring(1, v.length - 1);
    params[k] = v;
  }
  return { type, params };
}

// Decode RFC 2047 encoded-word: =?charset?Q?...?= or =?charset?B?...?=
function decodeEncodedWords(s: string): string {
  if (!s) return "";
  return s.replace(/=\?([^?]+)\?([QqBb])\?([^?]*)\?=/g, (_, charset, enc, text) => {
    try {
      let bytes: Uint8Array;
      if (enc.toUpperCase() === "B") {
        const bin = atob(text.replace(/\s+/g, ""));
        bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      } else {
        // Q-encoding: _ = space, =XX = hex
        const decoded = text.replace(/_/g, " ").replace(/=([0-9A-Fa-f]{2})/g, (_m: string, h: string) =>
          String.fromCharCode(parseInt(h, 16))
        );
        bytes = new Uint8Array(decoded.length);
        for (let i = 0; i < decoded.length; i++) bytes[i] = decoded.charCodeAt(i);
      }
      return new TextDecoder(charset.toLowerCase()).decode(bytes);
    } catch {
      return text;
    }
  }).replace(/\?=\s+=\?/g, "?==?"); // join adjacent encoded words
}

function decodeQuotedPrintable(s: string): Uint8Array {
  // Remove soft line breaks
  const cleaned = s.replace(/=\r?\n/g, "");
  const out: number[] = [];
  for (let i = 0; i < cleaned.length; i++) {
    if (cleaned[i] === "=" && i + 2 < cleaned.length) {
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

function decodeBase64Bytes(s: string): Uint8Array {
  try {
    const bin = atob(s.replace(/\s+/g, ""));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return new Uint8Array(0);
  }
}

function bodyToBytes(bodyStr: string, encoding: string): Uint8Array {
  const enc = (encoding || "7bit").toLowerCase();
  if (enc === "base64") return decodeBase64Bytes(bodyStr);
  if (enc === "quoted-printable") return decodeQuotedPrintable(bodyStr);
  // 7bit / 8bit / binary: latin1 round-trip
  const out = new Uint8Array(bodyStr.length);
  for (let i = 0; i < bodyStr.length; i++) out[i] = bodyStr.charCodeAt(i) & 0xff;
  return out;
}

function decodeBytes(bytes: Uint8Array, charset: string): string {
  try {
    return new TextDecoder(charset.toLowerCase() || "utf-8").decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}

function parsePart(rfc822: string): ParsedPart {
  const { headersRaw, body } = splitHeadersBody(rfc822);
  const headers = parseHeaders(headersRaw);
  const ct = parseContentType(headers["content-type"] || "text/plain");
  const cd = parseContentType(headers["content-disposition"] || "");
  const transferEncoding = (headers["content-transfer-encoding"] || "7bit").toLowerCase();
  const charset = ct.params.charset || "utf-8";
  const filename = cd.params.filename || ct.params.name || "";
  const disposition = cd.type || "";

  const part: ParsedPart = {
    headers,
    body: new Uint8Array(0),
    contentType: ct.type,
    charset,
    transferEncoding,
    disposition,
    filename,
  };

  if (ct.type.startsWith("multipart/") && ct.params.boundary) {
    const boundary = ct.params.boundary;
    const delim = `--${boundary}`;
    const closeDelim = `--${boundary}--`;
    // Split body on boundary
    const parts: ParsedPart[] = [];
    let rest = body;
    // Skip preamble
    const firstIdx = rest.indexOf(delim);
    if (firstIdx !== -1) rest = rest.substring(firstIdx + delim.length);
    while (true) {
      // Each part starts with \r\n then content until next --boundary
      if (rest.startsWith("--")) break; // close delim found
      const nl = rest.search(/\r?\n/);
      if (nl === -1) break;
      rest = rest.substring(rest.match(/\r?\n/)![0].length);
      // Find next boundary
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
      if (rest.startsWith("--")) break;
    }
    part.parts = parts;
  } else {
    part.body = bodyToBytes(body, transferEncoding);
  }
  return part;
}

// Walk parts, collect text/html, text/plain, and attachments
function collectContent(part: ParsedPart, out: {
  html: string;
  text: string;
  attachments: Array<{ name: string; size: number; contentType: string }>;
}) {
  if (part.parts && part.parts.length > 0) {
    // For multipart/alternative, prefer html over text — but walk all
    for (const p of part.parts) collectContent(p, out);
    return;
  }
  if (part.disposition === "attachment" || (part.filename && !part.contentType.startsWith("text/"))) {
    out.attachments.push({
      name: part.filename || "attachment",
      size: part.body.length,
      contentType: part.contentType,
    });
    return;
  }
  if (part.contentType === "text/html" && !out.html) {
    out.html = decodeBytes(part.body, part.charset);
  } else if (part.contentType === "text/plain" && !out.text) {
    out.text = decodeBytes(part.body, part.charset);
  } else if (part.contentType.startsWith("text/") && !out.text) {
    out.text = decodeBytes(part.body, part.charset);
  }
}

function extractAddresses(headerValue: string): string[] {
  if (!headerValue) return [];
  const decoded = decodeEncodedWords(headerValue);
  const emailRegex = /[\w.+-]+@[\w.-]+\.\w+/g;
  return decoded.match(emailRegex) || [];
}

function parseRfc822(rfc822: string): ParsedEmail {
  const root = parsePart(rfc822);
  const fromRaw = root.headers["from"] || "";
  const toRaw = root.headers["to"] || "";
  const ccRaw = root.headers["cc"] || "";
  const subjectRaw = root.headers["subject"] || "";
  const dateRaw = root.headers["date"] || "";

  const collected = { html: "", text: "", attachments: [] as Array<{ name: string; size: number; contentType: string }> };
  collectContent(root, collected);

  return {
    from: extractAddresses(fromRaw)[0] || decodeEncodedWords(fromRaw),
    to: extractAddresses(toRaw),
    cc: extractAddresses(ccRaw),
    subject: decodeEncodedWords(subjectRaw) || "(No Subject)",
    date: dateRaw,
    bodyHtml: collected.html,
    bodyText: collected.text,
    attachments: collected.attachments,
  };
}

// ============ MAIN HANDLER ============

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const adminClient = createClient(supabaseUrl, serviceKey);

    const { data: emailReq } = await adminClient
      .from("institutional_email_requests")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "approved")
      .limit(1)
      .single();

    if (!emailReq || !emailReq.current_password) {
      return new Response(JSON.stringify({ error: "No active institutional email or missing credentials" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Optional reset: client can send {reset:true} to wipe inbox + re-sync
    let resetRequested = false;
    try {
      if (req.body) {
        const body = await req.json().catch(() => ({}));
        resetRequested = !!body?.reset;
      }
    } catch { /* no body */ }

    if (resetRequested) {
      await adminClient.from("edumail_messages").delete()
        .eq("owner_id", user.id).eq("folder", "inbox");
      await adminClient.from("institutional_email_requests")
        .update({ last_synced_uid: 0 }).eq("id", emailReq.id);
      emailReq.last_synced_uid = 0;
    }

    const email = emailReq.requested_email;
    const password = emailReq.current_password;
    const lastSyncedUid = emailReq.last_synced_uid || 0;

    let conn: Deno.TlsConn | null = null;
    let newMessages = 0;

    try {
      tagCounter = 0;
      conn = await imapConnect(email, password);
      const selectResp = await imapCommand(conn, "SELECT INBOX");
      const existsMatch = selectResp.match(/\* (\d+) EXISTS/);
      const totalMessages = existsMatch ? parseInt(existsMatch[1]) : 0;

      if (totalMessages === 0) {
        try { await imapCommand(conn, "LOGOUT"); conn.close(); } catch { /* ignore */ }
        return new Response(JSON.stringify({ success: true, new_messages: 0, total: 0 }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const searchCmd = lastSyncedUid > 0
        ? `UID SEARCH UID ${lastSyncedUid + 1}:*`
        : `UID SEARCH ALL`;
      const searchResp = await imapCommand(conn, searchCmd);
      const searchLine = searchResp.split("\r\n").find((l) => l.startsWith("* SEARCH"));
      const uids: number[] = [];
      if (searchLine) {
        const parts = searchLine.replace("* SEARCH", "").trim().split(/\s+/);
        for (const p of parts) {
          const uid = parseInt(p);
          if (!isNaN(uid) && uid > lastSyncedUid) uids.push(uid);
        }
      }

      const uidsToFetch = uids.slice(-50);
      let maxUid = lastSyncedUid;

      for (const uid of uidsToFetch) {
        try {
          const fetchResp = await imapCommand(conn, `UID FETCH ${uid} (BODY[])`);
          const rfc822 = stripImapEnvelope(fetchResp);
          const parsed = parseRfc822(rfc822);

          if (parsed.from === email) {
            if (uid > maxUid) maxUid = uid;
            continue;
          }

          const { data: existing } = await adminClient
            .from("edumail_messages")
            .select("id")
            .eq("owner_id", user.id)
            .eq("from_email", parsed.from)
            .eq("subject", parsed.subject)
            .eq("folder", "inbox")
            .limit(1);

          if (existing && existing.length > 0) {
            if (uid > maxUid) maxUid = uid;
            continue;
          }

          await adminClient.from("edumail_messages").insert({
            owner_id: user.id,
            folder: "inbox",
            from_email: parsed.from,
            to_emails: parsed.to.length ? parsed.to : [email],
            cc_emails: parsed.cc,
            subject: parsed.subject,
            body_html: parsed.bodyHtml,
            body_text: parsed.bodyText,
            is_read: false,
            has_attachments: parsed.attachments.length > 0,
            attachments: parsed.attachments,
            sent_at: parsed.date ? new Date(parsed.date).toISOString() : new Date().toISOString(),
          });

          newMessages++;
          if (uid > maxUid) maxUid = uid;
        } catch (fetchErr) {
          console.error(`Error fetching UID ${uid}:`, fetchErr);
          if (uid > maxUid) maxUid = uid;
        }
      }

      if (maxUid > lastSyncedUid) {
        await adminClient
          .from("institutional_email_requests")
          .update({ last_synced_uid: maxUid })
          .eq("id", emailReq.id);
      }

      try { await imapCommand(conn, "LOGOUT"); conn.close(); } catch { /* ignore */ }

    } catch (imapErr: any) {
      console.error("IMAP error:", imapErr);
      if (conn) { try { conn.close(); } catch { /* ignore */ } }
      return new Response(JSON.stringify({
        error: `IMAP sync failed: ${imapErr.message}`,
        partial_sync: newMessages > 0,
        new_messages: newMessages,
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, new_messages: newMessages }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
