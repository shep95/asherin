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
  const reveal = () => { loading.hidden = true; document.body.classList.add('wallpaper-ready'); };
  const wallpaper = new Image();
  wallpaper.decoding = 'async';
  if ('fetchPriority' in wallpaper) wallpaper.fetchPriority = 'high';
  wallpaper.onload = reveal;
  wallpaper.onerror = reveal;
  wallpaper.src = document.createElement('canvas').toDataURL('image/webp').indexOf('image/webp') === 5
    ? '/asherin.ide/assets/night.webp'
    : '/asherin.ide/assets/night.jpg';
  if (wallpaper.complete) reveal(); else loading.hidden = false;
  setTimeout(reveal, 4000);
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

(() => {
  const btn = document.getElementById('asherin-install');
  const note = document.getElementById('asherin-install-note') || document.getElementById('asherin-install-fine');
  if (!btn) return;
  const ua = navigator.userAgent;
  const platform = /Windows/i.test(ua) ? 'windows'
    : /Macintosh|Mac OS X/i.test(ua) ? 'mac'
    : (/Linux/i.test(ua) && !/Android/i.test(ua)) ? 'linux'
    : null;
  const labels = {
    windows: 'install asherin.ide',
    mac: 'download for mac',
    linux: 'download for linux',
  };
  const fallback = {
    windows: { url: '/__l5e/assets-v1/6b747446-ee61-45f3-9210-5f39fa558835/asherin-ide-windows-x64.zip', ext: 'zip' },
    mac: { url: '/asherin.ide/install/asherin-ide-macos-x64.zip', ext: 'zip' },
    linux: { url: '/asherin.ide/install/asherin-ide-linux-x64.tar.gz', ext: 'tar.gz' },
  };
  function label(text) {
    btn.textContent = text + ' ';
    const arrow = document.createElement('span');
    arrow.textContent = '\u2197';
    btn.append(arrow);
  }
  function ready(href, line) {
    btn.dataset.state = 'ready';
    btn.removeAttribute('aria-disabled');
    btn.href = href;
    if (platform === 'windows') btn.setAttribute('download', 'asherin-ide-windows-x64.zip');
    if (note) note.textContent = line;
  }
  function halt(text) {
    btn.dataset.state = 'unavailable';
    btn.setAttribute('aria-disabled', 'true');
    if (note) note.textContent = text;
  }
  btn.addEventListener('click', e => {
    if (btn.getAttribute('aria-disabled') === 'true') {
      e.preventDefault();
      return;
    }
    if (platform === 'windows' && note) {
      note.textContent = 'download started · 443 mb · check your browser downloads';
    }
  });
  if (!platform) {
    label('desktop builds only');
    halt('the editor is a desktop build. open this page on windows, macos, or linux to download it.');
    return;
  }
  label(labels[platform]);
  if (platform === 'windows') {
    ready(fallback.windows.url, 'version 0.9.1 · windows desktop · 443 mb zip');
    return;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  fetch('/asherin.ide/updates/latest.json', { signal: controller.signal, cache: 'no-store' })
    .then(response => response.ok ? response.json() : Promise.reject(new Error('http ' + response.status)))
    .then(data => {
      const release = data && data.platforms ? data.platforms[platform] : null;
      const href = (release && release.url) || fallback[platform].url;
      const version = (release && release.version) || (data && data.version) || 'latest';
       ready(href, 'version ' + version + ' \u00b7 desktop download \u00b7 extract and open asherin ide.exe');
    })
    .catch(() => {
      const fb = fallback[platform];
      ready(fb.url, 'release channel offline \u00b7 using fallback ' + platform + ' ' + fb.ext + ' archive');
    })
    .finally(() => clearTimeout(timer));
})();
