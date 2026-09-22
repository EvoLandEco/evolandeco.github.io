(() => {
  const embedded = window.parent !== window;
  document.documentElement.classList.toggle('embedded', embedded);
  const apply = dark => {
    document.documentElement.classList.toggle('dark', dark);
    const checkbox = document.getElementById('darkmode') || document.getElementById('simDarkToggle');
    if (checkbox && checkbox.checked !== dark) checkbox.click();
    const toggle = document.getElementById('themeToggle');
    if (toggle && (document.body.dataset.theme === 'dark') !== dark) toggle.click();
  };
  if (embedded) {
    const sync = () => apply(parent.document.documentElement.classList.contains('dark'));
    new MutationObserver(sync).observe(parent.document.documentElement, { attributes: true, attributeFilter: ['class'] });
    sync();
  } else {
    const sync = () => {
      const checkbox = document.getElementById('darkmode') || document.getElementById('simDarkToggle');
      const dark = checkbox ? checkbox.checked : document.body.dataset.theme ? document.body.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.classList.toggle('dark', dark);
    };
    document.addEventListener('change', sync);
    new MutationObserver(sync).observe(document.body, { attributes: true, attributeFilter: ['data-theme', 'class'] });
    sync();
  }
})();
