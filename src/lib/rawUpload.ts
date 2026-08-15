import { supabase } from '@/integrations/supabase/client';

export async function getUploadAuthHeader(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
}

export function apiBase(): string {
  return import.meta.env.VITE_SUPABASE_URL || 'https://api.onlinetextileschool.com';
}

/**
 * Raw-binary upload via XMLHttpRequest. Unlike fetch (which supabase-js's
 * functions.invoke() uses internally), XHR exposes real upload.onprogress
 * events, so the percentage shown to the user reflects actual bytes sent
 * over the wire instead of jumping straight from "started" to "done".
 */
export function xhrUpload(
  url: string,
  body: Blob,
  headers: Record<string, string>,
  onProgress?: (pct: number) => void
): Promise<any> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };
    }
    xhr.onload = () => {
      let data: any = null;
      try { data = JSON.parse(xhr.responseText); } catch { /* non-JSON response */ }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data);
      else reject(new Error(data?.error || `Upload failed (HTTP ${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.send(body);
  });
}
