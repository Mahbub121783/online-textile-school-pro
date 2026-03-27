import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { S3Client, PutObjectCommand, ListObjectsV2Command, HeadObjectCommand } from "npm:@aws-sdk/client-s3@3.525.0";
import { getSignedUrl } from "npm:@aws-sdk/s3-request-presigner@3.525.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action } = body;

    if (action === "test") {
      return await handleTest(supabase, body, corsHeaders);
    }

    if (action === "presign") {
      return await handlePresign(supabase, body, corsHeaders);
    }

    if (action === "complete") {
      return await handleComplete(supabase, body, corsHeaders);
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("r2-presign error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function buildS3Client(account: any): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: account.endpoint_url,
    credentials: {
      accessKeyId: account.access_key_id,
      secretAccessKey: account.secret_access_key,
    },
  });
}

async function handleTest(supabase: any, body: any, headers: any) {
  const { account_id } = body;
  if (!account_id) {
    return new Response(JSON.stringify({ error: "account_id required" }), {
      status: 400,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }

  const { data: account, error } = await supabase
    .from("cloudflare_r2_accounts")
    .select("*")
    .eq("id", account_id)
    .single();

  if (error || !account) {
    return new Response(JSON.stringify({ error: "Account not found", success: false }), {
      status: 404,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }

  try {
    const s3 = buildS3Client(account);
    // Use ListObjectsV2 with MaxKeys=1 — more reliable with R2 than HeadBucket
    await s3.send(new ListObjectsV2Command({ Bucket: account.bucket_name, MaxKeys: 1 }));

    await supabase
      .from("cloudflare_r2_accounts")
      .update({ status: "active", updated_at: new Date().toISOString() })
      .eq("id", account_id);

    return new Response(JSON.stringify({
      success: true,
      message: "Connection verified",
      note: "Browser uploads still require Cloudflare R2 bucket CORS for your app origin.",
    }), {
      headers: { ...headers, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("R2 test error:", err.name, err.message, err.$metadata);
    await supabase
      .from("cloudflare_r2_accounts")
      .update({ status: "error", updated_at: new Date().toISOString() })
      .eq("id", account_id);

    const msg = err.message || err.name || "Connection failed";
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { headers: { ...headers, "Content-Type": "application/json" } }
    );
  }
}

async function handlePresign(supabase: any, body: any, headers: any) {
  const { file_name, file_type } = body;
  if (!file_name || !file_type) {
    return new Response(JSON.stringify({ error: "file_name and file_type required" }), {
      status: 400,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }

  // Fetch all active R2 accounts ordered by created_at
  const { data: accounts, error: accErr } = await supabase
    .from("cloudflare_r2_accounts")
    .select("*")
    .eq("status", "active")
    .order("created_at", { ascending: true });

  if (accErr || !accounts || accounts.length === 0) {
    return new Response(
      JSON.stringify({ error: "No active R2 accounts configured" }),
      { status: 400, headers: { ...headers, "Content-Type": "application/json" } }
    );
  }

  // Get round-robin state
  const { data: rrState } = await supabase
    .from("r2_round_robin_state")
    .select("last_account_id")
    .eq("id", 1)
    .single();

  const lastId = rrState?.last_account_id;
  let selectedAccount;

  if (!lastId) {
    selectedAccount = accounts[0];
  } else {
    const lastIndex = accounts.findIndex((a: any) => a.id === lastId);
    const nextIndex = (lastIndex + 1) % accounts.length;
    selectedAccount = accounts[nextIndex];
  }

  // Generate unique file key
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const ext = file_name.includes(".") ? file_name.substring(file_name.lastIndexOf(".")) : "";
  const safeName = file_name
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .substring(0, 100);
  const fileKey = `uploads/${timestamp}-${random}-${safeName}`;

  try {
    const s3 = buildS3Client(selectedAccount);

    const command = new PutObjectCommand({
      Bucket: selectedAccount.bucket_name,
      Key: fileKey,
      ContentType: file_type,
    });

    const presignedUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });

    // Build public URL
    let publicDomain = selectedAccount.public_domain_url.replace(/\/+$/, "");
    const publicUrl = `${publicDomain}/${fileKey}`;

     // Update round-robin state only. Upload count is confirmed after the browser PUT succeeds.
    await supabase
      .from("r2_round_robin_state")
      .update({
        last_account_id: selectedAccount.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);

    return new Response(
      JSON.stringify({
        presignedUrl,
        publicUrl,
        accountId: selectedAccount.id,
        fileKey,
         corsRequired: true,
      }),
      { headers: { ...headers, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: "Failed to generate presigned URL: " + err.message }),
      { status: 500, headers: { ...headers, "Content-Type": "application/json" } }
    );
  }
}

async function handleComplete(supabase: any, body: any, headers: any) {
  const { account_id, file_key } = body;

  if (!account_id || !file_key) {
    return new Response(JSON.stringify({ error: "account_id and file_key required" }), {
      status: 400,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }

  const { data: account, error } = await supabase
    .from("cloudflare_r2_accounts")
    .select("*")
    .eq("id", account_id)
    .single();

  if (error || !account) {
    return new Response(JSON.stringify({ error: "Account not found" }), {
      status: 404,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }

  try {
    const s3 = buildS3Client(account);
    await s3.send(new HeadObjectCommand({ Bucket: account.bucket_name, Key: file_key }));

    await supabase
      .from("cloudflare_r2_accounts")
      .update({
        upload_count: (account.upload_count || 0) + 1,
        last_used_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", account_id);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...headers, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("R2 complete verification error:", err.name, err.message, err.$metadata);
    return new Response(JSON.stringify({
      error: "Upload was not confirmed in R2. Check bucket CORS and public domain settings.",
      details: err.message || err.name || "Unknown verification error",
    }), {
      status: 400,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }
}
