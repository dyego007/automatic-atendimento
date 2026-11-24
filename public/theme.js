/* Runs in the head so a stored theme is applied before the first paint. */
(() => {
  const key = 'autoatende-theme';
  let initial = 'light';
  try { if (localStorage.getItem(key) === 'dark') initial = 'dark'; } catch (_) {}
  document.documentElement.dataset.theme = initial;
  document.addEventListener('DOMContentLoaded', () => {
    const toggles = document.querySelectorAll('[data-theme-toggle]');
    const menu = document.getElementById('menuToggle');
    const sidebar = document.getElementById('appSidebar');
    function renderTheme() {
      const dark = document.documentElement.dataset.theme === 'dark';
      toggles.forEach(toggle => {
      toggle.setAttribute('aria-pressed', String(dark));
      toggle.setAttribute('aria-label', dark ? 'Ativar tema claro' : 'Ativar tema escuro');
      toggle.title = dark ? 'Ativar tema claro' : 'Ativar tema escuro';
      toggle.querySelector('i').className = dark ? 'fas fa-sun' : 'fas fa-moon';
      toggle.querySelector('span').textContent = dark ? 'Tema claro' : 'Tema escuro';
      });
      document.querySelector('meta[name="theme-color"]').content = dark ? '#101d24' : '#f3f6f6';
    }
    toggles.forEach(toggle => toggle.addEventListener('click', () => {
      const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      try { localStorage.setItem(key, next); } catch (_) {}
      renderTheme();
    }));
    renderTheme();
    function closeMenu() { sidebar.classList.remove('menu-open'); menu.setAttribute('aria-expanded', 'false'); }
    menu.addEventListener('click', () => {
      const open = sidebar.classList.toggle('menu-open');
      menu.setAttribute('aria-expanded', String(open));
      if (open) sidebar.querySelector('[aria-current="page"]')?.focus();
    });
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && sidebar.classList.contains('menu-open')) { closeMenu(); menu.focus(); } });
    sidebar.querySelector('nav').addEventListener('click', event => {
      if (event.target.closest('button')) { closeMenu(); if (matchMedia('(max-width:1023px)').matches) menu.focus(); }
    });
    const syncNavigation = () => {
      document.querySelectorAll('[id^="navBtn-"]').forEach(button => {
        const page = document.getElementById(button.id.replace('navBtn-', 'tab-'));
        if (page && !page.classList.contains('hidden')) button.setAttribute('aria-current', 'page');
        else button.removeAttribute('aria-current');
      });
    };
    document.querySelectorAll('main>[id^="tab-"]').forEach(page => new MutationObserver(syncNavigation).observe(page, { attributes: true, attributeFilter: ['class'] }));
    syncNavigation();
  });
})();
