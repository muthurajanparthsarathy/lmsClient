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

// Models tried in order until one answers. A single fallback was not enough:
// Flash models regularly answer 503 "high demand" for a while, and Google
// retires old ones outright — gemini-2.5-flash now 404s "no longer available
// to new users", which is what broke "Generate programming question" once the
// primary was busy. So: Google's recommended current model first, then other
// current Flash models, ending on `gemini-flash-latest`, Google's alias that
// always points at the current stable Flash (it cannot be retired). The Flash
// Lite models close the list: lighter output, but they stay up when every
// full Flash model is answering 503 at once — observed while fixing this.
// NEXT_PUBLIC_GEMINI_MODEL, when set, is tried before all of them.
const GEMINI_MODELS: string[] = Array.from(new Set([
  (typeof process !== 'undefined' && (process as any).env?.NEXT_PUBLIC_GEMINI_MODEL) || '',
  'gemini-3.8-flash',
  'gemini-3.5-flash',
  'gemini-flash-latest',
  'gemini-3-flash-preview',
  'gemini-3.5-flash-lite',
  'gemini-flash-lite-latest',
].filter(Boolean)));

// 503s come and go within seconds, so a list that was all "busy" is walked
// once more after a short pause before giving up.
const PASSES = 2;
const RETRY_PAUSE_MS = 1500;

const pause = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Aborted', 'AbortError'));
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => { clearTimeout(t); reject(new DOMException('Aborted', 'AbortError')); }, { once: true });
  });

// Worth trying the next model on: retired / unknown (404), rate-limited (429),
// overloaded or down (500/503), or a network failure (0). Anything else — a
// bad key, a malformed request — would fail the same way on every model.
const TRY_NEXT_MODEL = new Set([0, 404, 429, 500, 503]);

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
 * Walks GEMINI_MODELS in order, moving on while a model is retired, busy or
 * rate-limited (see TRY_NEXT_MODEL).
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
      // Join every answer part: newer (thinking) models can split the reply,
      // and a `thought` part is reasoning, not the answer.
      const parts: any[] = data?.candidates?.[0]?.content?.parts || [];
      const text = parts.filter((p) => !p?.thought).map((p) => p?.text || '').join('');
      return { ok: true, text };
    } catch (e: any) {
      if (e?.name === 'AbortError') throw e;
      return { ok: false, status: 0, err: e };
    }
  };

  const failures: string[] = [];
  let last: { status: number; err: any } = { status: 0, err: null };
  let fatal = false;
  for (let pass = 0; pass < PASSES && !fatal; pass++) {
    if (pass > 0) await pause(RETRY_PAUSE_MS, signal);
    for (const model of GEMINI_MODELS) {
      const result = await tryOnce(model);
      if (result.ok) return result.text;
      last = result;
      failures.push(`${model} ${result.status || 'network'}`);
      if (!TRY_NEXT_MODEL.has(result.status)) { fatal = true; break; }
    }
    // Every model retired/unknown is not going to change on a second pass.
    if (failures.slice(-GEMINI_MODELS.length).every((f) => f.endsWith(' 404'))) break;
  }

  const busy = failures.length > 0 && [429, 500, 503].includes(last.status);
  throw new GeminiError(
    busy
      ? 'The AI service is busy right now. Please try again in a minute.'
      : `Gemini API request failed (${failures.join(', ')}).`,
    last.status,
    last.err,
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
