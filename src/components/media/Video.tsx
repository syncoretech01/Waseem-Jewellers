'use client';

import { useEffect, useImperativeHandle, useRef, useState, type CSSProperties, type Ref } from 'react';
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
  /** Hold the still until a frame at or past this media time is presented — skips an encoded fade-in. */
  revealAfter?: number;
  /** Paint the clip's own poster beneath the film. Set false when the caller already shows the same frame. */
  showStill?: boolean;
}

/**
 * The house video element: muted, playsInline, loop, poster-first, no `autoplay` attribute
 * (playback is started from an effect once the tier is known), portrait source for phones,
 * paused when off-screen, never played under reduced motion or when the visitor paused media.
 */
export function Video({ id, className, style, autoPlayInView = true, preload = 'none', onFirstFrame, ref, ariaLabel, portrait = true, revealAfter = 0, showStill = true }: VideoProps) {
  const asset = getVideo(id);
  const el = useRef<HTMLVideoElement>(null);
  const tier = useQualityStore((s) => s.tier);
  // a small screen or a visitor saving data takes the light film; a desktop keeps the full one
  // even on a weak tier, because a full-bleed clip is where compression shows
  const light = useQualityStore((s) => s.coarse || s.saveData);
  const paused = useSiteStore((s) => s.videoPaused);
  const firstFrameSent = useRef(false);
  const [revealed, setRevealed] = useState(false);

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

  // the still holds until a frame worth showing is on screen — never a black or empty box
  useEffect(() => {
    const video = el.current;
    if (!video || !asset || revealed) return;
    let cancelled = false;
    let handle = 0;
    const rvfc = typeof video.requestVideoFrameCallback === 'function' ? video.requestVideoFrameCallback.bind(video) : null;
    if (rvfc) {
      const step = (_now: DOMHighResTimeStamp, meta: VideoFrameCallbackMetadata) => {
        if (cancelled) return;
        if (meta.mediaTime >= revealAfter) setRevealed(true);
        else handle = rvfc(step);
      };
      handle = rvfc(step);
      return () => {
        cancelled = true;
        if (handle && typeof video.cancelVideoFrameCallback === 'function') video.cancelVideoFrameCallback(handle);
      };
    }
    const onTime = () => {
      if (video.currentTime < revealAfter) return;
      video.removeEventListener('timeupdate', onTime);
      if (!cancelled) setRevealed(true);
    };
    video.addEventListener('timeupdate', onTime);
    return () => {
      cancelled = true;
      video.removeEventListener('timeupdate', onTime);
    };
  }, [asset, revealed, revealAfter]);

  useEffect(() => {
    const video = el.current;
    if (!video || !asset) return;
    if (tier === 'unresolved') return;
    // the <source> list only mounts once the tier is known — start resource selection if it is still empty
    if (video.networkState === HTMLMediaElement.NETWORK_EMPTY) video.load();
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
  const src = tier === 'LOW' && light ? asset.src720 : asset.src1280;
  const subject = `${Math.round(asset.subject[0] * 100)}% ${Math.round(asset.subject[1] * 100)}%`;
  const tierKnown = tier !== 'unresolved';

  return (
    <span className={cn('absolute inset-0 block overflow-hidden', className)} style={style}>
      {showStill && (
        // the inline blur paints on the first frame of the page, the poster covers it, and it stays beneath the film
        <span
          aria-hidden
          className="absolute inset-0 block"
          style={{ backgroundImage: `url("${asset.poster}"), url("${asset.posterBlur}")`, backgroundSize: 'cover', backgroundPosition: subject }}
        />
      )}
      <video
        ref={el}
        className="absolute inset-0 h-full w-full object-cover"
        style={{ objectPosition: subject, opacity: revealed ? 1 : 0, transition: 'opacity 420ms linear' }}
        muted
        playsInline
        loop
        preload={preload}
        disablePictureInPicture
        disableRemotePlayback
        aria-label={ariaLabel}
        aria-hidden={ariaLabel ? undefined : true}
      >
        {tierKnown && portrait && <source src={asset.srcPortrait} type="video/mp4" media="(max-width: 767px) and (orientation: portrait)" />}
        {tierKnown && <source src={src} type="video/mp4" />}
      </video>
    </span>
  );
}
