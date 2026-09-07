'use client';

import Link from 'next/link';
import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from 'react';
import { runtime } from '@/state/runtime';

interface TransitionLinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  href: string;
  children: ReactNode;
  kind?: 'curtain' | 'veil';
  onNavigate?: () => void;
}

function isPlainLeftClick(e: MouseEvent<HTMLAnchorElement>) {
  return e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && !e.defaultPrevented;
}

/** next/link that routes plain clicks through the TransitionLayer curtain (prefetch kept). */
export function TransitionLink({ href, children, kind = 'curtain', onNavigate, onClick, target, ...rest }: TransitionLinkProps) {
  const external = /^(https?:|mailto:|tel:)/.test(href);
  if (external) {
    return (
      <a href={href} target={target ?? '_blank'} rel="noreferrer" onClick={onClick} {...rest}>
        {children}
      </a>
    );
  }
  return (
    <Link
      href={href}
      target={target}
      onClick={(e) => {
        onClick?.(e);
        if (!isPlainLeftClick(e) || target === '_blank') return;
        const t = runtime.transition;
        if (!t) return;
        e.preventDefault();
        onNavigate?.();
        void t.navigate(href, { kind });
      }}
      {...rest}
    >
      {children}
    </Link>
  );
}
