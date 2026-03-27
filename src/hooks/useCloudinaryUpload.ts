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

export function useCloudinaryUpload() {
  const [uploading, setUploading] = useState(false);

  const upload = async (file: File): Promise<UploadResult> => {
    setUploading(true);
    try {
      // Convert file to base64
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);

      const { data, error } = await supabase.functions.invoke('cloudinary-proxy', {
        body: {
          action: 'upload',
          file_base64: base64,
          file_name: file.name,
          file_type: file.type,
        },
      });

      if (error) throw new Error(error.message || 'Upload failed');
      if (data?.error) throw new Error(data.error);

      return {
        url: data.url,
        publicId: data.publicId,
        source: data.source,
        fallbackUrl: data.fallbackUrl,
        accountId: data.accountId,
      };
    } catch (err: any) {
      toast.error('Upload failed: ' + (err.message || 'Unknown error'));
      throw err;
    } finally {
      setUploading(false);
    }
  };

  return { upload, uploading, isConfigured: true };
}
