new Promise(async (resolve) => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const layer = [...document.querySelectorAll('div[aria-hidden].fixed.inset-0')].find((d) => d.children.length === 3);
  const c = layer ? layer.children[2] : null;
  const read = (t) => ({ t, href: location.pathname + location.search, top: c ? Math.round(c.getBoundingClientRect().top) : null, inert: document.getElementById('page-root')?.hasAttribute('inert') });
  const out = [read('rest')];
  window.__wjConcierge.open({ mode: 'chat' });
  await sleep(900);
  window.__wjConcierge.submitText('Show me gold pieces', 'text');
  for (let i = 1; i <= 10; i++) { await sleep(500); out.push(read(i * 500)); }
  resolve(JSON.stringify(out));
})
