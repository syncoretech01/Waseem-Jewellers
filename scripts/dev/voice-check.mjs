#!/usr/bin/env node
/**
 * The Live voice path, exercised without a credential.
 *
 * A real Chromium, a fake `RTCPeerConnection` whose data channel is scripted like a GPT-Live
 * session (session.started, input transcript deltas, a client delegation, output transcript
 * deltas, the appends acknowledged, session.close answered), a remote track that carries a
 * tone while the fake "speaks", the session route and the delegation route mocked. Nothing
 * else is faked: the router, the parser, the tools, the page and the stage are the real ones.
 * What is asserted is what the visitor sees and what the wire carries:
 *
 *   the session refused   said once, in writing, and the written concierge is presented;
 *                         no example runs in the visitor's name; the reason is on the trace
 *   a direct command      "Gold." → the page moves before any speech; one commentary append
 *                         with the delegation id; the trace says direct
 *   a natural sentence    → the delegation route, its tool executed here, the fact handed back;
 *                         the trace says astra
 *   language              Roman Urdu after English → one instructions append naming it
 *   a typed sentence      into the same session: routed, acted on, handed to the voice
 *   SPEAKING              follows the remote audio, not a server event
 *   the transcript        kept in the store, never on the stage; the QA view alone shows it
 *   the audio pipeline    one microphone stream, one peer connection, one session — and none
 *                         left open after close, across open → talk → close ×5
 *   the line dropped      re-established once with the recent transcript seeded, the microphone kept
 *   the browser's speech  never touched: SpeechRecognition and speechSynthesis are watched
 *
 *   node scripts/dev/voice-check.mjs [http://localhost:3300]
 */
import { chromium } from 'playwright';

const BASE = (process.argv[2] || 'http://localhost:3300').replace(/\/$/, '');
const failures = [];
const ok = (cond, what) => {
  console.log(`  ${cond ? 'ok  ' : 'FAIL'} ${what}`);
  if (!cond) failures.push(what);
};

const CAPABILITIES = { intelligence: 'keyless', languages: ['en', 'ur', 'ur-Latn', 'pa-Arab', 'pa-Guru'], voice: 'native', enquiry: 'local', privacy: null, booking: 'none' };

