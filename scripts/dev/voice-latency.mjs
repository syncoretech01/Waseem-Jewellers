#!/usr/bin/env node
/**
 * The spoken concierge on GPT-Live, timed from the client's own event timeline.
 *
 * ENGINEERING RUN, NOT HUMAN ACCEPTANCE. A real Chromium, the visitor's prompts played into a
 * fake microphone as one continuous conversation (`--use-file-for-fake-audio-capture`), one
 * Live session, the concierge's own router, tools and page. Nothing is mocked on the voice
 * path: the timings are what a visitor would get on this machine's network — with a
 * synthesised speaker, which is not a Lahore visitor.
 *
 * Per prompt, from the adapter's trace (`window.__wjVoiceTrace()`) and the controller's marks:
 *
 *   speech end → delegation      the last input-transcript fragment's end (the server's clock,
 *                                placed on this machine's clock from the session's creation:
 *                                ±200 ms) → session.delegation.created
 *   speech end → visible action  → the tool's outcome on the stage (tray set, page arrived)
 *   speech end → first audio     → the remote track carrying voice (the level meter, which is
 *                                what drives SPEAKING; the Live API has no end-of-response event)
 *   speech end → done            → the turn closed (the voice fell silent after the result)
 *   and, exact on this side:     transcript arrival → route → action
 *
 * The key lives only on the deployment, so the session is always created there. With
 * `--session-from <live>` a local build is driven against the deployed session route and the
 * deployed delegation route, so a change to the client can be timed before it is deployed.
 *
 *   node scripts/dev/voice-latency.mjs [--base <url>] [--session-from <url>] [--prompts <dir>] [--out <dir>] [--headed] [--qa]
 *
 * The prompt directory holds `conversation.wav`, `timeline.json` and `prompts.json` from the
 * prompt maker (`.cache/s22/concierge/s24/make-prompts.mjs`): `cmd` is the ten short commands,
 * `natural` the natural Pakistani set, `owner` the owner-demo script. A prompt may carry
 * `expect` — the rung, a tool, a path — and the run then reports pass/fail per turn.
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
const SESSION_FROM = (opt('--session-from', '') || '').replace(/\/$/, '');
const PROMPTS_DIR = opt('--prompts', path.join(ROOT, '.cache/s22/concierge/s24/prompts-cmd'));
const OUT = opt('--out', path.join(ROOT, '.cache/s22/concierge/s24/latency', `${path.basename(PROMPTS_DIR)}-${new Date().toISOString().replace(/[:.]/g, '-')}`));
const HEADED = flag('--headed');
const QA = flag('--qa') || !/localhost/.test(BASE);
const WAV = path.join(PROMPTS_DIR, 'conversation.wav');
const TL = JSON.parse(fs.readFileSync(path.join(PROMPTS_DIR, 'timeline.json'), 'utf8'));
const PROMPTS = JSON.parse(fs.readFileSync(path.join(PROMPTS_DIR, 'prompts.json'), 'utf8'));
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
    sessionStorage.clear();
  } catch {}
});
if (SESSION_FROM) {
  // the local build asks its own origin; the answers come from the deployment that holds the key
  const proxy = async (route, target) => {
    const req = route.request();
    const res = await fetch(`${SESSION_FROM}${target}`, { method: req.method(), headers: { 'content-type': 'application/json', origin: SESSION_FROM }, body: req.method() === 'POST' ? (req.postData() ?? '{}') : undefined });
    const body = await res.text();
    await route.fulfill({ status: res.status, contentType: res.headers.get('content-type') ?? 'application/json', body });
  };
  await ctx.route('**/api/concierge/capabilities', (route) => proxy(route, '/api/concierge/capabilities'));
  await ctx.route('**/api/concierge/live-session', (route) => proxy(route, '/api/concierge/live-session'));
  await ctx.route('**/api/concierge/delegate', (route) => proxy(route, '/api/concierge/delegate'));
  await ctx.route('**/api/concierge/turn', (route) => proxy(route, '/api/concierge/turn'));
}
const page = await ctx.newPage();
const errors = [];
const failed = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 300)));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text().slice(0, 300));
});
page.on('requestfailed', (r) => failed.push(`${r.failure()?.errorText ?? 'failed'} ${r.url().slice(0, 120)}`));

