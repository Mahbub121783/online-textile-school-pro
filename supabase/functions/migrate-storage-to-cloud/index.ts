// Queue-based migration worker.
// Actions:
//   scan         — page through Supabase `media` bucket and seed storage_migration_log (pending rows)
//   migrate-next — process 1 pending row: download from public URL, upload to Cloudinary (image) or R2 (other), update DB refs, delete original
//   status       — return counts
//   retry-failed — flip failed rows back to pending
//
// No nested edge-function calls. No full-bucket scan per migration. No big base64 buffers.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { S3Client, PutObjectCommand } from "npm:@aws-sdk/client-s3@3.525.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const IMAGE_MIMES = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml", "image/bmp", "image/tiff"];
const IMAGE_EXT = /\.(jpe?g|png|gif|webp|svg|bmp|tiff?)$/i;

const URL_COLUMNS: Array<{ table: string; col: string }> = [
  { table: "user_profiles", col: "avatar_url" },
  { table: "user_profiles", col: "cover_url" },
  { table: "media_library", col: "file_url" },
  { table: "posts", col: "featured_image_url" },
  { table: "posts", col: "og_image_url" },
  { table: "courses", col: "thumbnail_url" },
  { table: "courses", col: "og_image_url" },
  { table: "courses", col: "intro_video_url" },
  { table: "ebooks", col: "cover_url" },
  { table: "ebooks", col: "file_url" },
  { table: "ebooks", col: "og_image_url" },
  { table: "hero_slides", col: "media_url" },
  { table: "hero_slides", col: "background_url" },
  { table: "workshops", col: "thumbnail_url" },
  { table: "workshops", col: "og_image_url" },
  { table: "assignment_submissions", col: "file_url" },
  { table: "certificate_templates", col: "background_url" },
  { table: "sponsors", col: "logo_url" },
  { table: "instructors", col: "avatar_url" },
];

function publicUrlFor(path: string) {
  return `${SUPABASE_URL}/storage/v1/object/public/media/${path}`;
}

async function uploadToCloudinary(supabase: any, bytes: Uint8Array, fileName: string, mime: string): Promise<string> {
  const { data: account } = await supabase
    .from("cloudinary_accounts")
    .select("*")
    .eq("status", "active")
    .order("is_primary", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!account) throw new Error("No active Cloudinary account");

  const timestamp = Math.floor(Date.now() / 1000).toString();
  // Sign: only `timestamp` parameter included
  const toSign = `timestamp=${timestamp}${account.api_secret}`;
  const hashBuf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(toSign));
  const signature = Array.from(new Uint8Array(hashBuf)).map((b) => b.toString(16).padStart(2, "0")).join("");

  const form = new FormData();
  form.append("file", new Blob([bytes], { type: mime }), fileName);
  form.append("api_key", account.api_key);
  form.append("timestamp", timestamp);
  form.append("signature", signature);

  const resourceType = mime.startsWith("video/") ? "video" : "image";
  const res = await fetch(`https://api.cloudinary.com/v1_1/${account.cloud_name}/${resourceType}/upload`, {
    method: "POST",
    body: form,
  });
  const json = await res.json();
  if (!res.ok || !json.secure_url) throw new Error(`Cloudinary: ${json.error?.message || res.statusText}`);
  return json.secure_url as string;
}

