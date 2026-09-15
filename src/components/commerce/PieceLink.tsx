'use client';

import { useRef, type ReactNode } from 'react';
import { Img } from '@/components/media/Img';
import { useProductVisibility, useFocusedProduct } from '@/motion/hooks/useProductVisibility';
import { useOpenProduct } from '@/motion/hooks/useFlipNavigate';
import { cn } from '@/lib/cn';
import type { ProductImage } from '@/data/types';

/**
 * All a link needs to be: a slug and a photograph. A full `Product` satisfies it, and so
 * does a row from the slim index, which is what lets the department grid and the story
 * blocks share one link rather than growing a second one.
 */
export interface PieceRef {
  slug: string;
  media: { hero: ProductImage };
}

interface PieceLinkProps {
  product: PieceRef;
  imageId?: string;
  sizes: string;
  className?: string;
  /** Box aspect (CSS aspect-ratio value). */
  aspect?: string;
  priority?: boolean;
  children?: ReactNode;
  cursor?: string;
  /** Reveal wrapper attributes for useMaskReveal. */
  reveal?: 'bottom' | 'left' | 'top' | 'right';
  onOpen?: () => void;
  /**
   * A figure standing in for the photograph — a `SemanticFigure` on the piece's own frame.
   * The link stays the door and the FLIP source (the figure's image is the first `img`
   * inside), so looking closely and opening the piece are the same gesture.
   */
  figure?: ReactNode;
}

/**
 * The house product link: registers visibility for the concierge, marks focus,
 * carries the FLIP source image and the VIEW cursor label. Hover = the image draws
 * slightly closer and a champagne hairline sweeps its top edge (materiality, not a card).
 */
export function PieceLink({ product, imageId, sizes, className, aspect = '4 / 5', priority, children, cursor = 'view', reveal, onOpen, figure }: PieceLinkProps) {
  const ref = useProductVisibility<HTMLAnchorElement>(product.slug);
  const imgRef = useRef<HTMLDivElement>(null);
  const focus = useFocusedProduct(product.slug);
  const open = useOpenProduct();
  const href = `/jewellery/${product.slug}`;

  return (
    <a
      ref={ref}
      href={href}
      className={cn('group/piece relative block outline-none', className)}
      data-cursor={cursor}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        onOpen?.();
        const img = imgRef.current?.querySelector('img');
        open(product.slug, img);
      }}
      {...focus}
    >
      <div
        ref={imgRef}
        className={cn('overflow-hidden bg-bg-2', aspect === 'auto' ? 'absolute inset-0' : 'relative w-full')}
        style={aspect === 'auto' ? undefined : { aspectRatio: aspect }}
        data-reveal={reveal}
      >
        {figure ? (
          // the figure's camera owns its own transform; the hover scale stays off it
          <div className="absolute inset-0">{figure}</div>
        ) : (
          <div className="absolute inset-0 transition-transform duration-700 ease-[var(--ease-out-expo)] group-hover/piece:scale-[1.03] group-focus-visible/piece:scale-[1.03]" data-reveal-inner>
            <Img {...(imageId ? { id: imageId } : { image: product.media.hero })} sizes={sizes} priority={priority} plain data={{ 'flip-source': product.slug }} />
          </div>
        )}
        <span
          aria-hidden
          className="hairline absolute inset-x-0 top-0 origin-left scale-x-0 transition-transform duration-700 ease-[var(--ease-out-expo)] group-hover/piece:scale-x-100 group-focus-visible/piece:scale-x-100"
        />
      </div>
      {children}
    </a>
  );
}
