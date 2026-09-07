(() => {
  const g = window.__wj.gsap;
  const ST = g.core.globals().ScrollTrigger;
  const all = ST.getAll();
  const w = document.querySelector('.bridal-word');
  const track = document.querySelector('.heritage-track');
  const worlds = document.querySelector('.worlds-columns');
  return JSON.stringify({
    tier: document.documentElement.dataset.tier,
    triggers: all.length,
    pinned: all.filter((s) => s.pin).length,
    pinIds: all.filter((s) => s.pin).map((s) => (s.trigger && s.trigger.id) || (s.trigger && s.trigger.className && String(s.trigger.className).slice(0, 30))),
    word: w && { opacity: getComputedStyle(w).opacity, visibility: getComputedStyle(w).visibility },
    track: track && getComputedStyle(track).transform,
    worldsClip: worlds && getComputedStyle(worlds).clipPath,
    videos: [...document.querySelectorAll('video')].map((v) => ({ paused: v.paused, autoplay: v.autoplay })),
  });
})()
