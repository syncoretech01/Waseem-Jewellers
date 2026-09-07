new Promise(async (resolve) => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const layer = [...document.querySelectorAll('div[aria-hidden].fixed.inset-0')].find((d) => d.children.length === 3);
  const c = layer ? layer.children[2] : null;
  const read = (tag) => {
    const cs = c ? getComputedStyle(c) : null;
    const r = c ? c.getBoundingClientRect() : null;
    return { tag, href: location.pathname, transform: cs && cs.transform, translate: cs && cs.translate, top: r && Math.round(r.top), opacity: cs && cs.opacity, mid: (() => { const e = document.elementFromPoint(innerWidth / 2, innerHeight / 2); return e ? e.tagName + '.' + String(e.className).slice(0, 20) : null; })() };
  };
  const out = [read('rest')];
  const btn = [...document.querySelectorAll('a')].find((a) => a.getAttribute('href') === '/collections/bridal');
  if (!btn) return resolve(JSON.stringify({ error: 'no link', out }));
  btn.click();
  for (let i = 0; i < 9; i++) { await sleep(350); out.push(read('t' + (i + 1) * 350)); }
  resolve(JSON.stringify(out));
})