/** Installed before any page script: the fake transport, and a watch on the browser's own speech APIs. */
const FAKES = `
(() => {
  const fake = { pcs: [], sent: [], sessions: 0, seq: 0, sessionId: 'live_test', onSend: null, closeReason: 'close_requested' };
  window.__fakeLive = fake;
  window.__speechTouched = 0;
  for (const k of ['SpeechRecognition', 'webkitSpeechRecognition', 'speechSynthesis', 'SpeechSynthesisUtterance']) {
    Object.defineProperty(window, k, { configurable: true, get() { window.__speechTouched += 1; return undefined; } });
  }
  class FakeDataChannel {
    constructor(label) { this.label = label; this.readyState = 'connecting'; this.onopen = null; this.onmessage = null; this.onclose = null; this.onerror = null; }
    send(data) { const ev = JSON.parse(data); fake.sent.push(ev); fake.onSend && fake.onSend(ev, this); }
    close() { if (this.readyState === 'closed') return; this.readyState = 'closed'; this.onclose && this.onclose(new Event('close')); }
    _open() { this.readyState = 'open'; this.onopen && this.onopen(new Event('open')); }
    _push(ev) { if (this.readyState !== 'open') return; ev.event_id = ev.event_id || ('evt_' + (++fake.seq)); this.onmessage && this.onmessage(new MessageEvent('message', { data: JSON.stringify(ev) })); }
  }
  class FakeSender { constructor(track) { this.track = track || null; } async replaceTrack(t) { this.track = t; } }
  class FakePeerConnection {
    constructor() { this.connectionState = 'new'; this.iceGatheringState = 'complete'; this.localDescription = null; this.ontrack = null; this.onconnectionstatechange = null; this._dc = null; this._closed = false; fake.pcs.push(this); }
    addEventListener() {} removeEventListener() {}
    addTransceiver() { return { sender: new FakeSender() }; }
    addTrack(track) { return new FakeSender(track); }
    createDataChannel(label) { this._dc = new FakeDataChannel(label); return this._dc; }
    async createOffer() { return { type: 'offer', sdp: 'v=0\\r\\no=- 0 0 IN IP4 127.0.0.1\\r\\ns=-\\r\\n' }; }
    async setLocalDescription(d) { this.localDescription = d; }
    async setRemoteDescription() {
      this.connectionState = 'connected';
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      gain.gain.value = 0;
      osc.connect(gain);
      const dest = ctx.createMediaStreamDestination();
      gain.connect(dest);
      osc.start();
      fake.gain = gain;
      fake.ctx = ctx;
      const stream = dest.stream;
      const track = stream.getAudioTracks()[0];
      const dc = this._dc;
      fake.sessions += 1;
      setTimeout(() => {
        this.ontrack && this.ontrack({ track, streams: [stream] });
        dc._open();
        setTimeout(() => dc._push({ type: 'session.started', session: { id: fake.sessionId + '_' + fake.sessions, model: 'gpt-live-1', status: 'active' } }), 20);
      }, 30);
    }
    close() { if (this._closed) return; this._closed = true; this.connectionState = 'closed'; this._dc && this._dc.close(); }
    async getStats() { return new Map(); }
  }
  window.RTCPeerConnection = FakePeerConnection;
  fake.dc = () => { const pc = fake.pcs[fake.pcs.length - 1]; return pc && pc._dc; };
  fake.openPcs = () => fake.pcs.filter((p) => !p._closed).length;
  let t = 1000;
  /** The visitor's words: transcript fragments, then (optionally) a client delegation. */
  fake.say = (text, opts = {}) => {
    const dc = fake.dc();
    if (!dc) return null;
    const words = text.split(' ');
    const half = Math.ceil(words.length / 2);
    const parts = words.length > 3 ? [words.slice(0, half).join(' ') + ' ', words.slice(half).join(' ')] : [text];
    const startMs = t;
    for (const p of parts) { dc._push({ type: 'session.input_transcript.delta', delta: p, start_ms: t, end_ms: t + 400 }); t += 400; }
    const id = 'del_' + (++fake.seq);
    if (opts.delegate !== false) setTimeout(() => dc._push({ type: 'session.delegation.created', offset_ms: t, delegation: { id, type: 'delegation', target: 'client' } }), opts.delay ?? 250);
    t += 800;
    return { id, startMs, endMs: t };
  };
  /** The concierge's voice: output transcript fragments and a tone on the remote track for a while. */
  fake.speak = (text, ms = 900) => {
    const dc = fake.dc();
    if (!dc) return;
    dc._push({ type: 'session.output_transcript.delta', delta: text, start_ms: t, end_ms: t + ms });
    t += ms;
    if (fake.gain) { fake.gain.gain.value = 0.6; setTimeout(() => { fake.gain.gain.value = 0; }, ms); }
  };
  fake.drop = () => { const dc = fake.dc(); dc && dc._push({ type: 'session.closed', reason: 'connection_lost', usage: { seconds: 12 } }); };
  fake.onSend = (ev, dc) => {
    if (/^session\\.(thinking|commentary|instructions)\\.append$/.test(ev.type)) setTimeout(() => dc._push({ type: ev.type + 'ed', client_event_id: ev.event_id, start_ms: t, end_ms: t }), 15);
    if (ev.type === 'session.input_audio.mute') setTimeout(() => dc._push({ type: 'session.input_audio.muted', client_event_id: ev.event_id }), 10);
    if (ev.type === 'session.input_audio.unmute') setTimeout(() => dc._push({ type: 'session.input_audio.unmuted', client_event_id: ev.event_id }), 10);
    if (ev.type === 'session.close') setTimeout(() => { dc._push({ type: 'session.closed', reason: fake.closeReason, usage: { seconds: 30 } }); setTimeout(() => dc.close(), 10); }, 40);
  };
})();
`;

