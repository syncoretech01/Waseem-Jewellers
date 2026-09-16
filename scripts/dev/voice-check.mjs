#!/usr/bin/env node
/**
 * The voice tier, exercised without a microphone or a credential.
 *
 * A real Chromium, a fake SpeechRecognition that replays what a visitor might have said, a
 * fake speechSynthesis with a controllable voice list, and mocked server routes for the
 * model-backed tier. What is asserted is the sequence the visitor sees, not the engine:
 *
 *   browser tier   VOICE_READY → LISTENING → THINKING → SPEAKING → VOICE_READY, and the
 *                  microphone reopens by itself after a spoken turn
 *   a network fault says so and never runs the scripted example in the visitor's name
 *   "Write" mid-sentence discards the half sentence
 *   server tier    the recording goes to /api/concierge/transcribe, the words come back,
 *                  the reply plays through /api/concierge/speak, SPEAKING lasts as long
 *                  as the audio, then the microphone reopens
 *
 *   node scripts/dev/voice-check.mjs [http://localhost:3300]
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = (process.argv[2] || 'http://localhost:3300').replace(/\/$/, '');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const TONE = path.join(ROOT, '.cache/s22/tone.mp3');
const failures = [];
const ok = (cond, what) => {
  console.log(`  ${cond ? 'ok  ' : 'FAIL'} ${what}`);
  if (!cond) failures.push(what);
};

/** Installed before any page script: fake recognition and synthesis the controller cannot tell from the real thing. */
const FAKES = `
(() => {
  const plan = { utterance: 'Show me gold rings under 15 grams', error: null, voices: [{ name: 'Test English India', lang: 'en-IN', localService: true, default: true }] };
  window.__voicePlan = plan;
  window.__voiceLog = [];
  class FakeRecognition {
    constructor() { this.lang = 'en-US'; this.continuous = false; this.interimResults = true; this.maxAlternatives = 1; this._t = []; }
    start() {
      window.__voiceLog.push('rec.start:' + this.lang);
      const fire = (ms, fn) => this._t.push(setTimeout(fn, ms));
      fire(60, () => this.onstart && this.onstart());
      if (plan.error) { fire(200, () => { this.onerror && this.onerror({ error: plan.error }); this.onend && this.onend(); }); return; }
      const words = plan.utterance.split(' ');
      words.forEach((_, i) => fire(150 + i * 90, () => {
        const text = words.slice(0, i + 1).join(' ');
        const isFinal = i === words.length - 1;
        const result = [{ transcript: text, confidence: 0.9 }]; result.isFinal = isFinal; result.length = 1;
        const results = [result]; results.length = 1;
        this.onresult && this.onresult({ resultIndex: 0, results });
      }));
      fire(150 + words.length * 90 + 120, () => this.onend && this.onend());
    }
    stop() { window.__voiceLog.push('rec.stop'); this._t.forEach(clearTimeout); this._t = []; setTimeout(() => this.onend && this.onend(), 30); }
    abort() { window.__voiceLog.push('rec.abort'); this._t.forEach(clearTimeout); this._t = []; }
  }
  window.SpeechRecognition = FakeRecognition;
  window.webkitSpeechRecognition = FakeRecognition;
  class FakeUtterance { constructor(text) { this.text = text; this.lang = ''; this.rate = 1; this.pitch = 1; this.voice = null; } }
  window.SpeechSynthesisUtterance = FakeUtterance;
  const synth = {
    speaking: false, pending: false, paused: false, _q: [], _t: null,
    getVoices: () => plan.voices,
    addEventListener: () => {},
    speak(u) {
      window.__voiceLog.push('synth.speak:' + u.text.slice(0, 40));
      this._q.push(u);
      if (!this._t) this._next();
    },
    _next() {
      const u = this._q.shift();
      if (!u) { this._t = null; this.speaking = false; return; }
      this.speaking = true;
      u.onstart && u.onstart();
      const ms = Math.max(400, u.text.length * 40);
      this._t = setTimeout(() => { u.onend && u.onend(); this._t = null; this._next(); }, ms);
    },
    cancel() { window.__voiceLog.push('synth.cancel'); if (this._t) clearTimeout(this._t); this._t = null; this._q = []; this.speaking = false; },
  };
  Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
})();
`;

const state = (page) => page.evaluate(() => window.__wjConcierge?.store?.state ?? null);
const log = (page) => page.evaluate(() => window.__voiceLog);
const settle = (page, ms) => page.waitForTimeout(ms);

