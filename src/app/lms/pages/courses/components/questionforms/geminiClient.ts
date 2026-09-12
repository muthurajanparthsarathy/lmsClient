// ────────────────────────────────────────────────────────────────────────────────
//  Shared Gemini API client for the question-form AI generators
//  (Programming, Frontend, Database).
//
//  IMPORTANT: hard-coding API keys in the bundle is NOT a long-term solution —
//  the existing MCQ generator does the same, and the user explicitly provided
//  this key with the note "i know it is secret but i delete so implement" (i.e.
//  they'll rotate it after testing). Move to a server-side proxy or
//  NEXT_PUBLIC_GEMINI_API_KEY before a production launch.
// ────────────────────────────────────────────────────────────────────────────────

// Read from env only — never hard-code a key in source (GitHub Push
// Protection blocks commits containing real GCP/Google API keys). Set
// NEXT_PUBLIC_GEMINI_API_KEY in .env.local for local dev and in your
// deployment env for production.
const GEMINI_API_KEY: string =
  (typeof process !== 'undefined' && (process as any).env?.NEXT_PUBLIC_GEMINI_API_KEY) || '';

if (typeof window !== 'undefined' && !GEMINI_API_KEY) {
  // eslint-disable-next-line no-console
  console.warn(
    '[geminiClient] NEXT_PUBLIC_GEMINI_API_KEY is not set — AI generation calls will fail until you add it to .env.local.'
  );
}

// Primary + fallback models. Gemini 3.5 Flash per user request.
// If the primary endpoint isn't available on the key/region, the client
// automatically falls back to 2.5-flash → 1.5-flash.
const GEMINI_PRIMARY = 'gemini-3.5-flash';
const GEMINI_FALLBACK = 'gemini-2.5-flash';

const urlFor = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

export interface GeminiCallOptions {
  /** The prompt the model should respond to. */
  prompt: string;
  /** Optional explicit system instruction (kept separate from the user prompt). */
  systemInstruction?: string;
  /** Sampling temperature (0–1). Lower = more deterministic. Default 0.7. */
  temperature?: number;
  /** Max output tokens. Default 8192 (Gemini 2.0 Flash supports up to 8192). */
  maxOutputTokens?: number;
  /** Tells the model to return strict JSON. Default true. */
  jsonMode?: boolean;
  /** AbortSignal for cancelling in-flight requests. */
  signal?: AbortSignal;
}

export class GeminiError extends Error {
  status?: number;
  details?: any;
  constructor(message: string, status?: number, details?: any) {
    super(message);
    this.name = 'GeminiError';
    this.status = status;
    this.details = details;
  }
}

/**
 * Calls Gemini and returns the raw text response.
 * Tries the primary model first, falls back to a stable model if the
 * primary is unavailable (404 / 503).
 */
export async function callGemini(opts: GeminiCallOptions): Promise<string> {
  const {
    prompt,
    systemInstruction,
    temperature = 0.7,
    maxOutputTokens = 8192,
    jsonMode = true,
    signal,
  } = opts;

  const body: any = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature,
      maxOutputTokens,
      ...(jsonMode ? { responseMimeType: 'application/json' } : {}),
    },
  };
  if (systemInstruction) {
    body.systemInstruction = { parts: [{ text: systemInstruction }] };
  }

  const tryOnce = async (model: string): Promise<{ ok: true; text: string } | { ok: false; status: number; err: any }> => {
    try {
      const res = await fetch(urlFor(model), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return { ok: false, status: res.status, err };
      }
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      return { ok: true, text };
    } catch (e: any) {
      if (e?.name === 'AbortError') throw e;
      return { ok: false, status: 0, err: e };
    }
  };

  const primary = await tryOnce(GEMINI_PRIMARY);
  if (primary.ok) return primary.text;

  // Fall back on a model-not-found / service-unavailable type error.
  if (primary.status === 404 || primary.status === 503 || primary.status === 429) {
    const fallback = await tryOnce(GEMINI_FALLBACK);
    if (fallback.ok) return fallback.text;
    throw new GeminiError(
      `Gemini API failed on both models (primary ${primary.status}, fallback ${fallback.status}).`,
      fallback.status,
      fallback.err,
    );
  }

  throw new GeminiError(
    `Gemini API request failed (${primary.status}).`,
    primary.status,
    primary.err,
  );
}

/**
 * Calls Gemini and parses the response as JSON.
 * The model is instructed to return strict JSON via responseMimeType, but
 * we strip an optional ```json ... ``` fence defensively and fall back to
 * grabbing the first {...} or [...] block if the model wraps it.
 */
export async function callGeminiJSON<T = any>(opts: GeminiCallOptions): Promise<T> {
  const raw = await callGemini({ ...opts, jsonMode: true });
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // Try to extract the first {...} or [...] block — the model sometimes
    // wraps JSON in a short preamble even with responseMimeType set.
    const objMatch = cleaned.match(/\{[\s\S]*\}/);
    const arrMatch = cleaned.match(/\[[\s\S]*\]/);
    const candidate = arrMatch?.[0] || objMatch?.[0];
    if (candidate) {
      try { return JSON.parse(candidate) as T; } catch { /* fall through */ }
    }
    throw new GeminiError(
      'Gemini returned content that could not be parsed as JSON.',
      undefined,
      { raw },
    );
  }
}
