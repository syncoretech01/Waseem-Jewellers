import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function Eyebrow({ children, numeral, className, ...rest }: { children: ReactNode; numeral?: string; className?: string } & HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn('eyebrow flex items-center gap-4 text-fg-2', className)} {...rest}>
      {numeral && <span className="font-display text-[1.1em] tracking-normal opacity-70">{numeral}</span>}
      <span>{children}</span>
    </p>
  );
}

export function Hairline({ className }: { className?: string }) {
  return <div aria-hidden className={cn('hairline w-full', className)} />;
}

export function Rule({ className }: { className?: string }) {
  return <div aria-hidden className={cn('rule w-full', className)} />;
}

export function SrOnly({ children }: { children: ReactNode }) {
  return <span className="sr-only">{children}</span>;
}

/** Renders an Urdu accent only when a verified string exists. */
export function UrduAccent({ text, className }: { text?: string; className?: string }) {
  if (!text) return null;
  return (
    <span lang="ur" dir="rtl" className={cn('inline-block text-fg-2', className)}>
      {text}
    </span>
  );
}

/** A tiny travelling point of light on a hairline — the house's "working" indicator. */
export function TravellingLight({ active, className }: { active: boolean; className?: string }) {
  return (
    <span aria-hidden className={cn('relative block h-px w-6 overflow-hidden bg-line', className)}>
      <span
        className="absolute inset-y-0 left-0 w-1/4 bg-gold-hi"
        style={active ? { animation: 'travel-light 1.4s ease-in-out infinite' } : { transform: 'translateX(300%)', opacity: 0 }}
      />
    </span>
  );
}