const settle = (page, ms) => page.waitForTimeout(ms);
const state = (page) => page.evaluate(() => window.__wjConcierge?.store?.state ?? null);
const sent = (page, type) => page.evaluate((t) => window.__fakeLive.sent.filter((e) => e.type === t), type);
const audit = (page) => page.evaluate(() => window.__wjVoiceAudit?.() ?? null);
const lastTrace = (page) =>
  page.evaluate(() => {
    const t = window.__wjConcierge.qaTrace();
    return t[t.length - 1] ?? null;
  });

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

/** Waits for a predicate on the page, polling; resolves whether it came true. */
async function until(page, fn, timeout = 8000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (await page.evaluate(fn)) return true;
    await settle(page, 40);
  }
  return false;
}

const SESSION_ANSWER = { sessionId: 'live_test', model: 'gpt-live-1', voice: 'marin', sdp: 'v=0\r\no=- 1 1 IN IP4 0.0.0.0\r\ns=-\r\n' };

async function newContext(browser, { sessionStatus = 200, delegate } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, permissions: ['microphone'] });
  await ctx.addInitScript(FAKES);
  await ctx.addInitScript(() => {
    try {
      sessionStorage.clear();
    } catch {}
  });
  const calls = { session: [], delegate: [] };
  await ctx.route('**/api/concierge/capabilities', (route) => route.fulfill({ json: CAPABILITIES }));
  await ctx.route('**/api/concierge/live-session', (route) => {
    const body = JSON.parse(route.request().postData() ?? '{}');
    calls.session.push(body);
    if (sessionStatus !== 200) return route.fulfill({ status: sessionStatus, json: { error: { code: 'insufficient_quota', message: 'You exceeded your current quota (test)' } } });
    return route.fulfill({ json: SESSION_ANSWER });
  });
  await ctx.route('**/api/concierge/delegate', (route) => {
    const body = JSON.parse(route.request().postData() ?? '{}');
    calls.delegate.push(body);
    const frames = delegate ? delegate(body) : [{ type: 'turn.error', code: 'CONCIERGE_OFFLINE', message: 'no model configured', recoverable: true }];
    return route.fulfill({ status: 200, contentType: 'application/x-ndjson', body: frames.map((f) => JSON.stringify(f)).join('\n') + '\n' });
  });
  await ctx.route('**/api/concierge/turn', (route) => route.fulfill({ status: 200, contentType: 'application/x-ndjson', body: `${JSON.stringify({ type: 'turn.error', code: 'CONCIERGE_OFFLINE', message: 'no model configured', recoverable: true })}\n` }));
  return { ctx, calls };
}

