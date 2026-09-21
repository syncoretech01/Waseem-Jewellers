'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { TransitionLink } from '@/components/motion/TransitionLink';
import { cn } from '@/lib/cn';

type Variant = 'bracket' | 'hairline' | 'text';

interface BaseProps {
  variant?: Variant;
  tone?: 'default' | 'ivory';
  size?: 'sm' | 'md';
  className?: string;
  children: ReactNode;
  cursor?: string;
}

type ButtonProps = BaseProps &
  (
    | ({ href: string; kind?: 'curtain' | 'veil'; onNavigate?: () => void; target?: string } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'className'>)
    | ({ href?: undefined } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'className'>)
  );

/**
 * The house button. `bracket` = [ LABEL ] whose brackets breathe apart on hover;
 * `hairline` = tracked label with a gold hairline that draws beneath it; `text` = plain tracked label.
 */
export function Button(props: ButtonProps) {
  const { variant = 'bracket', size = 'md', className, children, cursor, ...rest } = props;
  const base = cn(
    'group/btn relative inline-flex items-center gap-3 select-none whitespace-nowrap',
    'font-sans uppercase tracking-[0.22em]',
    // a finger's target: the house button is never shorter than 44px at its full size
    size === 'sm' ? 'text-[0.6875rem] py-2' : 'min-h-11 text-[0.75rem] py-3',
    'transition-colors duration-500 ease-[var(--ease-silk)]',
    'text-fg hover:text-fg focus-visible:outline-none focus-visible:text-accent',
    className,
  );

  const inner =
    variant === 'bracket' ? (
      <>
        <span aria-hidden className="inline-block font-display text-[1.35em] leading-none opacity-60 transition-transform duration-500 ease-[var(--ease-out-expo)] group-hover/btn:-translate-x-1 group-focus-visible/btn:-translate-x-1">
          [
        </span>
        <span className="pt-px">{children}</span>
        <span aria-hidden className="inline-block font-display text-[1.35em] leading-none opacity-60 transition-transform duration-500 ease-[var(--ease-out-expo)] group-hover/btn:translate-x-1 group-focus-visible/btn:translate-x-1">
          ]
        </span>
      </>
    ) : variant === 'hairline' ? (
      <span className="relative pb-1">
        {children}
        <span aria-hidden className="absolute inset-x-0 bottom-0 h-px origin-left scale-x-100 bg-line-strong transition-transform duration-500 ease-[var(--ease-out-expo)]" />
        <span aria-hidden className="hairline absolute inset-x-0 bottom-0 origin-left scale-x-0 transition-transform duration-700 ease-[var(--ease-out-expo)] group-hover/btn:scale-x-100 group-focus-visible/btn:scale-x-100" />
      </span>
    ) : (
      <span className="opacity-80 transition-opacity duration-300 group-hover/btn:opacity-100">{children}</span>
    );

  if ('href' in props && props.href) {
    const { href, kind, onNavigate, target } = props;
    return (
      <TransitionLink href={href} kind={kind} onNavigate={onNavigate} target={target} className={base} data-cursor={cursor}>
        {inner}
      </TransitionLink>
    );
  }
  const buttonRest = rest as ButtonHTMLAttributes<HTMLButtonElement>;
  return (
    <button type="button" className={base} data-cursor={cursor} {...buttonRest}>
      {inner}
    </button>
  );
}
