import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const IMAP_HOST = "mail.onlinetextileschool.com";
const IMAP_PORT = 993;

// Minimal IMAP client using Deno's TLS
async function imapConnect(email: string, password: string): Promise<Deno.TlsConn> {
  const conn = await Deno.connectTls({
    hostname: IMAP_HOST,
    port: IMAP_PORT,
  });
  // Read greeting
  await readResponse(conn);
  // Login
  await imapCommand(conn, `LOGIN "${email}" "${password}"`);
  return conn;
}

async function readResponse(conn: Deno.TlsConn): Promise<string> {
  const buf = new Uint8Array(32768);
  let result = "";
  // Read until we get a complete response
  const n = await conn.read(buf);
  if (n === null) return result;
  result += new TextDecoder().decode(buf.subarray(0, n));
  return result;
}

async function readUntilTag(conn: Deno.TlsConn, tag: string): Promise<string> {
  let result = "";
  const decoder = new TextDecoder();
  const buf = new Uint8Array(65536);
  
  while (true) {
    const n = await conn.read(buf);
    if (n === null) break;
    result += decoder.decode(buf.subarray(0, n));
    if (result.includes(`${tag} OK`) || result.includes(`${tag} NO`) || result.includes(`${tag} BAD`)) {
      break;
    }
  }
  return result;
}

let tagCounter = 0;
function nextTag(): string {
  tagCounter++;
  return `A${String(tagCounter).padStart(4, "0")}`;
}

async function imapCommand(conn: Deno.TlsConn, command: string): Promise<string> {
  const tag = nextTag();
  const cmd = `${tag} ${command}\r\n`;
  await conn.write(new TextEncoder().encode(cmd));
  return await readUntilTag(conn, tag);
}

interface ParsedEmail {
  from: string;
  to: string[];
  cc: string[];
  subject: string;
  date: string;
  bodyHtml: string;
  bodyText: string;
  uid: number;
}

function extractHeader(raw: string, header: string): string {
  const regex = new RegExp(`^${header}:\\s*(.+?)(?=\\r?\\n[^\\s]|\\r?\\n\\r?\\n)`, "ims");
  const match = raw.match(regex);
  return match ? match[1].replace(/\r?\n\s+/g, " ").trim() : "";
}

function extractAddresses(headerValue: string): string[] {
  if (!headerValue) return [];
  const emailRegex = /[\w.+-]+@[\w.-]+\.\w+/g;
  return headerValue.match(emailRegex) || [];
}

function parseEmailFromFetch(raw: string, uid: number): ParsedEmail {
  const from = extractHeader(raw, "From");
  const to = extractHeader(raw, "To");
  const cc = extractHeader(raw, "Cc");
  const subject = extractHeader(raw, "Subject");
  const date = extractHeader(raw, "Date");
  
  // Extract body - simplified; gets text after headers
  const headerBodySplit = raw.split(/\r?\n\r?\n/);
  const bodyParts = headerBodySplit.slice(1).join("\n\n");
  
  // Try to extract HTML content
  let bodyHtml = "";
  let bodyText = bodyParts;
  
  const htmlMatch = bodyParts.match(/<html[\s\S]*<\/html>/i) || bodyParts.match(/<body[\s\S]*<\/body>/i);
  if (htmlMatch) {
    bodyHtml = htmlMatch[0];
  }
  
  // Clean up text version
  bodyText = bodyParts.replace(/<[^>]*>/g, "").substring(0, 5000);

  return {
    from: extractAddresses(from)[0] || from,
    to: extractAddresses(to),
    cc: extractAddresses(cc),
    subject: subject || "(No Subject)",
    date,
    bodyHtml: bodyHtml || `<pre>${bodyText.substring(0, 3000)}</pre>`,
    bodyText,
    uid,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

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

    // Get user's email credentials
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

    const email = emailReq.requested_email;
    const password = emailReq.current_password;

    // Get last synced UID
    const lastSyncedUid = emailReq.last_synced_uid || 0;

    let conn: Deno.TlsConn | null = null;
    let newMessages = 0;

    try {
      tagCounter = 0; // Reset tag counter
      conn = await imapConnect(email, password);

      // Select INBOX
      const selectResp = await imapCommand(conn, "SELECT INBOX");
      
      // Get message count from EXISTS
      const existsMatch = selectResp.match(/\* (\d+) EXISTS/);
      const totalMessages = existsMatch ? parseInt(existsMatch[1]) : 0;

      if (totalMessages === 0) {
        await imapCommand(conn, "LOGOUT");
        conn.close();
        return new Response(JSON.stringify({ success: true, new_messages: 0, total: 0 }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fetch UIDs of messages newer than last synced
      const searchCmd = lastSyncedUid > 0 
        ? `UID SEARCH UID ${lastSyncedUid + 1}:*`
        : `UID SEARCH ALL`;
      
      const searchResp = await imapCommand(conn, searchCmd);
      
      // Parse UIDs from search result
      const searchLine = searchResp.split("\r\n").find(l => l.startsWith("* SEARCH"));
      const uids: number[] = [];
      if (searchLine) {
        const parts = searchLine.replace("* SEARCH", "").trim().split(/\s+/);
        for (const p of parts) {
          const uid = parseInt(p);
          if (!isNaN(uid) && uid > lastSyncedUid) uids.push(uid);
        }
      }

      // Limit to last 50 new messages to avoid timeout
      const uidsToFetch = uids.slice(-50);
      let maxUid = lastSyncedUid;

      for (const uid of uidsToFetch) {
        try {
          const fetchResp = await imapCommand(conn, `UID FETCH ${uid} (BODY[])`);
          const parsed = parseEmailFromFetch(fetchResp, uid);

          // Don't re-import messages we sent ourselves
          if (parsed.from === email) {
            if (uid > maxUid) maxUid = uid;
            continue;
          }

          // Check if already exists (dedup by from_email + subject + sent_at approximate)
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

          // Insert into edumail_messages
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
            has_attachments: false,
            sent_at: parsed.date ? new Date(parsed.date).toISOString() : new Date().toISOString(),
          });

          newMessages++;
          if (uid > maxUid) maxUid = uid;
        } catch (fetchErr) {
          console.error(`Error fetching UID ${uid}:`, fetchErr);
          if (uid > maxUid) maxUid = uid;
        }
      }

      // Update last synced UID
      if (maxUid > lastSyncedUid) {
        await adminClient
          .from("institutional_email_requests")
          .update({ last_synced_uid: maxUid })
          .eq("id", emailReq.id);
      }

      // Logout
      try {
        await imapCommand(conn, "LOGOUT");
        conn.close();
      } catch { /* ignore close errors */ }

    } catch (imapErr: any) {
      console.error("IMAP error:", imapErr);
      if (conn) {
        try { conn.close(); } catch { /* ignore */ }
      }
      return new Response(JSON.stringify({ 
        error: `IMAP sync failed: ${imapErr.message}`,
        partial_sync: newMessages > 0,
        new_messages: newMessages 
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      new_messages: newMessages,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
