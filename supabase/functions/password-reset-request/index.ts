import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
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
      // Still return success (no enumeration) but do not send
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Look up user by email — paginate (listUsers returns at most ~1000 per page)
    let userId: string | null = null;
    let userName: string | null = null;
    try {
      for (let page = 1; page <= 20; page++) {
        const { data: list, error: listErr } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
        if (listErr) { console.error('listUsers error', listErr); break; }
        const users = list?.users ?? [];
        const found = users.find((u: any) => (u.email ?? '').toLowerCase() === emailRaw);
        if (found) {
          userId = found.id;
          userName = (found.user_metadata?.full_name as string) || (found.user_metadata?.name as string) || null;
          break;
        }
        if (users.length < 1000) break;
      }
    } catch (e) { console.error('user lookup failed', e); }
    console.log('password-reset-request: lookup', { email: emailRaw, found: !!userId });

    if (userId) {
      // Generate 6-digit code
      const code = String(Math.floor(100000 + Math.random() * 900000));
      const codeHash = await sha256(code);
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      await supabase.from('password_reset_codes').insert({
        user_id: userId,
        email: emailRaw,
        code_hash: codeHash,
        expires_at: expiresAt,
      });

      // Send email via existing SMTP function
      try {
        await supabase.functions.invoke('send-smtp-email', {
          body: {
            templateKey: 'password_reset',
            recipientEmail: emailRaw,
            placeholders: {
              user_name: userName || 'there',
              otp_code: code,
              expires_in: '10 minutes',
            },
          },
        });
      } catch (e) {
        console.error('send-smtp-email failed', e);
      }
    }

    // Always return success to prevent user enumeration
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
