/**
 * Proof that a webhook by itself does not start sending anyone's details anywhere.
 *
 * The rule for activating server-side enquiry delivery is a destination AND a canonical origin
 * AND a privacy statement AND a privacy contact. It is a rule about personal data leaving a
 * visitor's device, so it is not left to code review: this compiles the readiness predicate on
 * its own and asserts every partial configuration stays local. It runs on every
 * `npm run check`, and it fails the build if any single variable — the webhook above all —
 * is ever enough on its own.
 *
 *   node scripts/dev/enquiry-check.mjs
 */
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const OUT = path.join(ROOT, '.cache/enquiry');
const SRC = path.join(ROOT, 'src/server/enquiry/readiness.ts');

fs.rmSync(OUT, { recursive: true, force: true });
const tsc = path.join(ROOT, 'node_modules/typescript/lib/tsc.js');
execFileSync(process.execPath, [tsc, '--outDir', OUT, '--module', 'commonjs', '--target', 'es2022', '--moduleResolution', 'node', '--skipLibCheck', SRC], { stdio: 'inherit' });

const require = createRequire(import.meta.url);
const { assessEnquiryReadiness, ENQUIRY_ENV } = require(path.join(OUT, 'readiness.js'));

const WEBHOOK = 'https://hooks.example.com/waseem';
const ORIGIN = 'https://waseemjewellers.com';
const PRIVACY = 'https://waseemjewellers.com/privacy';
const CONTACT = 'privacy@waseemjewellers.com';

const full = {
  [ENQUIRY_ENV.destination]: WEBHOOK,
  [ENQUIRY_ENV.origin]: ORIGIN,
  [ENQUIRY_ENV.privacyUrl]: PRIVACY,
  [ENQUIRY_ENV.privacyContact]: CONTACT,
};

const without = (key) => Object.fromEntries(Object.entries(full).filter(([k]) => k !== key));

let failed = 0;
const check = (label, env, want) => {
  const r = assessEnquiryReadiness(env);
  const ok = r.ready === want.ready && JSON.stringify([...r.missing].sort()) === JSON.stringify([...(want.missing ?? [])].sort());
  if (!ok) failed++;
  const mode = r.ready ? 'server' : 'local ';
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${mode}  ${label.padEnd(44)} missing: ${r.missing.join(', ') || '—'}`);
};

console.log('enquiry readiness — a visitor\'s details leave the device only when every part is true\n');

// the one that matters most: the webhook alone changes nothing
check('webhook only', { [ENQUIRY_ENV.destination]: WEBHOOK }, { ready: false, missing: ['origin', 'privacyUrl', 'privacyContact'] });
check('nothing configured', {}, { ready: false, missing: ['destination', 'origin', 'privacyUrl', 'privacyContact'] });

// each of the four, absent on its own, is enough to keep it local
check('all but the destination', without(ENQUIRY_ENV.destination), { ready: false, missing: ['destination'] });
check('all but the origin', without(ENQUIRY_ENV.origin), { ready: false, missing: ['origin'] });
check('all but the privacy statement', without(ENQUIRY_ENV.privacyUrl), { ready: false, missing: ['privacyUrl'] });
check('all but the privacy contact', without(ENQUIRY_ENV.privacyContact), { ready: false, missing: ['privacyContact'] });

// present but malformed is the same as absent
check('webhook is not a URL', { ...full, [ENQUIRY_ENV.destination]: 'hooks.example.com' }, { ready: false, missing: ['destination'] });
check('webhook is plain http off localhost', { ...full, [ENQUIRY_ENV.destination]: 'http://hooks.example.com/x' }, { ready: false, missing: ['destination'] });
check('privacy URL is a relative path', { ...full, [ENQUIRY_ENV.privacyUrl]: '/privacy' }, { ready: false, missing: ['privacyUrl'] });
check('privacy contact is a word', { ...full, [ENQUIRY_ENV.privacyContact]: 'privacy team' }, { ready: false, missing: ['privacyContact'] });
check('whitespace is not a value', { ...full, [ENQUIRY_ENV.privacyContact]: '   ' }, { ready: false, missing: ['privacyContact'] });

// and the complete configuration is ready
check('every part present', full, { ready: true });
check('a telephone number is a valid contact', { ...full, [ENQUIRY_ENV.privacyContact]: '+92 300 7122859' }, { ready: true });
check('http on localhost, for a local run', { ...full, [ENQUIRY_ENV.origin]: 'http://localhost:3300' }, { ready: true });

// the origin the route compares against is normalised
const ready = assessEnquiryReadiness({ ...full, [ENQUIRY_ENV.origin]: 'https://waseemjewellers.com/some/path?x=1' });
const originOk = ready.ready && ready.config.origin === 'https://waseemjewellers.com';
if (!originOk) failed++;
console.log(`${originOk ? 'ok  ' : 'FAIL'}  origin normalised to scheme+host             -> ${ready.config?.origin}`);

console.log(failed ? `\nenquiry: ${failed} check(s) FAILED — a partial configuration would have activated delivery` : '\nenquiry: gate met — the webhook alone leaves the form on the device');
process.exit(failed ? 1 : 0);
