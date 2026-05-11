// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PROVIDER_CONFIG: Record<string, { url: string; envKey: string; label: string }> = {
  groq: { url: 'https://api.groq.com/openai/v1/chat/completions', envKey: 'GROQ_API_KEY', label: 'Groq' },
  mistral: { url: 'https://api.mistral.ai/v1/chat/completions', envKey: 'MISTRAL_API_KEY', label: 'Mistral' },
  openrouter: { url: 'https://openrouter.ai/api/v1/chat/completions', envKey: 'OPENROUTER_API_KEY', label: 'OpenRouter' },
  openai: { url: 'https://api.openai.com/v1/chat/completions', envKey: 'OPENAI_API_KEY', label: 'OpenAI' },
  lovable: { url: 'https://ai.gateway.lovable.dev/v1/chat/completions', envKey: 'LOVABLE_API_KEY', label: 'Lovable AI' },
};

const QUESTION_TOOL = {
  type: 'function',
  function: {
    name: 'submit_questions',
    description: 'Submit a list of generated quiz questions',
    parameters: {
      type: 'object',
      properties: {
        questions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              question_text: { type: 'string' },
              options: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 6 },
              correct_answer: { type: 'string', description: 'Must exactly match one item from options' },
              explanation: { type: 'string' },
            },
            required: ['question_text', 'options', 'correct_answer', 'explanation'],
            additionalProperties: false,
          },
        },
      },
      required: ['questions'],
      additionalProperties: false,
    },
  },
};

function buildPrompt(opts: { subjectName: string; topic?: string; difficulty: string; count: number; language: string; customPrompt?: string }) {
  const langLabel = opts.language === 'bn' ? 'Bengali (Bangla)' : 'English';
  const base = opts.customPrompt?.trim() || `You are an expert exam question writer for the subject "${opts.subjectName}".
Generate ${opts.count} ${opts.difficulty}-level multiple-choice questions in ${langLabel}.
Rules:
- Each question MUST have exactly 4 options.
- correct_answer MUST exactly match one of the options (case-sensitive).
- Provide a short factual explanation (1-2 sentences).
- Avoid duplicates and trivia. Focus on conceptual understanding.
- ${opts.topic ? `Focus topic: ${opts.topic}.` : 'Cover varied topics within the subject.'}
- Difficulty rubric: basic = recall, intermediate = applied, advanced = analytical/multi-step.`;
  return base;
}

