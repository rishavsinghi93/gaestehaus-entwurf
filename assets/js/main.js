/* Gästehaus Biehler – Prototyp. Kleines, abhängigkeitsfreies Skript. */
(() => {
  const root = document.documentElement;
  root.classList.add('js');

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------- Sprache: Deutsch steht im HTML, Englisch kommt aus assets/js/i18n.js ---------- */
  const LANGS = ['de', 'en'];
  const DICT = window.HB_I18N || {};
  const originals = new WeakMap();

  const currentLang = () => (root.lang === 'en' ? 'en' : 'de');
  const t = (key, fallback) => {
    const dict = DICT[currentLang()];
    return dict && dict[key] != null ? dict[key] : fallback;
  };
  const originalOf = (el) => {
    let o = originals.get(el);
    if (!o) { o = { html: null, attrs: {} }; originals.set(el, o); }
    return o;
  };
  const parseAttrSpec = (spec) => spec.split(';').map((s) => s.trim()).filter(Boolean).map((s) => {
    const i = s.indexOf(':');
    return [s.slice(0, i).trim(), s.slice(i + 1).trim()];
  });

  function applyLang(lang, { keepPosition = true } = {}) {
    if (!LANGS.includes(lang)) lang = 'de';
    const dict = lang === 'de' ? null : (DICT[lang] || {});
    const missing = new Set();

    // Leseposition halten: Element oben im Bild merken und nach dem Umschalten wieder dorthin
    let anchor = null;
    let anchorTop = 0;
    if (keepPosition && window.scrollY > 0) {
      const header = document.querySelector('.site-header');
      const y = (header ? header.getBoundingClientRect().bottom : 0) + 8;
      anchor = document.elementFromPoint(Math.round(window.innerWidth / 2), Math.round(y));
      if (anchor) {
        anchor = anchor.closest('[data-i18n]') || anchor;
        anchorTop = anchor.getBoundingClientRect().top;
      }
    }

    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const o = originalOf(el);
      const isTitle = el.tagName === 'TITLE';
      if (o.html === null) o.html = isTitle ? el.textContent : el.innerHTML;
      const key = el.dataset.i18n;
      let value = o.html;
      if (dict) {
        if (key in dict) value = dict[key];
        else missing.add(key);
      }
      if (isTitle) el.textContent = value;
      else if (el.innerHTML !== value) el.innerHTML = value;
    });

    document.querySelectorAll('[data-i18n-attr]').forEach((el) => {
      const o = originalOf(el);
      parseAttrSpec(el.dataset.i18nAttr).forEach(([attr, key]) => {
        if (!(attr in o.attrs)) o.attrs[attr] = el.getAttribute(attr);
        let value = o.attrs[attr];
        if (dict) {
          if (key in dict) value = dict[key];
          else missing.add(key);
        }
        if (value == null) el.removeAttribute(attr);
        else el.setAttribute(attr, value);
      });
    });

    root.lang = lang;
    document.querySelectorAll('.lang-switch [data-lang]').forEach((btn) => {
      btn.setAttribute('aria-pressed', String(btn.dataset.lang === lang));
    });
    try { sessionStorage.setItem('hb-lang', lang); } catch (_) { /* privater Modus */ }
    try {
      const url = new URL(window.location.href);
      if (lang === 'de') url.searchParams.delete('lang');
      else url.searchParams.set('lang', lang);
      history.replaceState(history.state, '', url);
    } catch (_) { /* z. B. file:// */ }

    if (anchor && anchor.isConnected) window.scrollBy(0, anchor.getBoundingClientRect().top - anchorTop);
    if (missing.size) console.warn('[i18n] Fehlende Übersetzungen (' + lang + '):', [...missing]);
    document.dispatchEvent(new CustomEvent('hb:lang', { detail: { lang } }));
  }

  document.querySelectorAll('.lang-switch [data-lang]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.dataset.lang !== currentLang()) applyLang(btn.dataset.lang);
    });
  });

  // Startsprache: ?lang=en in der Adresse, sonst die Wahl aus diesem Tab, sonst Deutsch
  let startLang = new URLSearchParams(window.location.search).get('lang');
  if (!LANGS.includes(startLang)) {
    try { startLang = sessionStorage.getItem('hb-lang'); } catch (_) { startLang = null; }
  }
  if (startLang === 'en') applyLang('en', { keepPosition: false });

  // Für spätere Bausteine (z. B. Anfrage mit Preisrechner)
  window.HB = { t, applyLang, lang: currentLang };

  /* ---------- Mobiles Menü ---------- */
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.getElementById('site-nav');
  if (toggle && nav) {
    const label = toggle.querySelector('.sr-only');
    const icon = toggle.querySelector('use');
    const setOpen = (open) => {
      toggle.setAttribute('aria-expanded', String(open));
      nav.classList.toggle('is-open', open);
      icon.setAttribute('href', open ? '#i-close' : '#i-menu');
      label.textContent = open ? t('menu.close', 'Menü schließen') : t('menu.open', 'Menü öffnen');
    };
    toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
    nav.addEventListener('click', (e) => { if (e.target.closest('a')) setOpen(false); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });
    document.addEventListener('hb:lang', () => setOpen(toggle.getAttribute('aria-expanded') === 'true'));
    window.matchMedia('(min-width: 960px)').addEventListener('change', () => setOpen(false));
    setOpen(false);
  }

  /* ---------- Kopfzeile mit Schatten, Schnellkontakt erst nach dem Hero ---------- */
  const header = document.querySelector('.site-header');
  const bar = document.querySelector('.action-bar');
  const hero = document.querySelector('.hero');
  let ticking = false;
  const onScroll = () => {
    ticking = false;
    const y = window.scrollY;
    if (header) header.classList.toggle('is-scrolled', y > 4);
    if (bar && hero) bar.classList.toggle('is-hidden', y < hero.offsetHeight * 0.5);
  };
  window.addEventListener('scroll', () => {
    if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
  }, { passive: true });
  onScroll();

  /* ---------- Foto-Karussells ---------- */
  document.querySelectorAll('[data-carousel]').forEach((carousel) => {
    const track = carousel.querySelector('.carousel-track');
    const slides = Array.from(track.children);
    const prev = carousel.querySelector('.carousel-btn.prev');
    const next = carousel.querySelector('.carousel-btn.next');
    const dots = Array.from(carousel.querySelectorAll('.carousel-dots span'));

    const current = () => Math.round(track.scrollLeft / Math.max(track.clientWidth, 1));
    const update = () => {
      const i = current();
      dots.forEach((dot, k) => dot.classList.toggle('is-active', k === i));
      prev.disabled = i <= 0;
      next.disabled = i >= slides.length - 1;
    };
    const go = (step) => {
      const i = Math.min(Math.max(current() + step, 0), slides.length - 1);
      track.scrollTo({ left: i * track.clientWidth, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
    };

    prev.addEventListener('click', () => go(-1));
    next.addEventListener('click', () => go(1));
    track.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
    });
    let raf = 0;
    track.addEventListener('scroll', () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    }, { passive: true });
    update();
  });
})();
