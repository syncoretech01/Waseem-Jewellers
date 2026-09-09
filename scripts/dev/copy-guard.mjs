/**
 * Keeps "House" from creeping back in as Waseem's name for itself.
 *
 * "House of Waseem" is a competitor-adjacent device, and the recurring habit it created —
 * "Ask the House", "confirmed by the House", "a member of the House" — is the same problem
 * in smaller words. Say Waseem, Waseem Jewellers, our jewellers, our team, a Waseem
 * consultant, our Lahore showroom. See BRAND.md.
 *
 * This reads customer-facing strings only: copy modules and the string literals inside JSX.
 * Comments, identifiers and prose about the rule itself are not matches.
 *
 *   node scripts/dev/copy-guard.mjs
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const ROOTS = ['src'];
const EXT = new Set(['.ts', '.tsx']);

/** Each pattern is a phrase that must not reach a visitor. */
const BANNED = [
  { re: /House of Waseem/i, why: 'brand identity' },
  { re: /Bridal House/i, why: 'sub-brand' },
  { re: /\bthe House\b/, why: 'Waseem is not "the House"' },
  { re: /\bOur House\b/i, why: 'Waseem is not "the House"' },
  { re: /\bthe house\b/, why: 'Waseem is not "the house"' },
];

/** Lines that talk *about* the rule rather than breaking it. */
const EXEMPT = [
  /Never call Waseem/, // the model instruction that enforces this
  /copy-guard/,
  /BRAND\.md/,
];

async function* walk(dir) {
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === 'generated' || e.name.startsWith('.')) continue;
      yield* walk(p);
    } else if (EXT.has(path.extname(e.name))) {
      yield p;
    }
  }
}

/** Strips comments so the guard reads code, not commentary. */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + ' '.repeat(m.length - p1.length));
}

const hits = [];
for (const root of ROOTS) {
  for await (const file of walk(path.join(ROOT, root))) {
    const raw = await fs.readFile(file, 'utf8');
    const rawLines = raw.split('\n');
    const code = stripComments(raw);
    code.split('\n').forEach((line, i) => {
      if (EXEMPT.some((re) => re.test(line))) return;
      // An explicit escape for patterns that match a visitor's own words: a visitor may well
      // say "the house", and matching that is not the site saying it. The marker sits on the
      // line above, where it does not clutter the pattern.
      if (/copy-guard-allow/.test(rawLines[i - 1] ?? '') || /copy-guard-allow/.test(rawLines[i] ?? '')) return;
      for (const { re, why } of BANNED) {
        if (re.test(line)) {
          hits.push({ file: path.relative(ROOT, file), line: i + 1, why, text: line.trim().slice(0, 110) });
          break;
        }
      }
    });
  }
}

if (hits.length) {
  console.error(`copy-guard: ${hits.length} customer-facing use${hits.length === 1 ? '' : 's'} of "House" as Waseem's name\n`);
  for (const h of hits) console.error(`  ${h.file}:${h.line}  (${h.why})\n    ${h.text}`);
  console.error('\nSay Waseem, Waseem Jewellers, our jewellers, our team, a Waseem consultant,');
  console.error('private consultation, our Lahore showroom. See BRAND.md.');
  process.exit(1);
}
console.log('copy-guard: clean — "House" is not used as Waseem’s name.');
