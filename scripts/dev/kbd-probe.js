(() => {
  const box = document.querySelector('[data-flip-target="product-hero"]') || document.querySelector('[role="button"][aria-label*="closely"]');
  const all = [...document.querySelectorAll('[role="button"]')].map((b) => ({ label: b.getAttribute('aria-label'), tab: b.tabIndex, pressed: b.getAttribute('aria-pressed') }));
  return JSON.stringify({ box: box ? { role: box.getAttribute('role'), tab: box.tabIndex, label: box.getAttribute('aria-label') } : null, roleButtons: all.slice(0, 4) });
})()