await page.goto(`${BASE}/${QA ? '?qa=1' : ''}`, { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction(() => Boolean(window.__wjConcierge), null, { timeout: 60000 });
await page.waitForTimeout(3000);
await page.evaluate(() => window.__wjConcierge.open({ mode: 'voice' }));
await page.waitForTimeout(1500);

// the tap: the file starts playing the moment the microphone opens, so this is also the file's zero
const tapAt = await page.evaluate(() => {
  const t = Date.now();
  window.__wjLatencyTap = t;
  window.__wjConcierge.startListening();
  return t;
});

const samples = [];
let last = '';
const endAt = tapAt + (TL.total + 12) * 1000;
let reloaded = false;
while (Date.now() < endAt) {
  let s;
  try {
    s = await page.evaluate(() => {
      const st = window.__wjConcierge.store;
      return { t: Date.now(), state: st.state, href: location.pathname, error: st.error?.message ?? null, adapter: st.voice.adapter, live: st.voice.sessionLive };
    });
  } catch {
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
    qa: window.__wjConcierge.qaTrace ? window.__wjConcierge.qaTrace() : [],
    turns: st.turns.map((t) => ({ role: t.role, text: t.text, source: t.source, tools: (t.tools || []).map((x) => `${x.status}:${x.label || x.name}`), result: t.result ? t.result.kind : null })),
    voice: st.voice,
    audit: window.__wjVoiceAudit ? window.__wjVoiceAudit() : null,
    href: location.pathname,
    language: st.memory.language,
  };
});
// the conversation ends with the panel: the session is closed gracefully and its resources released
await page.evaluate(() => window.__wjConcierge.close());
await page.waitForTimeout(1500);
const auditAfterClose = await page.evaluate(() => (window.__wjVoiceAudit ? window.__wjVoiceAudit() : null));

// ── per prompt, from the file's own timeline and the trace ──────────────────────────────
const trace = [...final.trace, ...final.marks].sort((a, b) => a.t - b.t);
const after = (t, type, before = Infinity) => trace.find((e) => e.t >= t && e.t < before && e.type === type) ?? null;
const between = (t, before, type) => trace.filter((e) => e.t >= t && e.t < before && e.type === type);
const micOn = after(tapAt - 100, 'mic.on');
const listening = samples.find((s) => s.t >= tapAt && s.state === 'LISTENING');
const tapToMic = micOn ? micOn.t - tapAt : listening ? listening.t - tapAt : null;
/**
 * The session's clock on this machine's clock: the session was created when the route
 * answered, less half a round trip. Every input-transcript fragment carries its own start and
 * end on the session's clock, so the last fragment's end is the speech-end reference — the
 * same ±200 ms for every prompt, and independent of the fake capture device's buffering.
 */
const created = trace.find((e) => e.type === 'session.created');
const createdMs = created ? Number(/(\d+) ms$/.exec(created.detail ?? '')?.[1] ?? 0) : 0;
/**
 * Measured on the first live runs: with zero at creation, the server placed the start of every
 * prompt 1.0–1.5 s BEFORE the file had begun playing it, which no capture device can do. The
 * session's clock starts when the session starts, not when the route answered — so the zero
 * is the arrival of `session.started` (a few ms late, which flatters nothing).
 */
const started = trace.find((e) => e.type === 'session.started');
const zero = started ? started.t : created ? created.t - Math.min(createdMs / 2, 600) : tapAt;
const deltaEnd = (e) => Number(/^(-?\d+)-(-?\d+)/.exec(e.detail ?? '')?.[2] ?? NaN);
const deltaStart = (e) => Number(/^(-?\d+)-(-?\d+)/.exec(e.detail ?? '')?.[1] ?? NaN);

const rows = [];
for (let i = 0; i < TL.prompts.length; i++) {
  const p = TL.prompts[i];
  const next = TL.prompts[i + 1];
  const spec = PROMPTS.find((x) => x.id === p.id) ?? {};
  const fileEnd = tapAt + p.end * 1000;
  const windowStart = tapAt + p.start * 1000 - 500;
  const windowEnd = next ? tapAt + next.start * 1000 + 300 : Infinity;
  const deltas = between(windowStart, windowEnd, 'input.delta').filter((e) => !Number.isNaN(deltaEnd(e)));
  const lastDelta = deltas[deltas.length - 1] ?? null;
  const firstDelta = deltas[0] ?? null;
  // the server's clock for the end of speech, on this machine's clock; the file's clock when no transcript came
  const speechEnd = lastDelta ? zero + deltaEnd(lastDelta) : fileEnd;
  const onsetOffset = firstDelta ? Math.round(zero + deltaStart(firstDelta) - (tapAt + p.start * 1000)) : null;
  const heard = after(windowStart, 'heard', windowEnd);
  const route = after(windowStart, 'route', windowEnd);
  const delegation = after(windowStart, 'delegation.created', windowEnd);
  const tool = after(windowStart, 'tool.start', windowEnd);
  const visible = tool ? after(tool.t, 'tool.visible', windowEnd) : null;
  const fact = after(windowStart, 'fact', windowEnd);
  const audio = after(speechEnd - 300, 'speaking.started', windowEnd);
  const done = after(fact ? fact.t : speechEnd, 'turn.done', windowEnd);
  const outputs = between(windowStart, windowEnd, 'output.started');
  const qa = final.qa.find((q) => q.at >= windowStart && q.at < windowEnd && (q.rung === 'direct' || q.rung === 'astra')) ?? final.qa.find((q) => q.at >= windowStart && q.at < windowEnd) ?? null;
  const turn = final.turns.filter((t) => t.role === 'concierge' && t.text).map((t) => t.text);
  const reply = done?.detail ?? null;
  const replyText = reply || (turn.length ? null : null);
  const state = samples.filter((s) => s.t >= windowStart && s.t < windowEnd).map((s) => s.state);
  const hrefAfter = samples.filter((s) => s.t >= windowStart && s.t < windowEnd).map((s) => s.href).pop() ?? null;
  const rung = route ? route.detail.split(' · ')[0] : qa?.rung ?? null;
  const language = route ? route.detail.split(' · ')[2] : qa?.language ?? null;
  const row = {
    id: p.id,
    text: p.text,
    interrupt: Boolean(p.interrupt),
    onsetOffset,
    heard: heard?.detail?.replace(/ \((pause|delegation)\)$/, '') ?? null,
    heardBy: heard ? /\((pause|delegation)\)$/.exec(heard.detail)?.[1] ?? null : null,
    rung,
    intent: qa?.intent ?? null,
    plan: qa?.plan ?? null,
    tool: qa?.tool ?? (tool?.detail ?? null),
    language,
    delegation: delegation ? /(del_[A-Za-z0-9]+|item_[A-Za-z0-9]+|[A-Za-z0-9_]+)/.exec(delegation.detail)?.[1] ?? null : null,
    action: visible?.detail ?? null,
    reply: replyText,
    replyStarted: outputs.length > 0,
    endToDelegation: delegation ? delegation.t - speechEnd : null,
    endToRoute: route ? route.t - speechEnd : null,
    endToAction: visible ? visible.t - speechEnd : null,
    endToAudio: audio ? audio.t - speechEnd : null,
    endToDone: done ? done.t - speechEnd : null,
    transcriptToAction: lastDelta && visible ? visible.t - lastDelta.t : null,
    states: [...new Set(state)].join(' → '),
    hrefAfter,
  };
  if (spec.expect) {
    const ex = spec.expect;
    const checks = [];
    if (ex.rung) checks.push([`rung ${ex.rung}`, row.rung === ex.rung]);
    if (ex.tool) checks.push([`tool ${ex.tool}`, (row.tool ?? '').split(',').includes(ex.tool)]);
    if (ex.path) checks.push([`path ${ex.path}`, new RegExp(ex.path).test(hrefAfter ?? '')]);
    if (ex.language) checks.push([`language ${ex.language}`, row.language === ex.language]);
    if (ex.spoke) checks.push(['a spoken reply', row.replyStarted]);
    row.pass = checks.every(([, v]) => v);
    row.checks = checks.map(([k, v]) => `${v ? 'ok' : 'FAIL'} ${k}`).join(', ');
  }
  rows.push(row);
}

const summary = {
  base: BASE,
  sessionFrom: SESSION_FROM || null,
  prompts: path.basename(PROMPTS_DIR),
  adapter: final.voice.adapter,
  tapToMic,
  sessionCreatedMs: createdMs,
  endToDelegation: { median: median(rows.map((r) => r.endToDelegation)), worst: worst(rows.map((r) => r.endToDelegation)) },
  endToAction: { median: median(rows.map((r) => r.endToAction)), worst: worst(rows.map((r) => r.endToAction)) },
  endToAudio: { median: median(rows.map((r) => r.endToAudio)), worst: worst(rows.map((r) => r.endToAudio)) },
  endToDone: { median: median(rows.map((r) => r.endToDone)), worst: worst(rows.map((r) => r.endToDone)) },
  transcriptToAction: { median: median(rows.map((r) => r.transcriptToAction)), worst: worst(rows.map((r) => r.transcriptToAction)) },
  direct: rows.filter((r) => r.rung === 'direct').length,
  astra: rows.filter((r) => r.rung === 'astra').length,
  heard: rows.filter((r) => r.heard).length,
  delegated: rows.filter((r) => r.delegation).length,
  acted: rows.filter((r) => r.action).length,
  spoke: rows.filter((r) => r.replyStarted).length,
  passed: rows.filter((r) => r.pass === true).length,
  expected: rows.filter((r) => 'pass' in r).length,
  total: rows.length,
  audit: final.audit,
  auditAfterClose,
  errors: errors.length,
  failedRequests: failed.length,
  endedAt: final.href,
  language: final.language,
};
fs.writeFileSync(path.join(OUT, 'session.json'), JSON.stringify({ summary, rows, samples, trace, qa: final.qa, turns: final.turns, errors, failed }, null, 1));

console.log(`\nvoice-latency (ENGINEERING RUN, synthetic audio) · ${BASE}${SESSION_FROM ? ` (session from ${SESSION_FROM})` : ''} · ${summary.prompts} · adapter=${final.voice.adapter}`);
console.log(`  tap → microphone active            ${fmt(tapToMic)} (session created in ${createdMs} ms${created && created.t < tapAt ? ', before the tap' : ''})`);
console.log(`  speech end → delegation created    median ${fmt(summary.endToDelegation.median)} · worst ${fmt(summary.endToDelegation.worst)}   (${summary.delegated}/${rows.length} delegated)`);
console.log(`  speech end → visible site action   median ${fmt(summary.endToAction.median)} · worst ${fmt(summary.endToAction.worst)}   (${summary.acted}/${rows.length} acted · ${summary.direct} direct · ${summary.astra} astra)`);
console.log(`  speech end → first voice audio     median ${fmt(summary.endToAudio.median)} · worst ${fmt(summary.endToAudio.worst)}   (${summary.spoke}/${rows.length} spoke)`);
console.log(`  speech end → turn done             median ${fmt(summary.endToDone.median)} · worst ${fmt(summary.endToDone.worst)}`);
console.log(`  transcript arrival → action        median ${fmt(summary.transcriptToAction.median)} · worst ${fmt(summary.transcriptToAction.worst)}   (exact on this side)`);
console.log(`  (file clock → server onset offset, per prompt: ${rows.map((r) => r.onsetOffset ?? '—').join(', ')} ms; speech end is the server's clock, zeroed at session.started)`);
for (const r of rows) {
  console.log(`\n  [${r.id}] "${r.text}"${r.interrupt ? ' (interruption)' : ''}`);
  console.log(`    heard: ${r.heard ?? '—'}${r.heardBy ? ` (at ${r.heardBy})` : ''}`);
  console.log(`    rung ${r.rung ?? '—'} · intent ${r.intent ?? '—'} · plan ${r.plan ?? '—'} · tool ${r.tool ?? '—'} · language ${r.language ?? '—'} · delegation ${r.delegation ?? '—'}`);
  console.log(`    action: ${r.action ?? '—'} · page ${r.hrefAfter ?? '—'} · reply: ${r.reply ?? '—'}`);
  console.log(`    end→delegation ${fmt(r.endToDelegation)} · end→action ${fmt(r.endToAction)} · end→voice ${fmt(r.endToAudio)} · end→done ${fmt(r.endToDone)} · states ${r.states}`);
  if ('pass' in r) console.log(`    ${r.pass ? 'PASS' : 'FAIL'} — ${r.checks}`);
}
if (summary.expected) console.log(`\n  ${summary.passed}/${summary.expected} turns passed their expectations`);
console.log(`  audit at the end: ${JSON.stringify(final.audit)} · after close: ${JSON.stringify(auditAfterClose)}`);
console.log(`  page ended at ${final.href} · language ${final.language} · console errors ${errors.length} · failed requests ${failed.length}`);
if (errors.length) console.log(`  ${errors.slice(0, 5).join('\n  ')}`);
if (failed.length) console.log(`  ${failed.slice(0, 5).join('\n  ')}`);
console.log(`  saved ${path.relative(ROOT, OUT)}`);
await browser.close();
