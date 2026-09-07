new Promise(async (resolve) => {
  const c = window.__wjConcierge;
  const before = { t: window.__wj.triggers(), w: window.__wj.tweens(), fns: window.__wj.tickerFns(), canvases: document.querySelectorAll('canvas').length };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < 10; i++) {
    c.open({ mode: i % 2 ? 'voice' : 'chat' });
    await sleep(900);
    if (i % 5 === 4) { c.submitText('hello', 'text'); await sleep(1500); }
    c.close();
    await sleep(500);
  }
  await sleep(800);
  const after = { t: window.__wj.triggers(), w: window.__wj.tweens(), fns: window.__wj.tickerFns(), canvases: document.querySelectorAll('canvas').length, state: c.store.state, panel: c.store.panel, turns: c.store.turns.length };
  resolve(JSON.stringify({ before, after }));
})
