'use client';

/**
 * The single GSAP module. Every consumer imports from '@/lib/motion/gsap';
 * importing 'gsap' or 'gsap/*' anywhere else is an ESLint error.
 *
 * Only registration and the house eases live at module scope (both are SSR-safe).
 * ScrollTrigger.config / clearScrollMemory / scrollRestoration run in Providers' effect.
 */
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { CustomEase } from 'gsap/CustomEase';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText, CustomEase);

// wj.out — the settle of a heavy object coming to rest. Used for every reveal.
if (typeof window !== 'undefined' && !CustomEase.get('wj.out')) {
  CustomEase.create('wj.out', 'M0,0 C0.16,1 0.3,1 1,1');
  CustomEase.create('wj.inOut', 'M0,0 C0.76,0 0.24,1 1,1');
}

gsap.defaults({ ease: 'wj.out', duration: 0.8, overwrite: false });

export { gsap, ScrollTrigger, SplitText, CustomEase, useGSAP };
