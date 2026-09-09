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
            {
              group: ['**/generated/catalogue', '**/generated/catalogue.json', '@/data/generated/catalogue'],
              message: 'The full catalogue is server-only. Reach it through the repository at @/data/repository.',
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
];

export default config;
