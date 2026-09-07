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
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
];

export default config;
