/* Fardin Huq portfolio — interactions (ported from the design file). */
(function () {
  'use strict';
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.prototype.slice.call((r || document).querySelectorAll(s));
  const REDUCE = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  class Site {
    constructor() {
      this.root = $('.nomi-root');
      this.storyEl = $('#about');
      this.panels = $$('.st-panel', this.storyEl);
      this.stage = $('.nomi-stage');
      this.head = $('.nomi-h1');
      this.xpEl = $('#experience'); this.xpLineEl = $$('.xp-line'); this.xpFillEl = $('.xp-fill');
      this.globeEl = $('.tg-globe'); this.tagEls = $$('.tg-tag');
      this.pjEl = $('#projects'); this.pjTrackEl = $('.pj-track'); this.pjPinEl = $('.pj-pin'); this.pjCardsEl = $('.pj-cards'); this.pjScoreEl = $('.pj-score'); this.pjCatBigEl = $('.pj-catbig');
      this.prEl = $('#process'); this.prTrackEl = $('.pr-track'); this.prMapEl = $('.pr-map'); this.prDoneEl = $('.pr-done'); this.prPandaEl = $('.pr-panda'); this.prStampEl = $('.pr-stamp'); this.prHintEl = $('.pr-hint');
      this.pbEl = $('#publications'); this.pbTrackEl = $('.pb-track'); this.pbDeckEl = $('.pb-deck');
      this.ctEl = $('#contact'); this.ctTypedEl = $('.ct-typed'); this.ctToastEl = $('.ct-toast');
      this.init();
    }
    small() { const w = this.root ? this.root.offsetWidth : window.innerWidth; return w < 1000 || this.pageH() < 540; }
    init() {
      // Scroll-driven sections
      this.onStory = () => { if (this.sraf) return; this.sraf = requestAnimationFrame(() => { this.sraf = null; this.updateStory(); }); };
      window.addEventListener('scroll', this.onStory, { passive: true });
      window.addEventListener('resize', () => { this.prLens = null; this.onStory(); });
      window.addEventListener('load', this.onStory);
      setTimeout(this.onStory, 50);
      // Hero name stretch
      if (this.stage) {
        this.stage.addEventListener('mousemove', (e) => {
          const r = this.stage.getBoundingClientRect();
          this.mx = (e.clientX - r.left) / r.width; this.my = (e.clientY - r.top) / r.height; this.inside = true; this.kick();
        });
        this.stage.addEventListener('mouseleave', () => { this.inside = false; this.kick(); });
      }
      const v = $('.nomi-video');
      if (v) { v.muted = true; v.defaultMuted = true; try { const p = v.play(); if (p && p.catch) p.catch(() => {}); } catch (e) {} }
      // Globe
      if (this.globeEl) {
        this.globeEl.addEventListener('mousemove', (e) => {
          const r = this.globeEl.getBoundingClientRect();
          const mx = (e.clientX - r.left) / r.width - 0.5, my = (e.clientY - r.top) / r.height - 0.5;
          const g = this.g; if (!g) return; g.ty = mx * 0.035; g.tx = -my * 0.035;
        });
        this.globeEl.addEventListener('mouseleave', () => { const g = this.g; if (!g) return; g.ty = 0.0045; g.tx = 0.0012; });
      }
      this.startGlobe();
      this.typeBubble();
      // Contact copy
      const mail = $('.ct-mail');
      if (mail) mail.addEventListener('click', () => {
        const t = mail.getAttribute('data-email');
        try { if (navigator.clipboard) navigator.clipboard.writeText(t).catch(() => {}); } catch (e) {}
        const el = this.ctToastEl; if (!el) return;
        el.classList.add('is-on'); clearTimeout(this.ctToastT);
        this.ctToastT = setTimeout(() => el.classList.remove('is-on'), 1700);
      });
      const jumpTo = (h, smooth) => { const sl = (h || '').replace(/^#/, ''); if (sl && this.goCat(sl, smooth)) this.markJump(sl); };
      $$('.pj-jump a').forEach((a) => a.addEventListener('click', (e) => {
        e.preventDefault();
        const h = a.getAttribute('href');
        try { history.replaceState(null, '', h); } catch (er) {}
        jumpTo(h, true);
      }));
      if (this.pjCardsEl && location.hash) {
        // let the layout settle (the pinned track height is set on the first update), then jump
        const h = location.hash;
        if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
        setTimeout(() => { this.updateStory(); jumpTo(h, false); }, 80);
        window.addEventListener('load', () => setTimeout(() => jumpTo(h, false), 60), { once: true });
      }
      window.addEventListener('hashchange', () => jumpTo(location.hash, true));
      $$('.pp-more').forEach((b) => {
        const label = b.textContent;
        b.addEventListener('click', () => {
          const box = document.getElementById(b.getAttribute('aria-controls'));
          const open = b.getAttribute('aria-expanded') !== 'true';
          b.setAttribute('aria-expanded', String(open));
          if (box) box.classList.toggle('is-open', open);
          b.textContent = open ? b.getAttribute('data-less') : label;
        });
      });
      $$('.pp-cite').forEach((b) => {
        const label = b.textContent;
        b.addEventListener('click', () => {
          const t = b.getAttribute('data-cite');
          const done = () => { b.textContent = b.getAttribute('data-done'); b.classList.add('is-done'); setTimeout(() => { b.textContent = label; b.classList.remove('is-done'); }, 1600); };
          try { navigator.clipboard.writeText(t).then(done, () => window.prompt('Citation:', t)); } catch (er) { window.prompt('Citation:', t); }
        });
      });
      const top = $('.ft-top');
      if (top) top.addEventListener('click', () => { try { window.scrollTo({ top: 0, behavior: REDUCE ? 'auto' : 'smooth' }); } catch (e) { window.scrollTo(0, 0); } });
      // Mobile menu
      const nav = $('.nomi-nav'), btn = $('.nav-toggle');
      if (nav && btn) {
        const close = () => { nav.classList.remove('is-open'); btn.setAttribute('aria-expanded', 'false'); };
        btn.addEventListener('click', () => { const o = !nav.classList.contains('is-open'); nav.classList.toggle('is-open', o); btn.setAttribute('aria-expanded', String(o)); });
        $$('.nav-links a', nav).forEach((a) => a.addEventListener('click', close));
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
      }
    }
    typeBubble() {
      const el = $('.nomi-typed'), caret = $('.nomi-caret-b');
      if (!el) return;
      const full = (window.SITE && window.SITE.bubble) || el.textContent;
      if (REDUCE) { el.textContent = full; return; }
      let n = 0;
      const next = (fn, ms) => { this.tmr = setTimeout(fn, ms); };
      const show = (c) => { el.textContent = full.slice(0, n); if (caret) caret.style.opacity = c ? 1 : 0; };
      const type = () => { n += 1; show(1); if (n < full.length) next(type, full[n - 1] === '\n' ? 260 : 75); else next(() => blink(0), 350); };
      const blink = (i) => { if (i >= 6) { show(1); next(restart, 500); return; } show(i % 2 === 0 ? 0 : 1); next(() => blink(i + 1), 420); };
      const restart = () => { n = 0; show(1); next(type, 450); };
      n = 0; show(1); next(type, 600);
    }
  goal() {
    if (!this.inside) return { s: 0, x: 0, y: 0 };
    const t = Math.min(1, Math.max(0, (this.mx - 0.25) / 0.75));
    return { s: t * t * (3 - 2 * t), x: this.mx - 0.5, y: this.my - 0.5 };
  }
  apply() {
    const c = this.cur || { s: 0, x: 0, y: 0 };
    if (!this.head) return;
    const sx = 1 + 0.2 * c.s, sy = 1 + 0.1 * c.s;
    this.head.style.transform = 'translate(' + (c.x * 1.8).toFixed(3) + 'cqw, ' + (c.y * 1.1).toFixed(3) + 'cqw) scale(' + sx.toFixed(4) + ', ' + sy.toFixed(4) + ')';
  }
  kick() {
    if (this.raf || typeof requestAnimationFrame === 'undefined') return;
    if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const step = () => {
      const g = this.goal();
      const c = this.cur || (this.cur = { s: 0, x: 0, y: 0 });
      let moving = false;
      for (const k of ['s', 'x', 'y']) {
        const d = g[k] - c[k];
        c[k] += d * 0.075;
        if (Math.abs(d) > 0.0008) moving = true;
      }
      this.apply();
      this.raf = moving ? requestAnimationFrame(step) : null;
    };
    this.raf = requestAnimationFrame(step);
  }
  pageH() {
    const w = (this.storyEl && this.storyEl.offsetWidth) || window.innerWidth;
    return Math.min(window.innerHeight, w * 0.6236);
  }
  pinOff() { return Math.max(0, (window.innerHeight - this.pageH()) / 2); }
  updateStory() {
    const w = this.storyEl;
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const de = document.documentElement;
    const ok = !reduce && de.scrollHeight > window.innerHeight + 80;
    const big = ok && !this.small();
    const anim = big;
    this.updateXp(ok);
    this.updateProjects(big);
    this.updateProcess(big);
    this.updatePubs(big);
    this.updateContact(ok);
    if (!w) return;
    w.classList.toggle('is-anim', anim);
    const ps = this.panels;
    if (!anim) { ps.forEach((el) => { if (el) { el.style.transform = ''; el.style.opacity = ''; el.style.visibility = ''; } }); return; }
    const r = w.getBoundingClientRect();
    const vh = this.pageH();
    const p = Math.min(1, Math.max(0, (this.pinOff() - r.top) / Math.max(1, r.height - vh)));
    const N = ps.length;
    const raw = p * (N - 1);
    const i0 = Math.min(N - 2, Math.floor(raw));
    let t = raw - i0;
    t = t < 0.5 ? 0 : (t - 0.5) / 0.5;
    t = t * t * (3 - 2 * t);
    const cur = i0 + t;
    ps.forEach((el, i) => {
      if (!el) return;
      const d = cur - i;
      const o = Math.max(0, 1 - Math.abs(d) * 1.5);
      el.style.transform = 'translateY(' + (-d * 30).toFixed(2) + '%)';
      el.style.opacity = o.toFixed(3);
      el.style.visibility = o < 0.01 ? 'hidden' : 'visible';
    });
  }
  countUp() {
    if (this.counted || !this.pjScoreEl) return;
    const r = this.pjScoreEl.getBoundingClientRect();
    if (!(r.top < window.innerHeight * 0.85 && r.bottom > 0)) return;
    this.counted = true;
    const els = Array.prototype.slice.call(this.pjScoreEl.querySelectorAll('.sc-n'));
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;
    const t0 = performance.now(), dur = 1500;
    const step = (now) => {
      const k = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - k, 3);
      els.forEach((el) => {
        const to = parseFloat(el.getAttribute('data-to')) || 0;
        const dec = parseInt(el.getAttribute('data-dec'), 10) || 0;
        el.textContent = (to * e).toFixed(dec);
      });
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  numberProjects(cats) {
    let n = 0;
    const total = cats.reduce((a, c) => a + c.projects.length, 0);
    cats.forEach((c, ci) => c.projects.forEach((p) => { n += 1; p.num = (n < 10 ? '0' : '') + n; p.total = String(total); p.cat = ci; p.catName = c.name; }));
    return cats;
  }
  updateProjects(anim) {
    this.countUp();
    const sec = this.pjEl, pin = this.pjPinEl, track = this.pjTrackEl, wrap = this.pjCardsEl;
    if (!sec || !pin || !track || !wrap) return;
    const cards = Array.prototype.slice.call(wrap.querySelectorAll('.pj-card'));
    const devs = Array.prototype.slice.call(pin.querySelectorAll('.pj-dev'));
    const score = this.pjScoreEl;
    const side = pin.querySelector('.pj-stage-side');
    const items = (score ? [score] : []).concat(cards);
    if (!anim || !cards.length) {
      sec.classList.remove('is-anim');
      track.style.height = '';
      items.forEach((el) => { el.style.transform = ''; el.style.opacity = ''; el.style.visibility = ''; el.style.pointerEvents = ''; });
      if (side) side.style.opacity = '';
      // stacked layout: highlight the category the reader is looking at
      let cur = cards[0];
      cards.forEach((c) => { if (c.getBoundingClientRect().top < window.innerHeight * 0.45) cur = c; });
      if (cur) this.markJump(cur.getAttribute('data-slug'));
      return;
    }
    sec.classList.add('is-anim');
    const vh = this.pageH();
    const N = items.length;
    const want = (N * 620 + vh) + 'px';
    if (track.style.height !== want) track.style.height = want;
    const r = track.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, (this.pinOff() - r.top) / Math.max(1, r.height - vh)));
    const raw = p * (N - 1);
    const i0 = Math.min(N - 2, Math.max(0, Math.floor(raw)));
    let t = raw - i0;
    t = t < 0.45 ? 0 : (t - 0.45) / 0.55;
    t = t * t * (3 - 2 * t);
    const cur = N > 1 ? i0 + t : 0;
    items.forEach((el, i) => {
      const d = cur - i;
      const o = Math.max(0, 1 - Math.abs(d) * 1.6);
      const dy = (-d * (el === score ? 220 : 150)).toFixed(1);
      el.style.transform = el === score ? 'translateY(' + dy + 'px)' : 'translateY(calc(-50% + ' + dy + 'px))';
      el.style.opacity = o.toFixed(3);
      el.style.visibility = o < 0.01 ? 'hidden' : 'visible';
      el.style.pointerEvents = o > 0.5 ? 'auto' : 'none';
    });
    if (side) side.style.opacity = score ? Math.min(1, Math.max(0, (cur - 0.35) / 0.5)).toFixed(3) : '';
    const ci = Math.min(N - 1, Math.max(0, Math.round(cur)));
    const cardEl = score ? cards[Math.max(0, ci - 1)] : cards[ci];
    const cat = parseInt(cardEl.getAttribute('data-cat'), 10) || 0;
    if (cat !== this.pjCat || !this.pjInit) {
      this.pjInit = true;
      this.pjCat = cat;
      pin.classList.toggle('is-flip', cat % 2 === 1);
      devs.forEach((d, k) => d.classList.toggle('is-on', k === cat));
      this.showModel(devs, cat);
      if (this.pjCatBigEl) this.pjCatBigEl.textContent = cardEl.getAttribute('data-catname') || '';
    }
    this.markJump(cardEl.getAttribute('data-slug'));
  }
  markJump(sl) {
    if (sl === this.pjJumpCur) return;
    this.pjJumpCur = sl;
    $$('.pj-jump a').forEach((a) => { const on = a.getAttribute('data-slug') === sl; a.classList.toggle('is-on', on); if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
  }
  // Projects page: go to the first project of a category (#web, #vr…). While the section is pinned the
  // cards sit on top of each other, so work out the scroll position that brings that card up.
  goCat(sl, smooth) {
    const wrap = this.pjCardsEl, track = this.pjTrackEl;
    if (!wrap || !track || !sl) return false;
    const cards = $$('.pj-card', wrap);
    const i = cards.findIndex((c) => c.getAttribute('data-slug') === sl);
    if (i < 0) return false;
    const behavior = smooth && !REDUCE ? 'smooth' : 'auto';
    if (this.pjEl.classList.contains('is-anim') && cards.length > 1) {
      const r = track.getBoundingClientRect();
      const y = r.top + window.scrollY - this.pinOff() + (i / (cards.length - 1)) * (r.height - this.pageH()) + 2;
      window.scrollTo({ top: Math.max(0, y), behavior });
    } else {
      cards[i].scrollIntoView({ behavior, block: 'start' });
    }
    return true;
  }
  // 3D models (desktop only): load the viewer library on first need, load the active category's model,
  // then quietly preload the next one. Only the visible model keeps rotating.
  showModel(devs, k) {
    const mvs = devs.map((d) => d.querySelector('model-viewer'));
    // Every model starts exactly front-facing, holds for a moment, then turns slowly. Coming back to a category resets it to the front.
    clearTimeout(this.mvSpinT);
    mvs.forEach((mv) => { if (mv) mv.removeAttribute('auto-rotate'); });
    const front = () => {
      const mv = mvs[k];
      if (!mv || this.pjCat !== k) return;
      try { if (mv.resetTurntableRotation) mv.resetTurntableRotation(0); if (mv.jumpCameraToGoal) mv.jumpCameraToGoal(); } catch (e) {}
      clearTimeout(this.mvSpinT);
      this.mvSpinT = setTimeout(() => { if (this.pjCat === k) mv.setAttribute('auto-rotate', ''); }, 2500);
    };
    const load = (i) => new Promise((done) => {
      const dev = devs[i], mv = mvs[i];
      if (!mv || mv.hasAttribute('src')) return done();
      if (!window.__mvLib) window.__mvLib = import('https://cdn.jsdelivr.net/npm/@google/model-viewer@3.5.0/dist/model-viewer.min.js').catch(() => null);
      window.__mvLib.then((ok) => {
        if (ok === null) return done();
        mv.addEventListener('load', () => { dev.classList.add('is-ready'); done(); }, { once: true });
        mv.addEventListener('error', () => done(), { once: true });
        mv.setAttribute('src', mv.getAttribute('data-src'));
      });
    });
    load(k).then(() => { front(); return load(k + 1); });
  }
  updateProcess(anim) {
    const sec = this.prEl, track = this.prTrackEl, map = this.prMapEl, done = this.prDoneEl, panda = this.prPandaEl, stamp = this.prStampEl;
    if (!sec || !track || !map || !done || !panda) return;
    const steps = Array.prototype.slice.call(map.querySelectorAll('.pr-step'));
    const N = steps.length;
    if (!N) return;
    if (!this.prLens || this.prLens.length !== N) {
      const L = done.getTotalLength();
      const pts = [];
      for (let k = 0; k <= 800; k++) { const q = done.getPointAtLength(L * k / 800); pts.push([q.x, q.y, L * k / 800]); }
      this.prL = L;
      this.prLens = steps.map((s) => {
        const x = parseFloat(s.getAttribute('data-x')), y = parseFloat(s.getAttribute('data-y'));
        let best = 0, bd = Infinity;
        pts.forEach((q) => { const dd = (q[0] - x) * (q[0] - x) + (q[1] - y) * (q[1] - y); if (dd < bd) { bd = dd; best = q[2]; } });
        return best;
      });
      done.style.strokeDasharray = L.toFixed(1);
    }
    const L = this.prL, lens = this.prLens;
    const place = (dist, hop, rot) => {
      const q = done.getPointAtLength(dist);
      panda.style.left = (q.x / 12).toFixed(3) + '%';
      panda.style.top = (q.y / 6.2).toFixed(3) + '%';
      panda.style.transform = 'translate(-50%,-50%) translateY(' + (-hop).toFixed(1) + 'px) rotate(' + rot.toFixed(1) + 'deg)';
      done.style.strokeDashoffset = Math.max(0, L - dist).toFixed(1);
    };
    if (!anim || map.offsetWidth < 500) {
      sec.classList.remove('is-anim');
      track.style.height = '';
      steps.forEach((s, i) => { s.classList.add('is-on'); s.classList.toggle('is-cur', i === N - 1); });
      if (stamp) stamp.classList.add('is-on');
      place(lens[N - 1], 0, 0);
      if (this.prHintEl) this.prHintEl.style.opacity = '';
      return;
    }
    sec.classList.add('is-anim');
    const vh = this.pageH();
    const want = (N * 460 + vh) + 'px';
    if (track.style.height !== want) track.style.height = want;
    const r = track.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, (this.pinOff() - r.top) / Math.max(1, r.height - vh)));
    const pp = Math.min(1, Math.max(0, (p - 0.04) / 0.86));
    const raw = pp * (N - 1);
    const i0 = Math.min(N - 2, Math.floor(raw));
    let t = raw - i0;
    t = t < 0.4 ? 0 : (t - 0.4) / 0.6;
    t = t * t * (3 - 2 * t);
    const moving = t > 0 && t < 1;
    const dist = lens[i0] + (lens[i0 + 1] - lens[i0]) * t;
    place(dist, moving ? Math.abs(Math.sin(t * Math.PI * 4)) * 14 : 0, moving ? Math.sin(t * Math.PI * 8) * 9 : 0);
    const reached = i0 + (t >= 1 ? 1 : 0);
    steps.forEach((s, i) => { s.classList.toggle('is-on', i <= reached); s.classList.toggle('is-cur', i === reached && !moving); });
    if (stamp) stamp.classList.toggle('is-on', reached === N - 1);
    if (this.prHintEl) this.prHintEl.style.opacity = Math.max(0, 1 - p * 10).toFixed(2);
  }
  updatePubs(anim) {
    const sec = this.pbEl, track = this.pbTrackEl, deck = this.pbDeckEl;
    if (!sec || !track || !deck) return;
    const sheets = Array.prototype.slice.call(deck.querySelectorAll('.pb-sheet'));
    if (!sheets.length) return;
    if (!anim || deck.offsetWidth < 700) {
      sec.classList.remove('is-anim');
      track.style.height = '';
      sheets.forEach((s) => { s.style.transform = ''; s.style.zIndex = ''; });
      return;
    }
    sec.classList.add('is-anim');
    const vh = this.pageH();
    const want = (sheets.length * 420 + vh) + 'px';
    if (track.style.height !== want) track.style.height = want;
    const r = track.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, (this.pinOff() - r.top) / Math.max(1, r.height - vh)));
    const mid = deck.offsetWidth / 2;
    const pile = [-7, 5, -2], fin = [-2.5, 1.2, 3], finY = [0, 10, 0];
    const n = sheets.length;
    sheets.forEach((s, i) => {
      const a = 0.08 + i * (0.8 / n), b = a + 0.8 / n * 0.9;
      let e = Math.min(1, Math.max(0, (p - a) / (b - a)));
      e = 1 - Math.pow(1 - e, 3);
      const dx = mid - (s.offsetLeft + s.offsetWidth / 2);
      const x = dx * (1 - e) + i * 6 * (1 - e);
      const y = (finY[i] || 0) * e + (i * 8) * (1 - e) - Math.sin(e * Math.PI) * 40;
      const rot = (pile[i] || 0) + ((fin[i] || 0) - (pile[i] || 0)) * e;
      s.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) rotate(' + rot.toFixed(2) + 'deg)';
      s.style.zIndex = e > 0.02 ? String(10 + i) : String(n - i);
    });
  }
  updateContact(anim) {
    const sec = this.ctEl;
    if (!sec || this.ctStarted) return;
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!anim || reduce) { sec.classList.add('is-in'); return; }
    const r = sec.getBoundingClientRect();
    if (r.top > window.innerHeight * 0.7) return;
    this.ctStarted = true;
    sec.classList.add('is-in');
    const el = this.ctTypedEl;
    if (!el) return;
    const full = el.getAttribute('data-text') || el.textContent;
    let n = 0;
    el.textContent = '';
    const tick = () => {
      if (!el.isConnected) return;
      n += 1;
      el.textContent = full.slice(0, n);
      if (n < full.length) { this.ctTmr = setTimeout(tick, 70); return; }
      this.ctTmr = setTimeout(() => { n = 0; el.textContent = ''; this.ctTmr = setTimeout(tick, 400); }, 2600);
    };
    this.ctTmr = setTimeout(tick, 1100);
  }
  updateXp(anim) {
    $$('.xp-line').forEach((line) => this.updateXpLine(anim, line.closest('section') || line, line, line.querySelector('.xp-fill')));
  }
  updateXpLine(anim, sec, line, fill) {
    const items = Array.prototype.slice.call(line.querySelectorAll('.xp-item'));
    if (!anim) {
      sec.classList.remove('xp-js');
      if (fill) fill.style.transform = 'scaleY(1)';
      items.forEach((it) => it.classList.add('is-up'));
      return;
    }
    if (!sec.classList.contains('xp-js')) { sec.classList.add('xp-js'); items.forEach((it) => it.classList.remove('is-up')); }
    const trigger = window.innerHeight * 0.62;
    const r = line.getBoundingClientRect();
    const prog = Math.min(1, Math.max(0, (trigger - r.top) / Math.max(1, r.height)));
    if (fill) fill.style.transform = 'scaleY(' + prog.toFixed(4) + ')';
    // A badge levels up when the filling line reaches it, and resets when you scroll back above it,
    // so the LEVEL UP pop replays every time you scroll down past it (a small margin stops flicker).
    items.forEach((it) => {
      const b = it.querySelector('.xp-badge');
      if (!b) return;
      const br = b.getBoundingClientRect(), c = br.top + br.height / 2;
      if (!it.classList.contains('is-up')) { if (c < trigger) it.classList.add('is-up'); }
      else if (c > trigger + 40) it.classList.remove('is-up');
    });
  }
  globeTick() {
    const box = this.globeEl, els = this.tagEls || [];
    if (box && els.length) {
      const rect = box.getBoundingClientRect();
      const onScreen = rect.bottom > -50 && rect.top < (window.innerHeight || 0) + 50;
      if (onScreen || !this.gDrawn) {
        const g = this.g || (this.g = { rx: 0.35, ry: 0, vx: 0.0012, vy: 0.0045, tx: 0.0012, ty: 0.0045 });
        if (!this.gReduce) { g.vx += (g.tx - g.vx) * 0.05; g.vy += (g.ty - g.vy) * 0.05; g.rx += g.vx; g.ry += g.vy; }
        const R = box.offsetWidth * 0.4;
        const cx = Math.cos(g.rx), sx = Math.sin(g.rx), cy = Math.cos(g.ry), sy = Math.sin(g.ry);
        const pts = this.gPts;
        for (let i = 0; i < els.length; i++) {
          const el = els[i], p = pts[i];
          if (!el || !p) continue;
          const x1 = p[0] * cy + p[2] * sy;
          const z1 = -p[0] * sy + p[2] * cy;
          const y2 = p[1] * cx - z1 * sx;
          const z2 = p[1] * sx + z1 * cx;
          const d = (z2 + 1) / 2;
          el.style.transform = 'translate(-50%,-50%) translate3d(' + (x1 * R).toFixed(1) + 'px,' + (y2 * R).toFixed(1) + 'px,0) scale(' + (0.62 + 0.45 * d).toFixed(3) + ')';
          el.style.opacity = (0.22 + 0.78 * d).toFixed(3);
          el.style.zIndex = String(Math.round(d * 100));
        }
        this.gDrawn = true;
      }
    }
    if (!this.gReduce) this.graf = requestAnimationFrame(() => this.globeTick());
  }
  startGlobe() {
    const N = (this.tagEls || []).length;
    if (N < 2) return;
    const golden = Math.PI * (3 - Math.sqrt(5));
    const raw = [];
    for (let i = 0; i < N; i++) {
      const y = 1 - (i / (N - 1)) * 2;
      const r = Math.sqrt(Math.max(0, 1 - y * y));
      const th = golden * i;
      raw.push([Math.cos(th) * r, y, Math.sin(th) * r]);
    }
    const keyIdx = [], other = [];
    this.tagEls.forEach((el, i) => { (el.classList.contains('is-key') ? keyIdx : other).push(i); });
    let seed = 11;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = other.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = other[i]; other[i] = other[j]; other[j] = t; }
    for (let i = keyIdx.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = keyIdx[i]; keyIdx[i] = keyIdx[j]; keyIdx[j] = t; }
    const slots = new Array(N);
    if (keyIdx.length) keyIdx.forEach((ti, k) => { slots[Math.min(N - 1, Math.floor((k + 0.5) * N / keyIdx.length))] = ti; });
    let o = 0;
    for (let s = 0; s < N; s++) { if (slots[s] === undefined) slots[s] = other[o++]; }
    this.gPts = [];
    slots.forEach((ti, s) => { this.gPts[ti] = raw[s]; });
    this.gReduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (this.gReduce) { setTimeout(() => this.globeTick(), 60); return; }
    this.graf = requestAnimationFrame(() => this.globeTick());
  }  }
  // Client logos: pass each logo's aspect ratio to CSS so wide and square logos get equal visual weight.
  // Project cards: if a YouTube video has no HD thumbnail (YouTube returns a tiny 120px placeholder), use the standard one.
  const media = () => {
    document.querySelectorAll('.cl-logo').forEach((img) => {
      const f = () => { if (img.naturalWidth && img.naturalHeight) img.style.setProperty('--r', (img.naturalWidth / img.naturalHeight).toFixed(3)); };
      img.addEventListener('load', f); f();
      if (img.decode) img.decode().then(f, () => {});
    });
    document.querySelectorAll('img.pj-img[data-fallback]').forEach((img) => {
      const swap = () => { if (img.dataset.fallback) { img.src = img.dataset.fallback; img.removeAttribute('data-fallback'); } };
      const chk = () => { if (img.naturalWidth && img.naturalWidth <= 120) swap(); };
      img.addEventListener('error', swap); img.addEventListener('load', chk);
      if (img.complete) chk();
    });
  };
  // "Email me": a mailto: link does nothing when no mail app is set up (most Windows PCs), so offer Gmail / Outlook / mail app / copy.
  const mailMenu = () => {
    const menu = document.querySelector('.ct-mailmenu');
    if (!menu) return;
    const wrap = menu.parentElement;
    let opener = null;
    const close = (focusBack) => {
      if (menu.hidden) return;
      menu.hidden = true; wrap.classList.remove('is-menu');
      if (opener) { opener.setAttribute('aria-expanded', 'false'); if (focusBack) opener.focus(); }
    };
    const open = (btn) => {
      opener = btn; menu.hidden = false; wrap.classList.add('is-menu'); btn.setAttribute('aria-expanded', 'true');
      const W = wrap.clientWidth, mw = menu.offsetWidth;
      const left = Math.max(0, Math.min(W - mw, btn.offsetLeft + btn.offsetWidth / 2 - mw / 2));
      menu.style.left = left + 'px'; menu.style.top = (btn.offsetTop + btn.offsetHeight + 10) + 'px';
      const first = menu.querySelector('a,button'); if (first) first.focus({ preventScroll: true });
    };
    wrap.querySelectorAll('a.ct-btn[href^="mailto:"]').forEach((a) => {
      a.setAttribute('aria-haspopup', 'menu'); a.setAttribute('aria-expanded', 'false');
      a.addEventListener('click', (e) => { e.preventDefault(); if (menu.hidden) open(a); else close(); });
    });
    menu.addEventListener('click', (e) => {
      const c = e.target.closest('[data-copy]');
      if (c) {
        const t = c.getAttribute('data-copy'), label = c.textContent;
        const done = () => { c.textContent = c.getAttribute('data-done'); setTimeout(() => { c.textContent = label; close(); }, 1200); };
        try { navigator.clipboard.writeText(t).then(done, () => { window.prompt('Email:', t); close(); }); } catch (err) { window.prompt('Email:', t); close(); }
        return;
      }
      if (e.target.closest('a')) setTimeout(() => close(), 50);
    });
    document.addEventListener('click', (e) => { if (!menu.hidden && !menu.contains(e.target) && !(opener && opener.contains(e.target))) close(); });
    document.addEventListener('keydown', (e) => {
      if (menu.hidden) return;
      if (e.key === 'Escape') close(true);
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const items = [...menu.querySelectorAll('a,button')], i = items.indexOf(document.activeElement);
        items[(i + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length].focus();
      }
    });
    window.addEventListener('resize', () => close());
  };
  // Case Studies page: the page opens on the case cards only. A card, the case bar or "Next case" opens ONE case
  // (#its-slug, so Back works and home cards can link straight to a case); the last case's Next loops to the first.
  // While a case is open: its cards reveal as they scroll in and a yellow bar shows reading progress.
  const caseStudies = () => {
    const sec = document.querySelector('.cs');
    if (!sec) return;
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const cases = Array.prototype.slice.call(sec.querySelectorAll('.cs-case'));
    const links = Array.prototype.slice.call(sec.querySelectorAll('.cs-jump a[data-slug]'));
    const jump = sec.querySelector('.cs-jump');
    const bar = document.querySelector('.cs-progress span');
    const baseTitle = document.title;
    sec.classList.add('js-router');
    const io = (!reduce && 'IntersectionObserver' in window) ? new IntersectionObserver((entries) => entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const el = e.target, sib = el.parentElement ? Array.prototype.indexOf.call(el.parentElement.children, el) : 0;
      el.style.transitionDelay = Math.min(sib, 4) * 90 + 'ms';
      el.classList.add('is-in'); io.unobserve(el);
    }), { rootMargin: '0px 0px -10% 0px', threshold: 0.1 }) : null;
    if (io) sec.classList.add('js');
    const show = () => {
      const id = decodeURIComponent((location.hash || '').slice(1));
      const open = cases.find((c) => c.id === id) || null;
      sec.classList.toggle('is-case', !!open);
      cases.forEach((c) => { const on = c === open; c.classList.toggle('is-open', on); c.hidden = !on; });
      links.forEach((a) => {
        const hit = !!open && a.getAttribute('data-slug') === open.id;
        a.classList.toggle('is-on', hit);
        if (hit) { a.setAttribute('aria-current', 'true'); if (jump && jump.scrollWidth > jump.clientWidth) jump.scrollTo({ left: a.offsetLeft - 60, behavior: reduce ? 'auto' : 'smooth' }); } else a.removeAttribute('aria-current');
      });
      if (open) {
        const t = open.querySelector('.cs-t');
        document.title = (t ? t.textContent + ' — ' : '') + baseTitle;
        if (io) open.querySelectorAll('[data-reveal]').forEach((el) => { el.classList.remove('is-in'); el.style.transitionDelay = ''; io.observe(el); });
      } else document.title = baseTitle;
      window.scrollTo(0, 0);
      tick();
    };
    const tick = () => {
      if (!bar) return;
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      bar.style.transform = 'scaleX(' + (sec.classList.contains('is-case') ? Math.min(1, window.scrollY / max) : 0).toFixed(4) + ')';
    };
    let raf = null;
    window.addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(() => { raf = null; tick(); }); }, { passive: true });
    window.addEventListener('resize', tick);
    window.addEventListener('hashchange', show);
    // "All cases": clear the hash without leaving a bare "#" in the address bar
    const all = sec.querySelector('.cs-all');
    if (all) all.addEventListener('click', (e) => { e.preventDefault(); try { history.pushState(null, '', location.pathname + location.search); } catch (er) { location.hash = ''; } show(); });
    window.addEventListener('popstate', show);
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    show();
  };
  const start = () => { media(); mailMenu(); caseStudies(); window.__site = new Site(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
