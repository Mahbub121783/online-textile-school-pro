import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "No authorization header" }, 401);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();
    if (userError || !user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const body = await req.json();
    const { action, ebook_id, token } = body;

    const admin = createClient(supabaseUrl, serviceKey);

    if (action === "generate_token") {
      if (!ebook_id) return jsonResponse({ error: "ebook_id required" }, 400);

      // Verify purchase
      const { data: purchase } = await admin
        .from("order_items")
        .select("id, orders!inner(user_id, status)")
        .eq("item_type", "ebook")
        .eq("item_id", ebook_id)
        .eq("orders.user_id", user.id)
        .eq("orders.status", "completed")
        .limit(1)
        .maybeSingle();

      if (!purchase) {
        return jsonResponse({ error: "You have not purchased this ebook" }, 403);
      }

      // Generate short-lived token
      const tokenValue = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      const { error: insertErr } = await admin
        .from("ebook_access_tokens")
        .insert({
          ebook_id,
          user_id: user.id,
          token: tokenValue,
          expires_at: expiresAt,
          used: false,
        });

      if (insertErr) {
        return jsonResponse({ error: "Failed to generate token" }, 500);
      }

      // Increment download count
      await admin.rpc("increment_ebook_download", { _ebook_id: ebook_id });

      return jsonResponse({ token: tokenValue, expires_at: expiresAt });
    }

    if (action === "stream_file") {
      if (!ebook_id || !token) {
        return jsonResponse({ error: "ebook_id and token required" }, 400);
      }

      // Validate token
      const { data: tokenRow } = await admin
        .from("ebook_access_tokens")
        .select("*")
        .eq("ebook_id", ebook_id)
        .eq("user_id", user.id)
        .eq("token", token)
        .eq("used", false)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();

      if (!tokenRow) {
        return jsonResponse({ error: "Invalid or expired token" }, 403);
      }

      // Mark token as used
      await admin
        .from("ebook_access_tokens")
        .update({ used: true })
        .eq("id", tokenRow.id);

      // Get ebook file URL
      const { data: ebook } = await admin
        .from("ebooks")
        .select("file_url, title")
        .eq("id", ebook_id)
        .single();

      if (!ebook?.file_url) {
        return jsonResponse({ error: "Ebook file not found" }, 404);
      }

      // Fetch the file from storage (Cloudflare R2 or wherever it is)
      const fileResponse = await fetch(ebook.file_url, {
        headers: {
          Range: req.headers.get("Range") || "",
        },
      });

      if (!fileResponse.ok && fileResponse.status !== 206) {
        return jsonResponse({ error: "Failed to fetch ebook file" }, 502);
      }

      const fileBody = fileResponse.body;
      const contentType =
        fileResponse.headers.get("Content-Type") || "application/pdf";
      const contentLength = fileResponse.headers.get("Content-Length");

      const responseHeaders: Record<string, string> = {
        ...corsHeaders,
        "Content-Type": contentType,
        "X-Ebook-Title": encodeURIComponent(ebook.title || "eBook"),
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": "inline",
        "Access-Control-Expose-Headers": "X-Ebook-Title, Content-Length",
      };

      if (contentLength) {
        responseHeaders["Content-Length"] = contentLength;
      }

      return new Response(fileBody, {
        status: fileResponse.status === 206 ? 206 : 200,
        headers: responseHeaders,
      });
    }

    return jsonResponse({ error: "Invalid action" }, 400);
  } catch (err) {
    console.error("ebook-secure-access error:", err);
    return jsonResponse(
      { error: err instanceof Error ? err.message : "Internal error" },
      500
    );
  }
});

function jsonResponse(data: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}
