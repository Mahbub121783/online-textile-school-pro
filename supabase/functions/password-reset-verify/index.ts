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

  const json = (status: number, data: any) =>
    new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const body = await req.json().catch(() => ({}));
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    const code = typeof body?.code === 'string' ? body.code.trim() : '';
    const newPassword = typeof body?.new_password === 'string' ? body.new_password : '';

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json(400, { error: 'Invalid email' });
    }
    if (!/^\d{6}$/.test(code)) {
      return json(400, { error: 'Code must be 6 digits' });
    }
    if (newPassword.length < 6 || newPassword.length > 200) {
      return json(400, { error: 'Password must be at least 6 characters' });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Latest unused code for this email
    const { data: rows } = await supabase
      .from('password_reset_codes')
      .select('*')
      .eq('email', email)
      .is('used_at', null)
      .order('created_at', { ascending: false })
      .limit(1);

    const row = rows?.[0];
    if (!row) return json(400, { error: 'invalid_code', message: 'Invalid or expired code' });

    if (new Date(row.expires_at).getTime() < Date.now()) {
      return json(400, { error: 'expired', message: 'Code has expired. Please request a new one.' });
    }
    if ((row.attempts ?? 0) >= 5) {
      return json(400, { error: 'too_many_attempts', message: 'Too many attempts. Please request a new code.' });
    }

    const codeHash = await sha256(code);
    if (codeHash !== row.code_hash) {
      await supabase.from('password_reset_codes').update({ attempts: (row.attempts ?? 0) + 1 }).eq('id', row.id);
      return json(400, { error: 'invalid_code', message: 'Invalid code' });
    }

    if (!row.user_id) return json(400, { error: 'invalid_code', message: 'Invalid code' });

    // Update password via admin API
    const { error: upErr } = await supabase.auth.admin.updateUserById(row.user_id, { password: newPassword });
    if (upErr) {
      console.error('updateUserById failed', upErr);
      return json(500, { error: 'update_failed', message: upErr.message });
    }

    // Mark this code used; invalidate all other codes for this email
    await supabase.from('password_reset_codes').update({ used_at: new Date().toISOString() }).eq('id', row.id);
    await supabase
      .from('password_reset_codes')
      .update({ used_at: new Date().toISOString() })
      .eq('email', email)
      .is('used_at', null);

    return json(200, { success: true });
  } catch (e: any) {
    console.error('password-reset-verify error', e);
    return json(500, { error: 'server_error', message: e?.message ?? 'Server error' });
  }
});
