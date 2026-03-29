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
]);

const PROXY_UPLOAD_MAX_BYTES = 4.5 * 1024 * 1024; // 4.5MB

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

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip data URI prefix
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

  const upload = async (file: File): Promise<UploadResult> => {
    setUploading(true);
    setProgress(0);

    try {
      // Route: images → Cloudinary, heavy files → R2
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

      // Heavy file → R2
      // For files under 4.5MB, use server-side proxy (no CORS needed)
      // For larger files, use presigned URL (requires CORS on R2 bucket)
      if (file.size <= PROXY_UPLOAD_MAX_BYTES) {
        return await uploadToR2Proxy(file);
      }
      return await uploadToR2Presigned(file);
    } catch (err: any) {
      throw err;
    } finally {
      setUploading(false);
    }
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

  const uploadToR2Presigned = async (file: File): Promise<UploadResult> => {
    // Step 1: Get presigned URL from edge function
    setProgress(5);
    const { data: session } = await supabase.auth.getSession();
    const token = session?.session?.access_token;

    if (!token) {
      toast.error('You must be logged in to upload files');
      throw new Error('Not authenticated');
    }

    const { data, error } = await supabase.functions.invoke('r2-presign', {
      body: {
        action: 'presign',
        file_name: file.name,
        file_type: file.type || 'application/octet-stream',
      },
    });

    if (error) {
      toast.error('Failed to get upload URL: ' + (error.message || 'Unknown error'));
      throw new Error(error.message || 'Failed to get presigned URL');
    }

    if (data?.error) {
      toast.error('Upload error: ' + data.error);
      throw new Error(data.error);
    }

    const { presignedUrl, publicUrl, accountId, fileKey } = data;

    // Step 2: Upload directly to R2 via presigned URL with progress
    setProgress(10);

    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', presignedUrl, true);
      xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const pct = Math.round(10 + (e.loaded / e.total) * 85);
          setProgress(pct);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          setProgress(100);
          resolve();
        } else {
          reject(new Error(`Upload failed with status ${xhr.status}. Your Cloudflare R2 bucket needs CORS configured for this site origin.`));
        }
      };

      xhr.onerror = () => reject(new Error('Browser upload blocked. Your Cloudflare R2 bucket CORS does not allow this site origin. For files over 4.5MB, CORS must be configured on the R2 bucket.'));
      xhr.ontimeout = () => reject(new Error('Upload timed out'));
      xhr.timeout = 600000; // 10 minutes

      xhr.send(file);
    });

    // Step 3: Verify upload in R2
    const { data: completeData, error: completeError } = await supabase.functions.invoke('r2-presign', {
      body: {
        action: 'complete',
        account_id: accountId,
        file_key: fileKey,
      },
    });

    if (completeError || completeData?.error) {
      const errorMessage = completeData?.error || completeData?.details || completeError?.message || 'Upload could not be confirmed in R2';
      toast.error(errorMessage);
      throw new Error(errorMessage);
    }

    toast.success('File uploaded to R2!');
    return {
      url: publicUrl,
      source: 'r2',
      accountId,
      fileKey,
    };
  };

  return { upload, uploading, progress };
}
