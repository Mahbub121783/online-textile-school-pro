// Ported from supabase/functions/qb-ai-generate/index.ts (Deno -> Node).
// Deviates from the original in one deliberate way: the original read each
// provider's key from a separate Supabase secret env var (GROQ_API_KEY,
// MISTRAL_API_KEY, etc). Since the admin wants ALL AI provider keys managed
// in one place, this now pulls from the same ai_api_keys table ai-tutor
// uses (Admin -> AI Chatbot -> API Keys) instead of requiring separate
// backend/.env entries per provider -- one panel configures both features.
// Also adds Gemini (missing from the original PROVIDER_CONFIG even though
// the admin key-management UI already offers it as an option).
const fetch = require('node-fetch');
const jwt = require('jsonwebtoken');
const { serviceQuery } = require('../db');

const PROVIDER_CONFIG = {
  groq: { url: 'https://api.groq.com/openai/v1/chat/completions', label: 'Groq' },
  mistral: { url: 'https://api.mistral.ai/v1/chat/completions', label: 'Mistral' },
  openrouter: { url: 'https://openrouter.ai/api/v1/chat/completions', label: 'OpenRouter' },
  openai: { url: 'https://api.openai.com/v1/chat/completions', label: 'OpenAI' },
  gemini: { url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', label: 'Google Gemini' },
  lovable: { url: 'https://ai.gateway.lovable.dev/v1/chat/completions', label: 'Lovable AI' },
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

function buildPrompt(opts) {
  const langLabel = opts.language === 'bn' ? 'Bengali (Bangla)' : 'English';
  return opts.customPrompt?.trim() || `You are an expert exam question writer for the subject "${opts.subjectName}".
Generate ${opts.count} ${opts.difficulty}-level multiple-choice questions in ${langLabel}.
Rules:
- Each question MUST have exactly 4 options.
- correct_answer MUST exactly match one of the options (case-sensitive).
- Provide a short factual explanation (1-2 sentences).
- Avoid duplicates and trivia. Focus on conceptual understanding.
- ${opts.topic ? `Focus topic: ${opts.topic}.` : 'Cover varied topics within the subject.'}
- Difficulty rubric: basic = recall, intermediate = applied, advanced = analytical/multi-step.`;
}

async function getApiKeyForProvider(provider) {
  if (provider === 'lovable') return process.env.LOVABLE_API_KEY || null;
  const r = await serviceQuery(
    `SELECT api_key FROM public.ai_api_keys WHERE provider = $1 AND is_active = true ORDER BY usage_count ASC NULLS FIRST LIMIT 1`,
    [provider]
  );
  return r.rows[0]?.api_key || null;
}

async function callProvider(provider, model, prompt, temperature) {
  const cfg = PROVIDER_CONFIG[provider];
  if (!cfg) throw new Error(`Unknown provider: ${provider}`);
  const apiKey = await getApiKeyForProvider(provider);
  if (!apiKey) throw new Error(`No active ${cfg.label} API key -- add one in Admin → AI Chatbot → API Keys`);

  const body = {
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
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...(provider === 'openrouter' ? { 'HTTP-Referer': 'https://www.onlinetextileschool.com', 'X-Title': 'OTS Question Bank' } : {}),
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`${cfg.label} ${res.status}: ${text.slice(0, 400)}`);
  let data;
  try { data = JSON.parse(text); } catch { throw new Error(`${cfg.label} returned invalid JSON`); }

  const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
  let parsed;
  if (toolCall?.function?.arguments) {
    try { parsed = JSON.parse(toolCall.function.arguments); }
    catch { throw new Error(`${cfg.label} tool args parse failed`); }
  } else {
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

async function qbAiGenerate(req, res) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    let uid;
    try {
      uid = jwt.verify(token, process.env.JWT_SECRET).sub;
    } catch {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const staffRes = await serviceQuery('SELECT public.qb_is_staff($1) AS is_staff', [uid]);
    if (!staffRes.rows[0]?.is_staff) {
      return res.status(403).json({ error: 'Forbidden: admin/instructor only' });
    }

    const body = req.body || {};
    const subject_id = body.subject_id;
    const topic = body.topic;
    const difficulty = body.difficulty || 'basic';
    const language = body.language || 'en';
    let count = Math.max(1, Math.min(50, Number(body.count) || 10));
    if (body.test) count = 1;

    if (!subject_id) return res.status(400).json({ error: 'subject_id is required' });
    if (!['basic', 'intermediate', 'advanced'].includes(difficulty)) {
      return res.status(400).json({ error: 'invalid difficulty' });
    }

    const [subjectRes, settingsRes] = await Promise.all([
      serviceQuery('SELECT id, name FROM public.qb_subjects WHERE id = $1', [subject_id]),
      serviceQuery('SELECT * FROM public.qb_ai_settings LIMIT 1'),
    ]);
    const subject = subjectRes.rows[0];
    if (!subject) return res.status(404).json({ error: 'Subject not found' });

    const cfg = settingsRes.rows[0] || { provider: 'groq', model: 'llama-3.3-70b-versatile', temperature: 0.7, fallback_enabled: true, fallback_provider: 'lovable', fallback_model: 'google/gemini-2.5-flash', system_prompt_override: null };
    if (count > (cfg.max_questions_per_run ?? 25)) count = cfg.max_questions_per_run ?? 25;

    const prompt = buildPrompt({ subjectName: subject.name, topic, difficulty, count, language, customPrompt: cfg.system_prompt_override });

    let questions;
    let usedProvider = cfg.provider;
    let primaryError = null;

    try {
      questions = await callProvider(cfg.provider, cfg.model, prompt, Number(cfg.temperature) || 0.7);
    } catch (e) {
      primaryError = e.message || String(e);
      console.error(`[qb-ai-generate] primary (${cfg.provider}) failed:`, primaryError);
      if (cfg.fallback_enabled && cfg.fallback_provider && cfg.fallback_provider !== cfg.provider) {
        try {
          questions = await callProvider(cfg.fallback_provider, cfg.fallback_model, prompt, Number(cfg.temperature) || 0.7);
          usedProvider = cfg.fallback_provider;
        } catch (e2) {
          return res.status(502).json({ error: `Both providers failed. Primary (${cfg.provider}): ${primaryError}. Fallback (${cfg.fallback_provider}): ${e2.message}` });
        }
      } else {
        return res.status(502).json({ error: primaryError });
      }
    }

    const clean = (questions || [])
      .filter((q) => q?.question_text && Array.isArray(q.options) && q.options.length >= 2 && q.correct_answer)
      .map((q) => ({
        question_text: String(q.question_text).trim(),
        options: q.options.map((o) => String(o).trim()),
        correct_answer: String(q.correct_answer).trim(),
        explanation: String(q.explanation || '').trim(),
      }))
      .filter((q) => q.options.includes(q.correct_answer));

    res.json({ questions: clean, provider_used: usedProvider, fallback_used: usedProvider !== cfg.provider, primary_error: primaryError });
  } catch (e) {
    console.error('[qb-ai-generate] error', e);
    res.status(500).json({ error: e.message || 'Internal error' });
  }
}

module.exports = { qbAiGenerate };
