import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCloudinaryUpload } from '@/hooks/useCloudinaryUpload';
import { toast } from 'sonner';
import { apiBase, getUploadAuthHeader, xhrUpload } from '@/lib/rawUpload';

const IMAGE_EXTENSIONS = new Set([
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'tiff', 'tif', 'bmp', 'ico',
]);

const HEAVY_EXTENSIONS = new Set([
  'pdf', 'mp4', 'mkv', 'avi', 'mov', 'webm', 'flv', 'wmv',
  'pptx', 'ppt', 'psd', 'ai', 'zip', 'rar', '7z', 'tar', 'gz',
  'doc', 'docx', 'xls', 'xlsx', 'csv', 'odt', 'ods', 'odp',
  'epub',
]);

const PROXY_UPLOAD_MAX_BYTES = 4.5 * 1024 * 1024; // 4.5MB
// S3/R2 multipart upload REQUIRES every part except the last to be >= 5MiB
// (5,242,880 bytes) -- a value below that makes CompleteMultipartUpload fail
// with "Your proposed upload is smaller than the minimum allowed object
// size" on every multi-chunk upload, discovered via a live end-to-end test.
const CHUNK_SIZE = 5 * 1024 * 1024; // 5MiB chunks for chunked proxy (S3 multipart minimum)

function getFileExtension(fileName: string): string {
  return fileName.split('.').pop()?.toLowerCase() || '';
}

function isImageFile(file: File): boolean {
  if (file.type.startsWith('image/')) return true;
  return IMAGE_EXTENSIONS.has(getFileExtension(file.name));
}

function isHeavyFile(file: File): boolean {
  const ext = getFileExtension(file.name);
  if (HEAVY_EXTENSIONS.has(ext)) return true;
  if (file.type.startsWith('video/')) return true;
  if (file.type === 'application/pdf') return true;
  if (file.type.includes('zip') || file.type.includes('rar')) return true;
  if (file.type.includes('document') || file.type.includes('spreadsheet') || file.type.includes('presentation')) return true;
  return false;
}

interface UploadResult {
  url: string;
  source: 'cloudinary' | 'r2' | 'local';
  publicId?: string;
  fallbackUrl?: string;
  accountId?: string;
  fileKey?: string;
}

interface UploadOptions {
  forceR2?: boolean;
  /** Cloudinary public_id (without folder). Folder will be prepended. */
  publicId?: string;
  /** Cloudinary folder, e.g. `uploads/{user_id}` or `content/course/{slug}`. */
  folder?: string;
  /** Allow overwriting existing public_id. Default true. */
  overwrite?: boolean;
}

