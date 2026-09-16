import { voiceEnv } from '@/server/env';
import { clientIp, sameOrigin, takeToken, MAX_INPUT_CHARS, type Limit } from '@/server/concierge/limits';
import { romaniseDevanagari } from '@/lib/romanise';

/**
 * Hearing, through a transcription model.
 *
 * The browser's own recognition is the fallback tier: it hears Indian English, transcribes
 * Urdu as English and offers no Punjabi at all. This route takes a few seconds of the
 * visitor's voice and returns what was said, in whichever of the five languages it was
 * said in — and nothing else. The words then enter the same grounded, validated, filtered
 * turn a typed sentence does; hearing better does not mean answering differently.
 *
 * Gated by the voice credential. Without it the route says so and the browser tier runs.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** A sentence a second is generous; the hourly figure allows an afternoon of trying pieces on. */
const TRANSCRIBE_LIMIT: Limit = { perMinute: 20, perHour: 160 };
/** Fifteen seconds of Opus at 24 kbps is ~45 KB, of 128 kbps webm ~250 KB; the cap is the fence, and it is billed by the minute. */
const MAX_AUDIO_BYTES = 600_000;
const UPSTREAM_TIMEOUT_MS = 20_000;

/** The words this shop deals in, so a transcription model spells them as the visitor did. */
const PROMPT =
  'Waseem Jewellers, Lahore. Jewellery: gold, diamond, polki, kundan, haar, satlada, choker, jhumka, tikka, nath, bangle, kangan, bracelet, pendant, ring, karat, 21K, 22K, tola, gram, lakh, crore, baraat, walima, mehndi, Rukh-e-Jana, Aks-e-Noor, Rang-e-Jamal, Dewan, Naqsh-e-Gul. The speaker may use English, Urdu, Roman Urdu or Punjabi, and may switch mid-sentence.';

const LANGUAGE_HINT: Record<string, string> = { en: 'en', ur: 'ur', 'pa-Arab': 'pa', 'pa-Guru': 'pa' };

/**
 * The current transcription models take the vocabulary as keywords and the languages as a
 * list; the older ones take a prompt and one language. The route serves either, so the model
 * is a deployment setting rather than a code change.
 */
const KEYWORDS = ['Waseem Jewellers', 'haar', 'satlada', 'raani haar', 'choker', 'tikka', 'jhumka', 'kangan', 'bangle', 'angoothi', 'nath', 'polki', 'kundan', 'jadau', 'heera', 'sona', 'tola', 'lakh', 'crore', 'baraat', 'walima', 'mehndi', 'dulhan', 'Rang-e-Jamal', 'Aks-e-Noor', 'Naqsh-e-Gul', 'Dewan', 'Rukh-e-Jana', 'dikhao', 'kholo', 'chahiye', 'halka', 'bhaari', 'ehde varga', 'doosra', 'hor dikhao'];
const takesKeywords = (model: string) => /^gpt-transcribe|^gpt-live-transcribe/.test(model);

/** The script of what came back decides how the browser tier should listen next time. */
function languageOf(text: string): string | null {
  if (/[؀-ۿ]/.test(text)) return 'ur';
  if (/[਀-੿]/.test(text)) return 'pa-Guru';
  return null;
}

export async function POST(request: Request) {
  const env = voiceEnv();
  const fail = (code: string, message: string, status: number) => Response.json({ error: { code, message } }, { status, headers: { 'cache-control': 'no-store' } });

  if (!env.apiKey) return fail('CONCIERGE_VOICE_OFFLINE', 'no voice configured', 503);
  if (!sameOrigin(request)) return fail('ORIGIN', 'cross-origin request', 403);
  const limit = takeToken(clientIp(request), 'transcribe', TRANSCRIBE_LIMIT);
  if (!limit.ok) return fail('RATE_LIMITED', `too many requests; retry in ${limit.retryAfterSeconds}s`, 429);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail('BAD_REQUEST', 'unreadable body', 400);
  }
  const audio = form.get('audio');
  if (!(audio instanceof Blob) || audio.size === 0) return fail('BAD_REQUEST', 'no audio', 400);
  if (audio.size > MAX_AUDIO_BYTES) return fail('BAD_REQUEST', 'audio too long', 413);
  const hint = LANGUAGE_HINT[String(form.get('language') ?? '')];

  const upstream = new FormData();
  const type = audio.type || 'audio/webm';
  const ext = type.includes('mp4') ? 'mp4' : type.includes('ogg') ? 'ogg' : type.includes('wav') ? 'wav' : type.includes('mpeg') || type.includes('mp3') ? 'mp3' : 'webm';
  upstream.append('file', new File([audio], `utterance.${ext}`, { type }));
  upstream.append('model', env.sttModel);
  upstream.append('response_format', 'json');
  if (takesKeywords(env.sttModel)) {
    for (const k of KEYWORDS) upstream.append('keywords[]', k);
    // the two language codes the model accepts (Punjabi is not one of them; it is heard through Urdu), so a code-switched sentence is heard as one
    for (const l of (hint === 'pa' ? ['ur'] : hint ? [hint] : ['en', 'ur'])) upstream.append('languages[]', l);
  } else {
    upstream.append('prompt', PROMPT);
    // a known language is a hint; mixed or Roman Urdu is left to the model, which hears it better than a wrong hint
    if (hint) upstream.append('language', hint);
  }

  let res: Response;
  try {
    res = await fetch(`${env.baseUrl}/audio/transcriptions`, {
      method: 'POST',
      headers: { authorization: `Bearer ${env.apiKey}` },
      body: upstream,
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch {
    return fail('UPSTREAM', 'the transcription service did not answer', 502);
  }
  if (!res.ok) {
    // the provider's reason stays in the server log; the browser learns only that hearing failed
    console.error('[transcribe] upstream', res.status, env.sttModel, (await res.text().catch(() => '')).slice(0, 600));
    return fail('UPSTREAM', `transcription ${res.status}`, 502);
  }

  let text = '';
  try {
    const json = (await res.json()) as { text?: unknown };
    text = typeof json.text === 'string' ? json.text : '';
  } catch {
    return fail('UPSTREAM', 'unreadable transcription', 502);
  }
  text = romaniseDevanagari(text.replace(/\s+/g, ' ').trim().slice(0, MAX_INPUT_CHARS));
  return Response.json({ text, language: languageOf(text) }, { headers: { 'cache-control': 'no-store' } });
}
