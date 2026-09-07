'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { trapFocus } from '@/lib/focusTrap';
import { startScroll, stopScroll } from '@/state/runtime';
import { EASE } from '@/lib/motion/easings';
import { cn } from '@/lib/cn';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  label: string;
  children: ReactNode;
  /** center = modal card; sheet = bottom sheet (mobile); right = side panel. */
  variant?: 'center' | 'sheet' | 'right';
  theme?: 'dark' | 'ivory';
  className?: string;
  zIndex?: number;
  /** Extra veil styling (e.g. blur on HIGH). */
  veilClassName?: string;
}

const panelVariants = {
  center: {
    initial: { opacity: 0, y: 24 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE.out } },
    exit: { opacity: 0, y: 12, transition: { duration: 0.32, ease: EASE.silk } },
  },
  sheet: {
    initial: { y: '100%' },
    animate: { y: 0, transition: { duration: 0.6, ease: EASE.out } },
    exit: { y: '100%', transition: { duration: 0.4, ease: EASE.silk } },
  },
  right: {
    initial: { clipPath: 'inset(0 0 0 100%)' },
    animate: { clipPath: 'inset(0 0 0 0%)', transition: { duration: 0.7, ease: EASE.out } },
    exit: { clipPath: 'inset(0 0 0 100%)', transition: { duration: 0.45, ease: EASE.silk } },
  },
} as const;

/** Accessible dialog: veil, focus trap, Escape, scroll lock, `inert` page behind. */
export function Dialog({ open, onClose, label, children, variant = 'center', theme = 'dark', className, zIndex, veilClassName }: DialogProps) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    stopScroll();
    const page = document.getElementById('page-root');
    page?.setAttribute('inert', '');
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    let release: (() => void) | null = null;
    const raf = requestAnimationFrame(() => {
      if (panel.current) release = trapFocus(panel.current);
    });
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKey);
      page?.removeAttribute('inert');
      release?.();
      startScroll();
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="dialog"
          className="fixed inset-0"
          style={{ zIndex: zIndex ?? 'var(--z-modal)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: 0.4 } }}
          exit={{ opacity: 0, transition: { duration: 0.35, delay: 0.05 } }}
        >
          <button aria-label="Close" className={cn('absolute inset-0 cursor-default bg-ink/70', veilClassName)} onClick={onClose} tabIndex={-1} />
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-label={label}
            data-theme={theme}
            data-lenis-prevent
            className={cn(
              'absolute bg-bg text-fg',
              variant === 'center' && 'left-1/2 top-1/2 max-h-[calc(100dvh-3rem)] w-[min(560px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto',
              variant === 'sheet' && 'inset-x-0 bottom-0 max-h-[100dvh] overflow-y-auto',
              variant === 'right' && 'inset-y-0 right-0 w-[min(480px,100vw)] overflow-y-auto',
              className,
            )}
            variants={panelVariants[variant]}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
