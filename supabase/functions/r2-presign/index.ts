import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { S3Client, PutObjectCommand, ListObjectsV2Command, HeadObjectCommand, GetObjectCommand } from "npm:@aws-sdk/client-s3@3.525.0";
import { decode } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { getSignedUrl } from "npm:@aws-sdk/s3-request-presigner@3.525.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// In-memory store for chunked uploads (per isolate lifetime)
const chunkedUploads = new Map<string, { accountId: string; fileKey: string; totalChunks: number; receivedChunks: Set<number> }>();

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

    if (action === "test") return await handleTest(supabase, body, corsHeaders);
    if (action === "presign") return await handlePresign(supabase, body, corsHeaders);
    if (action === "complete") return await handleComplete(supabase, body, corsHeaders);
    if (action === "proxy-upload") return await handleProxyUpload(supabase, body, corsHeaders);
    if (action === "chunked-init") return await handleChunkedInit(supabase, body, corsHeaders);
    if (action === "chunked-upload") return await handleChunkedUpload(supabase, body, corsHeaders);
    if (action === "chunked-complete") return await handleChunkedComplete(supabase, body, corsHeaders);

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

function generateFileKey(fileName: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_").substring(0, 100);
  return `uploads/${timestamp}-${random}-${safeName}`;
}

async function selectAccount(supabase: any) {
  const { data: accounts, error: accErr } = await supabase
    .from("cloudflare_r2_accounts")
    .select("*")
    .eq("status", "active")
    .order("created_at", { ascending: true });

  if (accErr || !accounts || accounts.length === 0) {
    throw new Error("No active R2 accounts configured");
  }

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

  return { selectedAccount, accounts };
}

