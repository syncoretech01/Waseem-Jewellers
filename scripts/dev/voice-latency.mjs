#!/usr/bin/env node
/**
 * The spoken concierge, timed from the client's own event timeline.
 *
 * A real Chromium, the visitor's prompts played into a fake microphone as one conversation
 * (`--use-file-for-fake-audio-capture`), the deployed realtime session, the concierge's own
 * tools and page. Nothing is mocked on the voice path: the timings are what a visitor would
 * get on this machine's network. What is measured, per prompt, from the trace the adapter
 * keeps (`window.__wjVoiceTrace()`) and the marks the controller writes:
 *
 *   tap → microphone active        startListening() → the stage says LISTENING (mic.on / live)
 *   speech end → turn detected     the prompt's last sample → input_audio_buffer.speech_stopped
 *                                  (the last sample is placed from the server's own speech_started
 *                                  plus the prompt's trimmed length: the fake capture device buffers
 *                                  about a second before the wire, so the file's clock cannot be used;
 *                                  the onset detection itself costs ~100 ms, which this cannot see)
 *   turn detected → tool call      speech_stopped → the first function call's arguments arrive
 *   tool call → visible action     that call → its outcome on the stage (tray set, page arrived)
 *   speech end → first voice       the prompt's last sample → output_audio_buffer.started
 *
 * The key lives only on the deployment, so the session is always minted there. With
 * `--token-from <live>` a local build is driven against the deployed token route, so a change
 * to the client can be timed before it is deployed; the session settings baked into the
 * secret are then the deployment's, and `--tune` pushes the local build's own turn detection,
 * tools and instructions over the data channel instead (the QA hook in realtime.ts).
 *
 *   node scripts/dev/voice-latency.mjs [--base <url>] [--token-from <url>] [--tune] [--prompts <dir>] [--out <dir>] [--headed]
 *
 * The prompt directory holds `conversation.wav` and `timeline.json` from the prompt maker
 * (see .cache/s22/concierge/make-cmd-prompts.mjs); the default set is the short commands.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback;
};
const flag = (name) => args.includes(name);
const BASE = opt('--base', 'https://waseem-jewellers-two.vercel.app').replace(/\/$/, '');
const TOKEN_FROM = (opt('--token-from', '') || '').replace(/\/$/, '');
const TUNE = flag('--tune');
const PROMPTS_DIR = opt('--prompts', path.join(ROOT, '.cache/s22/concierge/prompts-cmd'));
const OUT = opt('--out', path.join(ROOT, '.cache/s22/concierge/latency', new Date().toISOString().replace(/[:.]/g, '-')));
const HEADED = flag('--headed');
const WAV = path.join(PROMPTS_DIR, 'conversation.wav');
const TL = JSON.parse(fs.readFileSync(path.join(PROMPTS_DIR, 'timeline.json'), 'utf8'));
fs.mkdirSync(OUT, { recursive: true });
process.env.TMP = process.env.TEMP = path.join(ROOT, '.cache/s22/tmp');
fs.mkdirSync(process.env.TMP, { recursive: true });

const median = (xs) => {
  const s = xs.filter((x) => typeof x === 'number').sort((a, b) => a - b);
  if (!s.length) return null;
  return s.length % 2 ? s[(s.length - 1) / 2] : Math.round((s[s.length / 2 - 1] + s[s.length / 2]) / 2);
};
const worst = (xs) => {
  const s = xs.filter((x) => typeof x === 'number');
  return s.length ? Math.max(...s) : null;
};
const fmt = (n) => (typeof n === 'number' ? `${n} ms` : '—');

const browser = await chromium.launch({
  headless: !HEADED,
  args: ['--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${WAV.replace(/\//g, '\\')}%noloop`, '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'],
});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, permissions: ['microphone'] });
await ctx.addInitScript(() => {
  try {
    sessionStorage.removeItem('wj:concierge:capabilities:v1');
  } catch {}
});
if (TUNE) await ctx.addInitScript(() => { window.__wjVoiceTune = true; });
if (TOKEN_FROM) {
  // the local build asks its own origin; the answer comes from the deployment that holds the key
  const proxy = async (route, target) => {
    const req = route.request();
    const res = await fetch(`${TOKEN_FROM}${target}`, { method: req.method(), headers: { 'content-type': 'application/json', origin: TOKEN_FROM }, body: req.method() === 'POST' ? req.postData() ?? '{}' : undefined });
    const body = await res.text();
    await route.fulfill({ status: res.status, contentType: 'application/json', body });
  };
  await ctx.route('**/api/concierge/capabilities', (route) => proxy(route, '/api/concierge/capabilities'));
  await ctx.route('**/api/concierge/realtime-token', (route) => proxy(route, '/api/concierge/realtime-token'));
}
const page = await ctx.newPage();
const errors = [];
const failed = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 300)));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text().slice(0, 300));
});
page.on('requestfailed', (r) => failed.push(`${r.failure()?.errorText ?? 'failed'} ${r.url().slice(0, 120)}`));

