import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PROVIDER_ENDPOINTS: Record<string, string> = {
  lovable: "https://ai.gateway.lovable.dev/v1/chat/completions",
  openai: "https://api.openai.com/v1/chat/completions",
  groq: "https://api.groq.com/openai/v1/chat/completions",
  mistral: "https://api.mistral.ai/v1/chat/completions",
  gemini: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
};

const DEFAULT_MODELS: Record<string, string> = {
  lovable: "google/gemini-3-flash-preview",
  openai: "gpt-4o-mini",
  groq: "llama-3.3-70b-versatile",
  mistral: "mistral-small-latest",
  gemini: "gemini-2.5-flash",
};

async function getNextApiKey(
  sb: any,
  provider: string
): Promise<{ id: string; api_key: string } | null> {
  const { data } = await sb
    .from("ai_api_keys")
    .select("id, api_key")
    .eq("provider", provider)
    .eq("is_active", true)
    .order("last_used_at", { ascending: true, nullsFirst: true })
    .limit(1);
  return data?.[0] || null;
}

async function markKeyUsed(sb: any, keyId: string) {
  await sb
    .from("ai_api_keys")
    .update({ last_used_at: new Date().toISOString(), usage_count: sb.rpc ? undefined : 0 })
    .eq("id", keyId);
  // Increment usage_count via raw update
  await sb.rpc("increment_usage_count_noop").catch(() => {});
  // Simple increment
  const { data: row } = await sb.from("ai_api_keys").select("usage_count").eq("id", keyId).single();
  if (row) {
    await sb.from("ai_api_keys").update({ usage_count: (row.usage_count || 0) + 1, last_used_at: new Date().toISOString() }).eq("id", keyId);
  }
}

async function markKeyError(sb: any, keyId: string, error: string) {
  const { data: row } = await sb.from("ai_api_keys").select("error_count").eq("id", keyId).single();
  await sb.from("ai_api_keys").update({
    last_error: error,
    error_count: (row?.error_count || 0) + 1,
    last_used_at: new Date().toISOString(),
  }).eq("id", keyId);
}