async function updateRoundRobinAndCount(supabase: any, account: any) {
  await supabase
    .from("r2_round_robin_state")
    .update({ last_account_id: account.id, updated_at: new Date().toISOString() })
    .eq("id", 1);

  await supabase
    .from("cloudflare_r2_accounts")
    .update({
      upload_count: (account.upload_count || 0) + 1,
      last_used_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", account.id);
}

// ===== HANDLERS =====

async function handleTest(supabase: any, body: any, headers: any) {
  const { account_id } = body;
  if (!account_id) {
    return new Response(JSON.stringify({ error: "account_id required" }), {
      status: 400, headers: { ...headers, "Content-Type": "application/json" },
    });
  }

  const { data: account, error } = await supabase
    .from("cloudflare_r2_accounts").select("*").eq("id", account_id).single();

  if (error || !account) {
    return new Response(JSON.stringify({ error: "Account not found", success: false }), {
      status: 404, headers: { ...headers, "Content-Type": "application/json" },
    });
  }

  try {
    const s3 = buildS3Client(account);
    await s3.send(new ListObjectsV2Command({ Bucket: account.bucket_name, MaxKeys: 1 }));

    await supabase.from("cloudflare_r2_accounts")
      .update({ status: "active", updated_at: new Date().toISOString() })
      .eq("id", account_id);

    return new Response(JSON.stringify({ success: true, message: "Connection verified" }), {
      headers: { ...headers, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("R2 test error:", err.name, err.message);
    await supabase.from("cloudflare_r2_accounts")
      .update({ status: "error", updated_at: new Date().toISOString() })
      .eq("id", account_id);

    return new Response(JSON.stringify({ success: false, error: err.message || "Connection failed" }), {
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }
}

async function handlePresign(supabase: any, body: any, headers: any) {
  const { file_name, file_type } = body;
  if (!file_name || !file_type) {
    return new Response(JSON.stringify({ error: "file_name and file_type required" }), {
      status: 400, headers: { ...headers, "Content-Type": "application/json" },
    });
  }

  const { selectedAccount } = await selectAccount(supabase);
  const fileKey = generateFileKey(file_name);

  try {
    const s3 = buildS3Client(selectedAccount);
    const command = new PutObjectCommand({
      Bucket: selectedAccount.bucket_name, Key: fileKey, ContentType: file_type,
    });
    const presignedUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });

    let publicDomain = selectedAccount.public_domain_url.replace(/\/+$/, "");
    const publicUrl = `${publicDomain}/${fileKey}`;

    await supabase.from("r2_round_robin_state")
      .update({ last_account_id: selectedAccount.id, updated_at: new Date().toISOString() })
      .eq("id", 1);

    return new Response(JSON.stringify({
      presignedUrl, publicUrl, accountId: selectedAccount.id, fileKey, corsRequired: true,
    }), { headers: { ...headers, "Content-Type": "application/json" } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: "Failed to generate presigned URL: " + err.message }), {
      status: 500, headers: { ...headers, "Content-Type": "application/json" },
    });
  }
}

async function handleComplete(supabase: any, body: any, headers: any) {
  const { account_id, file_key } = body;
  if (!account_id || !file_key) {
    return new Response(JSON.stringify({ error: "account_id and file_key required" }), {
      status: 400, headers: { ...headers, "Content-Type": "application/json" },
    });
  }

  const { data: account, error } = await supabase
    .from("cloudflare_r2_accounts").select("*").eq("id", account_id).single();

  if (error || !account) {
    return new Response(JSON.stringify({ error: "Account not found" }), {
      status: 404, headers: { ...headers, "Content-Type": "application/json" },
    });
  }

  try {
    const s3 = buildS3Client(account);
    await s3.send(new HeadObjectCommand({ Bucket: account.bucket_name, Key: file_key }));

    await supabase.from("cloudflare_r2_accounts").update({
      upload_count: (account.upload_count || 0) + 1,
      last_used_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", account_id);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...headers, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("R2 complete verification error:", err.name, err.message);
    return new Response(JSON.stringify({
      error: "Upload was not confirmed in R2.",
      details: err.message || "Unknown verification error",
    }), { status: 400, headers: { ...headers, "Content-Type": "application/json" } });
  }
}

async function handleProxyUpload(supabase: any, body: any, headers: any) {
  const { file_base64, file_name, file_type } = body;
  if (!file_base64 || !file_name) {
    return new Response(JSON.stringify({ error: "file_base64 and file_name required" }), {
      status: 400, headers: { ...headers, "Content-Type": "application/json" },
    });
  }

  const { selectedAccount } = await selectAccount(supabase);
  const fileKey = generateFileKey(file_name);

  try {
    const s3 = buildS3Client(selectedAccount);
    const fileBytes = decode(file_base64);
    const contentType = file_type || "application/octet-stream";

    await s3.send(new PutObjectCommand({
      Bucket: selectedAccount.bucket_name, Key: fileKey, Body: fileBytes, ContentType: contentType,
    }));

    await updateRoundRobinAndCount(supabase, selectedAccount);

    let publicDomain = selectedAccount.public_domain_url.replace(/\/+$/, "");
    const publicUrl = `${publicDomain}/${fileKey}`;

    return new Response(
      JSON.stringify({ url: publicUrl, source: "r2", accountId: selectedAccount.id, fileKey }),
      { headers: { ...headers, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("R2 proxy upload error:", err);
    return new Response(
      JSON.stringify({ error: "Server-side upload to R2 failed: " + (err.message || "Unknown error") }),
      { status: 500, headers: { ...headers, "Content-Type": "application/json" } }
    );
  }
}

// ===== CHUNKED UPLOAD HANDLERS =====
// Allows uploading large files (>4.5MB) through the edge function in chunks,
// bypassing both the edge function body limit and browser CORS requirements.

async function handleChunkedInit(supabase: any, body: any, headers: any) {
  const { file_name, file_type, file_size } = body;
  if (!file_name) {
    return new Response(JSON.stringify({ error: "file_name required" }), {
      status: 400, headers: { ...headers, "Content-Type": "application/json" },
    });
  }

  const { selectedAccount } = await selectAccount(supabase);
  const fileKey = generateFileKey(file_name);
  const uploadId = crypto.randomUUID();

  // Store metadata for this chunked upload
  chunkedUploads.set(uploadId, {
    accountId: selectedAccount.id,
    fileKey,
    totalChunks: 0,
    receivedChunks: new Set(),
  });

  console.log(`[chunked-init] uploadId=${uploadId}, fileKey=${fileKey}, size=${file_size}`);

  return new Response(JSON.stringify({
    uploadId,
    fileKey,
    accountId: selectedAccount.id,
  }), { headers: { ...headers, "Content-Type": "application/json" } });
}

async function handleChunkedUpload(supabase: any, body: any, headers: any) {
  const { upload_id, file_key, account_id, chunk_index, chunk_base64, total_chunks } = body;

  if (!chunk_base64 || chunk_index === undefined || !file_key || !account_id) {
    return new Response(JSON.stringify({ error: "Missing required chunk upload parameters" }), {
      status: 400, headers: { ...headers, "Content-Type": "application/json" },
    });
  }

  const { data: account, error: accErr } = await supabase
    .from("cloudflare_r2_accounts").select("*").eq("id", account_id).single();

  if (accErr || !account) {
    return new Response(JSON.stringify({ error: "R2 account not found" }), {
      status: 404, headers: { ...headers, "Content-Type": "application/json" },
    });
  }

  try {
    const s3 = buildS3Client(account);
    const chunkBytes = decode(chunk_base64);
    const chunkKey = `${file_key}.__chunk_${chunk_index}`;

    await s3.send(new PutObjectCommand({
      Bucket: account.bucket_name,
      Key: chunkKey,
      Body: chunkBytes,
      ContentType: "application/octet-stream",
    }));

    console.log(`[chunked-upload] chunk ${chunk_index + 1}/${total_chunks} for ${file_key}`);

    return new Response(JSON.stringify({ success: true, chunk_index }), {
      headers: { ...headers, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error(`[chunked-upload] error chunk ${chunk_index}:`, err.message);
    return new Response(JSON.stringify({ error: `Chunk ${chunk_index} upload failed: ${err.message}` }), {
      status: 500, headers: { ...headers, "Content-Type": "application/json" },
    });
  }
}

async function handleChunkedComplete(supabase: any, body: any, headers: any) {
  const { upload_id, file_key, account_id, total_chunks } = body;

  if (!file_key || !account_id || !total_chunks) {
    return new Response(JSON.stringify({ error: "Missing required parameters" }), {
      status: 400, headers: { ...headers, "Content-Type": "application/json" },
    });
  }

  const { data: account, error: accErr } = await supabase
    .from("cloudflare_r2_accounts").select("*").eq("id", account_id).single();

  if (accErr || !account) {
    return new Response(JSON.stringify({ error: "R2 account not found" }), {
      status: 404, headers: { ...headers, "Content-Type": "application/json" },
    });
  }

  try {
    const s3 = buildS3Client(account);

    // Read all chunks and concatenate
    const chunks: Uint8Array[] = [];
    for (let i = 0; i < total_chunks; i++) {
      const chunkKey = `${file_key}.__chunk_${i}`;
      const resp = await s3.send(new GetObjectCommand({
        Bucket: account.bucket_name, Key: chunkKey,
      }));

      if (!resp.Body) throw new Error(`Chunk ${i} is empty`);

      // Convert stream to Uint8Array
      const reader = (resp.Body as ReadableStream).getReader();
      const parts: Uint8Array[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        parts.push(value);
      }
      const chunkData = new Uint8Array(parts.reduce((sum, p) => sum + p.length, 0));
      let offset = 0;
      for (const part of parts) {
        chunkData.set(part, offset);
        offset += part.length;
      }
      chunks.push(chunkData);
    }

    // Combine all chunks
    const totalSize = chunks.reduce((sum, c) => sum + c.length, 0);
    const combined = new Uint8Array(totalSize);
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }

    // Detect content type from file extension
    const ext = file_key.split('.').pop()?.toLowerCase() || '';
    const contentTypeMap: Record<string, string> = {
      pdf: "application/pdf",
      doc: "application/msword",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      epub: "application/epub+zip",
    };
    const contentType = contentTypeMap[ext] || "application/octet-stream";

    // Upload the combined file
    await s3.send(new PutObjectCommand({
      Bucket: account.bucket_name,
      Key: file_key,
      Body: combined,
      ContentType: contentType,
    }));

    // Clean up chunk files (fire and forget)
    for (let i = 0; i < total_chunks; i++) {
      const chunkKey = `${file_key}.__chunk_${i}`;
      try {
        const { DeleteObjectCommand } = await import("npm:@aws-sdk/client-s3@3.525.0");
        await s3.send(new DeleteObjectCommand({ Bucket: account.bucket_name, Key: chunkKey }));
      } catch {
        // Chunk cleanup is best-effort
      }
    }

    await updateRoundRobinAndCount(supabase, account);

    let publicDomain = account.public_domain_url.replace(/\/+$/, "");
    const publicUrl = `${publicDomain}/${file_key}`;

    // Clean up in-memory state
    if (upload_id) chunkedUploads.delete(upload_id);

    console.log(`[chunked-complete] Assembled ${total_chunks} chunks into ${file_key} (${totalSize} bytes)`);

    return new Response(JSON.stringify({
      url: publicUrl, source: "r2", accountId: account.id, fileKey: file_key,
    }), { headers: { ...headers, "Content-Type": "application/json" } });
  } catch (err: any) {
    console.error("[chunked-complete] error:", err.message);
    return new Response(JSON.stringify({
      error: "Failed to assemble chunked upload: " + (err.message || "Unknown error"),
    }), { status: 500, headers: { ...headers, "Content-Type": "application/json" } });
  }
}
