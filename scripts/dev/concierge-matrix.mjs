/**
 * Drives the keyless concierge through a matrix of commands on each route kind and prints
 * what happened: reply, tool labels, navigation, scroll, tray, ledger, consultation.
 *
 *   node scripts/dev/concierge-matrix.mjs [--only A,B] [--tier high]
 */
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const only = (opt('only', '') || '').split(',').filter(Boolean);
const tier = opt('tier', 'low');
const BASE = 'http://localhost:3300';

const SCENARIOS = [
  { id: 'A', route: '/', commands: ['hello', 'Show me collections', 'Tell me about Waseem', 'Show me something traditional', 'Open the third one'] },
  { id: 'B', route: '/', commands: ['Show me diamond pieces'] },
  { id: 'C', route: '/', commands: ['Take me to bridal'] },
  { id: 'D', route: '/collections/bridal', commands: ['Show me gold pieces', 'Show me bridal necklaces', 'Save the second one', 'Open the second one'] },
  { id: 'E', route: '/collections/bridal', commands: ['Show me the Satlada Haar', 'Tell me about the Naqsh-e-Gul choker', 'Open it'] },
  { id: 'F', route: '/jewellery/diamond-bridal-sapphire-suite', commands: ['How much is this?', 'Save this piece', 'Show me similar', 'Book an appointment', 'Where are you?', 'thank you'] },
  { id: 'G', route: '/jewellery/emerald-tassel-earrings-t06768', commands: ['Do you sell watches?', 'What is the weather', 'Show me my selection', 'Remove it'] },
  { id: 'H', route: '/', commands: ['mujhe haar dikhao', 'doosra kholo'] },
];

const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await context.newPage();
const errors = [];
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text().slice(0, 200));
  if (m.type() === 'info' && /\[concierge\]/.test(m.text())) console.log('   ·', m.text().slice(0, 300));
});
page.on('pageerror', (e) => errors.push('pageerror ' + e.message));

const snapshot = () =>
  page.evaluate(() => {
    const c = window.__wjConcierge;
    const s = c.store;
    const last = [...s.turns].reverse().find((t) => t.role === 'concierge');
    const site = window.__wj ? window.__wj.site() : null;
    return {
      state: s.state,
      panel: s.panel,
      tray: s.trayOpen,
      reply: last?.text ?? '',
      tools: (last?.tools ?? []).map((t) => `${t.status}:${t.label || t.name}`),
      result: last?.result?.kind ?? null,
      href: location.pathname + location.search,
      y: Math.round(window.scrollY),
      err: s.error?.code ?? null,
      site,
    };
  });

const waitForTurn = async () => {
  const start = Date.now();
  let quiet = 0;
  while (Date.now() - start < 14000) {
    const busy = await page.evaluate(() => ['THINKING', 'EXECUTING_ACTION', 'SPEAKING', 'OPENING', 'LISTENING'].includes(window.__wjConcierge.store.state));
    if (!busy) quiet += 1;
    else quiet = 0;
    if (quiet >= 4) return;
    await page.waitForTimeout(150);
  }
};

for (const sc of SCENARIOS) {
  if (only.length && !only.includes(sc.id)) continue;
  console.log(`\n=== ${sc.id} · ${sc.route}`);
  await page.goto(`${BASE}${sc.route}?tier=${tier}`, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForFunction(() => !!window.__wjConcierge && !!window.__wj, null, { timeout: 40000 });
  await page.waitForTimeout(2500);
  await page.evaluate(() => window.__wjConcierge.open({ mode: 'chat' }));
  await page.waitForTimeout(1200);
  for (const cmd of sc.commands) {
    await page.evaluate((c) => window.__wjConcierge.submitText(c, 'text'), cmd);
    await page.waitForTimeout(600);
    await waitForTurn();
    await page.waitForTimeout(700);
    const s = await snapshot();
    console.log(`> ${cmd}`);
    console.log(`  reply : ${s.reply}`);
    console.log(`  tools : ${s.tools.join(' | ') || '—'}   result=${s.result}   state=${s.state}/${s.panel}   tray=${s.tray}   err=${s.err}`);
    console.log(`  where : ${s.href}  y=${s.y}${s.site ? `  consult=${s.site.consultationOpen} focused=${s.site.focusedProduct}` : ''}`);
    if (!s.reply) console.log('  turn  : ' + (await page.evaluate(() => JSON.stringify(window.__wjConcierge.store.turns.slice(-2).map((t) => ({ id: t.id, role: t.role, text: t.text, streaming: t.streaming, tools: (t.tools || []).length }))))));
    if (s.panel !== 'full') {
      await page.evaluate(() => window.__wjConcierge.expand());
      await page.waitForTimeout(400);
    }
    const site = await page.evaluate(() => (window.__wj ? window.__wj.site() : null));
    if (site?.consultationOpen) {
      await page.evaluate(() => window.__wj.closeOverlays());
      await page.waitForTimeout(300);
    }
  }
}
console.log(`\nconsole errors: ${errors.length ? '\n' + errors.join('\n') : 'none'}`);
await browser.close();
