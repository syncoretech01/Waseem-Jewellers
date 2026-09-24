#!/usr/bin/env node
/** Free protocol check for the direct Realtime Concierge path. */
import { chromium } from 'playwright';

const BASE = (process.argv[2] || 'http://localhost:3300').replace(/\/$/, '');
const failures = [];
const ok = (value, label) => {
  console.log(`  ${value ? 'ok  ' : 'FAIL'} ${label}`);
  if (!value) failures.push(label);
};

const FAKES = `
(() => {
  const f = { sent: [], pcs: [], seq: 0 }; window.__wjRealtimeFake = f;
  for (const k of ['SpeechRecognition', 'webkitSpeechRecognition', 'speechSynthesis', 'SpeechSynthesisUtterance']) Object.defineProperty(window, k, { configurable: true, get() { throw new Error('browser speech touched'); } });
  class Channel {
    constructor() { this.readyState = 'connecting'; }
    send(value) { const e = JSON.parse(value); f.sent.push(e); if (e.type === 'conversation.item.create' && e.item?.type === 'function_call_output') setTimeout(() => { this.push({ type: 'response.created' }); this.push({ type: 'response.output_audio_transcript.delta', delta: 'The selection is ready.' }); this.push({ type: 'response.done', response: { status: 'completed' } }); }, 20); }
    close() { if (this.readyState === 'closed') return; this.readyState = 'closed'; this.onclose?.(); }
    push(e) { this.onmessage?.({ data: JSON.stringify(e) }); }
    open() { this.readyState = 'open'; this.onopen?.(); }
  }
  class Peer {
    constructor() { this.connectionState = 'new'; this.channel = null; f.pcs.push(this); }
    addTrack() {} createDataChannel() { return this.channel = new Channel(); }
    async createOffer() { return { type: 'offer', sdp: 'v=0\\r\\n' }; } async setLocalDescription() {}
    async setRemoteDescription() { this.connectionState = 'connected'; setTimeout(() => this.channel.open(), 10); }
    close() { this.connectionState = 'closed'; this.channel?.close(); this.onconnectionstatechange?.(); }
  }
  window.RTCPeerConnection = Peer;
  f.say = (text, calls, late = false) => { const c = f.pcs.at(-1)?.channel; c.push({ type: 'input_audio_buffer.speech_started' }); c.push({ type: 'input_audio_buffer.speech_stopped', item_id: 'i' + (++f.seq) }); c.push({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'i' + f.seq, transcript: text }); c.push({ type: 'response.created' }); const emit = () => calls.forEach((call, i) => c.push({ type: 'response.function_call_arguments.done', call_id: 'c' + f.seq + '_' + i, name: call.name, arguments: JSON.stringify(call.args) })); if (late) { c.push({ type: 'response.done', response: { status: 'completed' } }); setTimeout(emit, 15); } else { emit(); c.push({ type: 'response.done', response: { status: 'completed' } }); } };
  f.longReply = () => { const c = f.pcs.at(-1)?.channel, id = 'long_' + (++f.seq); c.push({ type: 'response.created', response: { id } }); c.push({ type: 'output_audio_buffer.started', response_id: id }); for (const delta of ['The first detail is complete. ', 'The second detail is complete. ', 'The final detail is complete.']) c.push({ type: 'response.output_audio_transcript.delta', response_id: id, delta }); c.push({ type: 'response.done', response: { id, status: 'completed' } }); c.push({ type: 'output_audio_buffer.stopped', response_id: id }); };
  f.staleDoneAfterInterrupt = () => { const c = f.pcs.at(-1)?.channel, oldId = 'old_' + (++f.seq), nextId = 'next_' + f.seq; c.push({ type: 'response.created', response: { id: oldId } }); c.push({ type: 'output_audio_buffer.started', response_id: oldId }); c.push({ type: 'response.output_audio_transcript.delta', response_id: oldId, delta: 'This response is interrupted.' }); c.push({ type: 'input_audio_buffer.speech_started' }); c.push({ type: 'response.created', response: { id: nextId } }); c.push({ type: 'output_audio_buffer.started', response_id: nextId }); c.push({ type: 'response.output_audio_transcript.delta', response_id: nextId, delta: 'The replacement response completes.' }); c.push({ type: 'response.done', response: { id: oldId, status: 'cancelled', status_details: { reason: 'turn_detected' } } }); c.push({ type: 'response.done', response: { id: nextId, status: 'completed' } }); c.push({ type: 'output_audio_buffer.stopped', response_id: nextId }); };
})();`;

