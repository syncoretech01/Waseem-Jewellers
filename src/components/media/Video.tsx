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
  const [isPortraitPhone, setIsPortraitPhone] = useState(false);
  useEffect(() => {
    if (!portrait) return;
    const mq = window.matchMedia('(max-width: 767px) and (orientation: portrait)');
    const onChange = (e: MediaQueryListEvent) => setIsPortraitPhone(e.matches);
    mq.addEventListener('change', onChange);
    onChange({ matches: mq.matches } as MediaQueryListEvent);
    return () => mq.removeEventListener('change', onChange);
  }, [portrait]);

  useImperativeHandle(ref, () => ({
    get el() {
      return el.current;
    },
    play: () => {
      el.current?.play().catch(() => undefined);
    },
    pause: () => el.current?.pause(),
  }));

  /**
   * Release the element on unmount, because Blink will not.
   *
   * A <source> with a media attribute registers a MediaQueryList listener that Chromium keeps
   * as a pending activity after the element is gone — and through it the <source>, the <video>,
   * the 31 seconds of film it buffered, and every ancestor up to the page. Measured: the whole
   * previous page tree retained per visit, three copies for the homepage. The <picture> path
   * unregisters correctly; the <video> path does not. Removing the sources first and then
   * loading an empty element is what actually lets go; clearing src alone does not.
   */
  useEffect(() => {
    const video = el.current;
    if (!video) return;
    return () => {
      for (const source of [...video.querySelectorAll('source')]) source.remove();
      video.removeAttribute('src');
      video.load();
    };
  }, []);

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
    const allowed = tier !== 'REDUCED' && !paused;
    if (!allowed) {
      // a film that will never play is never fetched: the poster stands, the bytes stay on the server
      video.pause();
      return;
    }
    // the <source> list only mounts once the tier is known — start resource selection if it is still empty
    if (video.networkState === HTMLMediaElement.NETWORK_EMPTY) video.load();
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
  /**
   * Which file, decided here rather than by a `media` attribute on a <source>.
   *
   * A <source media="…"> registers a MediaQueryList listener that Chromium keeps as a pending
   * activity after the element is gone — and through it the <source>, the <video>, its
   * buffered film, and every ancestor up to the page. Removing the sources on unmount let go
   * of most of it; the bare <source> nodes stayed pinned regardless, about one per visit.
   * Choosing the file with matchMedia and rendering a plain <source> is the whole fix.
   */

  const landscape = tier === 'LOW' && light ? asset.src720 : asset.src1280;
  const landscapeAv1 = tier === 'LOW' && light ? asset.src720Av1 : asset.src1280Av1;
  const src = isPortraitPhone ? asset.srcPortrait : landscape;
  const srcAv1 = isPortraitPhone ? asset.srcPortraitAv1 : landscapeAv1;
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
        {/*
          AV1 first, h264 after: the browser takes the first source it can play, so a device
          that decodes AV1 downloads roughly half the bytes and one that cannot never sees
          the AV1 file at all. The codec string is Main profile, level 4.0, 8-bit.
        */}
        {tierKnown && srcAv1 && <source key={srcAv1} src={srcAv1} type='video/mp4; codecs="av01.0.08M.08"' />}
        {tierKnown && <source key={src} src={src} type="video/mp4" />}
      </video>
    </span>
  );
}