async function callProvider(provider: string, model: string, prompt: string, temperature: number) {
  const cfg = PROVIDER_CONFIG[provider];
  if (!cfg) throw new Error(`Unknown provider: ${provider}`);
  const apiKey = Deno.env.get(cfg.envKey);
  if (!apiKey) throw new Error(`${cfg.label} API key (${cfg.envKey}) is not configured in Supabase secrets`);

  const body: any = {
    model,
    messages: [
      { role: 'system', content: 'You generate high-quality multiple-choice exam questions. Always call the submit_questions tool.' },
      { role: 'user', content: prompt },
    ],
    temperature,
    tools: [QUESTION_TOOL],
    tool_choice: { type: 'function', function: { name: 'submit_questions' } },
  };

  const res = await fetch(cfg.url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...(provider === 'openrouter' ? { 'HTTP-Referer': 'https://lovable.dev', 'X-Title': 'OTS Question Bank' } : {}),
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`${cfg.label} ${res.status}: ${text.slice(0, 400)}`);
  let data: any;
  try { data = JSON.parse(text); } catch { throw new Error(`${cfg.label} returned invalid JSON`); }

  const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
  let parsed: any;
  if (toolCall?.function?.arguments) {
    try { parsed = JSON.parse(toolCall.function.arguments); }
    catch { throw new Error(`${cfg.label} tool args parse failed`); }
  } else {
    // Fallback: try parsing message content
    const content = data?.choices?.[0]?.message?.content;
    if (!content) throw new Error(`${cfg.label} returned no tool call or content`);
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error(`${cfg.label} returned no parseable JSON`);
    parsed = JSON.parse(jsonMatch[0]);
  }

  const questions = parsed?.questions;
  if (!Array.isArray(questions) || questions.length === 0) throw new Error(`${cfg.label} returned no questions`);
  return questions;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claims, error: authErr } = await supabase.auth.getClaims(token);
    if (authErr || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const uid = claims.claims.sub;

    const { data: isStaff } = await supabase.rpc('qb_is_staff', { _uid: uid });
    if (!isStaff) {
      return new Response(JSON.stringify({ error: 'Forbidden: admin/instructor only' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const body = await req.json().catch(() => ({}));
    const subject_id: string = body.subject_id;
    const topic: string | undefined = body.topic;
    const difficulty: string = body.difficulty || 'basic';
    const language: string = body.language || 'en';
    let count: number = Math.max(1, Math.min(50, Number(body.count) || 10));
    const test: boolean = !!body.test;
    if (test) count = 1;

    if (!subject_id) {
      return new Response(JSON.stringify({ error: 'subject_id is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (!['basic', 'intermediate', 'advanced'].includes(difficulty)) {
      return new Response(JSON.stringify({ error: 'invalid difficulty' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Load subject + settings
    const [{ data: subject }, { data: settings }] = await Promise.all([
      supabase.from('qb_subjects').select('id,name').eq('id', subject_id).single(),
      supabase.from('qb_ai_settings').select('*').limit(1).maybeSingle(),
    ]);
    if (!subject) {
      return new Response(JSON.stringify({ error: 'Subject not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const cfg = settings ?? { provider: 'groq', model: 'llama-3.3-70b-versatile', temperature: 0.7, fallback_enabled: true, fallback_provider: 'lovable', fallback_model: 'google/gemini-2.5-flash', system_prompt_override: null };
    if (count > (cfg.max_questions_per_run ?? 25)) count = cfg.max_questions_per_run ?? 25;

    const prompt = buildPrompt({
      subjectName: subject.name,
      topic,
      difficulty,
      count,
      language,
      customPrompt: cfg.system_prompt_override,
    });

    let questions: any[] | undefined;
    let usedProvider = cfg.provider;
    let primaryError: string | null = null;

    try {
      questions = await callProvider(cfg.provider, cfg.model, prompt, Number(cfg.temperature) || 0.7);
    } catch (e: any) {
      primaryError = e?.message || String(e);
      console.error(`[qb-ai-generate] primary (${cfg.provider}) failed:`, primaryError);
      if (cfg.fallback_enabled && cfg.fallback_provider && cfg.fallback_provider !== cfg.provider) {
        try {
          questions = await callProvider(cfg.fallback_provider, cfg.fallback_model, prompt, Number(cfg.temperature) || 0.7);
          usedProvider = cfg.fallback_provider;
        } catch (e2: any) {
          return new Response(JSON.stringify({
            error: `Both providers failed. Primary (${cfg.provider}): ${primaryError}. Fallback (${cfg.fallback_provider}): ${e2.message}`,
          }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      } else {
        return new Response(JSON.stringify({ error: primaryError }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // Sanitize: ensure correct_answer is in options
    const clean = (questions || [])
      .filter((q: any) => q?.question_text && Array.isArray(q.options) && q.options.length >= 2 && q.correct_answer)
      .map((q: any) => ({
        question_text: String(q.question_text).trim(),
        options: q.options.map((o: any) => String(o).trim()),
        correct_answer: String(q.correct_answer).trim(),
        explanation: String(q.explanation || '').trim(),
      }))
      .filter((q: any) => q.options.includes(q.correct_answer));

    return new Response(JSON.stringify({
      questions: clean,
      provider_used: usedProvider,
      fallback_used: usedProvider !== cfg.provider,
      primary_error: primaryError,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    console.error('[qb-ai-generate] error', e);
    return new Response(JSON.stringify({ error: e?.message || 'Internal error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
