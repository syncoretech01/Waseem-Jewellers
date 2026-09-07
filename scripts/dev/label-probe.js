(() => {
  const out = [];
  document.querySelectorAll('input, textarea, select').forEach((el) => {
    const id = el.id;
    const byFor = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`) : null;
    const wrap = el.closest('label');
    out.push({ tag: el.tagName, type: el.type, id: id || null, name: el.name || null, placeholder: el.placeholder || null, labelledBy: el.getAttribute('aria-labelledby'), ariaLabel: el.getAttribute('aria-label'), labelFor: byFor ? byFor.textContent.trim().slice(0, 30) : null, wrappingLabel: wrap ? wrap.textContent.trim().slice(0, 30) : null });
  });
  return JSON.stringify(out);
})()
