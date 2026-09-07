'use client';

import { useEffect, useRef, useState } from 'react';
import { gsap, useGSAP } from '@/lib/motion/gsap';
import { Img } from '@/components/media/Img';
import { useQualityStore } from '@/state/qualityStore';
import { cn } from '@/lib/cn';

interface InspectImageProps {
  id: string;
  sizes: string;
  priority?: boolean;
  flipTarget?: boolean;
  slug: string;
  macro?: boolean;
  className?: string;
}

/**
 * Gallery image. Hover draws the whole image to the eye (scale 1.35, the point under the
 * pointer stays put) — no magnifier lens. Click on a macro enters drag-to-inspect at 2.4×.
 */
export function InspectImage({ id, sizes, priority, flipTarget, slug, macro, className }: InspectImageProps) {
  const box = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [inspecting, setInspecting] = useState(false);
  const coarse = useQualityStore((s) => s.coarse);
  const reduced = useQualityStore((s) => s.tier === 'REDUCED');
  const setters = useRef<{ x: (v: number) => void; y: (v: number) => void; sx: (v: number) => void; sy: (v: number) => void; s: (v: number) => void } | null>(null);
  const drag = useRef<{ active: boolean; sx: number; sy: number; ox: number; oy: number; x: number; y: number }>({ active: false, sx: 0, sy: 0, ox: 0, oy: 0, x: 0, y: 0 });

  useGSAP(
    () => {
      if (!inner.current) return;
      setters.current = {
        x: gsap.quickTo(inner.current, 'x', { duration: 0.6, ease: 'power3' }),
        y: gsap.quickTo(inner.current, 'y', { duration: 0.6, ease: 'power3' }),
        sx: gsap.quickTo(inner.current, 'scaleX', { duration: 1.2, ease: 'wj.out' }),
        sy: gsap.quickTo(inner.current, 'scaleY', { duration: 1.2, ease: 'wj.out' }),
        s: (v: number) => {
          setters.current?.sx(v);
          setters.current?.sy(v);
        },
      };
    },
    { scope: box },
  );

  useEffect(() => {
    if (!inspecting) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setInspecting(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [inspecting]);

  const hoverScale = 1.35;
  const inspectScale = 2.4;

  const onMove = (e: React.PointerEvent) => {
    const el = box.current;
    const s = setters.current;
    if (!el || !s || coarse || reduced) return;
    const r = el.getBoundingClientRect();
    if (inspecting) {
      if (!drag.current.active) return;
      const maxX = (r.width * (inspectScale - 1)) / 2;
      const maxY = (r.height * (inspectScale - 1)) / 2;
      const nx = Math.max(-maxX, Math.min(maxX, drag.current.ox + (e.clientX - drag.current.sx)));
      const ny = Math.max(-maxY, Math.min(maxY, drag.current.oy + (e.clientY - drag.current.sy)));
      drag.current.x = nx;
      drag.current.y = ny;
      s.x(nx);
      s.y(ny);
      return;
    }
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    s.x(-px * (hoverScale - 1) * r.width);
    s.y(-py * (hoverScale - 1) * r.height);
  };

  const onEnter = () => {
    if (coarse || reduced || inspecting) return;
    setters.current?.s(hoverScale);
  };

  const onLeave = () => {
    if (inspecting) return;
    setters.current?.s(1);
    setters.current?.x(0);
    setters.current?.y(0);
  };

  const toggleInspect = () => {
    if (!macro || coarse || reduced) return;
    const s = setters.current;
    if (!s) return;
    if (inspecting) {
      setInspecting(false);
      drag.current.x = 0;
      drag.current.y = 0;
      s.s(1);
      s.x(0);
      s.y(0);
    } else {
      setInspecting(true);
      s.s(inspectScale);
      s.x(0);
      s.y(0);
    }
  };

  const interactive = Boolean(macro) && !coarse && !reduced;

  return (
    <div
      ref={box}
      {...(interactive
        ? {
            role: 'button' as const,
            tabIndex: 0,
            'aria-pressed': inspecting,
            'aria-label': inspecting ? 'Close the close view' : 'Look closely at this image',
            onKeyDown: (e: React.KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleInspect();
              }
            },
          }
        : {})}
      className={cn('relative w-full overflow-hidden bg-bg-2 outline-none focus-visible:ring-1 focus-visible:ring-gold-hi', inspecting && 'cursor-grab active:cursor-grabbing', className)}
      style={{ aspectRatio: '4 / 5', maxHeight: '100svh' }}
      data-cursor={inspecting ? 'drag' : macro ? 'inspect' : undefined}
      data-flip-target={flipTarget ? 'product-hero' : undefined}
      data-flip-slug={flipTarget ? slug : undefined}
      onPointerMove={onMove}
      onPointerEnter={onEnter}
      onPointerLeave={onLeave}
      onPointerDown={(e) => {
        if (!inspecting) return;
        drag.current = { ...drag.current, active: true, sx: e.clientX, sy: e.clientY, ox: drag.current.x, oy: drag.current.y };
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      }}
      onPointerUp={() => {
        drag.current.active = false;
      }}
      onClick={toggleInspect}
    >
      <div ref={inner} className="absolute inset-0 will-change-transform">
        <Img id={id} sizes={sizes} priority={priority} plain />
      </div>
      {macro && (
        <p className="micro pointer-events-none absolute bottom-4 left-4 text-ivory/80 mix-blend-difference">
          {inspecting ? 'Drag · Esc to close' : coarse ? '' : 'Look closely'}
        </p>
      )}
    </div>
  );
}
