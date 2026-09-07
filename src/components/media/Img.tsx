'use client';

import Image from 'next/image';
import type { CSSProperties } from 'react';
import { getImage } from '@/data';
import { cn } from '@/lib/cn';

interface ImgProps {
  id: string;
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
}

/** next/image bound to the generated asset map: exact dimensions, blur placeholder, focal object-position. */
export function Img({ id, sizes, className, fill = true, priority, quality = 82, style, draggable = false, alt, onLoad, plain, data }: ImgProps) {
  const asset = getImage(id);
  const focal = `${Math.round(asset.focal[0] * 100)}% ${Math.round(asset.focal[1] * 100)}%`;
  const dataAttrs = data ? Object.fromEntries(Object.entries(data).map(([k, v]) => [`data-${k}`, v])) : {};
  if (!asset.src) return null;
  // White-background packshots sit on a pearl tile and multiply into it, so they never read as catalogue cut-outs.
  const packshot = asset.role === 'packshot';
  const blend = packshot ? ({ mixBlendMode: 'multiply' } as const) : undefined;
  if (packshot && fill) {
    return (
      <span className="absolute inset-0 block bg-pearl" aria-hidden={alt === ''}>
        <Image
          src={asset.src}
          alt={alt ?? asset.alt}
          fill
          sizes={sizes}
          quality={quality}
          priority={priority}
          fetchPriority={priority ? 'high' : undefined}
          placeholder="blur"
          blurDataURL={asset.blurDataURL}
          draggable={draggable}
          className={cn('object-cover', className)}
          style={{ objectPosition: focal, ...blend, ...style }}
          onLoad={onLoad}
          {...dataAttrs}
        />
      </span>
    );
  }

  if (plain) {
    const img = (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={asset.src}
        alt={alt ?? asset.alt}
        width={asset.width}
        height={asset.height}
        draggable={draggable}
        decoding="async"
        loading={priority ? 'eager' : 'lazy'}
        className={cn(fill ? 'absolute inset-0 h-full w-full object-cover' : 'h-auto w-full', className)}
        style={{ objectPosition: focal, ...blend, ...style }}
        onLoad={onLoad}
        {...dataAttrs}
      />
    );
    return packshot && fill ? <span className="absolute inset-0 block bg-pearl">{img}</span> : img;
  }

  if (fill) {
    return (
      <Image
        src={asset.src}
        alt={alt ?? asset.alt}
        fill
        sizes={sizes}
        quality={quality}
        priority={priority}
        fetchPriority={priority ? 'high' : undefined}
        placeholder="blur"
        blurDataURL={asset.blurDataURL}
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
      src={asset.src}
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
