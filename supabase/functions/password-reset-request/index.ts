import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function randomToken(len = 48): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const emailRaw = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (!emailRaw || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw) || emailRaw.length > 255) {
      return new Response(JSON.stringify({ error: 'Invalid email' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Rate limit: max 3 codes per 15 min per email
    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from('password_reset_codes')
      .select('id', { count: 'exact', head: true })
      .eq('email', emailRaw)
      .gte('created_at', fifteenMinAgo);
    if ((count ?? 0) >= 3) {
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Reliable lookup via SECURITY DEFINER RPC (no pagination, indexed)
    let userId: string | null = null;
    let userName: string | null = null;
    try {
      const { data: lookup, error: lookupErr } = await supabase
        .rpc('find_auth_user_by_email', { _email: emailRaw });
      if (lookupErr) console.error('find_auth_user_by_email error', lookupErr);
      const row = Array.isArray(lookup) ? lookup[0] : null;
      if (row?.user_id) {
        userId = row.user_id as string;
        userName = (row.full_name as string) || null;
      }
    } catch (e) {
      console.error('rpc lookup failed', e);
    }
    console.log('password-reset-request: lookup', { email: emailRaw, found: !!userId });

    if (userId) {
      const code = String(Math.floor(100000 + Math.random() * 900000));
      const codeHash = await sha256(code);
      const linkToken = randomToken(48);
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

      const { error: insErr } = await supabase.from('password_reset_codes').insert({
        user_id: userId,
        email: emailRaw,
        code_hash: codeHash,
        link_token: linkToken,
        expires_at: expiresAt,
      });
      if (insErr) console.error('insert code failed', insErr);

      const siteUrl = (Deno.env.get('SITE_URL') || '').replace(/\/+$/, '') || '';
      const resetLink = `${siteUrl}/reset-password?token=${encodeURIComponent(linkToken)}&email=${encodeURIComponent(emailRaw)}`;

      try {
        const { data: smtpData, error: smtpErr } = await supabase.functions.invoke('send-smtp-email', {
          body: {
            templateKey: 'password_reset',
            recipientEmail: emailRaw,
            placeholders: {
              user_name: userName || 'there',
              otp_code: code,
              reset_link: resetLink,
              expires_in: '15 minutes',
            },
          },
        });
        console.log('password-reset-request: smtp', { ok: !smtpErr, err: smtpErr?.message, data: smtpData });
      } catch (e) {
        console.error('send-smtp-email failed', e);
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('password-reset-request error', e);
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
