#!/usr/bin/env node
/**
 * Cost-free Realtime Concierge integration check.
 *
 * It drives the real browser controller, validator and browser tool executor through a fake
 * WebRTC data channel. The only fakes are media transport and the Realtime model's selected
 * function calls. No OpenAI session is opened. This verifies the frozen seam:
 *
 *   microphone -> WebRTC -> direct function -> real site action -> function output ->
 *   the same Realtime session -> one short reply.
 *
 * Run: node scripts/dev/voice-check.mjs [http://localhost:3300]
 */
import { chromium } from 'playwright';

const BASE = (process.argv[2] || 'http://localhost:3300').replace(/\/$/, '');
const failures = [];

function check(condition, message) {
  console.log('  ' + (condition ? 'ok  ' : 'FAIL') + ' ' + message);
  if (!condition) failures.push(message);
}

function installFakes() {
  const fake = {
    pcs: [],
    sent: [],
    calls: [],
    sessions: 0,
    sequence: 0,
    cancelled: 0,
    cleared: 0,
    speechTimers: [],
    speaking: false,
  };
  window.__fakeRealtime = fake;
  window.__speechTouched = 0;

  for (const key of ['SpeechRecognition', 'webkitSpeechRecognition', 'speechSynthesis', 'SpeechSynthesisUtterance']) {
    Object.defineProperty(window, key, {
      configurable: true,
      get() {
        window.__speechTouched += 1;
        return undefined;
      },
    });
  }

  class FakeDataChannel {
    constructor(label) {
      this.label = label;
      this.readyState = 'connecting';
      this.onopen = null;
      this.onmessage = null;
      this.onclose = null;
      this.onerror = null;
    }
    send(data) {
      const event = JSON.parse(data);
      fake.sent.push(event);
      fake.onSend(event, this);
    }
    close() {
      if (this.readyState === 'closed') return;
      this.readyState = 'closed';
      if (this.onclose) this.onclose(new Event('close'));
    }
    open() {
      this.readyState = 'open';
      if (this.onopen) this.onopen(new Event('open'));
    }
    push(event) {
      if (this.readyState !== 'open') return;
      event.event_id = event.event_id || 'evt_' + (++fake.sequence);
      if (this.onmessage) this.onmessage(new MessageEvent('message', { data: JSON.stringify(event) }));
    }
  }

  class FakeSender {
    constructor(track) {
      this.track = track || null;
    }
    async replaceTrack(track) {
      this.track = track;
    }
  }

  class FakePeerConnection {
    constructor() {
      this.connectionState = 'new';
      this.iceGatheringState = 'complete';
      this.localDescription = null;
      this.ontrack = null;
      this.onconnectionstatechange = null;
      this.channel = null;
      this.closed = false;
      fake.pcs.push(this);
    }
    addEventListener() {}
    removeEventListener() {}
    addTrack(track) {
      return new FakeSender(track);
    }
    addTransceiver() {
      return { sender: new FakeSender() };
    }
    createDataChannel(label) {
      this.channel = new FakeDataChannel(label);
      return this.channel;
    }
    async createOffer() {
      return { type: 'offer', sdp: 'v=0\r\no=- 0 0 IN IP4 127.0.0.1\r\ns=-\r\n' };
    }
    async setLocalDescription(description) {
      this.localDescription = description;
    }
    async setRemoteDescription() {
      this.connectionState = 'connected';
      fake.sessions += 1;
      const stream = new MediaStream();
      window.setTimeout(() => {
        if (this.closed) return;
        if (this.ontrack) this.ontrack({ streams: [stream] });
        if (this.channel) this.channel.open();
      }, 20);
    }
    close() {
      if (this.closed) return;
      this.closed = true;
      this.connectionState = 'closed';
      if (this.onconnectionstatechange) this.onconnectionstatechange();
      if (this.channel) this.channel.close();
    }
    async getStats() {
      return new Map();
    }
  }

  window.RTCPeerConnection = FakePeerConnection;
  fake.channel = function () {
    const pc = fake.pcs[fake.pcs.length - 1];
    return pc ? pc.channel : null;
  };
  fake.openPcs = function () {
    return fake.pcs.filter((pc) => !pc.closed).length;
  };
  fake.stopSpeech = function (notify) {
    for (const timer of fake.speechTimers) window.clearTimeout(timer);
    fake.speechTimers = [];
    if (!fake.speaking) return;
    fake.speaking = false;
    if (notify) {
      const channel = fake.channel();
      if (channel) channel.push({ type: 'output_audio_buffer.stopped' });
    }
  };
  fake.reply = function (call) {
    const channel = fake.channel();
    if (!channel || call.replySent) return;
    call.replySent = true;
    call.replyCount += 1;
    channel.push({ type: 'response.created', response: { id: 'reply_' + call.id } });
    channel.push({ type: 'output_audio_buffer.started' });
    channel.push({ type: 'response.output_audio_transcript.delta', delta: call.reply });
    fake.speaking = true;
    const timer = window.setTimeout(() => {
      fake.speaking = false;
      channel.push({ type: 'output_audio_buffer.stopped' });
      channel.push({ type: 'response.done', response: { status: 'completed', output: [] } });
      call.replyDone = true;
    }, call.duration);
    fake.speechTimers.push(timer);
  };
  fake.emitFunctionCall = function (call) {
    const channel = fake.channel();
    if (!channel) return;
    const item = { type: 'function_call', call_id: call.id, name: call.name, arguments: JSON.stringify(call.args || {}) };
    channel.push({ type: 'response.function_call_arguments.done', call_id: call.id, name: call.name, arguments: item.arguments });
    // Realtime can deliver the same call through more than one event. The client must dedupe it.
    channel.push({ type: 'response.output_item.done', item });
    channel.push({ type: 'response.done', response: { status: 'completed', output: [item] } });
  };
  fake.hear = function (text, name, args, reply, duration) {
    const channel = fake.channel();
    if (!channel) throw new Error('Realtime channel is not open');
    const id = 'call_' + (++fake.sequence);
    const itemId = 'item_' + fake.sequence;
    const call = {
      id,
      text,
      name,
      args,
      reply: reply || 'Ji.',
      duration: typeof duration === 'number' ? duration : 120,
      output: null,
      outputCount: 0,
      replyCount: 0,
      replySent: false,
      replyDone: false,
    };
    fake.calls.push(call);
    channel.push({ type: 'input_audio_buffer.speech_started' });
    channel.push({ type: 'conversation.item.input_audio_transcription.delta', delta: text });
    channel.push({ type: 'input_audio_buffer.speech_stopped', item_id: itemId });
    channel.push({ type: 'conversation.item.input_audio_transcription.completed', item_id: itemId, transcript: text });
    channel.push({ type: 'response.created', response: { id: 'tool_' + id } });
    fake.emitFunctionCall(call);
    return id;
  };
  fake.hearCompound = function (text, first, second, reply, duration) {
    const channel = fake.channel();
    if (!channel) throw new Error('Realtime channel is not open');
    const makeCall = (request) => ({
      id: 'call_' + (++fake.sequence),
      text,
      name: request.name,
      args: request.args,
      reply: reply || 'Ji.',
      duration: typeof duration === 'number' ? duration : 120,
      output: null,
      outputCount: 0,
      replyCount: 0,
      replySent: false,
      replyDone: false,
      continued: false,
      next: null,
    });
    const firstCall = makeCall(first);
    const secondCall = makeCall(second);
    firstCall.next = secondCall;
    fake.calls.push(firstCall, secondCall);
    const itemId = 'item_' + fake.sequence;
    channel.push({ type: 'input_audio_buffer.speech_started' });
    channel.push({ type: 'conversation.item.input_audio_transcription.delta', delta: text });
    channel.push({ type: 'input_audio_buffer.speech_stopped', item_id: itemId });
    channel.push({ type: 'conversation.item.input_audio_transcription.completed', item_id: itemId, transcript: text });
    channel.push({ type: 'response.created', response: { id: 'tool_' + firstCall.id } });
    fake.emitFunctionCall(firstCall);
    return [firstCall.id, secondCall.id];
  };
  fake.stallAfterSpeech = function (text) {
    const channel = fake.channel();
    if (!channel) throw new Error('Realtime channel is not open');
    const itemId = 'item_' + (++fake.sequence);
    channel.push({ type: 'input_audio_buffer.speech_started' });
    channel.push({ type: 'conversation.item.input_audio_transcription.delta', delta: text });
    channel.push({ type: 'input_audio_buffer.speech_stopped', item_id: itemId });
    channel.push({ type: 'conversation.item.input_audio_transcription.completed', item_id: itemId, transcript: text });
  };
  fake.onSend = function (event, channel) {
    if (
      event.type === 'conversation.item.create' &&
      event.item &&
      event.item.type === 'function_call_output'
    ) {
      const call = fake.calls.find((entry) => entry.id === event.item.call_id);
      if (call) {
        call.outputCount += 1;
        call.output = event.item.output;
      }
      return;
    }
    if (event.type === 'response.create' && event.response) {
      const call = fake.calls.find((entry) => entry.output !== null && !entry.replySent && !entry.continued);
      if (call && call.next) {
        call.continued = true;
        window.setTimeout(() => {
          channel.push({ type: 'response.created', response: { id: 'tool_' + call.next.id } });
          fake.emitFunctionCall(call.next);
        }, 8);
      } else if (call) {
        window.setTimeout(() => fake.reply(call), 8);
      }
      return;
    }
    if (event.type === 'response.cancel') {
      fake.cancelled += 1;
      return;
    }
    if (event.type === 'output_audio_buffer.clear') {
      fake.cleared += 1;
      fake.stopSpeech(false);
      channel.push({ type: 'output_audio_buffer.cleared' });
    }
  };
}

