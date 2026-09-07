new Promise(async (resolve) => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  window.__wjConcierge.open({ mode: 'chat' });
  await sleep(900);
  window.__wjConcierge.submitText('Show me gold pieces', 'text');
  await sleep(6000);
  const modeLine = [...document.querySelectorAll('button')].filter((b) => /^(ALL|GOLD|DIAMOND|POLKI|STORY|INDEX)$/i.test(b.textContent.trim())).map((b) => b.textContent.trim());
  resolve(JSON.stringify({ href: location.href, search: location.search, storeSearch: window.__wj.site && typeof window.__wj.site === 'function' ? undefined : undefined, editTitle: (document.body.innerText.match(/The (gold|diamond) edit[^\n]*/) || [null])[0], modeLine }));
})
