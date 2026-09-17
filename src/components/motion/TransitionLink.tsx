'use client';

import Link from 'next/link';
import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from 'react';
import { runtime } from '@/state/runtime';
import { productSlugOf, useOpenProduct } from '@/motion/hooks/useFlipNavigate';

interface TransitionLinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  href: string;
  children: ReactNode;
  kind?: 'curtain' | 'veil';
  onNavigate?: () => void;
}

function isPlainLeftClick(e: MouseEvent<HTMLAnchorElement>) {
  return e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && !e.defaultPrevented;
}

/**
 * next/link that routes plain clicks through the TransitionLayer (prefetch kept). A link to a
 * piece is a door to it: when the piece's photograph is on screen, the photograph flies; the
 * curtain is for everything else — a department, a kind, a page with no image to carry.
 */
export function TransitionLink({ href, children, kind = 'curtain', onNavigate, onClick, target, ...rest }: TransitionLinkProps) {
  const open = useOpenProduct();
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
        const slug = kind === 'curtain' && !/[?#]/.test(href) ? productSlugOf(href) : null;
        if (slug) open(slug);
        else void t.navigate(href, { kind });
      }}
      {...rest}
    >
      {children}
    </Link>
  );
}
