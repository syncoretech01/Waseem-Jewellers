import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const config = [
  ...nextVitals,
  ...nextTs,
  {
    ignores: ['.next/**', 'out/**', 'public/**', 'reference/**', 'media-originals/**', 'next-env.d.ts', 'scripts/**'],
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
     * The full catalogue is ~900 kB of product data and belongs to the server and the
     * build. Client code takes `generated/catalogue.slim`, which is a tenth of the size and
     * carries only what a facet UI needs.
     *
     * `src/data/products.ts` is the merge module and is the one place allowed to read it;
     * pages reach it through the repository, not directly.
     */
    files: ['src/components/**/*.{ts,tsx}', 'src/concierge/**/*.{ts,tsx}', 'src/state/**/*.{ts,tsx}', 'src/motion/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/generated/catalogue', '**/generated/catalogue.json', '@/data/generated/catalogue'],
              message: 'The full catalogue is server-only. Use the repository from @/data/repository, or generated/catalogue.slim in the browser.',
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
