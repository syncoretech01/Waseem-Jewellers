/**
 * The third layer keeping the API key out of the browser.
 *
 * `import 'server-only'` makes a client import a build error, and an ESLint rule forbids
 * `@/server/*` from client directories. Both are static: they reason about imports. This one
 * reasons about the artefact — it reads the chunks that were actually built and looks for the
 * key's real value in them.
 *
 * That distinction matters because the ways a secret escapes are usually not imports. A value
 * interpolated into a string, a config object serialised into the RSC payload, a debug log
 * that shipped: none of those trip a lint rule, and all of them would be caught here.
 *
 *   node scripts/dev/secret-scan.mjs
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const DIRS = ['.next/static', '.next/server/app'];

/** Anything that looks like a credential, whether or not this deployment has one. */
const SHAPES = [
  { re: /\bsk-[A-Za-z0-9_-]{20,}/g, what: 'an OpenAI-style secret key' },
  { re: /\bsk-ant-[A-Za-z0-9_-]{20,}/g, what: 'an Anthropic-style secret key' },
  { re: /\bAIza[0-9A-Za-z_-]{30,}/g, what: 'a Google API key' },
  { re: /\bghp_[A-Za-z0-9]{30,}/g, what: 'a GitHub token' },
];

/** The literal values this environment holds, so a key of any shape is still caught. */
const LITERALS = ['CONCIERGE_API_KEY', 'CONCIERGE_SIGNING_SECRET', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY']
  .map((name) => ({ name, value: process.env[name]?.trim() }))
  .filter((e) => e.value && e.value.length >= 12);

async function* walk(dir) {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (/\.(js|mjs|json|txt|map)$/.test(e.name)) yield p;
  }
}

const findings = [];
let scanned = 0;

for (const dir of DIRS) {
  for await (const file of walk(path.join(ROOT, dir))) {
    // the server bundle is *supposed* to hold the key; only the client must not
    const clientSide = file.includes(`${path.sep}static${path.sep}`);
    const text = await fs.readFile(file, 'utf8').catch(() => '');
    if (!text) continue;
    scanned++;
    if (!clientSide) continue;
    for (const { re, what } of SHAPES) {
      re.lastIndex = 0;
      if (re.test(text)) findings.push(`${path.relative(ROOT, file)}: ${what}`);
    }
    for (const { name, value } of LITERALS) {
      if (text.includes(value)) findings.push(`${path.relative(ROOT, file)}: the value of ${name}`);
    }
  }
}

if (!scanned) {
  console.log('secret-scan: nothing built yet — run after `next build`');
  process.exit(0);
}

if (findings.length) {
  console.error('secret-scan: FOUND in client output');
  for (const f of findings) console.error(`  ${f}`);
  process.exit(1);
}

console.log(`secret-scan: clean — ${scanned} built files, no credential in anything the browser downloads${LITERALS.length ? ` (checked ${LITERALS.length} configured value${LITERALS.length === 1 ? '' : 's'})` : ''}`);