await page.goto(`${BASE}/`, { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction(() => Boolean(window.__wjConcierge), null, { timeout: 60000 });
await page.waitForTimeout(3000);
await page.evaluate(() => window.__wjConcierge.open({ mode: 'voice' }));
await page.waitForTimeout(TUNE ? 2500 : 1200);

// the tap: the file starts playing the moment the microphone opens, so this is also the file's zero
const tapAt = await page.evaluate(() => {
  const t = Date.now();
  window.__wjLatencyTap = t;
  window.__wjConcierge.startListening();
  return t;
});

const samples = [];
let last = '';
const endAt = tapAt + (TL.total + 10) * 1000;
let reloaded = false;
while (Date.now() < endAt) {
  let s;
  try {
    s = await page.evaluate(() => {
      const st = window.__wjConcierge.store;
      return { t: Date.now(), state: st.state, href: location.pathname, error: st.error?.message ?? null, adapter: st.voice.adapter, fallback: st.voice.fallback };
    });
  } catch {
    // a full reload (a dev server's hot reload, most often) ends the session and the run
    reloaded = true;
    break;
  }
  if (s.state !== last) {
    samples.push(s);
    last = s.state;
  }
  await page.waitForTimeout(40);
}
if (reloaded) {
  console.log('the page reloaded mid-run (a dev server hot reload, most often); run it again');
  await browser.close();
  process.exit(2);
}
await page.screenshot({ path: path.join(OUT, 'end.jpg'), type: 'jpeg', quality: 70 });
const final = await page.evaluate(() => {
  const st = window.__wjConcierge.store;
  return {
    trace: window.__wjVoiceTrace ? window.__wjVoiceTrace() : [],
    marks: window.__wjConcierge.timeline ? window.__wjConcierge.timeline() : [],
    turns: st.turns.map((t) => ({ role: t.role, text: t.text, source: t.source, tools: (t.tools || []).map((x) => `${x.status}:${x.label || x.name}`), result: t.result ? t.result.kind : null })),
    voice: st.voice,
    href: location.pathname,
  };
});

// ── per prompt, from the file's own timeline and the trace ──────────────────────────────
const trace = [...final.trace, ...final.marks].sort((a, b) => a.t - b.t);
const after = (t, type, before = Infinity) => trace.find((e) => e.t >= t && e.t < before && e.type === type) ?? null;
const micOn = after(tapAt, 'mic.on') ?? after(tapAt, 'live');
const listening = samples.find((s) => s.t >= tapAt && s.state === 'LISTENING');
const tapToMic = micOn ? micOn.t - tapAt : listening ? listening.t - tapAt : null;
const rows = [];
for (let i = 0; i < TL.prompts.length; i++) {
  const p = TL.prompts[i];
  const next = TL.prompts[i + 1];
  const fileEnd = tapAt + p.end * 1000;
  const windowEnd = next ? tapAt + next.start * 1000 + 4000 : Infinity;
  // the onset the server saw, then the prompt's own length: the last sample as the wire had it
  const started = after(tapAt + p.start * 1000 - 3000, 'speech.started', windowEnd);
  const speechEnd = started ? started.t + (p.end - p.start) * 1000 : fileEnd;
  const stopped = after(speechEnd - 1500, 'speech.stopped', windowEnd);
  const from = stopped ? stopped.t : speechEnd;
  const tool = after(from, 'tool.queued', windowEnd) ?? after(from, 'tool.start', windowEnd);
  const visible = tool ? after(tool.t, 'tool.visible', windowEnd) ?? after(tool.t, 'tool.done', windowEnd) : null;
  const audio = after(from - 500, 'audio.started', windowEnd);
  const heard = after(from - 2000, 'heard', windowEnd);
  const done = after(from, 'turn.done', windowEnd);
  const toolNames = trace.filter((e) => e.t >= from && e.t < windowEnd && (e.type === 'tool.queued' || e.type === 'tool.start')).map((e) => e.detail);
  rows.push({
    id: p.id,
    text: p.text,
    fileOffset: started ? Math.round(started.t - (tapAt + p.start * 1000)) : null,
    heard: heard?.detail ?? null,
    tools: [...new Set(toolNames)],
    reply: done?.detail ?? null,
    endToTurn: stopped ? stopped.t - speechEnd : null,
    turnToTool: stopped && tool ? tool.t - stopped.t : null,
    toolToVisible: tool && visible ? visible.t - tool.t : null,
    endToVoice: audio ? audio.t - speechEnd : null,
    endToDone: done ? done.t - speechEnd : null,
  });
}

const summary = {
  base: BASE,
  tokenFrom: TOKEN_FROM || null,
  tuned: TUNE,
  adapter: final.voice.adapter,
  fallback: final.voice.fallback,
  tapToMic,
  endToTurn: { median: median(rows.map((r) => r.endToTurn)), worst: worst(rows.map((r) => r.endToTurn)) },
  turnToTool: { median: median(rows.map((r) => r.turnToTool)), worst: worst(rows.map((r) => r.turnToTool)) },
  toolToVisible: { median: median(rows.map((r) => r.toolToVisible)), worst: worst(rows.map((r) => r.toolToVisible)) },
  endToVoice: { median: median(rows.map((r) => r.endToVoice)), worst: worst(rows.map((r) => r.endToVoice)) },
  endToDone: { median: median(rows.map((r) => r.endToDone)), worst: worst(rows.map((r) => r.endToDone)) },
  turnsDetected: rows.filter((r) => r.endToTurn !== null).length,
  toolsCalled: rows.filter((r) => r.tools.length).length,
  prompts: rows.length,
  errors: errors.length,
  failedRequests: failed.length,
  endedAt: final.href,
};
fs.writeFileSync(path.join(OUT, 'session.json'), JSON.stringify({ summary, rows, samples, trace, turns: final.turns, errors, failed }, null, 1));

console.log(`\nvoice-latency · ${BASE}${TOKEN_FROM ? ` (session from ${TOKEN_FROM})` : ''}${TUNE ? ' · tuned' : ''} · adapter=${final.voice.adapter}${final.voice.fallback ? ` fallback=${final.voice.fallback}` : ''}`);
console.log(`  tap → microphone active          ${fmt(tapToMic)}`);
console.log(`  speech end → turn detected       median ${fmt(summary.endToTurn.median)} · worst ${fmt(summary.endToTurn.worst)}   (${summary.turnsDetected}/${rows.length} detected)`);
console.log(`  turn detected → tool call        median ${fmt(summary.turnToTool.median)} · worst ${fmt(summary.turnToTool.worst)}   (${summary.toolsCalled}/${rows.length} called a tool)`);
console.log(`  tool call → visible site action  median ${fmt(summary.toolToVisible.median)} · worst ${fmt(summary.toolToVisible.worst)}`);
console.log(`  speech end → first voice audio   median ${fmt(summary.endToVoice.median)} · worst ${fmt(summary.endToVoice.worst)}`);
console.log(`  speech end → turn done           median ${fmt(summary.endToDone.median)} · worst ${fmt(summary.endToDone.worst)}`);
console.log(`  (file clock → wire offset, per prompt: ${rows.map((r) => r.fileOffset ?? '—').join(', ')} ms)`);
for (const r of rows) {
  console.log(`\n  [${r.id}] "${r.text}"`);
  console.log(`    heard: ${r.heard ?? '—'}`);
  console.log(`    tools: ${r.tools.join(' | ') || '—'}`);
  console.log(`    reply: ${r.reply ?? '—'}`);
  console.log(`    end→turn ${fmt(r.endToTurn)} · turn→tool ${fmt(r.turnToTool)} · tool→visible ${fmt(r.toolToVisible)} · end→voice ${fmt(r.endToVoice)} · end→done ${fmt(r.endToDone)}`);
}
console.log(`\n  states: ${samples.map((s) => s.state).join(' → ')}`);
console.log(`  page ended at ${final.href} · console errors ${errors.length} · failed requests ${failed.length}`);
if (errors.length) console.log(`  ${errors.slice(0, 5).join('\n  ')}`);
if (failed.length) console.log(`  ${failed.slice(0, 5).join('\n  ')}`);
console.log(`  saved ${path.relative(ROOT, OUT)}`);
await browser.close();
