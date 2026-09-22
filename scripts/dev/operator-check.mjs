#!/usr/bin/env node
/**
 * The concierge as a site operator, exercised without a model.
 *
 * A real Chromium against a running server, the capabilities route mocked to the keyless
 * engine with the appointment form kept on the device, and every tool dispatched through the
 * controller's own `runTool` — the same validator, the same events, the same store
 * transitions a model's call goes through. What is asserted is what the visitor sees:
 *
 *   navigate 'gold'          lands on /gold through the curtain
 *   navigate 'back'          returns to the previous page
 *   scrollToSection          a homepage chapter from a department page: home first, then the chapter in view
 *   fillAppointment          the form opens with the values visibly in its fields
 *   submitAppointment        refused without confirmation; with it, 'prepared' with a WJ- reference,
 *                            and no request ever reaches /api/enquiry
 *   setGalleryFrame          on a piece's page, the asked-for photograph comes into view
 *   the voice router         which rung each sentence of the demo takes — direct (the parser, no
 *                            model) or the delegation model — read through window.__wjVoiceRoute
 *
 *   node scripts/dev/operator-check.mjs [http://localhost:3300]
 */
import { chromium } from 'playwright';

const BASE = (process.argv[2] || 'http://localhost:3300').replace(/\/$/, '');
const failures = [];
const ok = (cond, what) => {
  console.log(`  ${cond ? 'ok  ' : 'FAIL'} ${what}`);
  if (!cond) failures.push(what);
};

/** The voice is advertised so the router hook is installed; no session is ever opened here (the route answers 503). */
const CAPABILITIES = { intelligence: 'keyless', languages: ['en', 'ur', 'ur-Latn', 'pa-Arab', 'pa-Guru'], voice: 'native', enquiry: 'local', privacy: null, booking: 'none' };

/** Pieces the homepage opens with; the first with two or more photographs carries the gallery test. */
const DOORS = ['royal-wedding-polki-raani-haar', 'diamond-bridal-sapphire-suite', 'rang-e-jamal-emerald-suite', 'gold-bridal-set-2', 'naqsh-e-gul-pearl-blossom-choker', 'emerald-tassel-earrings-t06768', 'lavender-halo-ring-r11912'];

const settle = (page, ms) => page.waitForTimeout(ms);
const pathOf = (page) => new URL(page.url()).pathname;
/** The appointment form, by the label the dialog announces. */
const FORM = '[role="dialog"][aria-label="Book an appointment"]';
/** The dialog's own Close control — the veil beside it closes it too, but this is the one a visitor reads. */
const closeDialog = (page, selector) =>
  page.evaluate((sel) => {
    const dialog = document.querySelector(sel);
    const button = [...(dialog?.querySelectorAll('button') ?? [])].find((b) => b.textContent?.trim() === 'Close');
    button?.click();
    return Boolean(button);
  }, selector);

/** One tool through the controller, exactly as a provider would dispatch it. */
const run = (page, name, args = {}) => page.evaluate(({ name, args }) => window.__wjConcierge.runTool(name, args), { name, args });

/** The page as the concierge itself reports it. */
const context = async (page) => (await run(page, 'getCurrentContext')).result;

/** Waits for the curtain to lift and the URL to settle on a path. */
async function arrived(page, path, timeout = 12000) {
  await page.waitForFunction((p) => location.pathname === p && !document.documentElement.classList.contains('is-transitioning'), path, { timeout }).catch(() => undefined);
  await settle(page, 400);
}

/** The element's top once the page has stopped moving. */
async function restingTop(page, selector, timeout = 6000) {
  return page.evaluate(
    ({ selector, timeout }) =>
      new Promise((resolve) => {
        const started = performance.now();
        let last = null;
        let still = 0;
        const tick = () => {
          const el = document.querySelector(selector);
          const top = el ? el.getBoundingClientRect().top : null;
          if (top !== null && last !== null && Math.abs(top - last) < 0.5) still += 1;
          else still = 0;
          last = top;
          if (still >= 6 || performance.now() - started > timeout) return resolve(top);
          setTimeout(tick, 100);
        };
        tick();
      }),
    { selector, timeout },
  );
}

