// Migrates all files from Supabase Storage `media` bucket to Cloudinary (images) or R2 (others)
// Updates DB references and logs each migration. Idempotent.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/bmp', 'image/tiff'];

// Tables and columns where Supabase URLs may live
const URL_COLUMNS: Array<{ table: string; col: string }> = [
  { table: 'user_profiles', col: 'avatar_url' },
  { table: 'user_profiles', col: 'cover_url' },
  { table: 'media_library', col: 'file_url' },
  { table: 'posts', col: 'featured_image_url' },
  { table: 'posts', col: 'og_image_url' },
  { table: 'courses', col: 'thumbnail_url' },
  { table: 'courses', col: 'og_image_url' },
  { table: 'courses', col: 'intro_video_url' },
  { table: 'ebooks', col: 'cover_url' },
  { table: 'ebooks', col: 'file_url' },
  { table: 'ebooks', col: 'og_image_url' },
  { table: 'hero_slides', col: 'media_url' },
  { table: 'hero_slides', col: 'background_url' },
  { table: 'workshops', col: 'thumbnail_url' },
  { table: 'workshops', col: 'og_image_url' },
  { table: 'assignment_submissions', col: 'file_url' },
  { table: 'certificate_templates', col: 'background_url' },
  { table: 'sponsors', col: 'logo_url' },
  { table: 'instructors', col: 'avatar_url' },
];

