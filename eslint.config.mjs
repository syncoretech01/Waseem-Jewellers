import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const config = [
  ...nextVitals,
  ...nextTs,
  {
    ignores: ['.next/**', '.cache/**', 'out/**', 'public/**', 'reference/**', 'media-originals/**', 'next-env.d.ts', 'scripts/**'],
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/lib/motion/gsap.ts', 'src/lib/motion/lazyPlugins.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'gsap', message: "Import from '@/lib/motion/gsap' instead." },
            { name: 'gsap/all', message: "Import from '@/lib/motion/gsap' instead." },
            { name: '@gsap/react', message: "Import useGSAP from '@/lib/motion/gsap' instead." },
          ],
          patterns: [{ group: ['gsap/*'], message: "Import from '@/lib/motion/gsap' instead." }],
        },
      ],
    },
  },
  {
    /**
     * The full catalogue is ~1 MB of product data and belongs to the server and the build.
     * `src/data/products.ts` is the merge module and the one place allowed to read it;
     * everything else reaches the catalogue through the repository, which hands a page the
     * rows it needs and nothing more.
     *
     * The GSAP restrictions are repeated here on purpose: a flat config's later block
     * *replaces* a rule rather than extending it, so listing only the catalogue pattern
     * would quietly lift the GSAP ban from exactly the files most likely to import it.
     */
    files: ['src/components/**/*.{ts,tsx}', 'src/concierge/**/*.{ts,tsx}', 'src/state/**/*.{ts,tsx}', 'src/motion/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'gsap', message: "Import from '@/lib/motion/gsap' instead." },
            { name: 'gsap/all', message: "Import from '@/lib/motion/gsap' instead." },
            { name: '@gsap/react', message: "Import useGSAP from '@/lib/motion/gsap' instead." },
          ],
          patterns: [
            { group: ['gsap/*'], message: "Import from '@/lib/motion/gsap' instead." },
            /**
             * Every path that reaches the merged catalogue, not merely the generated one.
             *
             * The narrower rule this replaces guarded `generated/catalogue` and nothing else,
             * so it never fired: `@/data` re-exported `products.ts`, and a component
             * importing `getImage` from the barrel pulled 656 products into the client
             * bundle transitively. 1.14 MB of it, unnoticed.
             */
            {
              group: [
                '**/generated/catalogue',
                '**/generated/catalogue.json',
                '@/data/generated/catalogue',
                '@/data/products',
                '@/data/catalogue',
                '@/data/repository',
                '@/data/search',
              ],
              message:
                'The merged catalogue is a megabyte and belongs to the server. In the browser use @/data/clientIndex, which is fetched on demand; on the server reach it through @/data/repository.',
            },
            /**
             * The second of three layers keeping the API key out of the browser. The first is
             * `import 'server-only'` in every `src/server` module; the third is
             * `scripts/dev/secret-scan.mjs`, which greps the built client chunks for the key's
             * actual value before `npm run check` passes.
             */
            {
              group: ['@/server/*', '@/server/**'],
              message: 'Server modules hold the API key. The browser reaches them through /api routes, never by importing them.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    /**
     * `as never` is banned where it once did damage. It turned an unrecognised value into a
     * query that scored -100 against every product and returned an empty room, silently, on
     * every path it touched. `src/data/vocabulary.ts` narrows instead; a value that is not in
     * the vocabulary becomes `undefined`, and an undefined filter matches everything rather
     * than nothing. The rule keeps it that way.
     */
    files: ['src/concierge/**/*.{ts,tsx}', 'src/data/**/*.{ts,tsx}', 'src/server/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'TSAsExpression > TSNeverKeyword',
          message: 'Narrow the value through @/data/vocabulary (asCategory, asDepartment, ...) instead of casting it to never.',
        },
      ],
    },
  },
];

export default config;
