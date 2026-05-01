import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { S3Client, GetObjectCommand } from "npm:@aws-sdk/client-s3@3.525.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, range, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Expose-Headers":
    "X-Ebook-Title, Content-Length, Content-Range, Accept-Ranges, Content-Type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "No authorization header" }, 401);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Handle GET requests for PDF.js range loading
    if (req.method === "GET") {
      return handleGetStream(req, user, admin);
    }

    // Handle POST requests (generate_token, legacy stream_file)
    const body = await req.json();
    const { action, ebook_id, token } = body;

    if (action === "generate_token") {
      return handleGenerateToken(ebook_id, user, admin);
    }

    if (action === "stream_file") {
      // Legacy POST-based streaming (kept for backwards compat)
      return handleStreamFile(req, ebook_id, token, user, admin);
    }

    return jsonResponse({ error: "Invalid action" }, 400);
  } catch (err) {
    console.error("ebook-secure-access error:", err);
    return jsonResponse({ error: err instanceof Error ? err.message : "Internal error" }, 500);
  }
});

// ---------- Generate Token ----------

async function handleGenerateToken(
  ebook_id: string | undefined,
  user: { id: string },
  admin: ReturnType<typeof createClient>
) {
  if (!ebook_id) return jsonResponse({ error: "ebook_id required" }, 400);

  const { data: purchase } = await admin
    .from("order_items")
    .select("id, orders!inner(user_id, status)")
    .eq("item_type", "ebook")
    .eq("item_id", ebook_id)
    .eq("orders.user_id", user.id)
    .eq("orders.status", "completed")
    .limit(1)
    .maybeSingle();

  if (!purchase) {
    return jsonResponse({ error: "You have not purchased this ebook" }, 403);
  }

  // Get ebook metadata for format info
  const { data: ebook } = await admin
    .from("ebooks")
    .select("title, file_format, file_url")
    .eq("id", ebook_id)
    .single();

  const tokenValue = crypto.randomUUID();
  // Reusable token: valid for 30 minutes, NOT single-use
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

  const { error: insertErr } = await admin
    .from("ebook_access_tokens")
    .insert({ ebook_id, user_id: user.id, token: tokenValue, expires_at: expiresAt, used: false });

  if (insertErr) {
    return jsonResponse({ error: "Failed to generate token" }, 500);
  }

  await admin.rpc("increment_ebook_download", { _ebook_id: ebook_id });

  // Detect format from file_url if file_format is not set
  let fileFormat = ebook?.file_format || 'pdf';
  if (!ebook?.file_format && ebook?.file_url) {
    const ext = ebook.file_url.split('.').pop()?.toLowerCase()?.split('?')[0] || '';
    if (['pdf', 'epub', 'doc', 'docx'].includes(ext)) fileFormat = ext;
  }

  return jsonResponse({
    token: tokenValue,
    expires_at: expiresAt,
    title: ebook?.title || 'eBook',
    file_format: fileFormat,
  });
}

// ---------- GET-based Streaming for PDF.js ----------

async function handleGetStream(
  req: Request,
  user: { id: string },
  admin: ReturnType<typeof createClient>
) {
  const url = new URL(req.url);
  const action = url.searchParams.get("action");
  if (action !== "stream") {
    return jsonResponse({ error: "Invalid GET action" }, 400);
  }

  const ebook_id = url.searchParams.get("ebook_id");
  const token = url.searchParams.get("token");

  if (!ebook_id || !token) {
    return jsonResponse({ error: "ebook_id and token required" }, 400);
  }

  // Validate token — reusable until expiry (NOT marking as used)
  const { data: tokenRow } = await admin
    .from("ebook_access_tokens")
    .select("*")
    .eq("ebook_id", ebook_id)
    .eq("user_id", user.id)
    .eq("token", token)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (!tokenRow) {
    return jsonResponse({ error: "Invalid or expired token" }, 403);
  }

  return streamEbookFile(req, ebook_id, admin);
}

// ---------- Legacy POST streaming ----------

async function handleStreamFile(
  req: Request,
  ebook_id: string | undefined,
  token: string | undefined,
  user: { id: string },
  admin: ReturnType<typeof createClient>
) {
  if (!ebook_id || !token) {
    return jsonResponse({ error: "ebook_id and token required" }, 400);
  }

  const { data: tokenRow } = await admin
    .from("ebook_access_tokens")
    .select("*")
    .eq("ebook_id", ebook_id)
    .eq("user_id", user.id)
    .eq("token", token)
    .eq("used", false)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (!tokenRow) {
    return jsonResponse({ error: "Invalid or expired token" }, 403);
  }

  await admin.from("ebook_access_tokens").update({ used: true }).eq("id", tokenRow.id);

  return streamEbookFile(req, ebook_id, admin);
}

// ---------- Shared file streaming logic ----------