const wait = (page, predicate, timeout = 8000) => page.waitForFunction(predicate, undefined, { timeout }).then(() => true).catch(() => false);
const browser = await chromium.launch({ headless: true, args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
try {
  const context = await browser.newContext({ permissions: ['microphone'], viewport: { width: 1280, height: 800 } });
  await context.addInitScript(FAKES);
  await context.route('**/api/concierge/capabilities', route => route.fulfill({ json: { intelligence: 'model', voice: 'native', languages: ['en', 'ur', 'ur-Latn'], enquiry: 'local', privacy: null, booking: 'none' } }));
  await context.route('**/api/concierge/realtime-token', route => route.fulfill({ json: { token: 'test', model: 'gpt-realtime-2.1', voice: 'marin', instructions: 'test', callsUrl: 'https://realtime.test/calls' } }));
  await context.route('https://realtime.test/calls', route => route.fulfill({ contentType: 'application/sdp', body: 'v=0\\r\\n' }));
  const page = await context.newPage();
  const errors = []; page.on('pageerror', error => errors.push(String(error)));
  await page.goto(`${BASE}/?qa=1`, { waitUntil: 'load', timeout: 120000 });
  await page.waitForTimeout(1800);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('wj:concierge', { detail: { action: 'open', mode: 'voice' } })));
  await wait(page, () => window.__wjConcierge?.store?.state === 'VOICE_READY');
  await page.evaluate(() => window.__wjConcierge.startListening());
  ok(await wait(page, () => window.__wjConcierge?.store?.state === 'LISTENING'), 'one direct Realtime session opens on voice activation');
  await page.evaluate(() => window.__wjRealtimeFake.say('Show me gold.', [{ name: 'showDepartment', args: { department: 'gold' } }]));
  ok(await wait(page, () => location.pathname === '/' && window.__wjConcierge?.store?.trayOpen === true), 'direct function call brings the homepage Gold chapter/result into view without stale /gold navigation');
  await page.evaluate(() => window.__wjRealtimeFake.say('Show details.', [{ name: 'scrollToSection', args: { section: 'details' } }], true));
  ok(await wait(page, () => window.__wjRealtimeFake.sent.some(e => e.item?.type === 'function_call_output')), 'validated tool result returns to the same Realtime data channel');
  await page.evaluate(async () => {
    const continuousTurns = [
      'Show me gold.', 'Show me diamond.', 'Take me to bridal.', 'Show me men\'s jewellery.',
      'Show me gold rings.', 'Take me to diamond.', 'Show me bridal pieces.', 'Show me kids jewellery.',
      'Show me gold.', 'Show me diamond.', 'Take me to bridal.', 'Show me men\'s jewellery.',
    ];
    for (let i = 0; i < 36; i++) {
      const before = window.__wjRealtimeFake.sent.filter(e => e.item?.type === 'function_call_output').length;
      const departments = ['gold', 'diamond', 'bridal', 'men'];
      window.__wjRealtimeFake.say(continuousTurns[i % continuousTurns.length], [{ name: 'showDepartment', args: { department: departments[i % departments.length] } }], i % 2 === 0);
      await new Promise(resolve => {
        const started = performance.now();
        const tick = () => window.__wjRealtimeFake.sent.filter(e => e.item?.type === 'function_call_output').length > before || performance.now() - started > 1800 ? resolve() : setTimeout(tick, 20);
        tick();
      });
      await new Promise(resolve => setTimeout(resolve, 140));
    }
  });
  const continuousOutputs = await page.evaluate(() => window.__wjRealtimeFake.sent.filter(e => e.item?.type === 'function_call_output').length);
  ok(continuousOutputs >= 37, `thirty-six continuous human-style turns, including late function-call events, return tool output (${continuousOutputs})`);
  const appointmentConfirmation = await page.evaluate(async () => {
    const f = window.__wjRealtimeFake;
    const outputCount = () => f.sent.filter(e => e.item?.type === 'function_call_output').length;
    const waitForOutput = async (before) => {
      const started = performance.now();
      while (outputCount() <= before && performance.now() - started < 3000) await new Promise(resolve => setTimeout(resolve, 20));
    };
    let before = outputCount();
    f.say('Book an appointment.', [{ name: 'fillAppointment', args: { name: 'Ayesha Khan', phone: '0300 7122859', showroom: 'Liberty Market', occasion: 'bridal', date: '2026-10-01', window: 'afternoon' } }]);
    await waitForOutput(before);
    before = outputCount();
    f.say('Review the appointment.', [{ name: 'reviewAppointment', args: {} }]);
    await waitForOutput(before);
    before = outputCount();
    f.say('Confirm appointment.', [{ name: 'submitAppointment', args: { confirmed: true } }]);
    await waitForOutput(before);
    const output = f.sent.filter(e => e.item?.type === 'function_call_output').at(-1)?.item?.output ?? '{}';
    return JSON.parse(output);
  });
  ok(appointmentConfirmation.error !== 'CONFIRMATION_REQUIRED' && appointmentConfirmation.error !== 'REVIEW_REQUIRED', 'a later explicit confirmation reaches submitAppointment after review');
  await page.evaluate(() => { window.__wjRealtimeFake.longReply(); window.__wjRealtimeFake.staleDoneAfterInterrupt(); });
  await page.waitForTimeout(180);
  const report = await page.evaluate(() => ({ pcs: window.__wjRealtimeFake.pcs.length, open: window.__wjRealtimeFake.pcs.filter(p => p.connectionState !== 'closed').length, sent: window.__wjRealtimeFake.sent, trace: window.__wjVoiceTrace?.() ?? [], turns: window.__wjConcierge.store.turns.length, state: window.__wjConcierge.store.state }));
  ok(report.pcs === 1 && report.open === 1, 'one peer connection remains for the conversation');
  ok(report.sent.some(e => e.type === 'response.create'), 'tool output triggers the grounded same-session reply');
  ok(report.trace.some(e => e.type === 'response.created') && report.trace.some(e => e.type === 'response.done') && report.trace.some(e => e.type === 'response.output_audio.delta'), 'response lifecycle and audio activity are traced');
  ok(report.trace.some(e => e.type === 'response.stale') && report.trace.some(e => e.type === 'audio.stopped'), 'late cancelled-response events cannot end the replacement audio');
  ok(report.trace.filter(e => e.type === 'response.cancel').length >= 1, 'only an intentional barge-in cancels active response audio');
  ok(!report.trace.some(e => e.type === 'response.watchdog') && report.turns <= 40 && report.state !== 'ERROR', 'long-session state remains bounded without a watchdog, stale UI transcript, or error');
  ok(!report.sent.some(e => /^session\\.(delegation|commentary|thinking)\\./.test(e.type)), 'no Live delegation or output-drain protocol is active');
  ok(errors.length === 0, `no page errors (${errors.length})`);
  await page.evaluate(() => window.__wjConcierge.close());
  ok(await wait(page, () => window.__wjRealtimeFake.pcs.every(p => p.connectionState === 'closed')), 'closing Concierge releases the peer connection');
  await context.close();
} finally { await browser.close(); }
console.log(failures.length ? `\\nvoice:check: ${failures.length} failed` : '\\nvoice:check: all passed');
process.exit(failures.length ? 1 : 0);
