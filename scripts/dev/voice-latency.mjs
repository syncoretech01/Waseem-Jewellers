#!/usr/bin/env node
/**
 * Manual, headed Realtime acceptance monitor. It never supplies microphone audio.
 * A human activates Voice; diagnostics are journaled outside the browser as events arrive.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2);
const valueAfter = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] && !args[index + 1].startsWith('--') ? args[index + 1] : fallback;
};
const has = (name) => args.includes(name);
const base = valueAfter('--base', 'https://waseem-jewellers-two.vercel.app').replace(/\/$/, '');
const FREE_CHECK = has('--free-check');
const MAX_VISITOR_TURNS = 20;
const seconds = Math.max(30, Math.min(720, Number(valueAfter('--seconds', '720')) || 720));
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const out = path.resolve(valueAfter('--out', path.join(ROOT, '.cache', 'realtime-human', timestamp)));

if (!FREE_CHECK && (!has('--paid-human') || !has('--headed'))) {
  console.error('Refusing to start Realtime. A paid human test requires both --paid-human and --headed.');
  console.error('This monitor never uses synthetic audio. Run the free harness check first: node scripts/dev/voice-latency.mjs --free-check');
  process.exit(1);
}

const median = (values) => {
  const ordered = values.filter((value) => typeof value === 'number').sort((a, b) => a - b);
  if (!ordered.length) return null;
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle] : Math.round((ordered[middle - 1] + ordered[middle]) / 2);
};
const activeRealtimeAudit = (audit) =>
  Boolean(audit && audit.liveTracks === 1 && audit.openPeerConnections === 1 && audit.sessionOpen === true);
const sensitiveKey = /api[_-]?key|authorization|token|secret|credential|password|cookie/i;
const secretValue = /(?:sk-|bearer\s+)[A-Za-z0-9_\-.]+/i;

function redact(value, key = '') {
  if (sensitiveKey.test(key)) return '[redacted]';
  if (typeof value === 'string') return secretValue.test(value) ? '[redacted]' : value;
  if (Array.isArray(value)) return value.map((item) => redact(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([entryKey, entryValue]) => [entryKey, redact(entryValue, entryKey)]));
  }
  return value;
}

class QaJournal {
  constructor(directory) {
    this.directory = directory;
    this.eventsPath = path.join(directory, 'events.jsonl');
    this.checkpointPath = path.join(directory, 'checkpoint.json');
    this.turns = new Map();
    this.errors = [];
    this.audit = null;
    this.startedAt = null;
    fs.mkdirSync(directory, { recursive: true });
  }

  ingest(rawEvent) {
    const event = redact(rawEvent ?? {});
    event.at ??= new Date().toISOString();
    if (event.type === 'session.active') this.startedAt ??= event.at;
    if (event.type === 'turn.complete' || event.type === 'turn.incomplete') this.turns.set(event.turn.id, event.turn);
    if (event.type === 'realtime.error') this.errors.push(event.error);
    if (event.audit) this.audit = event.audit;
    fs.appendFileSync(this.eventsPath, JSON.stringify(event) + '\n');
    this.checkpoint();
  }

  checkpoint() {
    const checkpoint = {
      kind: 'manual-human-realtime-checkpoint',
      updatedAt: new Date().toISOString(),
      startedAt: this.startedAt,
      completedTurns: [...this.turns.values()].filter((turn) => turn.status === 'complete'),
      activeTurns: [...this.turns.values()].filter((turn) => turn.status !== 'complete'),
      errors: this.errors,
      audit: this.audit,
    };
    const temporary = this.checkpointPath + '.tmp';
    fs.writeFileSync(temporary, JSON.stringify(checkpoint, null, 2));
    fs.renameSync(temporary, this.checkpointPath);
  }

  finalise({ baseUrl, reason, sessionRequests, errors, closure, usage = null }) {
    for (const turn of this.turns.values()) {
      if (turn.status !== 'complete') {
        turn.status = 'incomplete';
        turn.termination = reason;
      }
    }
    this.checkpoint();
    const completedTurns = [...this.turns.values()].filter((turn) => turn.status === 'complete');
    const report = redact({
      kind: 'manual-human-realtime-check',
      base: baseUrl,
      startedAt: this.startedAt,
      completedAt: new Date().toISOString(),
      humanRequired: true,
      completion: { reason, visitorTurns: completedTurns.length },
      visitorTurnLimit: MAX_VISITOR_TURNS,
      sessionRequests,
      timing: {
        medianSpeechToModelOrToolMs: median(completedTurns.map((turn) => turn.timing?.speechToModelOrToolMs)),
        medianToolCallToResultMs: median(completedTurns.map((turn) => turn.timing?.toolCallToResultMs)),
        medianToolResultToFirstAudioMs: median(completedTurns.map((turn) => turn.timing?.toolResultToFirstAudioMs)),
        medianVisibleActionMs: median(completedTurns.map((turn) => turn.timing?.visibleActionMs)),
        medianFirstAudioMs: median(completedTurns.map((turn) => turn.timing?.firstAudioMs)),
      },
      turns: [...this.turns.values()],
      errors: [...this.errors, ...errors],
      audit: this.audit,
      usage,
      closure,
    });
    fs.writeFileSync(path.join(this.directory, 'report.json'), JSON.stringify(report, null, 2));
    return report;
  }
}

function pageUnavailable(page, context, browser) {
  try {
    return !page || page.isClosed() || !browser?.isConnected() || context?.pages().length === 0;
  } catch {
    return true;
  }
}
async function safelyEvaluate(page, context, browser, expression, fallback = null) {
  if (pageUnavailable(page, context, browser)) return fallback;
  try {
    return await page.evaluate(expression);
  } catch {
    return fallback;
  }
}

async function installDiagnosticObserver(page) {
  await page.evaluate(() => {
    if (window.__wjHumanQaObserverInstalled) return;
    const controller = window.__wjConcierge;
    if (!controller) return;
    window.__wjHumanQaObserverInstalled = true;
    let nextTurn = 0;
    let current = null;
    const publish = (event) => {
      try {
        void window.__wjHumanQaPersist(event);
      } catch {
        // The page can disappear while a human closes it. Prior journal events remain saved.
      }
    };
    const audit = () => window.__wjVoiceAudit ? window.__wjVoiceAudit() : null;
    const compact = (value) => {
      if (!value || typeof value !== 'object') return value ?? null;
      const products = Array.isArray(value.products) ? value.products : Array.isArray(value.items) ? value.items : [];
      return {
        kind: value.kind ?? null,
        count: value.count ?? products.length ?? null,
        productSlug: value.product?.slug ?? value.slug ?? null,
        slugs: products.slice(0, 8).map((product) => product?.slug).filter(Boolean),
        message: value.message ?? null,
      };
    };
    const timingFor = (turn) => {
      const trace = window.__wjVoiceTrace ? window.__wjVoiceTrace() : [];
      const stops = trace.filter((entry) => entry.type === 'speech.stopped');
      const start = stops[turn.stopIndex];
      if (!start) return {};
      const end = stops[turn.stopIndex + 1]?.t ?? Infinity;
      const first = (type) => trace.find((entry) => entry.t >= start.t && entry.t < end && entry.type === type);
      const model = first('response.created');
      const toolCall = first('tool.start');
      const toolResult = first('tool.result');
      const audio = first('audio.started');
      return {
        speechStoppedAt: start.t,
        speechToModelOrToolMs: (model ?? toolCall) ? (model ?? toolCall).t - start.t : null,
        toolCallToResultMs: toolCall && toolResult ? toolResult.t - toolCall.t : null,
        toolResultToFirstAudioMs: toolResult && audio ? audio.t - toolResult.t : null,
        visibleActionMs: toolResult ? toolResult.t - start.t : null,
        firstAudioMs: audio ? audio.t - start.t : null,
      };
    };
    const original = controller.onEvent.bind(controller);
    controller.onEvent = (event) => {
      if (event.type === 'voice.utterance' && event.final) {
        const trace = window.__wjVoiceTrace ? window.__wjVoiceTrace() : [];
        current = {
          id: ++nextTurn,
          status: 'active',
          timestamp: new Date().toISOString(),
          transcript: event.text ?? '',
          tools: [],
          result: null,
          reply: null,
          stopIndex: Math.max(0, trace.filter((entry) => entry.type === 'speech.stopped').length - 1),
        };
        publish({ type: 'turn.incomplete', turn: current, audit: audit() });
      }
      if (current && event.type === 'tool.call') {
        current.tools.push({ name: event.name ?? null, args: event.args ?? null, result: null });
        publish({ type: 'tool.call', turnId: current.id, tool: current.tools.at(-1), audit: audit() });
      }
      if (current && event.type === 'tool.result') {
        const tool = [...current.tools].reverse().find((item) => item.result === null);
        if (tool) tool.result = compact(event.outcome);
        current.result = compact(event.outcome);
        publish({ type: 'tool.result', turnId: current.id, tool: tool ?? null, result: current.result, audit: audit() });
      }
      if (current && event.type === 'text.done') current.reply = event.text ?? null;
      if (current && (event.type === 'turn.done' || event.type === 'turn.error')) {
        current.status = event.type === 'turn.done' ? 'complete' : 'incomplete';
        current.error = event.type === 'turn.error' ? event.message ?? 'turn error' : null;
        current.timing = timingFor(current);
        const trace = window.__wjVoiceTrace ? window.__wjVoiceTrace() : [];
        const start = current.timing.speechStoppedAt ?? -Infinity;
        const end = trace.filter((entry) => entry.type === 'speech.stopped').find((entry) => entry.t > start)?.t ?? Infinity;
        current.watchdogActivated = trace.some((entry) => entry.type === 'response.recover' && entry.t >= start && entry.t < end);
        current.realtimeErrors = trace.filter((entry) => entry.type === 'realtime.error' && entry.t >= start && entry.t < end).map((entry) => entry.detail ?? 'Realtime error');
        current.audit = audit();
        publish({ type: current.status === 'complete' ? 'turn.complete' : 'turn.incomplete', turn: current, audit: current.audit });
        current = null;
      }
      if (event.type === 'realtime.error') publish({ type: 'realtime.error', error: event.message ?? event.detail ?? 'Realtime error', audit: audit() });
      return original(event);
    };
    publish({ type: 'observer.ready', audit: audit() });
  });
}

async function waitForActiveRealtime(page, context, browser, journal, stopped) {
  while (!stopped.reason && !pageUnavailable(page, context, browser)) {
    const audit = await safelyEvaluate(page, context, browser, () => window.__wjVoiceAudit ? window.__wjVoiceAudit() : null);
    if (activeRealtimeAudit(audit)) {
      journal.ingest({ type: 'session.active', audit });
      return audit;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return null;
}

async function waitForCompletion({ page, context, browser, journal, stopped }) {
  return new Promise((resolve) => {
    let settled = false;
    let lastCount = 0;
    const finish = (reason) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearInterval(poll);
      process.stdin.pause();
      resolve({ reason, visitorTurns: lastCount });
    };
    const timer = setTimeout(() => finish('time-cap'), seconds * 1000);
    const poll = setInterval(async () => {
      if (settled) return;
      if (stopped.reason) return finish(stopped.reason);
      if (pageUnavailable(page, context, browser)) return finish('browser-closed');
      const audit = await safelyEvaluate(page, context, browser, () => window.__wjVoiceAudit ? window.__wjVoiceAudit() : null);
      if (!audit) return finish('browser-closed');
      journal.ingest({ type: 'audit.sample', audit });
      const count = [...journal.turns.values()].filter((turn) => turn.status === 'complete').length;
      if (count !== lastCount) {
        lastCount = count;
        console.log('Visitor turns: ' + count + '/' + MAX_VISITOR_TURNS);
      }
      if (!audit.sessionOpen && lastCount > 0) finish('voice-closed');
      if (count >= MAX_VISITOR_TURNS) finish('turn-cap');
    }, 250);
    page.once('close', () => finish('page-closed'));
    context.once('close', () => finish('context-closed'));
    browser.once('disconnected', () => finish('browser-disconnected'));
    process.stdin.resume();
    process.stdin.once('data', () => finish('tester-finished'));
  });
}

const journal = new QaJournal(out);
let browser = null;
let context = null;
let page = null;
const errors = [];
let realtimeRequests = 0;
const stopped = { reason: null };
process.once('SIGINT', () => {
  stopped.reason = 'sigint';
});

try {
  browser = await chromium.launch({ headless: FREE_CHECK });
  context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  page = await context.newPage();
  await page.exposeBinding('__wjHumanQaPersist', (_source, event) => journal.ingest(event));
  page.on('pageerror', (error) => {
    const message = String(error).slice(0, 300);
    errors.push(message);
    journal.ingest({ type: 'page.error', error: message });
  });
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const error = message.text().slice(0, 300);
    errors.push(error);
    journal.ingest({ type: 'console.error', error });
  });
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/concierge/realtime-session') realtimeRequests += 1;
  });

  await page.goto(base + '/?qa=1', { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => Boolean(window.__wjConcierge), null, { timeout: 60000 });
  await installDiagnosticObserver(page);
  if (FREE_CHECK) {
    const before = await safelyEvaluate(page, context, browser, () => window.__wjVoiceAudit ? window.__wjVoiceAudit() : null);
    if (activeRealtimeAudit(before) || realtimeRequests !== 0) throw new Error('free wait was not free');
    await new Promise((resolve) => setTimeout(resolve, 400));
    if (realtimeRequests !== 0) throw new Error('a Realtime request occurred before activation');
    await page.evaluate(() => {
      Object.defineProperty(window, '__wjVoiceAudit', {
        configurable: true,
        value: () => ({ streams: 1, liveTracks: 1, peerConnections: 1, openPeerConnections: 1, sessions: 1, sessionOpen: true }),
      });
    });
    await waitForActiveRealtime(page, context, browser, journal, stopped);
    if (realtimeRequests !== 0) throw new Error('active-session gate made a Realtime request');
    const simulateBrowserClose = has('--free-close-check');
    if (simulateBrowserClose) await page.close();
    const report = journal.finalise({
      baseUrl: base,
      reason: simulateBrowserClose ? 'page-closed' : 'free-check',
      sessionRequests: realtimeRequests,
      errors,
      closure: {
        closed: simulateBrowserClose,
        audit: simulateBrowserClose ? journal.audit : await safelyEvaluate(page, context, browser, () => window.__wjVoiceAudit ? window.__wjVoiceAudit() : null),
      },
    });
    console.log('free human-harness check: passed (free wait held; active-session gate detected; no Realtime request).');
    if (simulateBrowserClose) console.log('free browser-close check: passed (report written without a post-close page evaluation).');
    console.log('Saved ' + path.relative(ROOT, out));
    console.log('Completed turns: ' + report.completion.visitorTurns);
  } else {
    console.log('BROWSER READY — click the Concierge, activate Voice, allow microphone permission, then begin speaking.');
    console.log('This is a free waiting state: no timer runs and no Realtime session is created until the active-session gate passes.');
    const activeAudit = await waitForActiveRealtime(page, context, browser, journal, stopped);
    if (!activeAudit) {
      const report = journal.finalise({
        baseUrl: base,
        reason: stopped.reason ?? 'browser-closed-before-activation',
        sessionRequests: realtimeRequests,
        errors,
        closure: { closed: true, audit: journal.audit },
      });
      console.log('Browser closed before Voice activation; free wait ended normally. Saved ' + path.relative(ROOT, out));
      console.log('Completed turns: ' + report.completion.visitorTurns);
    } else {
      errors.splice(0, errors.length);
      console.log('REALTIME ACTIVE — ' + Math.round(seconds / 60) + '-minute acceptance timer started; maximum ' + MAX_VISITOR_TURNS + ' visitor turns. Press Enter here when finished.');
      const completion = await waitForCompletion({ page, context, browser, journal, stopped });
      const stillOpen = !pageUnavailable(page, context, browser);
      const finalAudit = stillOpen
        ? await safelyEvaluate(page, context, browser, () => window.__wjVoiceAudit ? window.__wjVoiceAudit() : null)
        : journal.audit;
      if (stillOpen && !['page-closed', 'context-closed', 'browser-disconnected'].includes(completion.reason)) {
        await safelyEvaluate(page, context, browser, () => window.__wjConcierge?.close());
      }
      const report = journal.finalise({
        baseUrl: base,
        reason: completion.reason,
        sessionRequests: realtimeRequests,
        errors,
        closure: { closed: !stillOpen || !finalAudit?.sessionOpen, audit: finalAudit },
      });
      console.log('Saved ' + path.relative(ROOT, out));
      console.log('Median speech end to visible action: ' + (report.timing.medianVisibleActionMs ?? 'not observed') + ' ms');
      console.log('Median speech end to first audio: ' + (report.timing.medianFirstAudioMs ?? 'not observed') + ' ms');
      console.log('Final voice audit: ' + JSON.stringify(finalAudit));
    }
  }
} finally {
  await context?.close().catch(() => {});
  await browser?.close().catch(() => {});
}