/** Waits until the store reaches one of the states, recording every state seen on the way. */
async function waitFor(page, states, timeout = 8000) {
  return page.evaluate(
    ({ states, timeout }) =>
      new Promise((resolve) => {
        const seen = [];
        const started = performance.now();
        const tick = () => {
          const s = window.__wjConcierge?.store?.state;
          if (s && seen[seen.length - 1] !== s) seen.push(s);
          if (states.includes(s)) return resolve({ hit: s, seen });
          if (performance.now() - started > timeout) return resolve({ hit: null, seen });
          setTimeout(tick, 25);
        };
        tick();
      }),
    { states, timeout },
  );
}

const browser = await chromium.launch({ headless: true, args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });
try {
  // ── browser tier ──────────────────────────────────────────────────────────
  {
    console.log('\nbrowser tier');
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, permissions: ['microphone'] });
    await ctx.addInitScript(FAKES);
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(`${BASE}/gold`, { waitUntil: 'load', timeout: 120000 });
    await settle(page, 3500);
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('wj:concierge', { detail: { action: 'open', mode: 'voice' } })));
    let r = await waitFor(page, ['VOICE_READY']);
    ok(r.hit === 'VOICE_READY', 'opens in voice mode at VOICE_READY');
    await page.evaluate(() => window.__wjConcierge.startListening());
    r = await waitFor(page, ['LISTENING']);
    ok(r.hit === 'LISTENING', 'the microphone opens: LISTENING');
    r = await waitFor(page, ['SPEAKING'], 10000);
    ok(r.hit === 'SPEAKING' && r.seen.includes('THINKING'), `heard → THINKING → SPEAKING (${r.seen.join(' → ')})`);
    // the state must outlast the synthesis: still SPEAKING while the fake voice is mid-reply
    await settle(page, 300);
    const stillSpeaking = await state(page);
    const synthSpeaking = await page.evaluate(() => window.speechSynthesis.speaking);
    ok(stillSpeaking === 'SPEAKING' && synthSpeaking, 'SPEAKING lasts while the voice is still speaking');
    r = await waitFor(page, ['LISTENING'], 12000);
    ok(r.hit === 'LISTENING', `the microphone reopens by itself after a spoken turn (${r.seen.join(' → ')})`);
    const spoke = (await log(page)).filter((l) => l.startsWith('synth.speak')).length;
    ok(spoke >= 1, `the reply was spoken (${spoke} utterance(s))`);
    // Write mid-sentence discards
    await page.evaluate(() => window.__wjConcierge.setMode('chat'));
    await settle(page, 400);
    const turnsAfterWrite = await page.evaluate(() => window.__wjConcierge.store.turns.filter((t) => t.role === 'visitor').length);
    ok(turnsAfterWrite === 1, `"Write" mid-sentence discarded the half sentence (visitor turns: ${turnsAfterWrite})`);
    // a network fault says so and runs no example
    await page.evaluate(() => { window.__voicePlan.error = 'network'; });
    await page.evaluate(() => window.__wjConcierge.setMode('voice'));
    await settle(page, 300);
    await page.evaluate(() => window.__wjConcierge.startListening());
    await settle(page, 1500);
    const err = await page.evaluate(() => window.__wjConcierge.store.error?.message ?? null);
    const adapter = await page.evaluate(() => window.__wjConcierge.store.voice.adapter);
    const visitorTurns = await page.evaluate(() => window.__wjConcierge.store.turns.filter((t) => t.role === 'visitor').length);
    ok(Boolean(err) && err.includes('Hearing is not available'), `a network fault is said plainly ("${err}")`);
    ok(adapter !== 'scripted' && visitorTurns === 1, `no scripted example ran in the visitor's name (adapter ${adapter}, visitor turns ${visitorTurns})`);
    ok(errors.length === 0, `no page errors (${errors.length})`);
    await ctx.close();
  }

  // ── server tier ───────────────────────────────────────────────────────────
  {
    console.log('\nserver tier (routes mocked)');
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, permissions: ['microphone'] });
    await ctx.addInitScript(FAKES);
    await ctx.addInitScript(() => { try { sessionStorage.removeItem('wj:concierge:capabilities:v1'); } catch {} });
    let transcribeCalls = 0;
    let speakCalls = 0;
    await ctx.route('**/api/concierge/capabilities', (route) => route.fulfill({ json: { intelligence: 'keyless', languages: ['en', 'ur', 'ur-Latn', 'pa-Arab', 'pa-Guru'], voice: 'server', enquiry: 'local', privacy: null } }));
    await ctx.route('**/api/concierge/transcribe', async (route) => {
      transcribeCalls += 1;
      const req = route.request();
      const type = req.headers()['content-type'] ?? '';
      if (!type.includes('multipart/form-data')) return route.fulfill({ status: 400, json: { error: { code: 'BAD_REQUEST', message: 'no form' } } });
      return route.fulfill({ json: { text: 'mujhe baraat ke liye kuch heavy dikhao', language: null } });
    });
    await ctx.route('**/api/concierge/speak', (route) => {
      speakCalls += 1;
      return route.fulfill({ status: 200, contentType: 'audio/mpeg', body: fs.readFileSync(TONE) });
    });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(`${BASE}/bridal`, { waitUntil: 'load', timeout: 120000 });
    await settle(page, 3500);
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('wj:concierge', { detail: { action: 'open', mode: 'voice' } })));
    let r = await waitFor(page, ['VOICE_READY']);
    await settle(page, 600); // the probe answers, the support flags refresh
    const caps = await page.evaluate(() => JSON.parse(sessionStorage.getItem('wj:concierge:capabilities:v1') ?? '{}')?.value?.voice ?? null);
    ok(caps === 'server', `capabilities advertise the server tier (${caps})`);
    await page.evaluate(() => window.__wjConcierge.startListening());
    r = await waitFor(page, ['LISTENING'], 6000);
    const adapter = await page.evaluate(() => window.__wjConcierge.store.voice.adapter);
    ok(r.hit === 'LISTENING' && adapter === 'server', `the server adapter records: LISTENING via '${adapter}'`);
    await settle(page, 1200);
    await page.evaluate(() => window.__wjConcierge.stopListening());
    r = await waitFor(page, ['SPEAKING', 'RESULT', 'VOICE_READY'], 12000);
    ok(transcribeCalls === 1, `one recording went to /api/concierge/transcribe (${transcribeCalls})`);
    const heard = await page.evaluate(() => window.__wjConcierge.store.turns.filter((t) => t.role === 'visitor').map((t) => t.text).pop() ?? null);
    ok(heard === 'mujhe baraat ke liye kuch heavy dikhao', `the words came back into the turn ("${heard}")`);
    ok(r.seen.includes('THINKING'), `THINKING followed the recording (${r.seen.join(' → ')})`);
    await settle(page, 600);
    ok(speakCalls >= 1, `the reply was fetched from /api/concierge/speak (${speakCalls})`);
    const spokenViaBrowser = (await log(page)).filter((l) => l.startsWith('synth.speak')).length;
    ok(spokenViaBrowser === 0, `the browser voice stayed silent while the server voice spoke (${spokenViaBrowser})`);
    r = await waitFor(page, ['LISTENING'], 12000);
    ok(r.hit === 'LISTENING', `the microphone reopened after the spoken reply (${r.seen.join(' → ')})`);
    ok(errors.length === 0, `no page errors (${errors.length})`);
    await ctx.close();
  }

  // ── native tier, unreachable: the ladder steps down one rung and says so ──
  {
    console.log('\nnative tier advertised, session refused (falls to the server tier)');
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, permissions: ['microphone'] });
    await ctx.addInitScript(FAKES);
    await ctx.addInitScript(() => { try { sessionStorage.removeItem('wj:concierge:capabilities:v1'); } catch {} });
    let tokenCalls = 0;
    let transcribeCalls = 0;
    await ctx.route('**/api/concierge/capabilities', (route) => route.fulfill({ json: { intelligence: 'keyless', languages: ['en', 'ur', 'ur-Latn', 'pa-Arab', 'pa-Guru'], voice: 'native', enquiry: 'local', privacy: null } }));
    await ctx.route('**/api/concierge/realtime-token', (route) => {
      tokenCalls += 1;
      return route.fulfill({ status: 503, json: { error: { code: 'CONCIERGE_VOICE_OFFLINE', message: 'refused for the test' } } });
    });
    await ctx.route('**/api/concierge/transcribe', (route) => {
      transcribeCalls += 1;
      return route.fulfill({ json: { text: 'ab bracelets dikhao', language: null } });
    });
    await ctx.route('**/api/concierge/speak', (route) => route.fulfill({ status: 200, contentType: 'audio/mpeg', body: fs.readFileSync(TONE) }));
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(`${BASE}/gold`, { waitUntil: 'load', timeout: 120000 });
    await settle(page, 3500);
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('wj:concierge', { detail: { action: 'open', mode: 'voice' } })));
    let r = await waitFor(page, ['VOICE_READY']);
    await settle(page, 600);
    await page.evaluate(() => window.__wjConcierge.startListening());
    r = await waitFor(page, ['LISTENING'], 9000);
    const voice = await page.evaluate(() => ({ adapter: window.__wjConcierge.store.voice.adapter, fallback: window.__wjConcierge.store.voice.fallback, error: window.__wjConcierge.store.error?.message ?? null }));
    ok(tokenCalls === 1, `one session was asked for and refused (${tokenCalls})`);
    ok(r.hit === 'LISTENING' && voice.adapter === 'server' && voice.fallback === 'server', `the server tier listens instead, marked as the rung below (${voice.adapter}/${voice.fallback})`);
    const status = await page.evaluate(() => document.querySelector('[aria-live="polite"]')?.textContent ?? '');
    ok(/correct me or write to me/i.test(status) && !/WebSpeech|API|provider|model error/i.test(status), `the stage says so in the visitor's words ("${status.trim()}")`);
    await settle(page, 1200);
    await page.evaluate(() => window.__wjConcierge.stopListening());
    r = await waitFor(page, ['SPEAKING', 'RESULT', 'VOICE_READY'], 12000);
    ok(transcribeCalls === 1, `the recording went to the transcription route (${transcribeCalls})`);
    // "Not quite? Correct it": the heard words land in a composer that mounts only after the switch
    await page.evaluate(() => window.__wjConcierge.editHeard());
    await settle(page, 500);
    const corrected = await page.evaluate(() => ({ mode: window.__wjConcierge.store.mode, value: document.querySelector('form input')?.value ?? null }));
    ok(corrected.mode === 'chat' && corrected.value === 'ab bracelets dikhao', `"Correct it" opens the composer with the heard words ("${corrected.value}")`);
    ok(errors.length === 0, `no page errors (${errors.length})`);
    await ctx.close();
  }

  // ── server tier, the transcription fails after the sentence: the browser rung opens and asks again ──
  {
    console.log('\nserver tier, transcription refused after the sentence (falls to the browser rung, asks again)');
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, permissions: ['microphone'] });
    await ctx.addInitScript(FAKES);
    await ctx.addInitScript(() => { try { sessionStorage.removeItem('wj:concierge:capabilities:v1'); } catch {} });
    await ctx.route('**/api/concierge/capabilities', (route) => route.fulfill({ json: { intelligence: 'keyless', languages: ['en', 'ur', 'ur-Latn', 'pa-Arab', 'pa-Guru'], voice: 'server', enquiry: 'local', privacy: null } }));
    await ctx.route('**/api/concierge/transcribe', (route) => route.fulfill({ status: 503, json: { error: { code: 'CONCIERGE_VOICE_OFFLINE', message: 'refused for the test' } } }));
    await ctx.route('**/api/concierge/speak', (route) => route.fulfill({ status: 200, contentType: 'audio/mpeg', body: fs.readFileSync(TONE) }));
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(`${BASE}/diamond`, { waitUntil: 'load', timeout: 120000 });
    await settle(page, 3500);
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('wj:concierge', { detail: { action: 'open', mode: 'voice' } })));
    let r = await waitFor(page, ['VOICE_READY']);
    await settle(page, 600);
    await page.evaluate(() => window.__wjConcierge.startListening());
    r = await waitFor(page, ['LISTENING'], 6000);
    await settle(page, 1200);
    await page.evaluate(() => window.__wjConcierge.stopListening());
    // the recording is refused; the rung below opens on its own and the sentence is asked for again
    const after = await page.evaluate(
      () =>
        new Promise((resolve) => {
          const started = performance.now();
          const tick = () => {
            const st = window.__wjConcierge.store;
            const read = () => {
              const now = window.__wjConcierge.store;
              return { state: now.state, adapter: now.voice.adapter, fallback: now.voice.fallback, status: document.querySelector('[aria-live="polite"]')?.textContent?.trim() ?? '' };
            };
            if (st.state === 'LISTENING' && st.voice.adapter === 'webspeech') return setTimeout(() => resolve(read()), 120);
            if (performance.now() - started > 8000) return resolve(read());
            setTimeout(tick, 25);
          };
          tick();
        }),
    );
    ok(after.adapter === 'webspeech' && after.fallback === 'browser', `the browser's own hearing took over (${after.adapter}/${after.fallback})`);
    ok(/could not hear that clearly/i.test(after.status) && !/WebSpeech|API|provider|model error/i.test(after.status), `the lost sentence is asked for again in the visitor's words ("${after.status}")`);
    ok(errors.length === 0, `no page errors (${errors.length})`);
    await ctx.close();
  }
} finally {
  await browser.close();
}

console.log(failures.length ? `\nvoice-check: ${failures.length} failed` : '\nvoice-check: all passed');
process.exit(failures.length ? 1 : 0);
