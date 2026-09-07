(() => {
  const r = (e) => e.getBoundingClientRect();
  const out = { scrollY: window.scrollY, inspector: !!window.__wj, triggers: window.__wj?.triggers() };
  out.reveals = [...document.querySelectorAll('[data-reveal]')].slice(0, 4).map((e) => ({
    cp: getComputedStyle(e).clipPath, vis: getComputedStyle(e).visibility, op: getComputedStyle(e).opacity,
    top: Math.round(r(e).top), h: Math.round(r(e).height), w: Math.round(r(e).width),
  }));
  out.splits = [...document.querySelectorAll('[data-split]')].slice(0, 2).map((e) => ({
    vis: getComputedStyle(e).visibility, op: getComputedStyle(e).opacity, top: Math.round(r(e).top), html: e.innerHTML.slice(0, 90),
  }));
  const img = document.querySelector('[data-reveal] img');
  out.img = img ? { w: Math.round(r(img).width), h: Math.round(r(img).height), src: img.currentSrc.slice(-50), complete: img.complete, natural: img.naturalWidth } : null;
  const inner = document.querySelector('[data-reveal] [data-reveal-inner]');
  out.inner = inner ? { h: Math.round(r(inner).height), transform: getComputedStyle(inner).transform, pos: getComputedStyle(inner).position } : null;
  return out;
})()