const CAPABILITIES = {
  intelligence: 'keyless',
  languages: ['en', 'ur', 'ur-Latn', 'pa-Arab', 'pa-Guru'],
  voice: 'native',
  enquiry: 'local',
  privacy: null,
  booking: 'none',
};

const SESSION_ANSWER = {
  model: 'gpt-realtime-2.1',
  voice: 'marin',
  sdp: 'v=0\r\no=- 1 1 IN IP4 127.0.0.1\r\ns=-\r\n',
};

const sleep = (page, ms) => page.waitForTimeout(ms);

async function until(page, predicate, arg, timeout = 8000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (await page.evaluate(predicate, arg)) return true;
    await sleep(page, 40);
  }
  return false;
}

async function waitState(page, states, timeout = 8000) {
  return until(page, (wanted) => wanted.includes(window.__wjConcierge?.store?.state), states, timeout);
}

async function createContext(browser, sessionStatus = 200, capabilityDelayMs = 0) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    permissions: ['microphone'],
  });
  await context.addInitScript(installFakes);
  const calls = { realtime: [], delegate: [], turn: [] };
  await context.route('**/api/concierge/capabilities', async (route) => {
    if (capabilityDelayMs) await new Promise((resolve) => setTimeout(resolve, capabilityDelayMs));
    await route.fulfill({ json: CAPABILITIES });
  });
  await context.route('**/api/concierge/realtime-session', (route) => {
    calls.realtime.push(JSON.parse(route.request().postData() || '{}'));
    if (sessionStatus !== 200) {
      return route.fulfill({
        status: sessionStatus,
        json: { error: { code: 'test_unavailable', message: 'Realtime test session unavailable' } },
      });
    }
    return route.fulfill({ json: SESSION_ANSWER });
  });
  await context.route('**/api/concierge/delegate', (route) => {
    calls.delegate.push(JSON.parse(route.request().postData() || '{}'));
    return route.fulfill({ status: 500, body: 'legacy delegate must not be used' });
  });
  await context.route('**/api/concierge/turn', (route) => {
    calls.turn.push(JSON.parse(route.request().postData() || '{}'));
    return route.fulfill({ status: 500, body: 'text turn must not be used while Realtime is healthy' });
  });
  return { context, calls };
}

