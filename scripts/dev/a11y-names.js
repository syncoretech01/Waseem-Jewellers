(() => {
  const sel = 'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"]), [role="button"]';
  const bad = [];
  document.querySelectorAll(sel).forEach((el) => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return;
    const r = el.getBoundingClientRect();
    const name = (el.getAttribute('aria-label') || el.getAttribute('title') || (el.querySelector('img') && el.querySelector('img').alt) || el.textContent || '').trim();
    if (!name) bad.push({ tag: el.tagName, cls: String(el.className).slice(0, 46), href: el.getAttribute('href'), w: Math.round(r.width), h: Math.round(r.height) });
  });
  const h1 = [...document.querySelectorAll('h1')].map((h) => h.textContent.trim().slice(0, 40));
  return JSON.stringify({ unnamed: bad.slice(0, 8), unnamedCount: bad.length, h1 });
})()
