(() => {
  const de = document.documentElement;
  const vw = de.clientWidth;
  const wide = [];
  document.querySelectorAll('body *').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    const right = r.right;
    const left = r.left;
    if (right > vw + 1.5 || left < -1.5) {
      const cs = getComputedStyle(el);
      // ignore elements inside a horizontal scroller (deliberate) and fixed overlays that are hidden
      let p = el.parentElement, inScroller = false;
      while (p) { const pcs = getComputedStyle(p); if (pcs.overflowX === 'auto' || pcs.overflowX === 'scroll' || pcs.overflowX === 'hidden') { inScroller = true; break; } p = p.parentElement; }
      if (inScroller) return;
      if (cs.visibility === 'hidden' || cs.opacity === '0') return;
      wide.push({ tag: el.tagName.toLowerCase(), cls: String(el.className).slice(0, 50), left: Math.round(left), right: Math.round(right) });
    }
  });
  return JSON.stringify({ vw, docScrollWidth: de.scrollWidth, bodyScrollWidth: document.body.scrollWidth, overflowing: wide.slice(0, 8) });
})()
