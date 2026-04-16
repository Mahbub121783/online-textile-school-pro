// Meta Conversions API relay.
// Mirrors browser fbq events server-side with hashed user data.
// Uses shared event_id for browser/server deduplication.
import { corsHeaders } from 'jsr:@supabase/functions-js/cors';

const PIXEL_ID = Deno.env.get('META_PIXEL_ID') || '';
const ACCESS_TOKEN = Deno.env.get('META_CAPI_ACCESS_TOKEN') || '';
const GRAPH_URL = `https://graph.facebook.com/v19.0/${PIXEL_ID}/events`;

async function sha256(value: string): Promise<string> {
  const data = new TextEncoder().encode(value.trim().toLowerCase());
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function hashIfPresent(v?: string | null): Promise<string | undefined> {
  if (!v || typeof v !== 'string' || !v.trim()) return undefined;
  return await sha256(v);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  if (!PIXEL_ID || !ACCESS_TOKEN) {
    return new Response(
      JSON.stringify({ error: 'Meta CAPI not configured (missing META_PIXEL_ID or META_CAPI_ACCESS_TOKEN)' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  try {
    const body = await req.json();
    const {
      event_name,
      event_id,
      event_source_url,
      custom_data = {},
      user_data = {},
      test_event_code,
    } = body || {};

    if (!event_name) {
      return new Response(JSON.stringify({ error: 'event_name required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Capture client IP from headers
    const xff = req.headers.get('x-forwarded-for') || '';
    const clientIp = xff.split(',')[0].trim() || req.headers.get('cf-connecting-ip') || undefined;

    const userAgent = user_data.client_user_agent || req.headers.get('user-agent') || undefined;

    // Hash PII per Meta requirements
    const hashedUser: Record<string, any> = {
      em: await hashIfPresent(user_data.email),
      ph: await hashIfPresent(user_data.phone?.replace(/[^\d]/g, '')),
      fn: await hashIfPresent(user_data.firstName),
      ln: await hashIfPresent(user_data.lastName),
      external_id: await hashIfPresent(user_data.externalId),
      fbp: user_data.fbp || undefined,
      fbc: user_data.fbc || undefined,
      client_ip_address: clientIp,
      client_user_agent: userAgent,
    };
    // Strip undefined keys
    Object.keys(hashedUser).forEach((k) => hashedUser[k] === undefined && delete hashedUser[k]);

    const eventPayload: Record<string, any> = {
      event_name,
      event_time: Math.floor(Date.now() / 1000),
      action_source: 'website',
      event_id: event_id || crypto.randomUUID(),
      event_source_url,
      user_data: hashedUser,
      custom_data,
    };

    const fbBody: Record<string, any> = { data: [eventPayload] };
    if (test_event_code) fbBody.test_event_code = test_event_code;

    const fbRes = await fetch(`${GRAPH_URL}?access_token=${encodeURIComponent(ACCESS_TOKEN)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fbBody),
    });

    const fbJson = await fbRes.json().catch(() => ({}));

    if (!fbRes.ok) {
      console.error('Meta CAPI error:', fbJson);
      return new Response(JSON.stringify({ error: fbJson, status: fbRes.status }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, fb: fbJson, event_id: eventPayload.event_id }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('meta-capi exception:', e);
    return new Response(JSON.stringify({ error: e?.message || 'unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
