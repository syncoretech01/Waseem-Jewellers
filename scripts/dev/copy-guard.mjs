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
  /**
   * Stage 2.2: a showroom, not a salon; an appointment or a viewing, never a "private
   * consultation". The lookarounds leave `data-salon` and `--salon-well` alone — internal
   * names are not customer copy.
   */
  { re: /(?<![\w-])salons?(?![\w-])/i, why: 'a showroom, not a salon' },
  { re: /private consultations?/i, why: 'say "book an appointment" or "book a viewing"' },
  /**
   * Stage 2.3: the appointment is "an appointment" or "a viewing", never a "private" one —
   * the adjective was the last trace of the consultation vocabulary, in the placeholder and
   * the greeting. "House of Waseem" is matched case-insensitively above; a visitor-facing
   * "Salon" is caught by the salon rule.
   */
  { re: /private (?:appointment|viewing)s?/i, why: 'say "an appointment" or "a viewing", never a "private" one' },
  { re: /\b(?:request|arrange|arranging|book) an? (?:private )?consultation\b/i, why: 'say "request an appointment"' },
  { re: /\bconsultation (?:details|form|request)s?\b/i, why: 'say "appointment …"' },
  /**
   * The semantic figures move attention between regions of a finished photograph. Nothing
   * anywhere may describe that as how a piece was *made*: no process imagery exists — no
   * band before its stone, no empty setting — so the words would be describing something
   * nobody has photographed. This vocabulary is reserved for the day that changes.
   */
  { re: /how (?:it|one|this piece|the piece) (?:is|was) (?:constructed|assembled|built|put together)/i, why: 'region attention is composition, not process' },
  { re: /\b(?:constructed|assembled) (?:by hand|in the workshop)\b/i, why: 'no process imagery exists to support this' },
];

/** Lines that talk *about* the rule rather than breaking it. */
const EXEMPT = [
  /Never call Waseem/, // the model instruction that enforces this
  /copy-guard/,
  /BRAND\.md/,
  // the register filter's own strip patterns — `[/…House…/g, 'Waseem']` — exist to remove the word, not to say it
  /^\s*\[\/.*\/g?i?, '/,
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
  console.error(`copy-guard: ${hits.length} customer-facing use${hits.length === 1 ? '' : 's'} of a banned phrase\n`);
  for (const h of hits) console.error(`  ${h.file}:${h.line}  (${h.why})\n    ${h.text}`);
  console.error('\nSay Waseem, Waseem Jewellers, our jewellers, our team; book an appointment, book a viewing,');
  console.error('visit a showroom, request details, enquire, speak with our team, ask Waseem Concierge. See BRAND.md.');
  process.exit(1);
}
console.log('copy-guard: clean — no banned phrase reaches a visitor.');
