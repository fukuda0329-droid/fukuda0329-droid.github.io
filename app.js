(() => {
  'use strict';
  const translations = window.DJLOG_TRANSLATIONS;
  if (!translations) return;
  const select = document.getElementById('language');
  const gallery = document.getElementById('gallery-track');
  const previous = document.getElementById('gallery-prev');
  const next = document.getElementById('gallery-next');
  const preferenceKey = 'djlog.site.language';
  const countryKey = 'djlog.site.country';
  const valid = value => Object.hasOwn(translations, value || '');
  const safeRead = (kind, key) => { try { return window[kind].getItem(key); } catch { return null; } };
  const safeWrite = (kind, key, value) => { try { window[kind].setItem(key, value); } catch { /* Private browsing remains usable. */ } };
  const requested = new URLSearchParams(window.location.search).get('lang')?.toLowerCase();
  const saved = safeRead('localStorage', preferenceKey);
  let manuallyChosen = valid(requested) || valid(saved);
  let initial = valid(requested) ? requested : valid(saved) ? saved : 'en';
  // Used only until IP-country lookup succeeds, or if it is unavailable.
  if (!manuallyChosen) {
    try { initial = Intl.DateTimeFormat().resolvedOptions().timeZone === 'Asia/Tokyo' ? 'ja' : 'en'; } catch { initial = 'en'; }
  }

  function applyLanguage(lang) {
    if (!valid(lang)) lang = 'en';
    const t = translations[lang];
    document.documentElement.lang = lang === 'zh-hans' ? 'zh-Hans' : lang;
    select.value = lang;
    document.querySelectorAll('[data-i18n]').forEach(element => {
      const text = t[element.dataset.i18n];
      if (text !== undefined) element.textContent = text;
    });
    const screenLanguage = lang === 'ja' ? 'ja' : 'en';
    const descriptions = {main:t.poster1,analysis:t.originalTitle,share:t.poster6,swipe:t.swipeTitle,manual:t.manualTitle,sets:t.setsTitle,trends:t.trendsTitle};
    document.querySelectorAll('[data-screen]').forEach(img => {
      const src = `assets/screens/${screenLanguage}/${img.dataset.screen}.webp`;
      if (img.getAttribute('src') !== src) img.src = src;
      img.alt = 'DJLog — ' + descriptions[img.dataset.screen].replaceAll('\n',' ');
    });
    document.querySelectorAll('[data-poster]').forEach(img => {
      const src = `assets/gallery/${lang}/${img.dataset.poster}.webp`;
      if (img.getAttribute('src') !== src) img.src = src;
      img.alt = t['poster' + img.dataset.poster];
    });
    document.querySelectorAll('.store-link').forEach(link => {
      link.href = lang === 'ja' ? 'https://apps.apple.com/jp/app/djlog/id6806450722' : 'https://apps.apple.com/app/djlog/id6806450722';
    });
    document.title = 'DJLog — ' + t.hero1 + ' ' + t.hero2;
    document.querySelector('meta[name="description"]').content = t.heroDescription.replaceAll('\n', ' ');
    document.querySelector('meta[property="og:title"]').content = document.title;
    document.querySelector('meta[property="og:description"]').content = t.heroDescription.replaceAll('\n', ' ');
    previous.setAttribute('aria-label', t.prev);
    next.setAttribute('aria-label', t.next);
    gallery.setAttribute('aria-label', t.galleryAria);
    updateGalleryControls();
  }

  select.addEventListener('change', () => {
    manuallyChosen = true;
    const lang = select.value;
    safeWrite('localStorage', preferenceKey, lang);
    applyLanguage(lang);
    // Shareable previews and reloads retain the choice even when storage is blocked.
    const url = new URL(window.location.href);
    url.searchParams.set('lang', lang);
    try { history.replaceState(null, '', url); } catch { /* file:// preview */ }
  });

  function updateGalleryControls() {
    previous.disabled = gallery.scrollLeft <= 2;
    next.disabled = gallery.scrollLeft >= gallery.scrollWidth - gallery.clientWidth - 2;
  }
  function scrollGallery(direction) {
    const card = gallery.querySelector('figure');
    const step = card.getBoundingClientRect().width + parseFloat(getComputedStyle(gallery).gap);
    gallery.scrollBy({left:direction * step, behavior:matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'});
  }
  previous.addEventListener('click', () => scrollGallery(-1));
  next.addEventListener('click', () => scrollGallery(1));
  gallery.addEventListener('scroll', updateGalleryControls, {passive:true});
  gallery.addEventListener('keydown', event => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault(); scrollGallery(event.key === 'ArrowRight' ? 1 : -1);
    }
  });
  window.addEventListener('resize', updateGalleryControls, {passive:true});
  const wave = document.querySelector('.wave');
  for (let i = 0; i < 52; i++) {
    const bar = document.createElement('i');
    bar.style.height = (8 + Math.abs(Math.sin(i * .47) * Math.cos(i * .13)) * 55) + 'px';
    wave.appendChild(bar);
  }
  applyLanguage(initial);

  async function detectCountry() {
    if (manuallyChosen) return;
    try {
      const cached = JSON.parse(safeRead('sessionStorage', countryKey) || 'null');
      if (/^[A-Z]{2}$/.test(cached?.country) && Date.now() - cached.time < 30 * 60 * 1000) {
        applyLanguage(cached.country === 'JP' ? 'ja' : 'en');
        return;
      }
    } catch { /* Ignore invalid cache. */ }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    try {
      // Only the country is used; no IP address is retained by this website.
      const response = await fetch('https://api.country.is/', {signal:controller.signal, credentials:'omit', referrerPolicy:'no-referrer'});
      if (!response.ok) return;
      const {country} = await response.json();
      if (!/^[A-Z]{2}$/.test(country)) return;
      safeWrite('sessionStorage', countryKey, JSON.stringify({country, time:Date.now()}));
      // A late network response must never override the user's selection.
      if (!manuallyChosen) applyLanguage(country === 'JP' ? 'ja' : 'en');
    } catch { /* Keep the timezone fallback and working language menu. */ }
    finally { clearTimeout(timeout); }
  }
  detectCountry();
})();
