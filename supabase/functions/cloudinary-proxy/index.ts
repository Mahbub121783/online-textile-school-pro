import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sha1Hex(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-1", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Verify JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return jsonResponse({ error: "Invalid token" }, 401);
    }

    const body = await req.json();
    const { action } = body;

    if (action === "test") {
      return await handleTest(supabase, body);
    }

    if (action === "upload") {
      return await handleUpload(supabase, body);
    }

    if (action === "fetch-url") {
      return await handleFetchUrl(supabase, body);
    }

    return jsonResponse({ error: "Invalid action" }, 400);
  } catch (err: any) {
    console.error("cloudinary-proxy error:", err);
    return jsonResponse({ error: err.message || "Internal error" }, 500);
  }
});

async function getAccount(supabase: any, category: string) {
  // Try category match first
  const { data: catAccounts } = await supabase
    .from("cloudinary_accounts")
    .select("*")
    .eq("status", "active")
    .eq("file_category", category)
    .order("is_primary", { ascending: false })
    .limit(1);

  if (catAccounts && catAccounts.length > 0) return catAccounts[0];

  // Fallback to primary
  const { data: primaryAccounts } = await supabase
    .from("cloudinary_accounts")
    .select("*")
    .eq("status", "active")
    .eq("is_primary", true)
    .limit(1);

  if (primaryAccounts && primaryAccounts.length > 0) return primaryAccounts[0];

  // Fallback to any active
  const { data: anyAccounts } = await supabase
    .from("cloudinary_accounts")
    .select("*")
    .eq("status", "active")
    .limit(1);

  return anyAccounts?.[0] || null;
}

async function handleTest(supabase: any, body: any) {
  const { account_id } = body;
  if (!account_id) return jsonResponse({ error: "account_id required" }, 400);

  const { data: account, error } = await supabase
    .from("cloudinary_accounts")
    .select("*")
    .eq("id", account_id)
    .single();

  if (error || !account) return jsonResponse({ error: "Account not found", success: false }, 404);

  try {
    // Ping Cloudinary API to verify credentials
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = await sha1Hex(`timestamp=${timestamp}${account.api_secret}`);

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${account.cloud_name}/image/upload`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          // Use a tiny 1x1 transparent pixel to test
          file: "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
          api_key: account.api_key,
          timestamp,
          signature,
          folder: "_test",
        }),
      }
    );

    const result = await res.json();

    if (result.error) {
      await supabase
        .from("cloudinary_accounts")
        .update({ status: "error", updated_at: new Date().toISOString() })
        .eq("id", account_id);
      return jsonResponse({ success: false, error: result.error.message });
    }

    await supabase
      .from("cloudinary_accounts")
      .update({ status: "active", updated_at: new Date().toISOString() })
      .eq("id", account_id);

    return jsonResponse({ success: true, message: "Connection verified" });
  } catch (err: any) {
    console.error("Cloudinary test error:", err);
    await supabase
      .from("cloudinary_accounts")
      .update({ status: "error", updated_at: new Date().toISOString() })
      .eq("id", account_id);
    return jsonResponse({ success: false, error: err.message || "Connection failed" });
  }
}

async function handleUpload(supabase: any, body: any) {
  const { file_base64, file_name, file_type } = body;
  if (!file_base64) return jsonResponse({ error: "file_base64 required" }, 400);

  // Determine category from file type
  let category = "images";
  if (file_type?.startsWith("video/")) category = "video";
  else if (file_type === "application/pdf" || file_type?.includes("document")) category = "documents";

  const account = await getAccount(supabase, category);
  if (!account) return jsonResponse({ error: "No active Cloudinary accounts configured" }, 400);

  try {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const folder = "uploads";
    const paramsToSign = `folder=${folder}&timestamp=${timestamp}${account.api_secret}`;
    const signature = await sha1Hex(paramsToSign);

    // Build data URI
    const mimeType = file_type || "application/octet-stream";
    const dataUri = `data:${mimeType};base64,${file_base64}`;

    const formData = new URLSearchParams({
      file: dataUri,
      api_key: account.api_key,
      timestamp,
      signature,
      folder,
    });

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${account.cloud_name}/auto/upload`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData,
      }
    );

    const result = await res.json();

    if (result.error) {
      console.error("Cloudinary upload error:", result.error);
      return jsonResponse({ error: result.error.message || "Upload failed" }, 500);
    }

    // Build fallback URL (direct Cloudinary URL)
    const fallbackUrl = result.secure_url;

    return jsonResponse({
      url: result.secure_url,
      publicId: result.public_id,
      source: "cloudinary",
      fallbackUrl,
      accountId: account.id,
    });
  } catch (err: any) {
    console.error("Cloudinary upload error:", err);
    return jsonResponse({ error: err.message || "Upload failed" }, 500);
  }
}

async function handleFetchUrl(supabase: any, body: any) {
  const { remote_url, file_name, file_type } = body;
  if (!remote_url) return jsonResponse({ error: "remote_url required" }, 400);

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(remote_url);
  } catch {
    return jsonResponse({ error: "Invalid remote_url" }, 400);
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    return jsonResponse({ error: "remote_url must use http or https" }, 400);
  }

  const account = await getAccount(supabase, "images");
  if (!account) return jsonResponse({ error: "No active Cloudinary accounts configured" }, 400);

  try {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const folder = "uploads/avatars";
    const publicIdBase = (file_name || parsedUrl.pathname.split("/").pop() || "avatar")
      .replace(/\.[a-zA-Z0-9]+$/, "")
      .replace(/[^a-zA-Z0-9/_-]/g, "_")
      .slice(0, 100) || "avatar";
    const paramsToSign = `folder=${folder}&public_id=${publicIdBase}&timestamp=${timestamp}${account.api_secret}`;
    const signature = await sha1Hex(paramsToSign);

    const formData = new URLSearchParams({
      file: parsedUrl.toString(),
      api_key: account.api_key,
      timestamp,
      signature,
      folder,
      public_id: publicIdBase,
    });

    if (file_type) formData.append("resource_type", file_type.startsWith("video/") ? "video" : "image");

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${account.cloud_name}/image/upload`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData,
      }
    );

    const result = await res.json();

    if (result.error) {
      console.error("Cloudinary fetch-url error:", result.error);
      return jsonResponse({ error: result.error.message || "Remote import failed" }, 500);
    }

    return jsonResponse({
      url: result.secure_url,
      publicId: result.public_id,
      source: "cloudinary",
      fallbackUrl: result.secure_url,
      accountId: account.id,
    });
  } catch (err: any) {
    console.error("Cloudinary fetch-url error:", err);
    return jsonResponse({ error: err.message || "Remote import failed" }, 500);
  }
}
