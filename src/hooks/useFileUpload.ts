import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCloudinaryUpload } from '@/hooks/useCloudinaryUpload';
import { toast } from 'sonner';

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
const CHUNK_SIZE = 4 * 1024 * 1024; // 4MB chunks for chunked proxy

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

function fileToBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

interface UploadResult {
  url: string;
  source: 'cloudinary' | 'r2';
  publicId?: string;
  fallbackUrl?: string;
  accountId?: string;
  fileKey?: string;
}

export function useFileUpload() {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const cloudinary = useCloudinaryUpload();

  const upload = async (file: File, options?: { forceR2?: boolean }): Promise<UploadResult> => {
    setUploading(true);
    setProgress(0);

    try {
      // HARD RULE: Supabase Storage is NEVER used. Images→Cloudinary, all else→R2.
      // forceR2 bypasses image detection — always goes to R2
      if (options?.forceR2) {
        return await uploadToR2Reliable(file);
      }

      // Route: images → Cloudinary (any size, for f_auto/q_auto optimization)
      if (isImageFile(file) && !isHeavyFile(file)) {
        const result = await cloudinary.upload(file);
        setProgress(100);
        return {
          url: result.url,
          source: 'cloudinary',
          publicId: result.publicId,
          fallbackUrl: result.fallbackUrl,
          accountId: result.accountId,
        };
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
   * Reliable R2 upload: uses chunked server-side proxy for ALL sizes.
   * This avoids browser CORS dependency entirely.
   */
  const uploadToR2Reliable = async (file: File): Promise<UploadResult> => {
    // For files under 4.5MB, single proxy upload
    if (file.size <= PROXY_UPLOAD_MAX_BYTES) {
      return await uploadToR2Proxy(file);
    }

    // For larger files, use chunked proxy upload
    return await uploadToR2Chunked(file);
  };

  const uploadToR2Proxy = async (file: File): Promise<UploadResult> => {
    setProgress(10);
    const base64 = await fileToBase64(file);
    setProgress(30);

    const { data, error } = await supabase.functions.invoke('r2-presign', {
      body: {
        action: 'proxy-upload',
        file_base64: base64,
        file_name: file.name,
        file_type: file.type || 'application/octet-stream',
      },
    });

    if (error) {
      toast.error('Upload failed: ' + (error.message || 'Unknown error'));
      throw new Error(error.message || 'Upload failed');
    }

    if (data?.error) {
      toast.error('Upload error: ' + data.error);
      throw new Error(data.error);
    }

    setProgress(100);
    toast.success('File uploaded to R2!');
    return {
      url: data.url,
      source: 'r2',
      accountId: data.accountId,
      fileKey: data.fileKey,
    };
  };

  /**
   * Chunked proxy upload: splits file into chunks and uploads each
   * through the edge function, then assembles on R2.
   * This bypasses both the 4.5MB edge function limit AND browser CORS.
   */
  const uploadToR2Chunked = async (file: File): Promise<UploadResult> => {
    setProgress(2);

    // Step 1: Initialize chunked upload
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
    setProgress(5);

    // Step 2: Upload chunks
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);
      const chunkBase64 = await fileToBase64(chunk);

      const { data: chunkData, error: chunkError } = await supabase.functions.invoke('r2-presign', {
        body: {
          action: 'chunked-upload',
          upload_id: uploadId,
          file_key: fileKey,
          account_id: accountId,
          chunk_index: i,
          chunk_base64: chunkBase64,
          total_chunks: totalChunks,
        },
      });

      if (chunkError || chunkData?.error) {
        const msg = chunkData?.error || chunkError?.message || `Chunk ${i + 1} upload failed`;
        toast.error(msg);
        throw new Error(msg);
      }

      const pct = Math.round(5 + ((i + 1) / totalChunks) * 85);
      setProgress(pct);
    }

    // Step 3: Finalize chunked upload
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
