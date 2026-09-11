'use client';

import { requestConcierge } from '../bridge';
import { CONCIERGE } from '../copy';
import { MicGlyph } from '@/components/ui/MicGlyph';
import { preloadOrbCanvas } from '../orb/Orb';
import { cn } from '@/lib/cn';

/**
 * The hero invitation — typographic, never boxed. The last line of the hero's type stack:
 * a hairline mic ring (a light travels its circumference every six seconds), the name, and the line.
 */
export function ConciergeInvitation({ className }: { className?: string }) {
  // the hero is on every first load; the bridge keeps the controller out of it
  return (
    <div className={cn('flex items-center gap-5', className)} data-concierge-invitation>
      <button
        type="button"
        aria-label={CONCIERGE.voice.start}
        onClick={() => requestConcierge({ mode: 'voice', autoListen: true })}
        onPointerEnter={preloadOrbCanvas}
        className="group/ring relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ivory/80 transition-colors hover:text-ivory"
      >
        <svg viewBox="0 0 40 40" className="absolute inset-0 h-full w-full" aria-hidden>
          <circle cx="20" cy="20" r="19.25" fill="none" stroke="rgba(228,207,163,0.35)" strokeWidth="1" />
          <circle cx="20" cy="20" r="19.25" fill="none" stroke="#e4cfa3" strokeWidth="1" strokeLinecap="round" pathLength="100" strokeDasharray="14 86" className="wj-ring-light" />
        </svg>
        <MicGlyph />
      </button>
      <button type="button" onClick={() => requestConcierge({ mode: 'chat' })} className="group/inv flex flex-col items-start gap-1 text-left">
        <span className="micro text-champagne">{CONCIERGE.name}</span>
        <span className="font-display italic text-[1.0625rem] leading-snug text-ivory/85 transition-colors group-hover/inv:text-ivory" style={{ fontVariationSettings: '"opsz" 16' }}>
          {CONCIERGE.placeholder}
        </span>
      </button>
    </div>
  );
}
