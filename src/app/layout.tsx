import type { Metadata, Viewport } from 'next';
import { siteUrl } from '@/lib/siteUrl';
import { assertCatalogue } from '@/data/catalogue';
import { Bodoni_Moda, Instrument_Sans, Noto_Nastaliq_Urdu } from 'next/font/google';
import 'lenis/dist/lenis.css';
import './globals.css';
import { Providers } from './providers';

const display = Bodoni_Moda({
  subsets: ['latin'],
  weight: 'variable',
  style: ['normal', 'italic'],
  axes: ['opsz'],
  display: 'swap',
  variable: '--font-display',
});

const sans = Instrument_Sans({
  subsets: ['latin'],
  weight: 'variable',
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-sans',
});

const urdu = Noto_Nastaliq_Urdu({
  subsets: ['arabic'],
  weight: 'variable',
  display: 'swap',
  preload: false,
  variable: '--font-urdu',
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: 'Waseem Jewellers — Jewellery, Crafted Across Generations',
    template: '%s — Waseem Jewellers',
  },
  description:
    'Waseem Jewellers, Lahore. Bridal jewellery in gold, polki and diamonds, from a Lahore jeweller founded in 1952.',
  openGraph: {
    title: 'Waseem Jewellers — A Legacy in Jewellery Since 1952',
    description: 'Bridal jewellery in gold, polki and diamonds. Lahore, since 1952.',
    images: ['/assets/waseem/og/home.jpg'],
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: '#0b0a09',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

/**
 * Runs synchronously before the body paints. It only stamps attributes on <html>
 * (returning visitor, reduced motion, coarse pointer, and a first guess at the tier) so
 * CSS and the loader can choose the right path before hydration. `suppressHydrationWarning`
 * on <html> covers the attribute difference.
 *
 * `data-tier-guess` is what the device says about itself before a WebGL probe can be run:
 * `reduced`, `low` (a coarse pointer, save-data, four gigabytes or less, a narrow window) or
 * `medium` (a desktop; HIGH needs the renderer string, which only `detectQuality` reads).
 * `data-weak` marks two gigabytes, two cores or save-data — the device that is handed the
 * prerendered chapter rather than the scene. `detectQuality` (`src/lib/quality.ts`) makes the
 * same decisions with more information a few hundred milliseconds later and overwrites
 * `data-tier`; the guess exists so nothing heavy has to be built first and taken back.
 */
const STAMP_SCRIPT =
  "(function(){try{var d=document.documentElement;var v=localStorage.getItem('wj:visited');if(v&&Date.now()-Number(v)<86400000){d.setAttribute('data-visited','1')}var rm=window.matchMedia('(prefers-reduced-motion: reduce)').matches;if(rm){d.setAttribute('data-rm','1')}var co=window.matchMedia('(pointer: coarse)').matches;if(co){d.setAttribute('data-coarse','1')}var n=navigator;var m=n.deviceMemory||8;var c=n.hardwareConcurrency||4;var sd=!!(n.connection&&n.connection.saveData);if(m<=2||c<=2||sd){d.setAttribute('data-weak','1')}d.setAttribute('data-tier-guess',rm?'reduced':(co||sd||m<=4||window.innerWidth<768)?'low':'medium')}catch(e){}})();";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // development-only, and on the server: it needs the whole catalogue, which is exactly
  // what the browser must not be handed
  assertCatalogue();
  return (
    <html
      lang="en"
      data-theme="dark"
      className={`${display.variable} ${sans.variable} ${urdu.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* the long tail of the catalogue is resized by the shop's own CDN; the connection is opened before the first tile asks */}
        <link rel="preconnect" href="https://cdn.shopify.com" />
      </head>
      <body>
        <script dangerouslySetInnerHTML={{ __html: STAMP_SCRIPT }} />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