async function fileToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)) as any);
  }
  return btoa(binary);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action || 'migrate';
    const deleteOriginals = body.deleteOriginals !== false; // default true per user request

    if (action === 'status') {
      const { count: total } = await supabase.from('storage_migration_log').select('*', { count: 'exact', head: true });
      const { count: done } = await supabase.from('storage_migration_log').select('*', { count: 'exact', head: true }).eq('status', 'success');
      const { count: failed } = await supabase.from('storage_migration_log').select('*', { count: 'exact', head: true }).eq('status', 'failed');
      return new Response(JSON.stringify({ total, done, failed }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // List all objects in media bucket
    const allFiles: Array<{ name: string; metadata: any }> = [];
    async function listFolder(prefix: string) {
      const { data, error } = await supabase.storage.from('media').list(prefix, { limit: 1000 });
      if (error) throw error;
      for (const item of data || []) {
        const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
        if (item.id === null || item.metadata === null) {
          // It's a folder
          await listFolder(fullPath);
        } else {
          allFiles.push({ name: fullPath, metadata: item.metadata });
        }
      }
    }
    await listFolder('');

    const results = { total: allFiles.length, migrated: 0, imagesToCloudinary: 0, filesToR2: 0, skipped: 0, failed: 0, deleted: 0, details: [] as any[] };

    for (const file of allFiles) {
      const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/media/${file.name}`;

      try {
        // Skip if already migrated
        const { data: existing } = await supabase
          .from('storage_migration_log')
          .select('id, status, new_url')
          .eq('old_url', publicUrl)
          .maybeSingle();

        if (existing && existing.status === 'success') {
          results.skipped++;
          continue;
        }

        // Insert pending log
        await supabase.from('storage_migration_log').upsert({
          old_url: publicUrl,
          bucket_path: file.name,
          file_size: file.metadata?.size || 0,
          mime_type: file.metadata?.mimetype || 'application/octet-stream',
          status: 'pending',
        }, { onConflict: 'old_url' });

        // Download from Supabase
        const { data: blob, error: dlErr } = await supabase.storage.from('media').download(file.name);
        if (dlErr || !blob) throw new Error(`Download failed: ${dlErr?.message}`);

        const mime = file.metadata?.mimetype || blob.type || 'application/octet-stream';
        const filename = file.name.split('/').pop() || 'file';
        const isImage = IMAGE_MIMES.includes(mime) || /\.(jpe?g|png|gif|webp|svg|bmp|tiff?)$/i.test(filename);

        let newUrl: string;
        let source: string;

        if (isImage) {
          // Upload to Cloudinary via existing proxy
          const base64 = await fileToBase64(blob);
          const { data: cldData, error: cldErr } = await supabase.functions.invoke('cloudinary-proxy', {
            body: { action: 'upload', file_base64: base64, file_name: filename, file_type: mime },
          });
          if (cldErr || cldData?.error) throw new Error(`Cloudinary: ${cldData?.error || cldErr?.message}`);
          newUrl = cldData.url;
          source = 'cloudinary';
        } else {
          // Upload to R2 via existing proxy (chunked if needed)
          const size = blob.size;
          const PROXY_MAX = 4.5 * 1024 * 1024;
          if (size <= PROXY_MAX) {
            const base64 = await fileToBase64(blob);
            const { data: r2Data, error: r2Err } = await supabase.functions.invoke('r2-presign', {
              body: { action: 'proxy-upload', file_base64: base64, file_name: filename, file_type: mime },
            });
            if (r2Err || r2Data?.error) throw new Error(`R2: ${r2Data?.error || r2Err?.message}`);
            newUrl = r2Data.url;
          } else {
            // Chunked
            const { data: initData, error: initErr } = await supabase.functions.invoke('r2-presign', {
              body: { action: 'chunked-init', file_name: filename, file_type: mime, file_size: size },
            });
            if (initErr || initData?.error) throw new Error(`R2 init: ${initData?.error || initErr?.message}`);
            const { uploadId, fileKey, accountId } = initData;
            const CHUNK = 4 * 1024 * 1024;
            const totalChunks = Math.ceil(size / CHUNK);
            for (let i = 0; i < totalChunks; i++) {
              const chunkBlob = blob.slice(i * CHUNK, Math.min((i + 1) * CHUNK, size));
              const chunkB64 = await fileToBase64(chunkBlob);
              const { data: cd, error: ce } = await supabase.functions.invoke('r2-presign', {
                body: { action: 'chunked-upload', upload_id: uploadId, file_key: fileKey, account_id: accountId, chunk_index: i, chunk_base64: chunkB64, total_chunks: totalChunks },
              });
              if (ce || cd?.error) throw new Error(`R2 chunk ${i}: ${cd?.error || ce?.message}`);
            }
            const { data: finData, error: finErr } = await supabase.functions.invoke('r2-presign', {
              body: { action: 'chunked-complete', upload_id: uploadId, file_key: fileKey, account_id: accountId, total_chunks: totalChunks },
            });
            if (finErr || finData?.error) throw new Error(`R2 complete: ${finData?.error || finErr?.message}`);
            newUrl = finData.url;
          }
          source = 'r2';
        }

        // Update DB references
        const tablesUpdated: string[] = [];
        for (const { table, col } of URL_COLUMNS) {
          const { data: matches } = await supabase.from(table).select('id').eq(col, publicUrl);
          if (matches && matches.length > 0) {
            await supabase.from(table).update({ [col]: newUrl }).eq(col, publicUrl);
            tablesUpdated.push(`${table}.${col} (${matches.length})`);
          }
        }

        // Mark success
        await supabase.from('storage_migration_log').update({
          new_url: newUrl,
          source,
          status: 'success',
          migrated_at: new Date().toISOString(),
          tables_updated: tablesUpdated,
        }).eq('old_url', publicUrl);

        // Delete from Supabase
        if (deleteOriginals) {
          const { error: delErr } = await supabase.storage.from('media').remove([file.name]);
          if (!delErr) results.deleted++;
        }

        results.migrated++;
        if (source === 'cloudinary') results.imagesToCloudinary++;
        else if (source === 'r2') results.filesToR2++;
        results.details.push({ file: file.name, newUrl, source, tablesUpdated });
      } catch (err: any) {
        results.failed++;
        await supabase.from('storage_migration_log').upsert({
          old_url: publicUrl,
          bucket_path: file.name,
          status: 'failed',
          error_message: String(err?.message || err),
        }, { onConflict: 'old_url' });
        results.details.push({ file: file.name, error: String(err?.message || err) });
      }
    }

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: String(err?.message || err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
