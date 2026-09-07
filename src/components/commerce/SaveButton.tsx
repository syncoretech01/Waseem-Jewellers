'use client';

import { motion, useReducedMotion } from 'motion/react';
import { useIsSaved, useSiteStore } from '@/state/siteStore';
import { cn } from '@/lib/cn';

interface SaveButtonProps {
  slug: string;
  /** compact = mark only (cards); full = label + mark (product page). */
  variant?: 'compact' | 'full';
  className?: string;
  onSaved?: (saved: boolean) => void;
}

/** A jewel mark that fills when the piece is kept in the visitor's selection. */
export function SaveButton({ slug, variant = 'compact', className, onSaved }: SaveButtonProps) {
  const saved = useIsSaved(slug);
  const hydrated = useSiteStore((s) => s.hydrated);
  const toggle = useSiteStore((s) => s.toggleWishlist);
  const openLedger = useSiteStore((s) => s.openLedger);
  const reduced = useReducedMotion();
  const isSaved = hydrated && saved;

  const mark = (
    <motion.svg
      viewBox="0 0 24 24"
      width={variant === 'full' ? 16 : 18}
      height={variant === 'full' ? 16 : 18}
      aria-hidden
      animate={isSaved && !reduced ? { scale: [1, 1.28, 1] } : { scale: 1 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="shrink-0"
    >
      <path d="M12 2.5 19 9.5 12 21.5 5 9.5Z" fill={isSaved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1} strokeLinejoin="round" />
      <path d="M5 9.5h14M8.5 9.5 12 2.5l3.5 7" fill="none" stroke="currentColor" strokeWidth={1} strokeLinejoin="round" opacity={isSaved ? 0.35 : 0.7} />
    </motion.svg>
  );

  if (variant === 'compact') {
    return (
      <button
        type="button"
        aria-pressed={isSaved}
        aria-label={isSaved ? 'Remove from your selection' : 'Keep this piece in your selection'}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          toggle(slug);
          onSaved?.(!isSaved);
        }}
        className={cn('inline-flex h-10 w-10 items-center justify-center text-fg-2 transition-colors duration-300 hover:text-accent', className)}
        data-cursor="save"
      >
        {mark}
      </button>
    );
  }

  return (
    <button
      type="button"
      aria-pressed={isSaved}
      onClick={() => {
        if (isSaved) {
          openLedger();
          return;
        }
        toggle(slug);
        onSaved?.(true);
      }}
      className={cn('group/save inline-flex items-center gap-3 text-fg transition-colors duration-500 hover:text-accent', className)}
    >
      {mark}
      <span className="relative pb-1 font-sans text-[0.75rem] uppercase tracking-[0.22em]">
        {isSaved ? 'Saved · View selection' : 'Save piece'}
        <span aria-hidden className="absolute inset-x-0 bottom-0 h-px bg-line-strong" />
        <span aria-hidden className="hairline absolute inset-x-0 bottom-0 origin-left scale-x-0 transition-transform duration-700 ease-[var(--ease-out-expo)] group-hover/save:scale-x-100" />
      </span>
    </button>
  );
}
