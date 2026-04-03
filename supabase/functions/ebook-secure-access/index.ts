import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { S3Client, GetObjectCommand } from "npm:@aws-sdk/client-s3@3.525.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "No authorization header" }, 401);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();
    if (userError || !user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const body = await req.json();
    const { action, ebook_id, token } = body;

    const admin = createClient(supabaseUrl, serviceKey);

    if (action === "generate_token") {
      if (!ebook_id) return jsonResponse({ error: "ebook_id required" }, 400);

      // Verify purchase
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

      // Generate short-lived token
      const tokenValue = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      const { error: insertErr } = await admin
        .from("ebook_access_tokens")
        .insert({
          ebook_id,
          user_id: user.id,
          token: tokenValue,
          expires_at: expiresAt,
          used: false,
        });

      if (insertErr) {
        return jsonResponse({ error: "Failed to generate token" }, 500);
      }

      // Increment download count
      await admin.rpc("increment_ebook_download", { _ebook_id: ebook_id });

      return jsonResponse({ token: tokenValue, expires_at: expiresAt });
    }

    if (action === "stream_file") {
      if (!ebook_id || !token) {
        return jsonResponse({ error: "ebook_id and token required" }, 400);
      }

      // Validate token
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

      // Mark token as used
      await admin
        .from("ebook_access_tokens")
        .update({ used: true })
        .eq("id", tokenRow.id);

      // Get ebook file URL
      const { data: ebook } = await admin
        .from("ebooks")
        .select("file_url, title")
        .eq("id", ebook_id)
        .single();

      if (!ebook?.file_url) {
        return jsonResponse({ error: "Ebook file not found" }, 404);
      }

      console.log(`[ebook-secure-access] Fetching file_url: ${ebook.file_url}`);

      // Try public URL fetch first
      let fileResponse: Response | null = null;
      let fetchError: string | null = null;

      try {
        fileResponse = await fetch(ebook.file_url, {
          headers: {
            Range: req.headers.get("Range") || "",
          },
        });
        if (!fileResponse.ok && fileResponse.status !== 206) {
          fetchError = `Public fetch failed: status ${fileResponse.status}`;
          console.warn(`[ebook-secure-access] ${fetchError} for URL: ${ebook.file_url}`);
          fileResponse = null;
        }
      } catch (e) {
        fetchError = `Public fetch error: ${e instanceof Error ? e.message : String(e)}`;
        console.warn(`[ebook-secure-access] ${fetchError}`);
        fileResponse = null;
      }

      // If public fetch failed and URL looks like R2, try S3 direct fetch
      if (!fileResponse && isR2Url(ebook.file_url)) {
        console.log("[ebook-secure-access] Attempting S3 direct fetch fallback...");
        try {
          fileResponse = await fetchFromR2Direct(admin, ebook.file_url);
        } catch (e) {
          const s3Error = e instanceof Error ? e.message : String(e);
          console.error(`[ebook-secure-access] S3 fallback failed: ${s3Error}`);
          return jsonResponse({
            error: "Failed to fetch ebook file",
            details: `Public: ${fetchError}. S3 fallback: ${s3Error}`,
            url_domain: new URL(ebook.file_url).hostname,
          }, 502);
        }
      }

      if (!fileResponse) {
        return jsonResponse({
          error: "Failed to fetch ebook file",
          details: fetchError || "Unknown error",
          url_domain: safeHostname(ebook.file_url),
        }, 502);
      }

      const fileBody = fileResponse.body;
      const contentType =
        fileResponse.headers.get("Content-Type") || "application/pdf";
      const contentLength = fileResponse.headers.get("Content-Length");

      const responseHeaders: Record<string, string> = {
        ...corsHeaders,
        "Content-Type": contentType,
        "X-Ebook-Title": encodeURIComponent(ebook.title || "eBook"),
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": "inline",
        "Access-Control-Expose-Headers": "X-Ebook-Title, Content-Length",
      };

      if (contentLength) {
        responseHeaders["Content-Length"] = contentLength;
      }

      return new Response(fileBody, {
        status: fileResponse.status === 206 ? 206 : 200,
        headers: responseHeaders,
      });
    }

    return jsonResponse({ error: "Invalid action" }, 400);
  } catch (err) {
    console.error("ebook-secure-access error:", err);
    return jsonResponse(
      { error: err instanceof Error ? err.message : "Internal error" },
      500
    );
  }
});

// ---------- Helpers ----------

function jsonResponse(data: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function isR2Url(url: string): boolean {
  try {
    const hostname = new URL(url).hostname;
    return hostname.includes("r2.cloudflarestorage.com") ||
           hostname.includes("r2.dev") ||
           hostname.includes("pub-"); // common R2 public domain prefix
  } catch {
    return false;
  }
}

function safeHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "unknown";
  }
}

/**
 * Fallback: fetch file directly from R2 via S3 SDK using stored credentials.
 * Extracts the file key from the public URL and finds the matching R2 account.
 */
async function fetchFromR2Direct(
  admin: ReturnType<typeof createClient>,
  fileUrl: string
): Promise<Response> {
  // Get all active R2 accounts
  const { data: accounts, error: accErr } = await admin
    .from("cloudflare_r2_accounts")
    .select("*")
    .eq("status", "active");

  if (accErr || !accounts?.length) {
    throw new Error("No active R2 accounts found");
  }

  const urlObj = new URL(fileUrl);
  const urlPath = urlObj.pathname.replace(/^\//, ""); // remove leading slash

  // Try to match account by public domain
  let matchedAccount = accounts.find((a: any) => {
    try {
      const pubDomain = new URL(a.public_domain_url).hostname;
      return urlObj.hostname === pubDomain;
    } catch {
      return false;
    }
  });

  // If no match by domain, use the first active account
  if (!matchedAccount) {
    console.warn("[ebook-secure-access] No R2 account matched by domain, using first active");
    matchedAccount = accounts[0];
  }

  const s3 = new S3Client({
    region: "auto",
    endpoint: matchedAccount.endpoint_url,
    credentials: {
      accessKeyId: matchedAccount.access_key_id,
      secretAccessKey: matchedAccount.secret_access_key,
    },
  });

  const command = new GetObjectCommand({
    Bucket: matchedAccount.bucket_name,
    Key: urlPath,
  });

  const s3Response = await s3.send(command);

  if (!s3Response.Body) {
    throw new Error("S3 returned empty body");
  }

  // Convert S3 readable stream to web ReadableStream
  const stream = s3Response.Body as ReadableStream;
  const contentType = s3Response.ContentType || "application/pdf";
  const contentLength = s3Response.ContentLength?.toString();

  const headers: Record<string, string> = {
    "Content-Type": contentType,
  };
  if (contentLength) {
    headers["Content-Length"] = contentLength;
  }

  return new Response(stream, { status: 200, headers });
}