/** Whether the transition layer's curtain was raised during an action. */
const watchCurtain = (page) =>
  page.evaluate(() => {
    window.__curtainSeen = false;
    const mo = new MutationObserver(() => {
      if (document.documentElement.classList.contains('is-transitioning')) window.__curtainSeen = true;
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    window.__curtainStop = () => mo.disconnect();
  });
const curtainSeen = (page) =>
  page.evaluate(() => {
    window.__curtainStop?.();
    return window.__curtainSeen === true;
  });

const browser = await chromium.launch({ headless: true });
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => {
    try {
      sessionStorage.removeItem('wj:concierge:capabilities:v1');
    } catch {}
  });
  let enquiryCalls = 0;
  await ctx.route('**/api/concierge/capabilities', (route) => route.fulfill({ json: CAPABILITIES }));
  await ctx.route('**/api/enquiry', (route) => {
    enquiryCalls += 1;
    return route.fulfill({ status: 503, json: { error: 'ENQUIRY_NOT_CONFIGURED' } });
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  console.log('\noperating the site');
  await ctx.route('**/api/concierge/live-session', (route) => route.fulfill({ status: 503, json: { error: { code: 'CONCIERGE_VOICE_OFFLINE', message: 'not in this harness' } } }));
  await page.goto(`${BASE}/?qa=1`, { waitUntil: 'load', timeout: 120000 });
  await settle(page, 3500);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('wj:concierge', { detail: { action: 'open', mode: 'chat' } })));
  await page.waitForFunction(() => typeof window.__wjConcierge?.runTool === 'function', null, { timeout: 15000 });
  await settle(page, 1200);
  ok(true, 'the concierge is mounted and exposes runTool');

  // navigate: a natural target, through the curtain
  await watchCurtain(page);
  const gold = await run(page, 'navigate', { target: 'gold' });
  await arrived(page, '/gold');
  const curtained = await curtainSeen(page);
  ok(gold.result?.ok === true && gold.result.path === '/gold', `navigate target 'gold' resolves to /gold (${JSON.stringify(gold.result)})`);
  ok(pathOf(page) === '/gold', `the visitor is on /gold (${pathOf(page)})`);
  ok(curtained, 'the transition curtain carried the navigation');

  // back: the history step, answered by the transition layer's reveal
  const back = await run(page, 'navigate', { target: 'back' });
  await arrived(page, '/');
  ok(back.result?.ok === true && back.result.path === '/', `navigate target 'back' returns to / (${JSON.stringify(back.result)})`);
  ok(pathOf(page) === '/', `the visitor is back on / (${pathOf(page)})`);

  // a homepage chapter from a department page
  await run(page, 'navigate', { target: 'gold' });
  await arrived(page, '/gold');
  const heritage = await run(page, 'scrollToSection', { section: 'heritage' });
  await arrived(page, '/');
  const top = await restingTop(page, '#ch03-heritage');
  ok(heritage.result?.ok === true, `scrollToSection 'heritage' from /gold answered (${JSON.stringify(heritage.result)})`);
  ok(pathOf(page) === '/', `it went home first (${pathOf(page)})`);
  ok(top !== null && Math.abs(top) <= 200, `#ch03-heritage rests within 200px of the top (${top === null ? 'not found' : Math.round(top)}px)`);

  // the gate and the kinds: the store carries the choice, the page follows
  const gate = await run(page, 'activateGate', { material: 'diamond' });
  await settle(page, 2200);
  const afterGate = await context(page);
  ok(gate.result?.ok === true && afterGate.gate === 'diamond', `activateGate 'diamond' is recorded for the gate chapter (${afterGate.gate})`);
  const kinds = await run(page, 'highlightCategory', { category: 'bangle' });
  await settle(page, 2200);
  const afterKinds = await context(page);
  ok(kinds.result?.ok === true && afterKinds.highlightedCategory === 'bangle', `highlightCategory 'bangle' is recorded for the window (${afterKinds.highlightedCategory})`);

  // saving is not offered on this build: the tool is gone, and the validator says so
  const saved = await run(page, 'openSaved').catch(() => null);
  ok(saved?.result?.error === 'TOOL_UNKNOWN', `openSaved is no longer a tool (${saved?.result?.error})`);

  console.log('\nthe appointment');
  const fill = await run(page, 'fillAppointment', { name: 'Ayesha Khan', phone: '0300 7122859', showroom: 'Liberty Market', occasion: 'bridal' });
  await settle(page, 900);
  const form = await page.evaluate((sel) => {
    const dialog = document.querySelector(sel);
    const radios = [...(dialog?.querySelectorAll('[role="radio"]') ?? [])];
    const checked = radios.filter((r) => r.getAttribute('aria-checked') === 'true').map((r) => r.textContent?.trim());
    return {
      open: Boolean(dialog),
      name: dialog?.querySelector('input[placeholder="Name"]')?.value ?? null,
      phone: dialog?.querySelector('input[placeholder="Telephone"]')?.value ?? null,
      checked,
    };
  }, FORM);
  ok(fill.result?.ok === true && fill.result.formOpen === true, `fillAppointment answers with the draft (${JSON.stringify(fill.result?.draft?.showroom)})`);
  ok(form.open, 'the appointment form is open');
  ok(form.name === 'Ayesha Khan', `the name is visibly in the field ("${form.name}")`);
  ok(form.phone === '0300 7122859', `the telephone is visibly in the field ("${form.phone}")`);
  ok(form.checked.includes('Liberty Market'), `the showroom is chosen by name (${form.checked.join(', ')})`);
  ok(form.checked.includes('Bridal'), `the occasion is chosen (${form.checked.join(', ')})`);
  ok(Array.isArray(fill.result?.missing) && fill.result.missing.length === 0, `nothing required is missing (${JSON.stringify(fill.result?.missing)})`);

  // the visitor's own hand wins over an older draft value, and a newer draft value wins over that
  const nameField = (page) => page.evaluate((sel) => document.querySelector(`${sel} input[placeholder="Name"]`)?.value ?? null, FORM);
  await page.evaluate((sel) => {
    const input = document.querySelector(`${sel} input[placeholder="Name"]`);
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, 'Ayesha K.');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, FORM);
  await settle(page, 200);
  const typed = await nameField(page);
  ok(typed === 'Ayesha K.', `a value the visitor types stays theirs ("${typed}")`);
  await settle(page, 20);
  await run(page, 'fillAppointment', { name: 'Ayesha Khan' });
  await settle(page, 300);
  const refilled = await nameField(page);
  ok(refilled === 'Ayesha Khan', `a later fill from the conversation is shown again ("${refilled}")`);

  const review = await run(page, 'reviewAppointment');
  ok(review.result?.draft?.showroom?.name === 'Liberty Market' && review.result.draft.occasion?.label === 'Bridal', `reviewAppointment reads it back in words (${review.result?.draft?.showroom?.name}, ${review.result?.draft?.occasion?.label})`);

  const refused = await run(page, 'submitAppointment', { confirmed: false });
  ok(refused.result?.error === 'NOT_CONFIRMED', `submitAppointment without confirmation is refused (${refused.result?.error})`);
  ok(enquiryCalls === 0, `no request reached /api/enquiry (${enquiryCalls})`);

  const sent = await run(page, 'submitAppointment', { confirmed: true });
  await settle(page, 600);
  const screen = await page.evaluate((sel) => document.querySelector(sel)?.textContent ?? '', FORM);
  ok(sent.result?.status === 'prepared', `with confirmation the outcome is 'prepared' (${sent.result?.status})`);
  ok(typeof sent.result?.reference === 'string' && /^WJ-\d{6}-[A-Z2-9]{4,6}$/.test(sent.result.reference), `it carries a WJ- reference (${sent.result?.reference})`);
  ok(sent.result?.transmitted === false && sent.result?.booked === false, 'it says nothing was transmitted and nothing was booked');
  ok(typeof sent.result?.whatsappHref === 'string' && sent.result.whatsappHref.includes('api.whatsapp.com'), 'it hands back the visitor\'s own WhatsApp line');
  ok(enquiryCalls === 0, `still no request to /api/enquiry (${enquiryCalls})`);
  ok(sent.result?.reference && screen.includes(sent.result.reference), 'the form shows the same reference on screen');
  ok(/ready/i.test(screen) && !/received|booked|confirmed/i.test(screen), 'the acknowledgement says ready, not received');
  ok(await closeDialog(page, FORM), 'the form is closed again by hand');
  await settle(page, 600);

  console.log('\nthe gallery');
  let piece = null;
  for (const slug of DOORS) {
    await run(page, 'navigate', { path: `/jewellery/${slug}` });
    await arrived(page, `/jewellery/${slug}`);
    await settle(page, 1200);
    const c = await context(page);
    if (c.routeKind === 'product' && c.gallery && c.gallery.count >= 2) {
      piece = { slug, count: c.gallery.count };
      break;
    }
  }
  ok(piece !== null, `a piece with two or more photographs is open (${piece ? `${piece.slug}, ${piece.count}` : 'none of the doors'})`);
  if (piece) {
    const before = await page.evaluate(() => document.querySelector('[data-frames] [data-frame="1"]')?.getBoundingClientRect().top ?? null);
    const frame = await run(page, 'setGalleryFrame', { index: 1 });
    const after = await restingTop(page, '[data-frames] [data-frame="1"]');
    const c = await context(page);
    ok(frame.result?.ok === true && frame.result.index === 1, `setGalleryFrame index 1 answered (${JSON.stringify(frame.result)})`);
    ok(before !== null && after !== null && after < before - 50, `the second photograph moved into view (${Math.round(before ?? 0)}px → ${Math.round(after ?? 0)}px)`);
    ok(after !== null && after >= -20 && after < 900 * 0.6, `it rests in the upper part of the viewport (${Math.round(after ?? 0)}px)`);
    ok(c.gallery?.index === 1, `the context reports frame 1 of ${c.gallery?.count} (${c.gallery?.index})`);
    const tooFar = await run(page, 'setGalleryFrame', { index: 11 });
    ok(tooFar.result?.error === 'NO_SUCH_FRAME', `a photograph that does not exist is refused (${tooFar.result?.error})`);
  }
  const offPiece = await (async () => {
    await run(page, 'navigate', { target: 'home' });
    await arrived(page, '/');
    return run(page, 'setGalleryFrame', { index: 1 });
  })();
  ok(offPiece.result?.error === 'NOT_ON_A_PIECE', `setGalleryFrame off a piece's page is refused (${offPiece.result?.error})`);

  /**
   * The keyless replies, in the visitor's language. The model route is refused the way the
   * live deployment refuses it today, so every sentence falls to the keyless engine — which
   * must mirror the language, say one word for an action, one sentence for a search, and one
   * short question for what it cannot read. Never the English capability paragraph.
   */
  console.log('\nthe replies, in the visitor\'s language (model route refused)');
  await ctx.route('**/api/concierge/turn', (route) => route.fulfill({ status: 200, contentType: 'application/x-ndjson', body: `${JSON.stringify({ type: 'turn.error', code: 'UPSTREAM', message: 'upstream 429 insufficient_quota', recoverable: true })}\n` }));
  await page.evaluate(() => window.__wjConcierge.forget());
  await settle(page, 400);
  const ask = async (text) => {
    await page.evaluate((t) => window.__wjConcierge.submitText(t, 'text'), text);
    await page.evaluate(
      () =>
        new Promise((resolve) => {
          const started = performance.now();
          const tick = () => {
            const s = window.__wjConcierge.store;
            const last = [...s.turns].reverse().find((t) => t.role === 'concierge');
            const busy = ['THINKING', 'EXECUTING_ACTION', 'SPEAKING'].includes(s.state) || last?.streaming;
            if ((!busy && last?.text && performance.now() - started > 400) || performance.now() - started > 15000) return resolve();
            setTimeout(tick, 30);
          };
          tick();
        }),
    );
    await arrived(page, pathOf(page));
    await settle(page, 900);
    return page.evaluate(() => {
      const s = window.__wjConcierge.store;
      const trace = window.__wjConcierge.qaTrace();
      return { reply: [...s.turns].reverse().find((t) => t.role === 'concierge')?.text ?? '', language: s.memory.language, rung: trace[trace.length - 1]?.rung ?? null, fallback: trace[trace.length - 1]?.fallback ?? null };
    });
  };
  let r = await ask('Mujhe gold rings dikhao.');
  ok(r.language === 'ur-Latn' && r.reply === 'Ji, chaar gold rings saamne hain.', `Roman Urdu is answered in Roman Urdu ("${r.reply}")`);
  ok(r.rung === 'keyless' && /UPSTREAM/.test(r.fallback ?? ''), `the trace records the rung and why the model did not answer (${r.rung} · ${r.fallback})`);
  r = await ask('Doosra.');
  ok(/^(Ji|Bilkul)\.$/.test(r.reply) && r.language === 'ur-Latn', `a one-word command inherits the language and is answered with one word ("${r.reply}")`);
  r = await ask('Wapas jao.');
  ok(/^(Ji|Bilkul)\.$/.test(r.reply) && pathOf(page) === '/', `"Wapas jao." goes back with one word ("${r.reply}" · ${pathOf(page)})`);
  r = await ask('Kal shaam ka time dekhna.');
  ok(r.reply === 'Maaf kijiye, dobara kahenge?', `what the engine cannot read is asked again, in Urdu ("${r.reply}")`);
  r = await ask('Menu diamond de rings dikhao.');
  ok(r.language === 'pa-Latn' && r.reply === 'Ji, chaar diamond rings saahmne ne.', `Roman Punjabi is answered in Roman Punjabi ("${r.reply}")`);
  r = await ask('Show me gold rings.');
  ok(r.language === 'en' && r.reply === 'Four gold rings are in view.', `a full English sentence is answered in English ("${r.reply}")`);
  ok(!/I may have missed that|show you pieces, open a collection/.test(r.reply), 'the capability paragraph is gone');
  await page.evaluate(() => window.__wjConcierge.forget());
  await settle(page, 400);

  /**
   * The voice router, read without a session: which rung each sentence of the demo takes.
   * A plain command is direct — the parser, no model, the site acts at once; a natural
   * sentence with qualifiers the lexicon does not carry goes to the delegation model. The
   * hook reads the page as it is, so the pieces are brought first and the form opened for
   * the sentences that answer it.
   */
  console.log('\nthe voice router: which rung each sentence takes');
  await page.evaluate(() => window.__wjConcierge.forget());
  await page.evaluate(() => window.__wjConcierge.runTool('searchProducts', { category: 'ring', material: 'gold', limit: 4 }));
  await settle(page, 1200);
  const route = (text) => page.evaluate((t) => window.__wjVoiceRoute(t), text);
  const DIRECT = [
    ['Gold.', 'core_department'], ['Show rings.', 'core_search'], ['Second one.', 'core_open'], ['Back.', 'back'], ['Diamond.', 'core_department'], ['Open it.', 'core_open'], ['Book an appointment.', 'consultation'],
    ['Doosra wala kholo.', 'core_open'], ['Nahi, pehla.', 'core_open'], ['Wapas jao.', 'back'], ['Liberty mein appointment karwani hai.', 'consultation'],
    ['Show me gold rings.', 'core_search'], ['Something lighter.', 'core_lighter'], ['Open the second one.', 'core_open'], ['Go back.', 'back'], ['Take me to Bridal.', 'core_department'], ['Is se thora halka.', 'core_lighter'], ['Iska price kya hai.', 'price'],
    ['Menu diamond de rings dikhao.', 'core_search'], ['Compare the first two', 'compare'], ['close', 'close'],
  ];
  const ASTRA = ['Show me something elegant for walima.', 'Mujhe baraat ke liye kuch heavy gold mein dikhao.', 'Mujhe bridal mein kuch elegant dikhao.', 'Gold mein koi simple ring dikhao.', 'Walima ke liye something classy.', 'Walima ke liye kuch elegant dikhao.', 'what would work with this necklace', 'around four lakh for a nikah', 'something similar but lighter and less traditional', 'Walima ke liye elegant diamond piece chahiye, not too heavy', 'Kal shaam ka time dekhna.'];
  for (const [text, plan] of DIRECT) {
    const r = await route(text);
    ok(r.rung === 'direct' && r.plan === plan, `direct · ${plan.padEnd(16)} "${text}" (${r.rung} · ${r.plan} · ${r.language} · ${r.why})`);
  }
  for (const text of ASTRA) {
    const r = await route(text);
    ok(r.rung === 'astra', `astra  · ${r.plan.padEnd(16)} "${text}" (${r.why})`);
  }
  await run(page, 'openAppointment', {});
  await settle(page, 600);
  for (const text of ['Liberty.', 'MM Alam kar dein.', 'Actually MM Alam.', 'ایم ایم عالم کر دیں.', 'م م عالم کر دیں.', '0300 7122859']) {
    const r = await route(text);
    ok(r.rung === 'direct' && r.plan === 'appointment_field', `direct · appointment_field "${text}" while the form is open (${r.rung} · ${r.plan})`);
  }
  ok(await closeDialog(page, FORM), 'the form is closed again by hand');
  await settle(page, 400);
  await page.evaluate(() => window.__wjConcierge.forget());
  await settle(page, 300);

  console.log('\nclosing');
  const bye = await run(page, 'closeConcierge');
  await settle(page, 2400);
  const state = await page.evaluate(() => window.__wjConcierge.store.state);
  ok(bye.result?.ok === true && state === 'IDLE', `closeConcierge closes the panel after the goodbye (${state})`);

  ok(errors.length === 0, `no page errors (${errors.length}${errors.length ? `: ${errors[0]}` : ''})`);
  await ctx.close();
} finally {
  await browser.close();
}

console.log(failures.length ? `\noperator-check: ${failures.length} failed` : '\noperator-check: all passed');
process.exit(failures.length ? 1 : 0);
