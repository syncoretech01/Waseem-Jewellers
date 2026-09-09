import type { Metadata, Viewport } from 'next';
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
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3300'),
  title: {
    default: 'Waseem Jewellers — Jewellery, Crafted Across Generations',
    template: '%s — Waseem Jewellers',
  },
  description:
    'Waseem Jewellers, Lahore. Bridal jewellery in gold, polki and diamonds, from a house founded in 1952.',
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
 * (returning visitor, reduced motion, coarse pointer) so CSS and the loader can
 * choose the right path before hydration. `suppressHydrationWarning` on <html>
 * covers the attribute difference.
 */
const STAMP_SCRIPT =
  "(function(){try{var d=document.documentElement;var v=localStorage.getItem('wj:visited');if(v&&Date.now()-Number(v)<86400000){d.setAttribute('data-visited','1')}if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){d.setAttribute('data-rm','1')}if(window.matchMedia('(pointer: coarse)').matches){d.setAttribute('data-coarse','1')}}catch(e){}})();";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      data-theme="dark"
      className={`${display.variable} ${sans.variable} ${urdu.variable}`}
      suppressHydrationWarning
    >
      <body>
        <script dangerouslySetInnerHTML={{ __html: STAMP_SCRIPT }} />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