async function streamEbookFile(
  req: Request,
  ebook_id: string,
  admin: ReturnType<typeof createClient>
) {
  const { data: ebook } = await admin
    .from("ebooks")
    .select("file_url, title")
    .eq("id", ebook_id)
    .single();

  if (!ebook?.file_url || ebook.file_url.trim().length === 0) {
    return jsonResponse({
      error: "EBOOK_FILE_MISSING",
      message: "This eBook is not ready yet — the publisher has not uploaded the PDF file. Please contact support and we'll fix it for you.",
    }, 422);
  }

  const fileUrl = ebook.file_url;
  const urlDomain = safeHostname(fileUrl);
  const isR2 = isR2Url(fileUrl);
  const isCloudinary = fileUrl.includes("cloudinary.com") || fileUrl.includes("res.cloudinary");
  const rangeHeader = req.headers.get("Range") || "";

  console.log(`[ebook-secure-access] stream: ${fileUrl} | R2:${isR2} | range:${rangeHeader || 'none'}`);

  if (isCloudinary) {
    console.warn("[ebook-secure-access] WARNING: Legacy Cloudinary URL — should be re-uploaded to R2");
  }

  // Try public URL fetch first (with range header forwarding)
  let fileResponse: Response | null = null;
  let fetchError: string | null = null;

  try {
    const fetchHeaders: Record<string, string> = {};
    if (rangeHeader) fetchHeaders["Range"] = rangeHeader;

    fileResponse = await fetch(fileUrl, { headers: fetchHeaders });
    if (!fileResponse.ok && fileResponse.status !== 206) {
      fetchError = `Public fetch failed: HTTP ${fileResponse.status}`;
      console.warn(`[ebook-secure-access] ${fetchError}`);
      fileResponse = null;
    }
  } catch (e) {
    fetchError = `Public fetch error: ${e instanceof Error ? e.message : String(e)}`;
    console.warn(`[ebook-secure-access] ${fetchError}`);
    fileResponse = null;
  }

  // S3 direct fallback for R2 URLs
  if (!fileResponse && isR2) {
    console.log("[ebook-secure-access] S3 fallback...");
    try {
      fileResponse = await fetchFromR2Direct(admin, fileUrl, rangeHeader);
      console.log("[ebook-secure-access] S3 fallback succeeded");
    } catch (e) {
      const s3Error = e instanceof Error ? e.message : String(e);
      console.error(`[ebook-secure-access] S3 fallback failed: ${s3Error}`);
      return jsonResponse({
        error: "Failed to fetch ebook file from R2",
        details: `Public: ${fetchError}. S3: ${s3Error}`,
        storage: "r2",
      }, 502);
    }
  }

  if (!fileResponse) {
    const storage = isCloudinary ? "cloudinary_legacy" : "unknown";
    return jsonResponse({
      error: "Failed to fetch ebook file",
      details: fetchError || "Unknown error",
      storage,
      hint: isCloudinary
        ? "This ebook uses a legacy Cloudinary URL. Please re-upload to Cloudflare R2."
        : "File could not be fetched. Check storage configuration.",
    }, 502);
  }

  const fileBody = fileResponse.body;
  const contentType = fileResponse.headers.get("Content-Type") || "application/pdf";
  const contentLength = fileResponse.headers.get("Content-Length");
  const contentRange = fileResponse.headers.get("Content-Range");
  const acceptRanges = fileResponse.headers.get("Accept-Ranges");

  const responseHeaders: Record<string, string> = {
    ...corsHeaders,
    "Content-Type": contentType,
    "X-Ebook-Title": encodeURIComponent(ebook.title || "eBook"),
    "Cache-Control": "no-store, no-cache, must-revalidate",
    "X-Content-Type-Options": "nosniff",
    "Content-Disposition": "inline",
  };

  // Forward range-related headers for PDF.js incremental loading
  if (contentLength) responseHeaders["Content-Length"] = contentLength;
  if (contentRange) responseHeaders["Content-Range"] = contentRange;
  if (acceptRanges) responseHeaders["Accept-Ranges"] = acceptRanges;
  else responseHeaders["Accept-Ranges"] = "bytes";

  return new Response(fileBody, {
    status: fileResponse.status === 206 ? 206 : 200,
    headers: responseHeaders,
  });
}

// ---------- Helpers ----------

function jsonResponse(data: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isR2Url(url: string): boolean {
  try {
    const hostname = new URL(url).hostname;
    return hostname.includes("r2.cloudflarestorage.com") ||
           hostname.includes("r2.dev") ||
           hostname.includes("pub-");
  } catch {
    return false;
  }
}

function safeHostname(url: string): string {
  try { return new URL(url).hostname; } catch { return "unknown"; }
}

async function fetchFromR2Direct(
  admin: ReturnType<typeof createClient>,
  fileUrl: string,
  rangeHeader?: string
): Promise<Response> {
  const { data: accounts, error: accErr } = await admin
    .from("cloudflare_r2_accounts")
    .select("*")
    .eq("status", "active");

  if (accErr || !accounts?.length) throw new Error("No active R2 accounts found");

  const urlObj = new URL(fileUrl);
  const urlPath = urlObj.pathname.replace(/^\//, "");

  let matchedAccount = accounts.find((a: any) => {
    try { return urlObj.hostname === new URL(a.public_domain_url).hostname; } catch { return false; }
  });

  if (!matchedAccount) {
    console.warn("[ebook-secure-access] No R2 account matched by domain, using first active");
    matchedAccount = accounts[0];
  }

  const s3 = new S3Client({
    region: "auto",
    endpoint: matchedAccount.endpoint_url,
    credentials: { accessKeyId: matchedAccount.access_key_id, secretAccessKey: matchedAccount.secret_access_key },
  });

  const commandInput: any = { Bucket: matchedAccount.bucket_name, Key: urlPath };
  if (rangeHeader) commandInput.Range = rangeHeader;

  const s3Response = await s3.send(new GetObjectCommand(commandInput));
  if (!s3Response.Body) throw new Error("S3 returned empty body");

  const stream = s3Response.Body as ReadableStream;
  const contentType = s3Response.ContentType || "application/pdf";
  const contentLength = s3Response.ContentLength?.toString();
  const contentRange = s3Response.ContentRange;

  const headers: Record<string, string> = {
    "Content-Type": contentType,
    "Accept-Ranges": "bytes",
  };
  if (contentLength) headers["Content-Length"] = contentLength;
  if (contentRange) headers["Content-Range"] = contentRange;

  const status = contentRange ? 206 : 200;
  return new Response(stream, { status, headers });
}
