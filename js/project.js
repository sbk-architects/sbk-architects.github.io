/* SBK Architects — project pages (work/*.html)
   1. Arrival: the card's arch, carried over from the home page, opens out into the hero
      picture: it grows, its rounded top squares off, and the full view appears around the
      card's crop. On a direct visit the picture is uncovered from the ground up (CSS).
   2. Leaving: "Selected work" goes back the way the visitor came and hands the picture to the
      home page, which closes it into the card's arch (js/main.js, section 12).
   3. The drawing viewer: enlarge, zoom, drag, previous and next (work/more.html uses it too).
   Load after js/main.js (smooth scroll, menu, drawings and AA.xfer come from there). */
(() => {
  'use strict';

  const doc = document.documentElement;
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));
  const AA = (window.AA = window.AA || {});
  AA.project = true;
  const X = AA.xfer;
  const reduce = !!AA.reduce;
  const hero = $('[data-hero]');
  const heroImg = hero && $('img', hero);
  const css = (name) => getComputedStyle(doc).getPropertyValue(name).trim();

  /* ------------------------------------------------------------------
     1. Arrival
     ------------------------------------------------------------------ */
  // (an arch on a page that was not arrived at this way belongs to js/main.js: one coming back)
  const arrival = window.SBK_XFER;
  const flyer = arrival ? $('.arch.xfer') : null;
  if (arrival && flyer && hero && X) {
    const full = $('.xfer__full', flyer);
    const card = $('.xfer__card', flyer);
    const decoded = (im) => (im && im.decode ? im.decode().catch(() => {}) : Promise.resolve());
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    // Hold the card's own photograph until the full picture is ready (the home page fetched it
    // early, so this is usually at once), then open the arch.
    Promise.race([decoded(full), wait(700)]).then(() => requestAnimationFrame(() => {
      if (card) card.remove();
      flyer.classList.add('is-plain');           // the arch's gold line goes as it opens
      doc.classList.add('is-go');
      const r0 = arrival.r[2] / 2;
      X.fly(flyer, arrival.r, () => X.rectOf(hero), {
        ms: 1100,
        radius: (e) => (1 - e) * r0,             // the round top squares off
        done: () => decoded(heroImg).then(() => {
          doc.classList.add('is-landed');
          requestAnimationFrame(() => flyer.remove());
        }),
      });
    }));
  } else {
    if (flyer) flyer.remove();
    doc.classList.remove('is-xfer');
  }

  /* ------------------------------------------------------------------
     2. Leaving
     ------------------------------------------------------------------ */
  let via = null;        // the link taking the visitor away, if it was a link
  let leaving = false;
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href]');
    if (!a || e.defaultPrevented || a.target === '_blank') return;
    via = a;
    setTimeout(() => { if (via === a) via = null; }, 1500);
  });
  const inView = (r) => r[1] + r[3] > 60 && r[1] < window.innerHeight - 60;
  const picture = () => ({ lqip: css('--lqip'), pos: css('--pos'), flat: true });
  function handBack() {
    if (!X || !hero || !heroImg) return;
    const r = X.rectOf(hero);
    if (!inView(r)) return;      // the picture is out of sight: the home page simply appears
    X.store.set('sbk:back', Object.assign({ from: location.href, r, src: heroImg.currentSrc || heroImg.src, t: Date.now() }, picture()));
  }
  // the browser's back button, or one of the "Selected work" links
  window.addEventListener('pagehide', () => { if (!via || via.hasAttribute('data-back')) handBack(); });
  let leftovers = [];           // the paper (and arch) laid down on the way out
  window.addEventListener('pageshow', (e) => {
    if (!e.persisted) return;    // back here from the back/forward cache: clear the way out
    leftovers.forEach((n) => n.remove());
    leftovers = [];
    leaving = false;
    via = null;
  });

  $$('[data-back]').forEach((a) => {
    a.addEventListener('click', (e) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const from = X && X.trail.to(location.href);     // how this page was reached
      const viaHistory = !!(from && X.samePage(from.url, a.href) && document.referrer &&
        X.samePage(document.referrer, a.href) && window.history.length > 1);
      const go = () => { if (viaHistory) window.history.back(); else window.location.href = a.href; };
      if (reduce || !X || typeof Element.prototype.animate !== 'function') {
        if (viaHistory) { e.preventDefault(); go(); }
        return;
      }
      e.preventDefault();
      if (leaving) return;
      leaving = true;
      via = a;
      const v = X.veil(0);
      const r = hero && X.rectOf(hero);
      leftovers.push(v);
      if (r && inView(r)) leftovers.push(X.arch(r, heroImg.currentSrc || heroImg.src, picture()));
      X.fade(v, 0, 1, 380);
      setTimeout(go, 400);
    });
  });

  /* ------------------------------------------------------------------
     3. Drawing viewer
     ------------------------------------------------------------------ */
  const viewer = $('[data-viewer]');
  const zoomers = $$('[data-zoom]');
  if (!viewer || !zoomers.length) return;

  const stage = $('[data-viewer-stage]', viewer);
  const img = $('[data-viewer-img]', viewer);
  const title = $('[data-viewer-title]', viewer);
  const count = $('[data-viewer-count]', viewer);
  const zoomBtn = $('[data-viewer-zoom]', viewer);
  const zoomLabel = $('[data-viewer-zoom-label]', viewer);
  const plus = $('[data-viewer-plus]', viewer);
  const hint = $('[data-viewer-hint]', viewer);
  const closeBtn = $('[data-viewer-close]', viewer);
  const rest = $$('body > *').filter((n) => n !== viewer && n.tagName !== 'SCRIPT');
  const items = zoomers.map((b) => {
    const im = $('img', b);
    // data-full: a larger picture to show in the viewer than the small one on the page
    return { b, im, full: b.dataset.full, title: b.dataset.title || im.alt, w: +im.getAttribute('width'), h: +im.getAttribute('height'), white: b.classList.contains('p-plan--white') };
  });
  const pad2 = (n) => String(n).padStart(2, '0');
  const HINT_FIT = 'Click the drawing to zoom in';
  const HINT_ZOOM = 'Drag or scroll to look around · click to zoom out';
  let index = 0, zoomed = false, opener = null;
  img.draggable = false;

  function size(keep) {
    const it = items[index];
    const cs = getComputedStyle(stage);
    const w = stage.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const h = stage.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    const fit = Math.min(w / it.w, h / it.h);
    const z = zoomed ? Math.max(1, fit * 2.2) : fit;
    img.style.width = Math.round(it.w * z) + 'px';
    img.style.height = Math.round(it.h * z) + 'px';
    stage.classList.toggle('is-zoomed', zoomed);
    zoomBtn.setAttribute('aria-pressed', String(zoomed));
    zoomLabel.textContent = zoomed ? 'Zoom out' : 'Zoom in';
    plus.setAttribute('d', zoomed ? 'M11.6 11.6 16 16M5 7.5h5' : 'M11.6 11.6 16 16M5 7.5h5M7.5 5v5');
    hint.textContent = zoomed ? HINT_ZOOM : HINT_FIT;
    if (keep) {                  // keep the point under the pointer (or the middle) where it was
      stage.scrollLeft = img.offsetLeft + keep.fx * img.offsetWidth - keep.x;
      stage.scrollTop = img.offsetTop + keep.fy * img.offsetHeight - keep.y;
    }
  }
  function toggle(cx, cy) {
    const b = img.getBoundingClientRect(), s = stage.getBoundingClientRect();
    if (cx == null) { cx = s.left + s.width / 2; cy = s.top + s.height / 2; }
    const fx = Math.min(1, Math.max(0, (cx - b.left) / b.width));
    const fy = Math.min(1, Math.max(0, (cy - b.top) / b.height));
    zoomed = !zoomed;
    size({ fx, fy, x: cx - s.left, y: cy - s.top });
  }
  function show(i) {
    index = (i + items.length) % items.length;
    const it = items[index];
    zoomed = false;
    img.classList.toggle('is-white', it.white);
    img.alt = it.im.alt;
    img.src = it.full || it.im.currentSrc || it.im.src;
    title.textContent = it.title;
    count.textContent = pad2(index + 1) + ' / ' + pad2(items.length);
    size();
    stage.scrollTo(0, 0);
  }
  function open(i) {
    opener = document.activeElement;
    viewer.hidden = false;
    rest.forEach((n) => { n.inert = true; });
    doc.classList.add('has-viewer');
    if (AA.lenis) AA.lenis.stop();
    show(i);
    requestAnimationFrame(() => viewer.classList.add('is-open'));
    closeBtn.focus();
  }
  function close() {
    if (viewer.hidden) return;
    viewer.classList.remove('is-open');
    rest.forEach((n) => { n.inert = false; });
    doc.classList.remove('has-viewer');
    if (AA.lenis) AA.lenis.start();
    setTimeout(() => { if (!viewer.classList.contains('is-open')) viewer.hidden = true; }, reduce ? 0 : 360);
    if (opener && opener.focus) opener.focus({ preventScroll: true });
  }

  items.forEach((it, i) => it.b.addEventListener('click', () => open(i)));
  closeBtn.addEventListener('click', close);
  $('[data-viewer-prev]', viewer).addEventListener('click', () => show(index - 1));
  $('[data-viewer-next]', viewer).addEventListener('click', () => show(index + 1));
  zoomBtn.addEventListener('click', () => toggle());
  window.addEventListener('resize', () => { if (!viewer.hidden) size(); });

  // drag to move around a zoomed drawing (touch screens scroll it natively)
  let drag = null, moved = false;
  stage.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    drag = { x: e.clientX, y: e.clientY, l: stage.scrollLeft, t: stage.scrollTop };
    moved = false;
  });
  window.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!moved && Math.abs(dx) + Math.abs(dy) > 5) { moved = true; stage.classList.add('is-dragging'); }
    if (moved && zoomed) { stage.scrollLeft = drag.l - dx; stage.scrollTop = drag.t - dy; }
  });
  window.addEventListener('pointerup', () => { if (!drag) return; drag = null; stage.classList.remove('is-dragging'); });
  stage.addEventListener('click', (e) => {
    if (moved) { moved = false; return; }
    if (e.target === img) toggle(e.clientX, e.clientY);
    else if (!zoomed) close();
  });

  document.addEventListener('keydown', (e) => {
    if (viewer.hidden) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'ArrowLeft' && !zoomed) { e.preventDefault(); show(index - 1); }
    else if (e.key === 'ArrowRight' && !zoomed) { e.preventDefault(); show(index + 1); }
  });
})();