async function tryProviderCall(
  sb: any,
  provider: string,
  endpoint: string,
  modelName: string,
  body: any,
  maxRetries: number = 3
): Promise<{ response: Response; keyId: string | null; apiKey: string }> {
  // For lovable provider, use env key directly
  if (provider === "lovable") {
    const apiKey = Deno.env.get("LOVABLE_API_KEY") || "";
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");
    const resp = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, model: modelName }),
    });
    return { response: resp, keyId: null, apiKey };
  }

  // Rolling key system for other providers
  const triedKeys = new Set<string>();
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const key = await getNextApiKey(sb, provider);
    if (!key || triedKeys.has(key.id)) {
      // Try config api_key as fallback
      break;
    }
    triedKeys.add(key.id);

    const resp = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${key.api_key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, model: modelName }),
    });

    if (resp.ok) {
      await markKeyUsed(sb, key.id);
      return { response: resp, keyId: key.id, apiKey: key.api_key };
    }

    if (resp.status === 429 || resp.status === 402 || resp.status >= 500) {
      await markKeyError(sb, key.id, `HTTP ${resp.status}`);
      await resp.text(); // consume body
      continue;
    }

    // Other errors - return as-is
    return { response: resp, keyId: key.id, apiKey: key.api_key };
  }

  throw new Error(`All API keys exhausted for provider: ${provider}`);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startTime = Date.now();

  try {
    const { messages, user_id, session_id } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    // Fetch AI config
    const { data: config } = await sb
      .from("ai_chatbot_config")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!config) {
      return new Response(JSON.stringify({ error: "AI Tutor is not configured. Contact admin." }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const provider = config.provider || "lovable";
    const modelName = config.model_name || DEFAULT_MODELS[provider] || DEFAULT_MODELS.lovable;
    const maxTokens = config.max_tokens || 2048;
    const temperature = parseFloat(config.temperature) || 0.7;
    const knowledgeBase = config.knowledge_base || [];
    const dbContextEnabled = config.db_context_enabled !== false;

    // Build knowledge base context
    let knowledgeContext = "";
    if (Array.isArray(knowledgeBase) && knowledgeBase.length > 0) {
      knowledgeContext = "\n\n## Textile Knowledge Base:\n" +
        knowledgeBase.map((k: any) => `### ${k.topic}\n${k.content}`).join("\n\n");
    }

    // Deep search index context - search user's last message
    let searchContext = "";
    const lastUserMsg = [...messages].reverse().find((m: any) => m.role === "user");
    if (lastUserMsg?.content) {
      try {
        const searchTerms = lastUserMsg.content.replace(/[^\w\s]/g, "").split(/\s+/).filter((w: string) => w.length > 2).slice(0, 8).join(" & ");
        if (searchTerms) {
          const { data: searchResults } = await sb
            .from("ai_search_index")
            .select("entity_type, title, content_summary, keywords, metadata")
            .textSearch("search_vector", searchTerms.replace(/ & /g, " | "), { type: "plain" })
            .limit(5);

          if (searchResults?.length) {
            searchContext = "\n\n## Relevant Platform Content:\n" +
              searchResults.map((r: any) =>
                `- [${r.entity_type.toUpperCase()}] ${r.title}: ${(r.content_summary || "").slice(0, 300)}`
              ).join("\n");
          }
        }
      } catch (e) {
        console.error("Search index error:", e);
      }
    }

    // Database context
    let dbContext = "";
    if (dbContextEnabled && user_id) {
      try {
        const [enrollRes, quizRes, coursesRes, batchRes] = await Promise.all([
          sb.from("enrollments").select("course_id, progress_pct, courses(title, description)").eq("user_id", user_id).limit(10),
          sb.from("quiz_attempts").select("score, quizzes(title, passing_score)").eq("user_id", user_id).order("completed_at", { ascending: false }).limit(5),
          sb.from("courses").select("title, short_description, difficulty_level").eq("is_published", true).limit(20),
          sb.from("batch_students").select("batches(name, start_date, end_date)").eq("user_id", user_id).limit(1),
        ]);

        if (enrollRes.data?.length) {
          dbContext += "\n\n## Student's Enrolled Courses:\n" +
            enrollRes.data.map((e: any) => `- ${e.courses?.title} (Progress: ${e.progress_pct || 0}%)`).join("\n");
        }
        if (quizRes.data?.length) {
          dbContext += "\n\n## Recent Quiz Performance:\n" +
            quizRes.data.map((q: any) => `- ${q.quizzes?.title}: Score ${q.score}/${q.quizzes?.passing_score || 100}`).join("\n");
        }
        if (coursesRes.data?.length) {
          dbContext += "\n\n## Available Courses on Platform:\n" +
            coursesRes.data.map((c: any) => `- ${c.title} (${c.difficulty_level || "All levels"}): ${c.short_description || ""}`).join("\n");
        }
        if (batchRes.data?.length) {
          const batch = (batchRes.data[0] as any).batches;
          if (batch) dbContext += `\n\n## Student's Batch: ${batch.name}`;
        }
      } catch (e) {
        console.error("DB context error:", e);
      }
    }

    const systemPrompt = (config.system_prompt || "You are an AI Tutor.") +
      "\n\n## Additional Capabilities:\n" +
      "- You can perform textile engineering calculations (GSM, yarn count, fabric density, TPI, etc.)\n" +
      "- Show step-by-step mathematical workings with formulas\n" +
      "- Provide structured answers with headings and bullet points\n" +
      "- Reference specific courses, lessons, or resources when available\n" +
      "- For complex calculations, show: Formula → Substitution → Result with units" +
      knowledgeContext + searchContext + dbContext;

    const endpoint = PROVIDER_ENDPOINTS[provider] || PROVIDER_ENDPOINTS.lovable;

    // Save user message to history
    if (user_id && lastUserMsg) {
      const sid = session_id || null;
      sb.from("ai_chat_history").insert({
        session_id: sid,
        user_id,
        role: "user",
        content: lastUserMsg.content,
      }).then(() => {});
    }

    // Try call with rolling keys
    let result: { response: Response; keyId: string | null; apiKey: string };
    try {
      // Check if we have rolling keys, otherwise fall back to config api_key
      const { data: keyCount } = await sb
        .from("ai_api_keys")
        .select("id", { count: "exact" })
        .eq("provider", provider)
        .eq("is_active", true);

      if (provider !== "lovable" && (!keyCount || keyCount.length === 0)) {
        // Fall back to config api_key
        const fallbackKey = config.api_key || "";
        if (!fallbackKey) {
          return new Response(JSON.stringify({ error: `No API keys configured for ${provider}` }), {
            status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const resp = await fetch(endpoint, {
          method: "POST",
          headers: { Authorization: `Bearer ${fallbackKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: modelName,
            messages: [{ role: "system", content: systemPrompt }, ...messages],
            stream: true,
            max_tokens: maxTokens,
            temperature,
          }),
        });
        result = { response: resp, keyId: null, apiKey: fallbackKey };
      } else {
        result = await tryProviderCall(sb, provider, endpoint, modelName, {
          messages: [{ role: "system", content: systemPrompt }, ...messages],
          stream: true,
          max_tokens: maxTokens,
          temperature,
        });
      }
    } catch (e) {
      console.error("Provider call error:", e);
      return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "AI service error" }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { response } = result;

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please contact admin." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error(`${provider} API error:`, response.status, t);
      return new Response(JSON.stringify({ error: `AI service error (${provider}): ${response.status}` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Stream response and capture for history
    const reader = response.body!.getReader();
    let fullResponse = "";
    const stream = new ReadableStream({
      async pull(controller) {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          // Save assistant response to history
          if (user_id && fullResponse) {
            const elapsed = Date.now() - startTime;
            sb.from("ai_chat_history").insert({
              session_id: session_id || null,
              user_id,
              role: "assistant",
              content: fullResponse,
              provider_used: provider,
              model_used: modelName,
              response_time_ms: elapsed,
            }).then(() => {});
          }
          return;
        }
        // Parse chunks to capture content
        const text = new TextDecoder().decode(value);
        for (const line of text.split("\n")) {
          if (!line.startsWith("data: ") || line.includes("[DONE]")) continue;
          try {
            const parsed = JSON.parse(line.slice(6));
            const c = parsed.choices?.[0]?.delta?.content;
            if (c) fullResponse += c;
          } catch {}
        }
        controller.enqueue(value);
      },
    });

    return new Response(stream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ai-tutor error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