async function openVoice(page, path) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${BASE}${path}${/\?/.test(path) ? '&' : '?'}qa=1`, { waitUntil: 'load', timeout: 120000 });
  await settle(page, 3500);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('wj:concierge', { detail: { action: 'open', mode: 'voice' } })));
  const r = await waitFor(page, ['VOICE_READY']);
  await settle(page, 800);
  return { errors, r };
}

const browser = await chromium.launch({ headless: true, args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });
try {
  // ── the session refused: said once, in writing, and the written concierge answers ──
  {
    console.log('\nthe session refused (the route answers 502 with the provider\'s reason)');
    const { ctx, calls } = await newContext(browser, { sessionStatus: 502 });
    const page = await ctx.newPage();
    const { errors, r } = await openVoice(page, '/gold');
    ok(r.hit === 'VOICE_READY', 'opens in voice mode at VOICE_READY');
    await page.evaluate(() => window.__wjConcierge.startListening());
    const said = await until(page, () => window.__wjConcierge.store.turns.some((t) => t.role === 'concierge' && /Voice is unavailable just now/.test(t.text)), 12000);
    const s = await page.evaluate(() => ({ mode: window.__wjConcierge.store.mode, state: window.__wjConcierge.store.state, adapter: window.__wjConcierge.store.voice.adapter, visitorTurns: window.__wjConcierge.store.turns.filter((t) => t.role === 'visitor').length, error: window.__wjConcierge.store.error?.message ?? null }));
    ok(said, 'the stage says, in writing, that voice is unavailable and writing continues');
    ok(s.mode === 'chat' && s.state === 'CHAT', `the written concierge is presented (${s.mode}/${s.state})`);
    ok(s.adapter !== 'scripted' && s.visitorTurns === 0, `no example ran in the visitor's name (${s.adapter}, ${s.visitorTurns} visitor turns)`);
    const trace = await lastTrace(page);
    ok(trace && trace.rung === 'live' && /insufficient_quota/.test(trace.fallback ?? ''), `the provider's reason is on the trace verbatim ("${trace?.fallback}")`);
    ok(calls.session.length >= 1 && calls.session.length <= 2, `the session route was asked (${calls.session.length})`);
    // a second tap does not ask again until "Try again"
    const before = calls.session.length;
    await page.evaluate(() => window.__wjConcierge.startListening());
    await settle(page, 600);
    ok(calls.session.length === before, `a second tap does not ask the route again (${calls.session.length})`);
    const touched = await page.evaluate(() => window.__speechTouched);
    ok(touched === 0, `the browser's own speech APIs were never touched (${touched})`);
    ok(errors.length === 0, `no page errors (${errors.length}${errors[0] ? `: ${errors[0]}` : ''})`);
    await ctx.close();
  }

  // ── the live session: direct, the delegation model, language, typed text, speaking, the audit ──
  {
    console.log('\nthe live session (transport faked, session route mocked)');
    const { ctx, calls } = await newContext(browser, {
      delegate: (body) => {
        if (!body.continuation) return [{ type: 'turn.trace', note: 'gpt-6-astra · effort low · tier priority · round 1' }, { type: 'tool.call', callId: 'call_1', name: 'searchProducts', args: { occasion: 'walima', style: 'contemporary', limit: 4 } }, { type: 'await.tools', continuation: 'c1' }];
        return [{ type: 'turn.trace', note: 'round 2' }, { type: 'text.done', text: 'Four walima pieces are on the page now.' }, { type: 'turn.done' }];
      },
    });
    const page = await ctx.newPage();
    const { errors } = await openVoice(page, '/diamond');
    const warm = await until(page, () => window.__wjConcierge.store.voice.sessionLive === true, 8000);
    ok(warm, 'the session is opened before the tap (voice.sessionLive)');
    const tapAt = Date.now();
    await page.evaluate(() => window.__wjConcierge.startListening());
    let r = await waitFor(page, ['LISTENING'], 8000);
    ok(r.hit === 'LISTENING', `the tap attaches the microphone: LISTENING in ${Date.now() - tapAt} ms`);
    let a = await audit(page);
    ok(a && a.streams === 1 && a.liveTracks === 1 && a.openPeerConnections === 1 && a.sessionOpen === true, `one stream, one live track, one peer connection, one session (${JSON.stringify(a)})`);
    ok(calls.session.length === 1, `one session was created (${calls.session.length})`);

    // a direct command: the page moves before any speech, the delegation is answered with the fact
    const say1 = await page.evaluate(() => window.__fakeLive.say('Gold.'));
    const moved = await until(page, () => location.pathname === '/gold', 8000);
    const movedAt = Date.now();
    ok(moved, `"Gold." moves the page to /gold (${movedAt - tapAt} ms after the tap, before any speech)`);
    await until(page, () => window.__fakeLive.sent.some((e) => e.type === 'session.commentary.append' && /department is open/.test(e.content)), 4000);
    let appends = await sent(page, 'session.commentary.append');
    const gold = appends.find((e) => /Gold department is open/.test(e.content));
    ok(Boolean(gold) && gold.delegation_id === say1.id, `one commentary append carries the fact with the delegation id (${gold?.delegation_id} = ${say1.id})`);
    let trace = await lastTrace(page);
    ok(trace?.rung === 'direct' && trace.plan === 'core_department' && trace.language === 'en', `the trace says direct · core_department · en (${trace?.rung} · ${trace?.plan} · ${trace?.language})`);
    const refreshed = await until(page, () => window.__fakeLive.sent.some((e) => e.type === 'session.thinking.append' && /site-context/.test(e.content) && /page: \/gold/.test(e.content)), 4000);
    ok(refreshed, 'the page state was pushed to the session after the action');
    // SPEAKING follows the remote audio
    await page.evaluate(() => window.__fakeLive.speak('Gold is open.', 1000));
    r = await waitFor(page, ['SPEAKING'], 3000);
    ok(r.hit === 'SPEAKING', `the remote track carrying voice puts the stage at SPEAKING (${r.seen.join(' → ')})`);
    r = await waitFor(page, ['LISTENING'], 6000);
    ok(r.hit === 'LISTENING', `silence on the track returns the stage to LISTENING (${r.seen.join(' → ')})`);
    const heard = await page.evaluate(() => ({ stored: window.__wjConcierge.store.turns.filter((t) => t.role === 'visitor' && t.source === 'voice').map((t) => t.text), onStage: document.querySelector('[data-voice-stage]')?.textContent ?? '', qa: Boolean(document.querySelector('[data-qa-heard]')) }));
    ok(heard.stored.includes('Gold.') && !heard.onStage.includes('Gold.') && !heard.qa, 'the words are kept in the store and never written on the stage');

    // a natural sentence: the delegation model, its tool executed here
    await page.evaluate(() => { window.__wjConcierge.dismissTray(); });
    const say2 = await page.evaluate(() => window.__fakeLive.say('Walima ke liye something classy.'));
    const delegated = await until(page, () => window.__wjConcierge.store.trayOpen === true && window.__wjConcierge.qaTrace().slice(-1)[0]?.tool === 'searchProducts', 10000);
    ok(delegated && (await lastTrace(page))?.rung === 'astra', 'the natural sentence brings pieces onto the page through the delegation route');
    ok(calls.delegate.length === 2 && calls.delegate[0].mode === 'voice' && calls.delegate[0].text === 'Walima ke liye something classy.' && Boolean(calls.delegate[1].continuation), `two rounds went to /api/concierge/delegate in voice mode (${calls.delegate.length})`);
    ok(Array.isArray(calls.delegate[0].history) && calls.delegate[0].history.some((h) => h.text === 'Gold.'), 'the recent spoken exchange travelled with it');
    await until(page, () => window.__fakeLive.sent.some((e) => e.type === 'session.commentary.append' && /walima pieces/.test(e.content)), 4000);
    appends = await sent(page, 'session.commentary.append');
    const walima = appends.find((e) => /walima pieces/.test(e.content));
    ok(Boolean(walima) && walima.delegation_id === say2.id, `the model's fact was handed back under the delegation id (${walima?.delegation_id})`);
    trace = await lastTrace(page);
    ok(trace?.rung === 'astra' && trace.tool === 'searchProducts', `the trace says astra · searchProducts (${trace?.rung} · ${trace?.tool} · ${trace?.note})`);
    const langAppends = (await sent(page, 'session.instructions.append')).filter((e) => /Roman Urdu/.test(e.content));
    ok(langAppends.length === 1, `the language change to Roman Urdu was told once (${langAppends.length})`);
    await page.evaluate(() => window.__fakeLive.speak('Ji, chaar pieces saamne hain.', 700));
    await waitFor(page, ['LISTENING'], 6000);

    // an ordinal, in Roman Urdu: direct, the language kept
    await page.evaluate(() => window.__fakeLive.say('Doosra wala kholo.'));
    const opened = await until(page, () => /^\/jewellery\//.test(location.pathname), 8000);
    ok(opened, `"Doosra wala kholo." opens the second piece (${await page.evaluate(() => location.pathname)})`);
    // the trace lands when the turn ends, a beat after the page has moved on a fast build
    await until(page, () => window.__wjConcierge.qaTrace().slice(-1)[0]?.plan === 'core_open', 4000);
    trace = await lastTrace(page);
    ok(trace?.rung === 'direct' && trace.plan === 'core_open' && trace.language === 'ur-Latn', `direct · core_open · ur-Latn (${trace?.rung} · ${trace?.plan} · ${trace?.language})`);
    ok((await sent(page, 'session.instructions.append')).filter((e) => /Roman Urdu/.test(e.content)).length === 1, 'no second language instruction for the same language');
    await page.evaluate(() => window.__fakeLive.speak('Yeh raha.', 600));
    await waitFor(page, ['LISTENING'], 6000);

    // a typed sentence into the same conversation
    await page.evaluate(() => window.__wjConcierge.submitText('Wapas jao', 'text'));
    const back = await until(page, () => !/^\/jewellery\//.test(location.pathname), 8000);
    ok(back, `a typed "Wapas jao" goes back through the session (${await page.evaluate(() => location.pathname)})`);
    await until(page, () => window.__fakeLive.sent.some((e) => e.type === 'session.commentary.append' && e.delegation_id === null && /Went back|page is now/.test(e.content)), 4000);
    appends = await sent(page, 'session.commentary.append');
    const typed = appends[appends.length - 1];
    ok(typed && typed.delegation_id === null && /Went back|page is now/.test(typed.content), `its fact was handed to the voice with no delegation (${typed?.content?.slice(0, 60)})`);
    ok((await sent(page, 'session.thinking.append')).some((e) => /visitor typed/.test(e.content)), 'the voice was told the words were typed');

    // the words the parser cannot read are left to the voice model unless it delegates
    const before = (await sent(page, 'session.commentary.append')).length;
    await page.evaluate(() => window.__fakeLive.say('Kal shaam ka time dekhna.', { delegate: false }));
    await settle(page, 3500);
    ok((await sent(page, 'session.commentary.append')).length === before && calls.delegate.length === 2, 'an unread sentence with no delegation calls no model and hands nothing back');
    await page.evaluate(() => window.__fakeLive.say('Kal shaam ka time dekhna.', { delegate: true }));
    const asked = await until(page, () => window.__fakeLive.sent.filter((e) => e.type === 'session.commentary.append').length > 0 && (window.__wjConcierge.qaTrace().slice(-1)[0]?.rung === 'astra'), 10000);
    ok(asked && calls.delegate.length >= 3, `the same sentence delegated goes to the model (${calls.delegate.length} calls)`);

    // the close: session.close, session.closed, everything released
    await page.evaluate(() => window.__wjConcierge.close());
    const closed = await until(page, () => window.__fakeLive.sent.some((e) => e.type === 'session.close') && window.__fakeLive.openPcs() === 0, 6000);
    a = await audit(page);
    ok(closed && a.liveTracks === 0 && a.openPeerConnections === 0 && a.sessionOpen === false, `close sends session.close and releases the track, the connection and the session (${JSON.stringify(a)})`);
    const touched = await page.evaluate(() => window.__speechTouched);
    ok(touched === 0, `the browser's own speech APIs were never touched (${touched})`);
    ok(errors.length === 0, `no page errors (${errors.length}${errors[0] ? `: ${errors[0]}` : ''})`);
    await ctx.close();
  }

  // ── the audio pipeline across five conversations ──
  {
    console.log('\nthe audio pipeline: open → talk → close, five times');
    const { ctx } = await newContext(browser);
    const page = await ctx.newPage();
    const { errors } = await openVoice(page, '/diamond');
    let maxTracks = 0;
    let maxPcs = 0;
    let maxSessions = 0;
    for (let i = 0; i < 5; i++) {
      if (i > 0) {
        await page.evaluate(() => window.dispatchEvent(new CustomEvent('wj:concierge', { detail: { action: 'open', mode: 'voice' } })));
        await waitFor(page, ['VOICE_READY'], 6000);
        await settle(page, 300);
      }
      await page.evaluate(() => window.__wjConcierge.startListening());
      const r = await waitFor(page, ['LISTENING'], 8000);
      ok(r.hit === 'LISTENING', `round ${i + 1}: LISTENING`);
      await page.evaluate(() => window.__fakeLive.say('Show rings.'));
      await until(page, () => window.__wjConcierge.store.trayOpen === true, 8000);
      await settle(page, 300);
      const a = await audit(page);
      maxTracks = Math.max(maxTracks, a.liveTracks);
      maxPcs = Math.max(maxPcs, a.openPeerConnections);
      maxSessions = Math.max(maxSessions, a.sessionOpen ? 1 : 0);
      await page.evaluate(() => window.__wjConcierge.close());
      await until(page, () => window.__fakeLive.openPcs() === 0, 6000);
      await settle(page, 200);
    }
    const a = await audit(page);
    ok(maxTracks === 1 && maxPcs === 1 && maxSessions === 1, `never more than one live track, one open connection, one session at a time (${maxTracks}/${maxPcs}/${maxSessions})`);
    ok(a.liveTracks === 0 && a.openPeerConnections === 0 && a.sessionOpen === false, `nothing left open after the fifth close (${JSON.stringify(a)})`);
    ok(a.streams === 5 && a.sessions === 5 && a.peerConnections === 5, `five conversations, five of each (${a.streams} streams, ${a.peerConnections} connections, ${a.sessions} sessions)`);
    const touched = await page.evaluate(() => window.__speechTouched);
    ok(touched === 0, `the browser's own speech APIs were never touched (${touched})`);
    ok(errors.length === 0, `no page errors (${errors.length}${errors[0] ? `: ${errors[0]}` : ''})`);
    await ctx.close();
  }

  // ── the QA view: what was heard, and the rung, shown to a tester only ──
  {
    console.log('\nQA view (?qa=1): the heard words and the trace');
    const { ctx } = await newContext(browser);
    const page = await ctx.newPage();
    const { errors } = await openVoice(page, '/gold?qa=1');
    await page.evaluate(() => window.__wjConcierge.startListening());
    await waitFor(page, ['LISTENING'], 8000);
    await page.evaluate(() => window.__fakeLive.say('Show rings.'));
    await until(page, () => window.__wjConcierge.store.trayOpen === true, 8000);
    await settle(page, 300);
    const qa = await page.evaluate(() => ({ heard: document.querySelector('[data-qa-heard]')?.textContent ?? '', trace: document.querySelector('[data-qa-trace]')?.textContent ?? '' }));
    ok(/Show rings/.test(qa.heard), `the QA line shows what was heard ("${qa.heard.trim()}")`);
    ok(/rung direct/.test(qa.trace) && /searchProducts/.test(qa.trace) && /delegation/.test(qa.trace), `the QA trace shows the rung, the tool and the delegation ("${qa.trace.trim().slice(0, 120)}")`);
    ok(errors.length === 0, `no page errors (${errors.length}${errors[0] ? `: ${errors[0]}` : ''})`);
    await ctx.close();
  }

  // ── the line dropped: re-established once, the transcript seeded, the microphone kept ──
  {
    console.log('\nthe line dropped mid-conversation');
    const { ctx, calls } = await newContext(browser);
    const page = await ctx.newPage();
    const { errors } = await openVoice(page, '/');
    await page.evaluate(() => window.__wjConcierge.startListening());
    await waitFor(page, ['LISTENING'], 8000);
    await page.evaluate(() => window.__fakeLive.say('Diamond.'));
    await until(page, () => location.pathname === '/diamond', 8000);
    await page.evaluate(() => window.__fakeLive.speak('Diamond is open.', 500));
    await waitFor(page, ['LISTENING'], 6000);
    await page.evaluate(() => window.__fakeLive.drop());
    const again = await until(page, () => window.__fakeLive.sessions === 2 && window.__wjConcierge.store.state === 'LISTENING', 10000);
    const a = await audit(page);
    ok(again, 'a dropped line is re-established and the stage listens again');
    ok(calls.session.length === 2 && Array.isArray(calls.session[1].history) && calls.session[1].history.some((h) => h.text === 'Diamond.'), `the second session was seeded with the recent transcript (${JSON.stringify(calls.session[1]?.history ?? null).slice(0, 120)})`);
    ok(a.streams === 1 && a.liveTracks === 1 && a.openPeerConnections === 1 && a.peerConnections === 2, `the microphone stream was kept; one new connection (${JSON.stringify(a)})`);
    ok((await sent(page, 'session.instructions.append')).some((e) => /line dropped/i.test(e.content)), 'the voice was told to say so once');
    const err = await page.evaluate(() => window.__wjConcierge.store.error?.message ?? null);
    ok(err === null, `no error is shown for a line that came back (${err})`);
    ok(errors.length === 0, `no page errors (${errors.length}${errors[0] ? `: ${errors[0]}` : ''})`);
    await ctx.close();
  }
} finally {
  await browser.close();
}

console.log(failures.length ? `\nvoice-check: ${failures.length} failed` : '\nvoice-check: all passed');
process.exit(failures.length ? 1 : 0);
