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
    const token = typeof body?.token === 'string' ? body.token.trim() : '';
    const newPassword = typeof body?.new_password === 'string' ? body.new_password : '';

    if (newPassword.length < 6 || newPassword.length > 200) {
      return json(400, { error: 'weak_password', message: 'Password must be at least 6 characters' });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    let row: any = null;

    if (token) {
      // Magic link path
      const { data } = await supabase
        .from('password_reset_codes')
        .select('*')
        .eq('link_token', token)
        .is('used_at', null)
        .limit(1);
      row = data?.[0] || null;
      if (!row) return json(400, { error: 'invalid_token', message: 'This reset link is invalid or already used.' });
    } else {
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return json(400, { error: 'invalid_email', message: 'Invalid email' });
      }
      if (!/^\d{6}$/.test(code)) {
        return json(400, { error: 'invalid_code', message: 'Code must be 6 digits' });
      }

      const { data } = await supabase
        .from('password_reset_codes')
        .select('*')
        .eq('email', email)
        .is('used_at', null)
        .order('created_at', { ascending: false })
        .limit(1);
      row = data?.[0] || null;
      if (!row) return json(400, { error: 'invalid_code', message: 'Invalid or expired code' });
    }

    if (row.locked_at) {
      return json(400, { error: 'too_many_attempts', message: 'Too many attempts. Please request a new code.' });
    }
    if (new Date(row.expires_at).getTime() < Date.now()) {
      return json(400, { error: 'expired', message: 'Code has expired. Please request a new one.' });
    }
    if ((row.attempts ?? 0) >= 5) {
      await supabase.from('password_reset_codes').update({ locked_at: new Date().toISOString() }).eq('id', row.id);
      return json(400, { error: 'too_many_attempts', message: 'Too many attempts. Please request a new code.' });
    }

    // For code path, verify the hash
    if (!token) {
      const codeHash = await sha256(code);
      if (codeHash !== row.code_hash) {
        const nextAttempts = (row.attempts ?? 0) + 1;
        const updates: any = { attempts: nextAttempts };
        if (nextAttempts >= 5) updates.locked_at = new Date().toISOString();
        await supabase.from('password_reset_codes').update(updates).eq('id', row.id);
        if (nextAttempts >= 5) {
          return json(400, { error: 'too_many_attempts', message: 'Too many attempts. Please request a new code.' });
        }
        return json(400, { error: 'invalid_code', message: `Invalid code. ${5 - nextAttempts} attempts left.` });
      }
    }

    if (!row.user_id) return json(400, { error: 'invalid_code', message: 'Invalid code' });

    const { error: upErr } = await supabase.auth.admin.updateUserById(row.user_id, { password: newPassword });
    if (upErr) {
      console.error('updateUserById failed', upErr);
      return json(500, { error: 'update_failed', message: upErr.message });
    }

    await supabase.from('password_reset_codes').update({ used_at: new Date().toISOString() }).eq('id', row.id);
    await supabase
      .from('password_reset_codes')
      .update({ used_at: new Date().toISOString() })
      .eq('email', row.email)
      .is('used_at', null);

    return json(200, { success: true });
  } catch (e: any) {
    console.error('password-reset-verify error', e);
    return json(500, { error: 'server_error', message: e?.message ?? 'Server error' });
  }
});
