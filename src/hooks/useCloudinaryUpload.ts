import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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

  const fileToBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      resolve(result.split(',')[1] || '');
    };
    reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });

  const upload = async (file: File, options?: UploadOptions): Promise<UploadResult> => {
    setUploading(true);
    try {
      const base64 = await fileToBase64(file);
      return await invokeUpload({
        action: 'upload',
        file_base64: base64,
        file_name: file.name,
        file_type: file.type,
        public_id: options?.publicId,
        folder: options?.folder,
        overwrite: options?.overwrite,
      });
    } catch (err: any) {
      toast.error('Upload failed: ' + (err.message || 'Unknown error'));
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
