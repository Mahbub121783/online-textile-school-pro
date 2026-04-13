import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Provider endpoints
const PROVIDER_ENDPOINTS: Record<string, string> = {
  lovable: "https://ai.gateway.lovable.dev/v1/chat/completions",
  openai: "https://api.openai.com/v1/chat/completions",
  groq: "https://api.groq.com/openai/v1/chat/completions",
  mistral: "https://api.mistral.ai/v1/chat/completions",
  gemini: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
};

// Default models per provider
const DEFAULT_MODELS: Record<string, string> = {
  lovable: "google/gemini-3-flash-preview",
  openai: "gpt-4o-mini",
  groq: "llama-3.3-70b-versatile",
  mistral: "mistral-small-latest",
  gemini: "gemini-2.5-flash",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, user_id } = await req.json();
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Fetch AI config from database
    const { data: config } = await supabase
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

    // Determine API key
    let apiKey: string;
    if (provider === "lovable") {
      apiKey = Deno.env.get("LOVABLE_API_KEY") || "";
    } else {
      apiKey = config.api_key || "";
    }

    if (!apiKey) {
      return new Response(JSON.stringify({ error: `API key not configured for provider: ${provider}` }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build context from knowledge base
    let knowledgeContext = "";
    if (Array.isArray(knowledgeBase) && knowledgeBase.length > 0) {
      knowledgeContext = "\n\n## Textile Knowledge Base:\n" +
        knowledgeBase.map((k: any) => `### ${k.topic}\n${k.content}`).join("\n\n");
    }

    // Build database context if enabled
    let dbContext = "";
    if (dbContextEnabled && user_id) {
      try {
        // Fetch student's enrolled courses
        const { data: enrollments } = await supabase
          .from("enrollments")
          .select("course_id, progress_pct, courses(title, description)")
          .eq("user_id", user_id)
          .limit(10);

        // Fetch recent quiz attempts
        const { data: quizAttempts } = await supabase
          .from("quiz_attempts")
          .select("score, quizzes(title, passing_score)")
          .eq("user_id", user_id)
          .order("completed_at", { ascending: false })
          .limit(5);

        // Fetch available courses for recommendations
        const { data: availableCourses } = await supabase
          .from("courses")
          .select("title, short_description, difficulty_level")
          .eq("is_published", true)
          .limit(20);

        // Fetch batch info
        const { data: batchInfo } = await supabase
          .from("batch_students")
          .select("batches(name, start_date, end_date)")
          .eq("user_id", user_id)
          .limit(1);

        if (enrollments?.length) {
          dbContext += "\n\n## Student's Enrolled Courses:\n" +
            enrollments.map((e: any) => `- ${e.courses?.title} (Progress: ${e.progress_pct || 0}%)`).join("\n");
        }

        if (quizAttempts?.length) {
          dbContext += "\n\n## Recent Quiz Performance:\n" +
            quizAttempts.map((q: any) => `- ${q.quizzes?.title}: Score ${q.score}/${q.quizzes?.passing_score || 100}`).join("\n");
        }

        if (availableCourses?.length) {
          dbContext += "\n\n## Available Courses on Platform:\n" +
            availableCourses.map((c: any) => `- ${c.title} (${c.difficulty_level || 'All levels'}): ${c.short_description || ''}`).join("\n");
        }

        if (batchInfo?.length) {
          const batch = (batchInfo[0] as any).batches;
          if (batch) dbContext += `\n\n## Student's Batch: ${batch.name}`;
        }
      } catch (e) {
        console.error("DB context error:", e);
      }
    }

    const systemPrompt = (config.system_prompt || "You are an AI Tutor.") + knowledgeContext + dbContext;

    // Get endpoint
    const endpoint = PROVIDER_ENDPOINTS[provider] || PROVIDER_ENDPOINTS.lovable;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
        max_tokens: maxTokens,
        temperature: temperature,
      }),
    });

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

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ai-tutor error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
