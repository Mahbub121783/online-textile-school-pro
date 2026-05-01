// Workshop reminder cron — sends "join now" emails to all registered students
// of any workshop starting in the next ~35 minutes that hasn't been reminded yet.
// Also supports manual invocation: POST { workshop_id: "..." } from admin.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function fmtDhakaDateTime(startAtIso: string, endTimeStr: string | null): string {
  const d = new Date(startAtIso);
  const dateStr = d.toLocaleString('en-US', {
    timeZone: 'Asia/Dhaka', year: 'numeric', month: 'long', day: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
  return endTimeStr ? `${dateStr} (ends ${String(endTimeStr).slice(0, 5)})` : dateStr;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  let forcedWorkshopId: string | null = null;
  if (req.method === 'POST') {
    try {
      const body = await req.json();
      if (body?.workshop_id && typeof body.workshop_id === 'string') {
        forcedWorkshopId = body.workshop_id;
      }
    } catch { /* cron call with no body */ }
  }

  let q = supabase
    .from('workshops')
    .select('id, title, slug, start_at, end_at, end_time, meet_link, reminder_sent_at, status')
    .not('meet_link', 'is', null);

  if (forcedWorkshopId) {
    q = q.eq('id', forcedWorkshopId);
  } else {
    // Catch any workshop starting within the next 40 minutes that hasn't been
    // reminded yet. Window is wider than 30 to absorb cron jitter.
    const now = new Date();
    const in40min = new Date(now.getTime() + 40 * 60 * 1000);
    q = q
      .gte('start_at', now.toISOString())
      .lte('start_at', in40min.toISOString())
      .is('reminder_sent_at', null)
      .in('status', ['published', 'ongoing']);
  }

  const { data: workshops, error: wsErr } = await q;
  if (wsErr) {
    return new Response(JSON.stringify({ error: wsErr.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const results: any[] = [];

  for (const ws of workshops || []) {
    if (!ws.meet_link || !ws.start_at) continue;

    const { data: regs } = await supabase
      .from('workshop_registrations')
      .select('email, full_name, user_id')
      .eq('workshop_id', ws.id)
      .eq('status', 'registered');

    const startTime = fmtDhakaDateTime(ws.start_at, ws.end_time as any);
    let sent = 0;
    let failed = 0;

    await Promise.all((regs || []).map(async (r: any) => {
      if (!r.email) return;
      try {
        const { error } = await supabase.functions.invoke('send-smtp-email', {
          body: {
            templateKey: 'workshop_live_link',
            recipientEmail: r.email,
            placeholders: {
              user_name: r.full_name || 'Student',
              workshop_title: ws.title,
              start_time: startTime,
              meet_link: ws.meet_link,
            },
          },
        });
        if (error) failed++; else sent++;
      } catch {
        failed++;
      }
    }));

    await supabase
      .from('workshops')
      .update({ reminder_sent_at: new Date().toISOString() })
      .eq('id', ws.id);

    // In-app notifications
    try {
      const rows = (regs || [])
        .filter((u: any) => u.user_id)
        .map((u: any) => ({
          user_id: u.user_id,
          type: 'workshop',
          title: `Workshop starting soon: ${ws.title}`,
          message: `Join the live session at ${startTime}. Tap to open the Meet link.`,
          link: ws.meet_link,
        }));
      if (rows.length) await supabase.from('notifications').insert(rows);
    } catch { /* non-critical */ }

    results.push({ workshop_id: ws.id, title: ws.title, total: regs?.length || 0, sent, failed });
  }

  return new Response(JSON.stringify({ ok: true, processed: results.length, results }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
