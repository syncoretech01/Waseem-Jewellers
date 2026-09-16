'use client';

import Image, { getImageProps } from 'next/image';
import type { CSSProperties, SyntheticEvent } from 'react';
import { resolveImage } from '@/data';
import type { ImageRef, ProductImage } from '@/data/types';
import { cn } from '@/lib/cn';

interface ImgProps {
  /** An id in the generated asset map. Give this or `image`. */
  id?: string;
  /**
   * A product image of either tier. A flagship piece resolves to a localised asset with a
   * blur placeholder; a long-tail piece is resized from the shop's CDN by the optimiser, so
   * the browser still only ever talks to our own domain.
   */
  image?: ProductImage | ImageRef;
  /** Required: how wide the image renders, e.g. "(min-width:1280px) 62vw, 100vw". */
  sizes: string;
  className?: string;
  /** Fill the parent box (parent must be positioned with an explicit aspect-ratio or size). */
  fill?: boolean;
  priority?: boolean;
  quality?: 70 | 82;
  style?: CSSProperties;
  draggable?: boolean;
  /** Override alt (e.g. decorative "") */
  alt?: string;
  onLoad?: () => void;
  /** Plain <img> for FLIP sources — no wrapper, no lazy loading, stable currentSrc. */
  plain?: boolean;
  /** Attribute hooks for chapters (data-flip-source etc.). */
  data?: Record<string, string>;
  /** Load immediately without a preload hint (tiles inside pinned stages). */
  eager?: boolean;
}

/**
 * A frame that could not be fetched keeps its plate and its name rather than a broken
 * glyph: the ground stays, the visitor is not shown a fault, and the network audit still
 * sees the failed request.
 */
function markFailed(e: SyntheticEvent<HTMLImageElement>) {
  e.currentTarget.dataset.failed = '1';
}

/** next/image bound to the generated asset map: exact dimensions, blur placeholder, focal object-position. */
export function Img({ id, image, sizes, className, fill = true, priority, quality = 82, style, draggable = false, alt, onLoad, plain, data, eager }: ImgProps) {
  const ref: ImageRef | undefined = image ? ('ref' in image ? image.ref : image) : id ? { kind: 'local', id } : undefined;
  if (!ref) throw new Error('<Img> needs either an id or an image');
  // a campaign frame is a scene and fills its box; a packshot is a cut-out and must not be cropped
  const role = image && 'role' in image ? (image.role === 'campaign' ? 'campaign' : image.role === 'macro' ? 'macro' : 'packshot') : undefined;
  const asset = resolveImage(ref, image && 'alt' in image ? image.alt : undefined, role);
  const focal = `${Math.round(asset.focal[0] * 100)}% ${Math.round(asset.focal[1] * 100)}%`;
  const dataAttrs = data ? Object.fromEntries(Object.entries(data).map(([k, v]) => [`data-${k}`, v])) : {};
  if (!asset.src) return null;
  // a local source carries its own width, so the loader never serves a variant wider than the file
  const src = asset.src.startsWith('/') ? `${asset.src}?mw=${asset.width}` : asset.src;
  // White-background packshots sit on a pearl tile and multiply into it, so they never read as catalogue cut-outs.
  const packshot = asset.role === 'packshot';
  const blend = packshot ? ({ mixBlendMode: 'multiply' } as const) : undefined;
  if (packshot && fill) {
    return (
      <span className="absolute inset-0 block bg-pearl" aria-hidden={alt === ''}>
        <Image
          src={src}
          alt={alt ?? asset.alt}
          fill
          sizes={sizes}
          quality={quality}
          priority={priority}
          fetchPriority={priority ? 'high' : undefined}
          placeholder={asset.blurDataURL ? 'blur' : 'empty'}
          blurDataURL={asset.blurDataURL || undefined}
          draggable={draggable}
          /**
           * `contain`, not `cover`. The shop photographs every piece square; a long haar
           * shown cover in a 4:5 column would lose its ends, and the one thing a jewellery
           * index must never do is crop the jewellery.
           */
          className={cn('object-contain', className)}
          style={{ objectPosition: focal, ...blend, ...style }}
          onLoad={onLoad}
          {...dataAttrs}
        />
      </span>
    );
  }

  if (plain) {
    /**
     * A plain <img> — kept for the FLIP sources, which need a bare element with a stable
     * `currentSrc` — but never a bare file. The optimiser writes the srcset, exactly as it
     * does for next/image, so a 400 px tile fetches a 640 px webp rather than the 4 MB
     * original the shop keeps on its CDN. Until it arrives the frame shows the blur it has,
     * or the plate it does not: a long-tail scene has no placeholder, and an empty ink box
     * in a row of jewellery reads as a fault, so it sits on a warm plate instead.
     */
    const { props: optimised } = getImageProps({ src, alt: alt ?? asset.alt, width: asset.width, height: asset.height, sizes, quality, loading: priority || eager ? 'eager' : 'lazy' });
    const holding = !packshot
      ? asset.blurDataURL
        ? { backgroundImage: `url("${asset.blurDataURL}")`, backgroundSize: 'cover', backgroundPosition: focal }
        : { backgroundColor: 'var(--plate)' }
      : undefined;
    const img = (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={optimised.src}
        srcSet={optimised.srcSet}
        sizes={optimised.sizes ?? sizes}
        alt={alt ?? asset.alt}
        width={asset.width}
        height={asset.height}
        draggable={draggable}
        decoding="async"
        loading={priority || eager ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : undefined}
        className={cn(fill ? cn('absolute inset-0 h-full w-full', packshot ? 'object-contain' : 'object-cover') : 'h-auto w-full', className)}
        style={{ objectPosition: focal, ...holding, ...blend, ...style }}
        onLoad={(e) => {
          e.currentTarget.style.backgroundImage = '';
          onLoad?.();
        }}
        onError={markFailed}
        {...dataAttrs}
      />
    );
    return packshot && fill ? <span className="absolute inset-0 block bg-pearl">{img}</span> : img;
  }

  if (fill) {
    return (
      <Image
        src={src}
        alt={alt ?? asset.alt}
        fill
        sizes={sizes}
        quality={quality}
        priority={priority}
        fetchPriority={priority ? 'high' : undefined}
        placeholder={asset.blurDataURL ? 'blur' : 'empty'}
        blurDataURL={asset.blurDataURL || undefined}
        draggable={draggable}
        className={cn('object-cover', className)}
        style={{ objectPosition: focal, ...style }}
        onLoad={onLoad}
        {...dataAttrs}
      />
    );
  }

  return (
    <Image
      src={src}
      alt={alt ?? asset.alt}
      width={asset.width}
      height={asset.height}
      sizes={sizes}
      quality={quality}
      priority={priority}
      placeholder="blur"
      blurDataURL={asset.blurDataURL}
      draggable={draggable}
      className={cn('h-auto w-full', className)}
      style={style}
      onLoad={onLoad}
      {...dataAttrs}
    />
  );
}
