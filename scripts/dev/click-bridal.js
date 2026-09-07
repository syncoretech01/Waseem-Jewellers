(() => { const e = [...document.querySelectorAll('#wj-menu a, #wj-menu button')].find((el) => /^\s*Bridal\s*$/i.test(el.textContent)); if (e) e.click(); return !!e; })()
