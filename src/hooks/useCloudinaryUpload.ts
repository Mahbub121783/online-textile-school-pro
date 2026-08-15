import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { apiBase, getUploadAuthHeader, xhrUpload } from '@/lib/rawUpload';

interface UploadResult {
  url: string;
  publicId?: string;
  source: 'cloudinary' | 'supabase';
  fallbackUrl?: string;
  accountId?: string;
}

interface UploadOptions {
  publicId?: string;
  folder?: string;
  overwrite?: boolean;
  /** Skip the error toast -- for callers (useFileUpload.ts) that silently
   * retry via a fallback path, where surfacing this failure would wrongly
   * read as "your upload failed" even though it's about to succeed anyway. */
  silent?: boolean;
  /** Real-time upload percentage (0-100), driven by XHR's upload.onprogress. */
  onProgress?: (pct: number) => void;
}

export function useCloudinaryUpload() {
  const [uploading, setUploading] = useState(false);

  const invokeUpload = async (body: Record<string, unknown>): Promise<UploadResult> => {
    const { data, error } = await supabase.functions.invoke('cloudinary-proxy', { body });
    if (error) throw new Error(error.message || 'Upload failed');
    if (data?.error) throw new Error(data.error);
    return {
      url: data.url,
      publicId: data.publicId,
      source: data.source,
      fallbackUrl: data.fallbackUrl,
      accountId: data.accountId,
    };
  };

  const upload = async (file: File, options?: UploadOptions): Promise<UploadResult> => {
    setUploading(true);
    try {
      const headers: Record<string, string> = {
        ...(await getUploadAuthHeader()),
        'Content-Type': file.type || 'application/octet-stream',
        'X-File-Type': file.type || 'application/octet-stream',
      };
      if (options?.publicId) headers['X-Public-Id'] = encodeURIComponent(options.publicId);
      if (options?.folder) headers['X-Folder'] = encodeURIComponent(options.folder);
      if (options?.overwrite === false) headers['X-Overwrite'] = 'false';

      const data = await xhrUpload(`${apiBase()}/functions/v1/uploads/cloudinary`, file, headers, options?.onProgress);
      return {
        url: data.url,
        publicId: data.publicId,
        source: data.source,
        fallbackUrl: data.fallbackUrl,
        accountId: data.accountId,
      };
    } catch (err: any) {
      if (!options?.silent) toast.error('Upload failed: ' + (err.message || 'Unknown error'));
      throw err;
    } finally {
      setUploading(false);
    }
  };

  const uploadFromUrl = async (remoteUrl: string, options?: { fileName?: string; fileType?: string }) => {
    setUploading(true);
    try {
      return await invokeUpload({
        action: 'fetch-url',
        remote_url: remoteUrl,
        file_name: options?.fileName,
        file_type: options?.fileType,
      });
    } catch (err: any) {
      toast.error('Remote image import failed: ' + (err.message || 'Unknown error'));
      throw err;
    } finally {
      setUploading(false);
    }
  };

  return { upload, uploadFromUrl, uploading, isConfigured: true };
}
