new Promise(async (resolve) => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const c = window.__wjConcierge;
  c.open({ mode: 'chat' });
  await sleep(1200);
  c.submitText('Tell me about the Naqsh-e-Gul choker', 'text');
  const out = [];
  for (let i = 0; i < 8; i++) {
    await sleep(800);
    const s = window.__wj.site();
    out.push({ t: (i + 1) * 0.8, href: location.pathname, y: Math.round(window.scrollY), pending: s.pendingSpotlight, focused: s.focusedProduct, el: document.querySelectorAll('[data-flip-source="naqsh-e-gul-pearl-blossom-choker"]').length, state: c.store.state });
  }
  resolve(JSON.stringify(out));
})
