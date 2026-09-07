new Promise((resolve) => {
  const g = window.__wj && window.__wj.gsap;
  if (!g) return resolve('no gsap on __wj');
  const out = [];
  const t0 = performance.now();
  g.to({ v: 0 }, { v: 1, duration: 1.5, ease: 'none', onUpdate() { if (out.length < 5) out.push(this.targets()[0].v.toFixed(3) + '@' + Math.round(performance.now() - t0)); }, onComplete() { resolve(out.join(' ') + ' | ticker.time=' + g.ticker.time.toFixed(2) + ' fps~' + g.ticker.fps); } });
  setTimeout(() => resolve('timeout ' + out.join(' ')), 3000);
})