export function useFileUpload() {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const cloudinary = useCloudinaryUpload();

  const upload = async (file: File, options?: UploadOptions): Promise<UploadResult> => {
    setUploading(true);
    setProgress(0);

    try {
      // HARD RULE: Supabase Storage is NEVER used. Images→Cloudinary, all else→R2.
      if (options?.forceR2) {
        return await uploadToR2Reliable(file);
      }

      // Route: images → Cloudinary (any size, for f_auto/q_auto optimization),
      // falling back to our own server's local file-manager storage if
      // Cloudinary is unreachable/unconfigured, so image uploads never hard-fail.
      if (isImageFile(file) && !isHeavyFile(file)) {
        try {
          const result = await cloudinary.upload(file, {
            publicId: options?.publicId,
            folder: options?.folder,
            overwrite: options?.overwrite,
            silent: true,
            onProgress: setProgress,
          });
          return {
            url: result.url,
            source: 'cloudinary',
            publicId: result.publicId,
            fallbackUrl: result.fallbackUrl,
            accountId: result.accountId,
          };
        } catch (cloudinaryErr) {
          setProgress(0);
          return await uploadToLocal(file);
        }
      }

      // Everything else → R2
      return await uploadToR2Reliable(file);
    } catch (err: any) {
      throw err;
    } finally {
      setUploading(false);
    }
  };

  /**
   * Fallback image host: our own server's local file manager (see
   * backend/src/functions/localUpload.js). Only used when Cloudinary fails.
   */
  const uploadToLocal = async (file: File): Promise<UploadResult> => {
    const headers: Record<string, string> = {
      ...(await getUploadAuthHeader()),
      'Content-Type': file.type || 'application/octet-stream',
      'X-File-Type': file.type || 'application/octet-stream',
    };
    try {
      const data = await xhrUpload(`${apiBase()}/functions/v1/uploads/local`, file, headers, setProgress);
      toast.success('Uploaded (local storage)');
      return { url: data.url, source: 'local' };
    } catch (err: any) {
      toast.error('Upload failed: ' + (err.message || 'Unknown error'));
      throw err;
    }
  };

  /**
   * Reliable R2 upload: uses a server-side proxy for ALL sizes -- raw binary
   * via XHR (real upload.onprogress), not base64-in-JSON, so large files
   * transfer faster and the progress bar reflects actual bytes sent.
   */
  const uploadToR2Reliable = async (file: File): Promise<UploadResult> => {
    if (file.size <= PROXY_UPLOAD_MAX_BYTES) {
      return await uploadToR2Single(file);
    }
    return await uploadToR2Chunked(file);
  };

  const uploadToR2Single = async (file: File): Promise<UploadResult> => {
    const headers: Record<string, string> = {
      ...(await getUploadAuthHeader()),
      'Content-Type': file.type || 'application/octet-stream',
      'X-File-Name': encodeURIComponent(file.name),
      'X-File-Type': file.type || 'application/octet-stream',
    };
    try {
      const data = await xhrUpload(`${apiBase()}/functions/v1/uploads/r2-single`, file, headers, setProgress);
      toast.success('File uploaded to R2!');
      return { url: data.url, source: 'r2', accountId: data.accountId, fileKey: data.fileKey };
    } catch (err: any) {
      toast.error('Upload failed: ' + (err.message || 'Unknown error'));
      throw err;
    }
  };

  const uploadToR2Chunked = async (file: File): Promise<UploadResult> => {
    setProgress(1);

    const { data: initData, error: initError } = await supabase.functions.invoke('r2-presign', {
      body: {
        action: 'chunked-init',
        file_name: file.name,
        file_type: file.type || 'application/octet-stream',
        file_size: file.size,
      },
    });

    if (initError || initData?.error) {
      const msg = initData?.error || initError?.message || 'Failed to initialize upload';
      toast.error(msg);
      throw new Error(msg);
    }

    const { uploadId, fileKey, accountId } = initData;
    setProgress(2);

    const authHeader = await getUploadAuthHeader();
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    let bytesDone = 0;

    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);
      const chunkSize = end - start;

      try {
        await xhrUpload(`${apiBase()}/functions/v1/uploads/r2-chunk`, chunk, {
          ...authHeader,
          'Content-Type': 'application/octet-stream',
          'X-Upload-Id': uploadId,
          'X-File-Key': fileKey,
          'X-Account-Id': accountId,
          'X-Chunk-Index': String(i),
        }, (chunkPct) => {
          const doneNow = bytesDone + (chunkPct / 100) * chunkSize;
          // Cap at 99% until chunked-complete actually confirms the multipart
          // upload is assembled server-side -- "100%" should mean "done and
          // verified", not just "the last byte left the browser".
          setProgress(Math.min(99, Math.round((doneNow / file.size) * 100)));
        });
      } catch (err: any) {
        const msg = err.message || `Chunk ${i + 1} upload failed`;
        toast.error(msg);
        throw new Error(msg);
      }

      bytesDone += chunkSize;
    }

    const { data: finalData, error: finalError } = await supabase.functions.invoke('r2-presign', {
      body: {
        action: 'chunked-complete',
        upload_id: uploadId,
        file_key: fileKey,
        account_id: accountId,
        total_chunks: totalChunks,
      },
    });

    if (finalError || finalData?.error) {
      const msg = finalData?.error || finalError?.message || 'Failed to finalize upload';
      toast.error(msg);
      throw new Error(msg);
    }

    setProgress(100);
    toast.success('File uploaded to R2!');
    return {
      url: finalData.url,
      source: 'r2',
      accountId: finalData.accountId,
      fileKey: finalData.fileKey,
    };
  };

  return { upload, uploading, progress };
}
