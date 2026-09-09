(() => {
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  const menu = document.querySelector('.menu-toggle');
  const nav = document.querySelector('#main-nav');
  menu.hidden = false;
  document.body.classList.add('menu-enabled');
  function closeMenu(focus = false) {
    document.body.classList.remove('menu-open');
    menu.setAttribute('aria-expanded', 'false');
    menu.setAttribute('aria-label', 'open navigation');
    if (focus) menu.focus();
  }
  menu.addEventListener('click', () => {
    const open = menu.getAttribute('aria-expanded') !== 'true';
    document.body.classList.toggle('menu-open', open);
    menu.setAttribute('aria-expanded', String(open));
    menu.setAttribute('aria-label', open ? 'close navigation' : 'open navigation');
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(true); });
  nav.addEventListener('click', e => { if (e.target.closest('a')) closeMenu(); });
  matchMedia('(min-width: 651px)').addEventListener('change', () => closeMenu());
  const loading = document.querySelector('.loading-indicator');
  const wallpaper = new Image();
  const finish = () => { loading.hidden = true; };
  wallpaper.onload = finish;
  wallpaper.onerror = finish;
  wallpaper.src = 'assets/night.png';
  if (!wallpaper.complete) loading.hidden = false;
  const bar = document.querySelector('.scroll-progress');
  const sections = [...document.querySelectorAll('main > section')];
  let scheduled = false;
  function update() {
    const distance = document.documentElement.scrollHeight - innerHeight;
    bar.style.transform = `scaleX(${distance > 0 ? Math.min(1, Math.max(0, scrollY / distance)) : 0})`;
    let current = sections[0].id;
    for (const section of sections) if (section.getBoundingClientRect().top < innerHeight * .45) current = section.id;
    nav.querySelectorAll('a').forEach(a => {
      if (a.hash === `#${current}`) a.setAttribute('aria-current', 'location');
      else a.removeAttribute('aria-current');
    });
    scheduled = false;
  }
  function schedule() { if (!scheduled) { scheduled = true; requestAnimationFrame(update); } }
  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', schedule);
  update();
  if (preference.matches || !('IntersectionObserver' in window)) return;
  const elements = document.querySelectorAll('.section-heading, .editor, .preview-note, .principles > .eyebrow, .principle-grid article, .access > .eyebrow, .access > h2, .access > p, .access > details');
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); }
    });
  }, { threshold: .08 });
  elements.forEach(element => {
    if (element.matches('.principle-grid article')) element.style.setProperty('--reveal-delay', `${[...element.parentElement.children].indexOf(element) * 120}ms`);
    element.classList.add('reveal-ready'); observer.observe(element);
  });
  preference.addEventListener('change', e => {
    if (e.matches) { observer.disconnect(); elements.forEach(el => el.classList.add('is-visible')); }
  });
})();
