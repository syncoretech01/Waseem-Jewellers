'use client';

import { useRef, type CSSProperties, type ReactNode } from 'react';
import { Img } from '@/components/media/Img';
import { useProductVisibility, useFocusedProduct } from '@/motion/hooks/useProductVisibility';
import { useOpenProduct } from '@/motion/hooks/useFlipNavigate';
import { runtime } from '@/state/runtime';
import { resolveImage } from '@/data';
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

/**
 * Whether the photograph is a studio cut-out to be mounted on pearl — decided the way `Img`
 * decides it, from the asset itself for a localised piece (the index files a flagship's hero
 * under its campaign, but the asset map knows the file is a packshot) and from the filed role
 * for a long-tail one. The plate and the packshot's inset must agree, or the inset shows as a
 * lighter rectangle on a darker ground.
 */
function isPackshot(image: ProductImage): boolean {
  if (image.ref.kind === 'local') return resolveImage(image.ref).role === 'packshot';
  return image.role !== 'campaign' && image.role !== 'macro';
}

/** The three card scales of the product presentation system (src/styles/cards.css, DESIGN_SYSTEM.md §13). */
export type CardScale = 'hero' | 'editorial' | 'standard';

/**
 * The built-in caption: the piece's kind (when its name does not already say it), its name,
 * and its published tag as parts — the facts in order (purity, weight, carat), each one word
 * that never breaks inside itself, and the reference last. A card wide enough sets them on one
 * line joined by the house's middle dot; a narrow card spaces the facts and gives the reference
 * a line of its own (src/styles/cards.css).
 */
export interface PieceCaption {
  kind?: string;
  name: string;
  facts?: string[];
  ref?: string;
}

interface PieceLinkProps {
  product: PieceRef;
  imageId?: string;
  sizes: string;
  className?: string;
  /**
   * The card's scale. It sets the plate's aspect (4/5 for hero and editorial, 1/1 for
   * standard), the packshot's inset from the plate's edge and the caption's type size, so
   * every card of one scale presents its jewellery the same way. `aspect` overrides the
   * aspect alone.
   */
  scale?: CardScale;
  /** Box aspect (CSS aspect-ratio value). Without `scale`, defaults to 4/5. */
  aspect?: string;
  priority?: boolean;
  /** Custom content beneath the plate; rendered after the built-in caption when both are given. */
  children?: ReactNode;
  /** The house caption beneath the plate: kind, name and tag at the card's scale. */
  caption?: PieceCaption;
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
export function PieceLink({ product, imageId, sizes, className, scale, aspect, priority, children, caption, cursor = 'view', reveal, onOpen, figure }: PieceLinkProps) {
  const ref = useProductVisibility<HTMLAnchorElement>(product.slug);
  const imgRef = useRef<HTMLDivElement>(null);
  const focus = useFocusedProduct(product.slug);
  const open = useOpenProduct();
  const href = `/jewellery/${product.slug}`;
  // without a scale the plate keeps its old default; with one, the scale's rule sets the aspect unless told otherwise
  const ratio = aspect ?? (scale ? undefined : '4 / 5');
  const packshot = !imageId && isPackshot(product.media.hero);
  const named = Boolean(caption) || Boolean(children);

  return (
    <a
      ref={ref}
      href={href}
      className={cn('group/piece relative block', className)}
      data-cursor={cursor}
      data-card={scale}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        onOpen?.();
        const img = imgRef.current?.querySelector('img');
        open(product.slug, img);
      }}
      {...focus}
      // the page is fetched as the hand arrives, so the flight rarely waits at its predicted frame
      onPointerEnter={() => {
        focus.onPointerEnter();
        runtime.router?.prefetch(href);
      }}
      onFocus={() => {
        focus.onFocus();
        runtime.router?.prefetch(href);
      }}
    >
      <div
        ref={imgRef}
        className={cn('wj-plate', ratio === 'auto' ? 'absolute inset-0' : 'relative w-full')}
        style={ratio && ratio !== 'auto' ? { aspectRatio: ratio } : undefined}
        data-reveal={reveal}
        data-packshot={packshot && !figure ? '' : undefined}
      >
        {figure ? (
          // the figure's camera owns its own transform and its own frame: the hover scale stays off it, and so does the scale's packshot inset
          <div className="absolute inset-0" style={{ '--packshot-inset': '0' } as CSSProperties}>
            {figure}
          </div>
        ) : (
          <div className="absolute inset-0 transition-transform duration-700 ease-[var(--ease-out-expo)] group-hover/piece:scale-[1.03] group-focus-visible/piece:scale-[1.03]" data-reveal-inner>
            {/* a caption beneath names the piece; the photograph is then decorative, so the link is not named twice */}
            <Img {...(imageId ? { id: imageId } : { image: product.media.hero })} sizes={sizes} priority={priority} plain alt={named ? '' : undefined} data={{ 'flip-source': product.slug }} />
          </div>
        )}
        <span aria-hidden className="hairline absolute inset-x-0 top-0 origin-left scale-x-0 transition-transform duration-700 ease-[var(--ease-out-expo)] group-hover/piece:scale-x-100 group-focus-visible/piece:scale-x-100" />
      </div>
      {caption && (
        <span className="wj-caption">
          {caption.kind && <span className="wj-caption-kind">{caption.kind}</span>}
          <span className="wj-caption-name">{caption.name}</span>
          {(Boolean(caption.facts?.length) || Boolean(caption.ref)) && (
            <span className="wj-caption-tag">
              {caption.facts?.map((fact) => (
                <span key={fact} className="wj-caption-part">
                  {fact}
                </span>
              ))}
              {caption.ref && <span className="wj-caption-ref">{caption.ref}</span>}
            </span>
          )}
        </span>
      )}
      {children}
    </a>
  );
}
