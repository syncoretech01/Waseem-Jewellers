/**
 * The keyless engine's development gate.
 *
 * Compiles `src/concierge/nlu` on its own — the whole point of that folder being isomorphic
 * and DOM-free is that it can be run outside a browser — and puts the fixture set through it.
 *
 * Three numbers, and the third is the one that matters:
 *
 *   intent accuracy   ≥ 95%   did it understand what was asked
 *   slot match        ≥ 90%   did it understand what about
 *   wrong-slug action   0     did it ever act on something the visitor did not ask for
 *
 * The third has no tolerance because its failures are not degradations. Opening the wrong
 * piece is worse than admitting confusion, which is why the parser has a confidence floor
 * and returns `unknown` rather than its best guess.
 *
 * This is the *development* gate. It cannot be the acceptance gate: the fixtures and the
 * lexicon were written by the same hand, so passing proves the engine self-consistent, not
 * that a Lahore customer is understood. A blind set from native speakers is the acceptance
 * gate, and it is a person's sign-off rather than a number.
 *
 *   node scripts/dev/nlu-check.mjs
 */
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const OUT = path.join(ROOT, '.cache/nlu');
const SRC = path.join(ROOT, 'src/concierge/nlu');

fs.rmSync(OUT, { recursive: true, force: true });
const sources = fs.readdirSync(SRC).filter((f) => f.endsWith('.ts')).map((f) => path.join(SRC, f));
try {
  // CommonJS on purpose: Node's ESM resolver will not take the extensionless relative
  // specifiers TypeScript emits, and `require` will
  const tsc = path.join(ROOT, 'node_modules/typescript/lib/tsc.js');
  execFileSync(
    process.execPath,
    [tsc, ...sources, '--outDir', OUT, '--module', 'commonjs', '--target', 'es2022', '--moduleResolution', 'node', '--skipLibCheck', '--strict'],
    { stdio: 'pipe', cwd: ROOT },
  );
} catch (err) {
  console.error(String(err.stdout ?? err));
  process.exit(1);
}

const require_ = createRequire(import.meta.url);
const { parse, FLOOR } = require_(path.join(OUT, 'parse.js'));
const { FIXTURES } = require_(path.join(OUT, 'fixtures.js'));
const { LEXICON_SIZE } = require_(path.join(OUT, 'lexicon.js'));

let intentHits = 0;
let slotTotal = 0;
let slotHits = 0;
const failures = [];
const byLanguage = {};

for (const f of FIXTURES) {
  const got = parse(f.text);
  const lang = (byLanguage[f.as] ??= { n: 0, ok: 0 });
  lang.n++;

  if (got.intent === f.intent) {
    intentHits++;
    lang.ok++;
  } else {
    failures.push(`intent  ${JSON.stringify(f.text)} → ${got.intent} (${got.confidence.toFixed(2)}), wanted ${f.intent}`);
  }

  for (const [k, want] of Object.entries(f.slots ?? {})) {
    slotTotal++;
    const have = got.slots[k];
    const ok = typeof want === 'number' && typeof have === 'number' ? Math.abs(have - want) < Math.max(0.01, want * 0.01) : have === want;
    if (ok) slotHits++;
    else failures.push(`slot    ${JSON.stringify(f.text)} → ${k}=${JSON.stringify(have)}, wanted ${JSON.stringify(want)}`);
  }
}

/**
 * A wrong-slug action is any frame confident enough to act on that carries a subject the
 * visitor never named. The floor is what prevents it, so this measures whether the floor
 * holds rather than trusting that it does.
 */
const wrongSlug = FIXTURES.filter((f) => {
  const got = parse(f.text);
  if (got.confidence < FLOOR) return false;
  const wanted = f.slots ?? {};
  return ['category', 'material', 'department', 'occasion'].some((k) => got.slots[k] && wanted[k] === undefined);
});

const intentPct = (intentHits / FIXTURES.length) * 100;
const slotPct = slotTotal ? (slotHits / slotTotal) * 100 : 100;

console.log(`lexicon        ${LEXICON_SIZE} surface forms`);
console.log(`fixtures       ${FIXTURES.length} across ${Object.keys(byLanguage).length} languages`);
for (const [lang, s] of Object.entries(byLanguage)) console.log(`  ${lang.padEnd(8)} ${s.ok}/${s.n}`);
console.log(`intent         ${intentPct.toFixed(1)}%  (gate 95%)`);
console.log(`slots          ${slotPct.toFixed(1)}%  (gate 90%, ${slotHits}/${slotTotal})`);
console.log(`wrong-slug     ${wrongSlug.length}  (gate 0)`);

if (failures.length) {
  console.log('\nfailures:');
  for (const f of failures) console.log(`  ${f}`);
}
for (const f of wrongSlug) console.log(`  wrong-slug ${JSON.stringify(f.text)} → ${JSON.stringify(parse(f.text).slots)}`);

const pass = intentPct >= 95 && slotPct >= 90 && wrongSlug.length === 0;
console.log(pass ? '\nnlu: gate met' : '\nnlu: GATE NOT MET');
process.exit(pass ? 0 : 1);
