import { supabase } from '@/integrations/supabase/client';

export async function sendTemplateEmail(
  templateKey: string,
  recipientEmail: string,
  placeholders?: Record<string, string>,
  metadata?: Record<string, any>
) {
  const { data, error } = await supabase.functions.invoke('send-smtp-email', {
    body: { templateKey, recipientEmail, placeholders, metadata },
  });
  if (error) throw error;
  return data;
}

export async function sendCustomEmail(
  recipientEmail: string,
  subject: string,
  body: string,
  metadata?: Record<string, any>
) {
  const { data, error } = await supabase.functions.invoke('send-smtp-email', {
    body: { recipientEmail, subject, body, metadata },
  });
  if (error) throw error;
  return data;
}
