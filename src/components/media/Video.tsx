'use client';

import { useEffect, useImperativeHandle, useRef, type CSSProperties, type Ref } from 'react';
import { getVideo } from '@/data';
import { useQualityStore } from '@/state/qualityStore';
import { useSiteStore } from '@/state/siteStore';
import { cn } from '@/lib/cn';

export interface VideoHandle {
  el: HTMLVideoElement | null;
  play: () => void;
  pause: () => void;
}

interface VideoProps {
  id: string;
  className?: string;
  style?: CSSProperties;
  /** Play while in view (IntersectionObserver); default true. Set false when a chapter drives playback itself. */
  autoPlayInView?: boolean;
  /** Load policy for the hero only. */
  preload?: 'none' | 'metadata' | 'auto';
  /** Called once the first frame has been presented (requestVideoFrameCallback or `playing`). */
  onFirstFrame?: () => void;
  ref?: Ref<VideoHandle>;
  ariaLabel?: string;
  portrait?: boolean;
}

/**
 * The house video element: muted, playsInline, loop, poster-first, no `autoplay` attribute
 * (playback is started from an effect once the tier is known), portrait source for phones,
 * paused when off-screen, never played under reduced motion or when the visitor paused media.
 */
export function Video({ id, className, style, autoPlayInView = true, preload = 'none', onFirstFrame, ref, ariaLabel, portrait = true }: VideoProps) {
  const asset = getVideo(id);
  const el = useRef<HTMLVideoElement>(null);
  const tier = useQualityStore((s) => s.tier);
  const paused = useSiteStore((s) => s.videoPaused);
  const firstFrameSent = useRef(false);

  useImperativeHandle(ref, () => ({
    get el() {
      return el.current;
    },
    play: () => {
      el.current?.play().catch(() => undefined);
    },
    pause: () => el.current?.pause(),
  }));

  useEffect(() => {
    const video = el.current;
    if (!video || !asset) return;
    if (onFirstFrame && !firstFrameSent.current) {
      const send = () => {
        if (firstFrameSent.current) return;
        firstFrameSent.current = true;
        onFirstFrame();
      };
      if (typeof video.requestVideoFrameCallback === 'function') video.requestVideoFrameCallback(() => send());
      else video.addEventListener('playing', send, { once: true });
      const timeout = window.setTimeout(send, 2500);
      return () => window.clearTimeout(timeout);
    }
    return undefined;
  }, [asset, onFirstFrame]);

  useEffect(() => {
    const video = el.current;
    if (!video || !asset) return;
    if (tier === 'unresolved') return;
    const allowed = tier !== 'REDUCED' && !paused;
    if (!allowed) {
      video.pause();
      return;
    }
    if (!autoPlayInView) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            if (video.preload === 'none') video.preload = 'auto';
            video.play().catch(() => undefined);
          } else {
            video.pause();
          }
        }
      },
      { rootMargin: '25% 0px' },
    );
    io.observe(video);
    return () => io.disconnect();
  }, [asset, tier, paused, autoPlayInView]);

  if (!asset) return null;
  const src = tier === 'LOW' ? asset.src720 : asset.src1280;

  return (
    <video
      ref={el}
      className={cn('absolute inset-0 h-full w-full object-cover', className)}
      style={{ objectPosition: `${Math.round(asset.subject[0] * 100)}% ${Math.round(asset.subject[1] * 100)}%`, ...style }}
      muted
      playsInline
      loop
      preload={preload}
      poster={asset.poster}
      disablePictureInPicture
      disableRemotePlayback
      aria-label={ariaLabel ?? asset.label}
    >
      {portrait && <source src={asset.srcPortrait} type="video/mp4" media="(max-width: 767px) and (orientation: portrait)" />}
      <source src={src} type="video/mp4" />
    </video>
  );
}
