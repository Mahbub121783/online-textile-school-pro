import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" } });
  try {
    const { sql } = await req.json();
    if (!sql || typeof sql !== "string") return new Response(JSON.stringify({ error: "missing sql" }), { status: 400 });
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    // Use PostgREST is not arbitrary SQL; instead use rpc via the Postgres REST? Use the supabase-js's `from(...)` not for arbitrary SQL.
    // Workaround: call the pg-meta /query endpoint via fetch.
    const resp = await fetch(`${Deno.env.get("SUPABASE_URL")}/rest/v1/rpc/exec_sql`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!}` },
      body: JSON.stringify({ q: sql }),
    });
    // Fallback: try direct insert via parsing not feasible. Just return error guidance.
    return new Response(JSON.stringify({ ok: resp.ok, status: resp.status, body: await resp.text() }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