async function openVoice(page, path = '/') {
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  const separator = path.includes('?') ? '&' : '?';
  await page.goto(BASE + path + separator + 'qa=1', { waitUntil: 'load', timeout: 120000 });
  await sleep(page, 1200);
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('wj:concierge', { detail: { action: 'open', mode: 'voice' } }));
  });
  const ready = await waitState(page, ['VOICE_READY']);
  return { errors, ready };
}

async function tell(page, text, name, args, reply, duration, waitForReplyDone = true) {
  const before = await page.evaluate(() => window.__fakeRealtime.calls.length);
  await page.evaluate(
    (request) => window.__fakeRealtime.hear(request.text, request.name, request.args, request.reply, request.duration),
    { text, name, args, reply, duration },
  );
  const output = await until(
    page,
    (index) => Boolean(window.__fakeRealtime.calls[index] && window.__fakeRealtime.calls[index].output !== null),
    before,
  );
  const replyStarted = await until(
    page,
    (index) => Boolean(window.__fakeRealtime.calls[index] && window.__fakeRealtime.calls[index].replyCount === 1),
    before,
  );
  const complete = waitForReplyDone
    ? await until(
    page,
    (index) => Boolean(window.__fakeRealtime.calls[index] && window.__fakeRealtime.calls[index].replyDone),
    before,
      )
    : true;
  const call = await page.evaluate((index) => window.__fakeRealtime.calls[index], before);
  check(output && replyStarted && complete, name + ' returns a result and a same-session reply');
  check(call && call.outputCount === 1, name + ' has one function_call_output despite duplicate call events');
  check(call && call.replyCount === 1, name + ' has exactly one spoken reply');
  return call;
}