async function uploadToR2(supabase: any, bytes: Uint8Array, fileName: string, mime: string): Promise<string> {
  const { data: accounts } = await supabase
    .from("cloudflare_r2_accounts")
    .select("*")
    .eq("status", "active")
    .order("created_at", { ascending: true });
  if (!accounts || accounts.length === 0) throw new Error("No active R2 accounts");
  const account = accounts[0];

  const client = new S3Client({
    region: "auto",
    endpoint: account.endpoint_url,
    credentials: { accessKeyId: account.access_key_id, secretAccessKey: account.secret_access_key },
  });
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, "_").substring(0, 100);
  const key = `uploads/${Date.now()}-${Math.random().toString(36).substring(2, 8)}-${safe}`;
  await client.send(new PutObjectCommand({
    Bucket: account.bucket_name,
    Key: key,
    Body: bytes,
    ContentType: mime,
  }));
  const base = String(account.public_domain_url).replace(/\/+$/, "");
  return `${base}/${key}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action || "status";

    // ---------- STATUS ----------
    if (action === "status") {
      const counts: Record<string, number> = {};
      for (const s of ["pending", "processing", "success", "failed"]) {
        const { count } = await supabase.from("storage_migration_log").select("*", { count: "exact", head: true }).eq("status", s);
        counts[s] = count || 0;
      }
      const { count: total } = await supabase.from("storage_migration_log").select("*", { count: "exact", head: true });
      return new Response(JSON.stringify({ ...counts, total: total || 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---------- RETRY FAILED ----------
    if (action === "retry-failed") {
      const { error } = await supabase
        .from("storage_migration_log")
        .update({ status: "pending", error_message: null })
        .eq("status", "failed");
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ---------- SCAN ----------
    if (action === "scan") {
      // Page through bucket. body.prefix = current folder (default ""), body.offset = page offset.
      const prefix: string = body.prefix || "";
      const offset: number = Number(body.offset) || 0;
      const limit = 100;

      const { data, error } = await supabase.storage.from("media").list(prefix, { limit, offset });
      if (error) throw error;

      let inserted = 0;
      const folders: string[] = [];
      const rows: any[] = [];
      for (const item of data || []) {
        const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
        if (item.id === null && item.metadata === null) {
          folders.push(fullPath);
          continue;
        }
        rows.push({
          old_url: publicUrlFor(fullPath),
          bucket_path: fullPath,
          file_size: item.metadata?.size || 0,
          mime_type: item.metadata?.mimetype || "application/octet-stream",
          status: "pending",
        });
      }
      if (rows.length > 0) {
        const { error: upErr } = await supabase.from("storage_migration_log").upsert(rows, { onConflict: "old_url", ignoreDuplicates: true });
        if (upErr) throw upErr;
        inserted = rows.length;
      }

      const hasMore = (data?.length || 0) === limit;
      return new Response(JSON.stringify({
        prefix,
        offset,
        scanned: data?.length || 0,
        inserted,
        folders,
        hasMore,
        nextOffset: hasMore ? offset + limit : null,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ---------- MIGRATE NEXT ----------
    if (action === "migrate-next") {
      const { data: row, error: pickErr } = await supabase
        .from("storage_migration_log")
        .select("*")
        .eq("status", "pending")
        .lt("attempt_count", 3)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (pickErr) throw pickErr;
      if (!row) {
        return new Response(JSON.stringify({ done: true, message: "No pending items" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const path = row.bucket_path;
      const oldUrl = row.old_url;

      // Mark processing
      await supabase.from("storage_migration_log").update({
        status: "processing",
        started_at: new Date().toISOString(),
        attempt_count: (row.attempt_count || 0) + 1,
      }).eq("id", row.id);

      try {
        // Download via public URL (avoids storage SDK auth overhead)
        const dlRes = await fetch(oldUrl);
        if (!dlRes.ok) throw new Error(`Download HTTP ${dlRes.status}`);
        const buf = new Uint8Array(await dlRes.arrayBuffer());
        const mime = row.mime_type || dlRes.headers.get("content-type") || "application/octet-stream";
        const fileName = path.split("/").pop() || "file";
        const isImage = IMAGE_MIMES.includes(mime) || IMAGE_EXT.test(fileName);

        let newUrl: string;
        let source: string;
        if (isImage) {
          newUrl = await uploadToCloudinary(supabase, buf, fileName, mime);
          source = "cloudinary";
        } else {
          newUrl = await uploadToR2(supabase, buf, fileName, mime);
          source = "r2";
        }

        // Update DB references
        const tablesUpdated: string[] = [];
        for (const { table, col } of URL_COLUMNS) {
          const { data: matches } = await supabase.from(table).select("id").eq(col, oldUrl);
          if (matches && matches.length > 0) {
            await supabase.from(table).update({ [col]: newUrl }).eq(col, oldUrl);
            tablesUpdated.push(`${table}.${col} (${matches.length})`);
          }
        }

        // Delete original from Supabase
        let deleted = false;
        if (body.deleteOriginals !== false) {
          const { error: delErr } = await supabase.storage.from("media").remove([path]);
          deleted = !delErr;
        }

        await supabase.from("storage_migration_log").update({
          status: "success",
          new_url: newUrl,
          source,
          tables_updated: tablesUpdated,
          migrated_at: new Date().toISOString(),
          error_message: null,
        }).eq("id", row.id);

        return new Response(JSON.stringify({
          done: false,
          processed: { file: path, newUrl, source, tablesUpdated, deleted },
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } catch (err: any) {
        const msg = String(err?.message || err);
        await supabase.from("storage_migration_log").update({
          status: "failed",
          error_message: msg,
          last_error_at: new Date().toISOString(),
        }).eq("id", row.id);
        return new Response(JSON.stringify({
          done: false,
          processed: { file: path, error: msg },
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: String(err?.message || err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