async function tellCompound(page, text, first, second, reply, duration) {
  const before = await page.evaluate(() => window.__fakeRealtime.calls.length);
  await page.evaluate(
    (request) => window.__fakeRealtime.hearCompound(request.text, request.first, request.second, request.reply, request.duration),
    { text, first, second, reply, duration },
  );
  const complete = await until(
    page,
    (index) => {
      const calls = window.__fakeRealtime.calls.slice(index, index + 2);
      return calls.length === 2 && calls.every((call) => call.output !== null) && calls[1].replyDone;
    },
    before,
  );
  const calls = await page.evaluate((index) => window.__fakeRealtime.calls.slice(index, index + 2), before);
  check(complete, first.name + ' then ' + second.name + ' completes in one visitor turn');
  check(calls[0]?.outputCount === 1 && calls[1]?.outputCount === 1, 'compound request returns one function output per grounded action');
  check(calls[0]?.replyCount === 0 && calls[1]?.replyCount === 1, 'compound request produces one final spoken reply');
  return calls;
}

async function recentSlugs(page) {
  return page.evaluate(() => window.__wjConcierge.store.recentResults.map((piece) => piece.slug));
}

const browser = await chromium.launch({
  headless: true,
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'],
});

try {
  {
    console.log('\nvoice activation and fallback');
    const { context, calls } = await createContext(browser, 502);
    const page = await context.newPage();
    const opened = await openVoice(page, '/gold');
    check(opened.ready, 'voice panel opens ready');
    check(calls.realtime.length === 0, 'opening the panel creates no paid Realtime session');
    await page.evaluate(() => window.__wjConcierge.startListening());
    const fallback = await until(
      page,
      () => window.__wjConcierge.store.mode === 'chat' && window.__wjConcierge.store.state === 'CHAT',
      undefined,
      12000,
    );
    check(fallback, 'a Realtime failure falls back to text Concierge');
    check(calls.realtime.length === 1, 'one session is requested only after the explicit voice tap');
    const speechTouched = await page.evaluate(() => window.__speechTouched);
    check(speechTouched === 0, 'browser SpeechRecognition and SpeechSynthesis stay untouched');
    check(opened.errors.length === 0, 'fallback has no page errors');
    await context.close();
  }

  {
    console.log('\ndirect Realtime owner flow');
    // Hold the free capability probe long enough to exercise a visitor tapping Voice before
    // it returns. That must wait for Realtime, never run the scripted example.
    const { context, calls } = await createContext(browser, 200, 1800);
    const page = await context.newPage();
    const opened = await openVoice(page, '/');
    check(opened.ready, 'voice panel is ready on the homepage');
    check(calls.realtime.length === 0, 'opening voice still creates no session');

    await page.evaluate(() => window.__wjConcierge.startListening());
    const listening = await waitState(page, ['LISTENING']);
    const audit = await page.evaluate(() => window.__wjVoiceAudit && window.__wjVoiceAudit());
    check(listening, 'one explicit tap opens mic and Realtime session');
    check(
      audit && audit.streams === 1 && audit.liveTracks === 1 && audit.openPeerConnections === 1 && audit.sessions === 1 && audit.sessionOpen,
      'one microphone, connection and persistent session are active',
    );
    check(calls.realtime.length === 1, 'only one Realtime session was created');
    const earlyTap = await page.evaluate(() => ({
      adapter: window.__wjConcierge.store.voice.adapter,
      examples: window.__wjConcierge.store.turns.filter((turn) => turn.role === 'visitor' && turn.source === 'example').length,
    }));
    check(earlyTap.adapter === 'realtime' && earlyTap.examples === 0, 'an early voice tap waits for Realtime and never runs a scripted example');
    check(calls.realtime[0].context && !('name' in calls.realtime[0].context), 'session context excludes appointment personal data');

    await tell(page, 'Gold.', 'showDepartment', { department: 'gold' }, 'Ji.');
    check(await page.evaluate(() => location.pathname === '/'), 'homepage department command stays on its homepage chapter');

    await tell(page, 'Show me gold rings.', 'searchProducts', { category: 'ring', material: 'gold', limit: 4 }, 'Four gold rings are on the page.');
    let slugs = await recentSlugs(page);
    check(slugs.length >= 2, 'gold ring search produces ordinal-ready catalogue results');

    await tell(page, 'Something lighter.', 'refineResults', { weight: 'lighter', limit: 4 }, 'Lighter options are on the page.');
    await tell(page, 'Compare the first and second.', 'comparePieces', { slugs: slugs.slice(0, 2) }, 'The first two are side by side.');
    check(
      await page.evaluate(() => window.__wjConcierge.store.turns.some((turn) => turn.result && turn.result.kind === 'compare')),
      'comparison is rendered by the authoritative browser tool',
    );

    await tellCompound(
      page,
      'Open the second one and scroll down.',
      { name: 'openProduct', args: { slug: slugs[1] } },
      { name: 'scrollToProductDetails', args: {} },
      'Here are the details.',
    );
    const openedProduct = await until(page, (slug) => location.pathname === '/jewellery/' + slug, slugs[1]);
    check(openedProduct, 'compound ordinal product action changes to the selected product route');
    await tell(page, 'Show similar pieces.', 'showSimilarPieces', { slug: slugs[1], limit: 4 }, 'Here are similar pieces.');
    await tell(page, 'What matches this?', 'showMatchingPieces', { slug: slugs[1], limit: 4 }, 'These pair beautifully.');
    await tell(page, 'Go back.', 'goBack', {}, 'Bilkul.');
    const backed = await until(page, () => !location.pathname.startsWith('/jewellery/'));
    check(backed, 'goBack returns from the product route without a separate router');

    await tell(page, 'Mujhe bridal mein kuch elegant dikhao.', 'searchProducts', { department: 'bridal', style: 'bridal', limit: 4 }, 'Chaar bridal pieces saamne hain.');
    slugs = await recentSlugs(page);
    check(slugs.length >= 2, 'bridal search leaves ordinal context in the same session');
    await tell(page, 'Doosra wala kholo.', 'openProduct', { slug: slugs[1] }, 'Yeh raha.');
    const urduContinuity = await page.evaluate(() => window.__wjConcierge.store.memory.language);
    check(urduContinuity === 'ur-Latn', 'Roman Urdu survives the short ordinal follow-up');
    await tell(page, 'Is se thora halka.', 'refineResults', { weight: 'lighter', limit: 4 }, 'Halkay options saamne hain.');
    await tell(page, 'Iska price kya hai.', 'getProductFacts', {}, 'Iski price on request hai.');

    await tell(page, 'Liberty mein appointment karwani hai.', 'openAppointment', { topic: 'bridal' }, 'Ji.');
    await tell(page, 'Liberty.', 'fillAppointment', { showroom: 'Liberty Market' }, 'Liberty select kar diya hai.');
    await tell(page, 'Mera naam Ayesha hai aur phone 03001234567.', 'fillAppointment', { name: 'Ayesha', phone: '03001234567' }, 'Naam aur number likh diye hain.');
    const appointmentFields = await page.evaluate(() => ({
      name: document.querySelector('input[autocomplete="name"]')?.value || '',
      phone: document.querySelector('input[autocomplete="tel"]')?.value || '',
      liberty: Array.from(document.querySelectorAll('[role="radio"]')).some((node) => node.textContent?.includes('Liberty') && node.getAttribute('aria-checked') === 'true'),
    }));
    check(appointmentFields.name === 'Ayesha' && appointmentFields.phone === '03001234567' && appointmentFields.liberty, 'appointment details are visibly filled, not submitted');

    await tell(page, 'Actually MM Alam.', 'fillAppointment', { showroom: 'MM Alam Road' }, 'MM Alam select kar diya hai.');
    const mmAlam = await page.evaluate(() => Array.from(document.querySelectorAll('[role="radio"]')).some((node) => node.textContent?.includes('MM Alam') && node.getAttribute('aria-checked') === 'true'));
    check(mmAlam, 'showroom correction replaces Liberty with MM Alam');

    const longReply = await tell(page, 'Review it.', 'reviewAppointment', {}, 'MM Alam ke liye draft tayyar hai.', 3000, false);
    check(longReply && longReply.replyCount === 1, 'review begins one reply before interruption');
    const speaking = await until(page, () => window.__fakeRealtime.speaking === true, undefined, 1500);
    check(speaking, 'Realtime output is active before barge-in');
    const cancelBefore = await page.evaluate(() => window.__fakeRealtime.cancelled);
    const clearBefore = await page.evaluate(() => window.__fakeRealtime.cleared);
    await tell(page, 'Ruko, mera naam Ayesha hai.', 'fillAppointment', { name: 'Ayesha' }, 'Ji.');
    const barge = await page.evaluate(() => ({
      cancelled: window.__fakeRealtime.cancelled,
      cleared: window.__fakeRealtime.cleared,
      audit: window.__wjVoiceAudit && window.__wjVoiceAudit(),
    }));
    check(barge.cancelled === cancelBefore + 1 && barge.cleared === clearBefore + 1, 'barge-in sends native cancel and output clear once');
    check(
      barge.audit && barge.audit.streams === 1 && barge.audit.liveTracks === 1 && barge.audit.openPeerConnections === 1 && barge.audit.sessions === 1 && barge.audit.sessionOpen,
      'barge-in keeps the same microphone and Realtime session',
    );

    const recoveryBefore = await page.evaluate(
      () => window.__fakeRealtime.sent.filter((event) => event.type === 'response.create' && !event.response).length,
    );
    await page.evaluate(() => window.__fakeRealtime.stallAfterSpeech('Please show gold.'));
    const recovered = await until(
      page,
      (count) => window.__fakeRealtime.sent.filter((event) => event.type === 'response.create' && !event.response).length === count + 1,
      recoveryBefore,
      4000,
    );
    check(recovered, 'a committed VAD turn without model activity gets one same-session recovery response request');
    const settledAfterUnacknowledgedResponse = await waitState(page, ['VOICE_READY'], 7000);
    check(settledAfterUnacknowledgedResponse, 'an unanswered recovery request settles the stage instead of leaving it listening forever');

    const transport = await page.evaluate(() => ({
      legacyAppends: window.__fakeRealtime.sent.filter((event) => /^session\.(commentary|thinking)\.append$/.test(event.type)).length,
      responseCreates: window.__fakeRealtime.sent.filter((event) => event.type === 'response.create' && event.response && event.response.tool_choice === 'auto').length,
      trace: (window.__wjVoiceTrace ? window.__wjVoiceTrace() : []).map((entry) => entry.type),
      speechTouched: window.__speechTouched,
    }));
    check(calls.delegate.length === 0 && calls.turn.length === 0, 'healthy voice uses neither delegation nor text-turn routes');
    check(transport.legacyAppends === 0, 'no Live commentary, thinking or output-drain layer remains');
    check(!transport.trace.some((type) => /delegate|astra|output\.drain|fact\.queued/.test(type)), 'voice trace contains no retired routing or drain events');
    check(transport.speechTouched === 0, 'no browser speech fallback is touched');

    await page.evaluate(() => window.__wjConcierge.close());
    const released = await until(page, () => {
      const audit = window.__wjVoiceAudit && window.__wjVoiceAudit();
      return Boolean(audit && audit.liveTracks === 0 && audit.openPeerConnections === 0 && !audit.sessionOpen && window.__fakeRealtime.openPcs() === 0);
    });
    check(released, 'closing Concierge releases the microphone, peer connection and Realtime session');
    check(opened.errors.length === 0, 'owner flow has no page errors');
    await context.close();
  }
} finally {
  await browser.close();
}

console.log(failures.length ? '\nvoice-check: ' + failures.length + ' failed' : '\nvoice-check: all passed');
process.exit(failures.length ? 1 : 0);
