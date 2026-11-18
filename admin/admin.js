/* Portfolio admin: edits content/content.json in your GitHub repo.
   Saving commits the file through the GitHub API; the GitHub Action then rebuilds and redeploys the site. */
(function () {
  'use strict';
  const CONTENT_PATH = 'content/content.json';
  const LS = 'portfolio-admin';
  const app = document.getElementById('app');
  const toastEl = document.getElementById('toast');
  let cfg = load();
  let data = null, sha = null, dirty = false, current = 'site', offline = false;

  const SECTIONS = [
    ['site', 'Site & SEO', 'How Google and social apps see your site. Fill in your profile links: they help Google show this site first for your name.'],
    ['nav', 'Navigation', 'Links in the top bar and footer. "href" is a section id like #projects or a full link.'],
    ['hero', 'Hero', 'The first screen: your name, title, highlight lines and the panda’s speech bubble.'],
    ['about', 'About', 'The five scrolling panels next to your portrait. Style picks the layout: intro, statement, pitch, quote or cta.'],
    ['experience', 'Experience', 'Your level-up timeline and the toolbox globe. Tools listed under “highlighted” are shown in yellow.'],
    ['clients', 'Clients', 'Your client logos. Click “Upload logos…” to add several PNGs at once: empty margins are trimmed automatically so every logo lines up. A client without a logo shows its name instead.'],
    ['projects', 'Projects', 'Scoreboard numbers and every project card, grouped by category. The card picture is your uploaded image (you choose the crop), or the YouTube / video thumbnail when no image is set.'],
    ['process', 'Process', 'The 7-level map. You can add or remove levels and the path redraws itself.'],
    ['publications', 'Publications', 'Your papers. In authors, wrap your own name in **double stars** to mark it in yellow.'],
    ['contact', 'Contact', 'Contact heading, buttons and the panda’s typing bubble.'],
    ['footer', 'Footer', 'The small print at the very bottom.'],
  ];
  const OPTIONS = {
    'about.panels.*.style': ['intro', 'statement', 'pitch', 'quote', 'cta'],
    'projects.categories.*.device': ['vr', 'sim', 'ar', 'game', 'web', 'app', 'gallery'],
    'projects.smallStats.*.icon': ['vr', 'sim', 'ar', 'web', 'app'],
    'contact.buttons.*.style': ['outline', 'yellow'],
  };
  const HINTS = {
    'site.url': 'Your live address, e.g. https://username.github.io/ or your own domain. Ends with /',
    'site.title': 'Browser tab + Google result title. Keep your name first.',
    'site.description': 'The grey text under your Google result (about 150–160 characters).',
    'site.googleVerification': 'Code from Google Search Console → Settings → Ownership verification → HTML tag (content="…").',
    'site.profiles.scholar': 'Your Google Scholar profile link.',
    'site.profiles.website': 'Optional extra website (blog, company page…). Every filled-in profile, WhatsApp and Email appear as icons in the footer.',
    'site.whatsapp': 'Country code + number, digits only.',
    'hero.highlight': 'A new line here becomes a line break.',
    'hero.bubble': 'A new line here becomes a line break in the bubble.',
    'projects.categories.*.projects.*.video': 'Paste a YouTube link or upload a video file. With no image set, the card shows this video’s thumbnail. Leave empty to hide the “Watch video” button.',
    'projects.categories.*.projects.*.image': 'Upload a picture and drag/zoom to choose the area shown on the card. Leave empty to use the video thumbnail.',
    'projects.categories.*.model': '3D model (.glb) shown beside this category on computers. Upload a new .glb to replace it (smaller files load faster; under 10 MB is best).',
    'projects.categories.*.modelCredit': 'Required by the model’s CC BY licence: model name, author and licence.',
    'projects.categories.*.modelCreditUrl': 'Link to the model’s page (e.g. on Sketchfab).',
    'projects.categories.*.modelView': 'Optional starting angle. Empty = exact front (0deg 90deg auto). First number turns left/right, second tilts (90deg = straight on, smaller = from above).',
    'projects.smallStats.*.image': 'Picture on the small tile (transparent PNG/WebP works best). Empty = simple line icon.',
    'clients.logos.*.logo': 'PNG with a transparent background works best (white backgrounds are fine too). Margins are trimmed automatically.',
    'clients.logos.*.name': 'Used for screen readers and Google, and shown as text if there is no logo.',
    'clients.fullList': 'Hidden sentence for Google and screen readers. Leave empty to list the names above automatically.',
    'publications.papers.*.url': 'Link to the paper (DOI link is best).',
  };
  const FILE_KEY = /^(image|portrait|poster|video|cv|ogImage|logo|model)$/;
  const HIDDEN_KEY = /^(imageSource)$/; // managed by the image field (original picture kept for re-cropping)
  const IMG_RE = /\.(png|jpe?g|webp|gif|svg|avif)(\?|#|$)/i;
  const openItems = new WeakSet(); // list items the user has expanded (kept across in-place redraws)
  const previews = {}; // freshly uploaded path -> local object URL (the live site has not rebuilt yet)
  const refreshers = new WeakMap(); // owner object -> { key: fn } so one field can update another
  const LONG_KEY = /^(description|desc|highlight|heading|intro|line|sub|tagline|authors|title|bubble|fullList|bigLine|keywords)$/;

  // ---------- storage / utils ----------
  function load() { try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch (e) { return {}; } }
  function save() { try { localStorage.setItem(LS, JSON.stringify(cfg)); } catch (e) {} }
  function toast(msg, ms) { toastEl.textContent = msg; toastEl.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => toastEl.classList.remove('on'), ms || 2600); }
  const h = (tag, attrs, ...kids) => {
    const el = document.createElement(tag);
    for (const k in attrs || {}) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    kids.flat().forEach((c) => { if (c == null || c === false) return; el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return el;
  };
  const human = (k) => String(k).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());
  const b64enc = (str) => { const bytes = new TextEncoder().encode(str); let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(bin); };
  const b64dec = (b64) => { const bin = atob(b64.replace(/\n/g, '')); const bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i); return new TextDecoder().decode(bytes); };
  const setDirty = (v) => { dirty = v; const s = document.getElementById('st'); if (s) { s.textContent = v ? 'Unsaved changes' : (offline ? 'Offline mode' : 'All changes saved'); s.className = 'status' + (v ? ' dirty' : ''); } };
  window.addEventListener('beforeunload', (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
  const pathKey = (path) => path.map((p) => (typeof p === 'number' ? '*' : p)).join('.');
  const blank = (v) => Array.isArray(v) ? [] : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, blank(x)])) : typeof v === 'number' ? 0 : typeof v === 'boolean' ? false : '';

  // ---------- GitHub ----------
  function guessRepo() {
    const host = location.hostname;
    if (/\.github\.io$/.test(host)) {
      const owner = host.split('.')[0];
      const seg = location.pathname.split('/').filter(Boolean)[0];
      const repo = seg && seg !== 'admin' ? seg : owner + '.github.io';
      return { owner, repo };
    }
    return {};
  }
  async function gh(path, opts) {
    const r = await fetch(`https://api.github.com/repos/${cfg.owner}/${cfg.repo}/${path}`, Object.assign({ headers: { Authorization: 'Bearer ' + cfg.token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' } }, opts || {}));
    if (!r.ok) { let m = r.status + ' ' + r.statusText; try { const j = await r.json(); if (j.message) m = j.message + ' (' + r.status + ')'; } catch (e) {} throw new Error(m); }
    return r.json();
  }
  async function getFile(p) { return gh(`contents/${p}?ref=${encodeURIComponent(cfg.branch || 'main')}`); }
  async function putFile(p, b64, message, fileSha) {
    const body = { message, content: b64, branch: cfg.branch || 'main' };
    if (fileSha) body.sha = fileSha;
    return gh(`contents/${p}`, { method: 'PUT', body: JSON.stringify(body) });
  }

  // ---------- screens ----------
  function loginScreen(err) {
    const g = guessRepo();
    const owner = h('input', { class: 'in', value: cfg.owner || g.owner || '', placeholder: 'your-github-username', autocomplete: 'off' });
    const repo = h('input', { class: 'in', value: cfg.repo || g.repo || '', placeholder: 'repository-name', autocomplete: 'off' });
    const branch = h('input', { class: 'in', value: cfg.branch || 'main' });
    const token = h('input', { class: 'in', type: 'password', value: cfg.token || '', placeholder: 'github_pat_…', autocomplete: 'off' });
    const go = async () => {
      cfg = { owner: owner.value.trim(), repo: repo.value.trim(), branch: branch.value.trim() || 'main', token: token.value.trim() };
      if (!cfg.owner || !cfg.repo || !cfg.token) return loginScreen('Fill in username, repository and token.');
      save(); await open();
    };
    app.replaceChildren(h('div', { class: 'login' },
      h('h1', {}, 'Portfolio ', h('span', { class: 'hl' }, 'admin')),
      h('p', {}, 'Edit your site’s text, projects and papers. Saving updates the site automatically in about a minute.'),
      h('div', { class: 'row' }, h('div', {}, h('label', { class: 'f' }, 'GitHub username'), owner), h('div', {}, h('label', { class: 'f' }, 'Repository'), repo)),
      h('label', { class: 'f' }, 'Branch'), branch,
      h('label', { class: 'f' }, 'Access token'), token,
      err ? h('p', { class: 'err' }, err) : null,
      h('div', { class: 'row', style: 'margin-top:18px' }, h('div', { style: 'flex:0 0 auto' }, h('button', { class: 'btn y', onclick: go }, 'Open editor →')), h('div', { style: 'flex:0 0 auto' }, h('button', { class: 'btn ghost', onclick: openOffline }, 'Edit offline (download file)'))),
      h('details', { class: 'help' }, h('summary', {}, 'How do I get a token? (2 minutes, one time)'),
        h('ol', {},
          h('li', { html: 'Open <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">GitHub → Settings → Fine-grained tokens → Generate new token</a>.' }),
          h('li', {}, 'Name it “portfolio admin”, set an expiry (e.g. 1 year).'),
          h('li', {}, 'Repository access → Only select repositories → pick this site’s repository.'),
          h('li', {}, 'Permissions → Repository permissions → Contents → Read and write.'),
          h('li', {}, 'Generate, copy the token and paste it above. It stays only in this browser.')),
        h('p', { class: 'tip' }, 'Never share the token. If you lose a device, delete the token on GitHub and make a new one.'))
    ));
  }

  async function open() {
    app.replaceChildren(h('div', { class: 'login' }, h('h1', {}, 'Loading…')));
    try {
      const f = await getFile(CONTENT_PATH);
      sha = f.sha; data = JSON.parse(b64dec(f.content)); offline = false;
      editor();
    } catch (e) { loginScreen('Could not open your content: ' + e.message + '. Check the username, repository, branch and token.'); }
  }
  async function openOffline() {
    try { const r = await fetch('../' + CONTENT_PATH, { cache: 'no-store' }); data = await r.json(); }
    catch (e) { return loginScreen('Offline mode needs the site files served (e.g. open the site, then /admin/).'); }
    offline = true; sha = null; editor();
  }

  function editor() {
    const nav = h('nav', { class: 'side', 'aria-label': 'Sections' }, SECTIONS.map(([k, label]) => h('button', { class: k === current ? 'on' : '', onclick: () => { current = k; editor(); } }, label)));
    const sec = SECTIONS.find((s) => s[0] === current);
    const panel = h('section', { class: 'panel' }, h('h2', {}, sec[1]), h('p', { class: 'tip' }, sec[2]),
      h('p', { class: 'tip', html: 'Text tricks: <code>==word==</code> = <span class="hl">yellow marker</span>, <code>**word**</code> = <b>bold</b>, <code>*word*</code> = <i>italic</i>, new line = line break.' }));
    renderValue(data[current], [current], panel, (v) => { data[current] = v; });
    const live = data.site && data.site.url;
    app.replaceChildren(
      h('header', { class: 'top' },
        h('span', { class: 'brand' }, 'Portfolio ', h('span', { class: 'hl' }, 'admin')),
        h('span', { id: 'st', class: 'status' }),
        live ? h('a', { class: 'btn sm', href: live, target: '_blank', rel: 'noopener' }, 'View site ↗') : null,
        !offline ? h('a', { class: 'btn sm', href: `https://github.com/${cfg.owner}/${cfg.repo}/actions`, target: '_blank', rel: 'noopener' }, 'Build status ↗') : null,
        h('button', { class: 'btn sm', onclick: download }, 'Download backup'),
        h('label', { class: 'btn sm' }, 'Import', h('input', { type: 'file', accept: 'application/json', hidden: true, onchange: importJson })),
        !offline ? h('button', { class: 'btn sm ghost', onclick: () => { if (dirty && !confirm('Discard unsaved changes?')) return; cfg.token = ''; save(); dirty = false; loginScreen(); } }, 'Log out') : null,
        h('button', { class: 'btn y', id: 'savebtn', onclick: saveAll }, offline ? 'Download content.json' : 'Save & publish')),
      h('div', { class: 'wrap' }, nav, panel));
    setDirty(dirty);
  }

  // ---------- generic form ----------
  function renderValue(val, path, parent, set, owner) {
    const key = path[path.length - 1];
    const pk = pathKey(path);
    if (HIDDEN_KEY.test(String(key))) return;
    if (Array.isArray(val)) return renderArray(val, path, parent);
    if (val && typeof val === 'object') {
      const box = path.length === 1 ? parent : h('div', { class: 'grp' }, h('div', { class: 'gh' }, h('b', {}, human(key))), h('div', { class: 'gb' }));
      const body = path.length === 1 ? parent : box.lastChild;
      Object.keys(val).forEach((k) => renderValue(val[k], path.concat(k), body, (v) => { val[k] = v; }, val));
      if (box !== parent) parent.appendChild(box);
      return;
    }
    const fld = h('div', { class: 'fld' });
    const lab = h('div', { class: 'lab' }, typeof key === 'number' ? '' : human(key));
    if (typeof key !== 'number') fld.appendChild(lab);
    let input;
    if (typeof val === 'boolean') {
      input = h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: val, onchange: (e) => { set(e.target.checked); setDirty(true); } }), 'Yes');
      lab.remove();
      input.lastChild.textContent = human(key);
    } else if (typeof val === 'number') {
      input = h('input', { class: 'in', type: 'number', step: 'any', value: val, oninput: (e) => { set(e.target.value === '' ? 0 : Number(e.target.value)); setDirty(true); } });
    } else if (OPTIONS[pk]) {
      input = h('select', { class: 'in', onchange: (e) => { set(e.target.value); setDirty(true); } }, OPTIONS[pk].map((o) => h('option', { value: o, selected: o === val }, o)));
    } else if (FILE_KEY.test(String(key))) {
      input = fileField(val, set, pk, owner, String(key));
    } else {
      const long = LONG_KEY.test(String(key)) || String(val).length > 70 || String(val).includes('\n');
      input = long
        ? h('textarea', { class: 'in', rows: Math.min(8, Math.max(2, Math.ceil(String(val).length / 80) + String(val).split('\n').length - 1)), oninput: (e) => { set(e.target.value); setDirty(true); } }, String(val))
        : h('input', { class: 'in', value: String(val), oninput: (e) => { set(e.target.value); setDirty(true); } });
    }
    fld.appendChild(input);
    if (HINTS[pk]) fld.appendChild(h('div', { class: 'tip', style: 'margin:4px 0 0' }, HINTS[pk]));
    parent.appendChild(fld);
  }

  function itemTitle(it, i) {
    if (it && typeof it === 'object') return it.title || it.name || it.role || it.label || it.venue || it.badge || (it.heading ? String(it.heading).replace(/==|\*\*/g, '').slice(0, 48) : '') || ('Item ' + (i + 1));
    return '';
  }
  function itemThumb(it) {
    if (!it || typeof it !== 'object') return '';
    const p = it.logo || it.image || (ytId(it.video) ? `https://i.ytimg.com/vi/${ytId(it.video)}/mqdefault.jpg` : '');
    return p && (IMG_RE.test(p) || /^https?:/.test(p)) ? h('img', { class: 'hthumb' + (it.logo ? ' logo' : ''), src: srcFor(p), alt: '' }) : '';
  }

  // Lists redraw in place: adding, moving or removing an item never reloads the page or closes what you have open.
  function renderArray(arr, path, parent, extraTools) {
    const key = path[path.length - 1];
    const pk = pathKey(path);
    const objects = arr.length ? arr.every((x) => x && typeof x === 'object' && !Array.isArray(x)) : guessObjects(path);
    let grp = draw();
    parent.appendChild(grp);

    function redraw(focus) {
      setDirty(true);
      const next = draw();
      grp.replaceWith(next); grp = next;
      if (focus == null) return;
      const el = grp.querySelector(`:scope > .gb > [data-i="${focus}"]`);
      if (!el) return;
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      const f = el.querySelector('input.in, textarea.in, select.in');
      if (f) f.focus({ preventScroll: true });
      el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1200);
    }
    function add() {
      let item;
      if (objects) { item = blank(arr[0] || templateFor(path)); openItems.add(item); }
      else if (arr.length && Array.isArray(arr[0])) item = [];
      else item = '';
      arr.push(item);
      redraw(arr.length - 1);
    }
    function draw() {
      const g = h('div', { class: 'grp', 'data-dnd': pk });
      g.__list = { arr, redraw: (f) => redraw(f) };
      const actions = [h('button', { class: 'btn sm', type: 'button', onclick: add }, '+ Add')];
      if (/^clients\.logos$/.test(pk)) actions.unshift(bulkLogos(arr, redraw));
      g.appendChild(h('div', { class: 'gh' },
        h('b', {}, typeof key === 'number' ? 'Row ' + (key + 1) : human(key)),
        h('span', { class: 'tip', style: 'margin:0' }, arr.length + ' item' + (arr.length === 1 ? '' : 's')),
        h('span', { class: 'sp' }, actions, extraTools || [])));
      const body = h('div', { class: 'gb lst' });
      arr.forEach((it, i) => {
        const handle = h('button', { class: 'ico drag', type: 'button', title: 'Drag to move', 'aria-label': 'Drag to move', onpointerdown: (e) => startDrag(e, { arr, i, pk, redraw, label: itemTitle(it, i) || String(it) || 'Item' }) }, '⠿');
        const tools = [
          handle,
          h('button', { class: 'ico', type: 'button', title: 'Move up', 'aria-label': 'Move up', onclick: () => { if (i > 0) { [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]; redraw(); } } }, '↑'),
          h('button', { class: 'ico', type: 'button', title: 'Move down', 'aria-label': 'Move down', onclick: () => { if (i < arr.length - 1) { [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]]; redraw(); } } }, '↓'),
          h('button', { class: 'ico del', type: 'button', title: 'Remove', 'aria-label': 'Remove', onclick: () => { if (confirm('Remove this item?')) { arr.splice(i, 1); redraw(); } } }, '✕'),
        ];
        if (it && typeof it === 'object' && !Array.isArray(it)) {
          const isOpen = openItems.has(it);
          const card = h('div', { class: 'grp' + (isOpen ? '' : ' collapsed'), 'data-i': i });
          const toggle = () => { const c = card.classList.toggle('collapsed'); if (c) openItems.delete(it); else openItems.add(it); };
          const head = h('div', { class: 'gh' }, h('button', { class: 'ico tg', type: 'button', 'aria-label': 'Expand', onclick: toggle }, '▸'), itemThumb(it), h('b', { style: 'cursor:pointer', onclick: toggle }, itemTitle(it, i)), h('span', { class: 'sp' }, tools));
          const cb = h('div', { class: 'gb' });
          card.__drops = {}; card.__redraw = () => redraw(); card.__name = itemTitle(it, i);
          Object.keys(it).forEach((k) => { if (Array.isArray(it[k])) card.__drops[pathKey(path.concat(i, k))] = it[k]; });
          Object.keys(it).forEach((k) => renderValue(it[k], path.concat(i, k), cb, (v) => { it[k] = v; }, it));
          card.append(head, cb);
          body.appendChild(card);
        } else if (Array.isArray(it)) {
          const wrap = h('div', { 'data-i': i });
          renderArray(it, path.concat(i), wrap, tools);
          body.appendChild(wrap);
        } else {
          const long = String(it).length > 70;
          const inp = long ? h('textarea', { class: 'in', rows: 2, oninput: (e) => { arr[i] = e.target.value; setDirty(true); } }, String(it))
            : h('input', { class: 'in', value: String(it), oninput: (e) => { arr[i] = e.target.value; setDirty(true); }, onkeydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } } });
          body.appendChild(h('div', { class: 'li', 'data-i': i }, inp, tools));
        }
      });
      if (!arr.length) body.appendChild(h('p', { class: 'tip', style: 'margin:0 0 10px' }, 'Nothing here yet. Click “+ Add”.'));
      g.appendChild(body);
      return g;
    }
  }
  // ---------- drag & drop (mouse and touch) ----------
  // Drag an item by its ⠿ handle within its list, into the same kind of list elsewhere (e.g. a project into
  // another category's projects), or onto a collapsed card that holds such a list (e.g. a closed category).
  function startDrag(e, src) {
    if (e.button != null && e.button !== 0) return;
    e.preventDefault();
    const srcEl = e.currentTarget.closest('[data-i]');
    const ghost = h('div', { class: 'dnd-ghost' }, '⠿ ' + String(src.label).replace(/==|\*\*/g, '').slice(0, 60));
    const line = h('div', { class: 'dnd-line', hidden: true });
    document.body.append(ghost, line);
    document.body.classList.add('dnd-on');
    if (srcEl) srcEl.classList.add('dragging');
    let target = null, hot = null, y = e.clientY, raf = 0, alive = true;
    const listFor = (el) => { let g = el && el.closest('.grp[data-dnd]'); while (g && g.dataset.dnd !== src.pk) g = g.parentElement && g.parentElement.closest('.grp[data-dnd]'); return g; };
    const cardFor = (el) => { let c = el && el.closest('[data-i]'); while (c && !(c.__drops && c.__drops[src.pk])) c = c.parentElement && c.parentElement.closest('[data-i]'); return c; };
    const setHot = (c) => { if (hot === c) return; if (hot) hot.classList.remove('drop-into'); hot = c; if (hot) hot.classList.add('drop-into'); };
    const move = (ev) => {
      y = ev.clientY;
      ghost.style.left = ev.clientX + 'px'; ghost.style.top = ev.clientY + 'px';
      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      const L = listFor(el);
      if (L && L.__list) {
        setHot(null);
        const items = [...L.querySelectorAll(':scope > .gb > [data-i]')];
        let idx = items.length;
        for (let k = 0; k < items.length; k++) { const r = items[k].getBoundingClientRect(); if (ev.clientY < r.top + r.height / 2) { idx = k; break; } }
        const gb = L.querySelector(':scope > .gb').getBoundingClientRect();
        const ref = items[idx] ? items[idx].getBoundingClientRect().top - 5 : (items.length ? items[items.length - 1].getBoundingClientRect().bottom + 2 : gb.top + 4);
        line.hidden = false; line.style.left = gb.left + 'px'; line.style.width = gb.width + 'px'; line.style.top = ref + 'px';
        target = { list: L.__list, idx };
        return;
      }
      line.hidden = true;
      const c = cardFor(el);
      if (c && c.__drops[src.pk] !== src.arr) { setHot(c); target = { card: c }; return; }
      setHot(null); target = null;
    };
    const tick = () => { if (!alive) return; const edge = 70; if (y < edge) window.scrollBy(0, -Math.ceil((edge - y) / 5)); else if (y > innerHeight - edge) window.scrollBy(0, Math.ceil((y - innerHeight + edge) / 5)); raf = requestAnimationFrame(tick); };
    const end = (drop) => {
      alive = false; cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', cancel); window.removeEventListener('keydown', key);
      ghost.remove(); line.remove(); setHot(null); document.body.classList.remove('dnd-on'); if (srcEl) srcEl.classList.remove('dragging');
      if (!drop || !target) return;
      const item = src.arr[src.i];
      if (target.list) {
        const dst = target.list.arr; let idx = target.idx;
        if (dst === src.arr) { if (idx === src.i || idx === src.i + 1) return; src.arr.splice(src.i, 1); if (idx > src.i) idx--; dst.splice(idx, 0, item); src.redraw(idx); }
        else { src.arr.splice(src.i, 1); dst.splice(idx, 0, item); src.redraw(); target.list.redraw(idx); toast('Moved.', 1500); }
      } else if (target.card) {
        src.arr.splice(src.i, 1); target.card.__drops[src.pk].push(item); src.redraw(); target.card.__redraw();
        toast('Moved to “' + target.card.__name + '”.', 2200);
      }
      setDirty(true);
    };
    const up = () => end(true), cancel = () => end(false), key = (ev) => { if (ev.key === 'Escape') end(false); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', cancel); window.addEventListener('keydown', key);
    move(e); raf = requestAnimationFrame(tick);
  }
  function guessObjects(path) { const k = pathKey(path); return /(nav|panels|items|bigStats|smallStats|categories|projects|steps|papers|buttons|logos)$/.test(k) && !/toolbox\.steps$/.test(k); }
  function templateFor(path) {
    const k = pathKey(path);
    if (/projects\.categories\.\*\.projects$/.test(k)) return { title: '', client: '', desc: '', tech: [], role: [], video: '', image: '', imageSource: '' };
    if (/categories$/.test(k)) return { name: '', label: '', device: 'web', projects: [] };
    if (/process\.steps$/.test(k)) return { title: '', line: '' };
    if (/papers$/.test(k)) return { venue: '', place: '', title: '', authors: '', line: '', url: '', publisher: 'ACM', year: new Date().getFullYear() };
    if (/nav$/.test(k)) return { label: '', href: '#' };
    if (/buttons$/.test(k)) return { label: '', href: '', style: 'outline', icon: '→' };
    if (/logos$/.test(k)) return { name: '', logo: '' };
    return { title: '' };
  }

  // ---------- media helpers ----------
  function ytId(u) { const m = String(u || '').match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/|v\/))([\w-]{11})/); return m ? m[1] : ''; }
  const isVideoFile = (u) => /\.(mp4|webm|mov|m4v|ogv)(\?|#|$)/i.test(String(u || ''));
  function srcFor(p) {
    if (!p) return '';
    if (previews[p]) return previews[p];
    if (/^(https?:|blob:|data:)/.test(p)) return p;
    if (!offline && cfg.owner && cfg.repo) return `https://raw.githubusercontent.com/${cfg.owner}/${cfg.repo}/${cfg.branch || 'main'}/${p}`;
    return '../' + p;
  }
  const slug = (n) => String(n).toLowerCase().replace(/\.[a-z0-9]+$/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'file';
  const blobToB64 = (b) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(b); });
  async function uploadBlob(blob, baseName, ext) {
    if (offline) throw new Error('uploading needs GitHub login (offline mode can’t upload)');
    if (blob.size > 25 * 1024 * 1024) throw new Error('file is over 25 MB, please compress it first');
    const name = 'assets/uploads/' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5) + '-' + slug(baseName) + '.' + ext;
    await putFile(name, await blobToB64(blob), 'Upload ' + baseName + ' via admin');
    previews[name] = URL.createObjectURL(blob);
    return name;
  }
  const extOf = (f) => ((f.name.match(/\.([a-z0-9]+)$/i) || [])[1] || 'bin').toLowerCase();
  function loadImg(src) {
    return new Promise((res, rej) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = () => rej(new Error('could not load that picture')); i.src = src; });
  }
  const canvasBlob = (c, type, q) => new Promise((res) => c.toBlob(res, type, q));

  // Grab a frame (about 1 s in) from a local video file
  function videoFrame(file) {
    return new Promise((res, rej) => {
      const v = document.createElement('video');
      v.muted = true; v.playsInline = true; v.preload = 'auto';
      v.src = URL.createObjectURL(file);
      v.onloadeddata = () => { v.currentTime = Math.min(1, (v.duration || 2) / 3); };
      v.onseeked = async () => {
        const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight;
        c.getContext('2d').drawImage(v, 0, 0);
        const b = await canvasBlob(c, 'image/jpeg', 0.9);
        b ? res(URL.createObjectURL(b)) : rej(new Error('could not read a frame'));
      };
      v.onerror = () => rej(new Error('this browser can’t read that video format'));
    });
  }

  // Trim empty margins (transparent, or the background colour) so every logo lines up the same way
  async function trimLogo(file) {
    if (/svg/.test(file.type) || /\.svg$/i.test(file.name)) return { blob: file, ext: 'svg' };
    const url = URL.createObjectURL(file);
    const img = await loadImg(url);
    const k = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
    const W = Math.round(img.naturalWidth * k), H = Math.round(img.naturalHeight * k);
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0, W, H);
    const d = x.getImageData(0, 0, W, H).data;
    const px = (i) => [d[i], d[i + 1], d[i + 2], d[i + 3]];
    const corners = [0, (W - 1) * 4, (H - 1) * W * 4, ((H - 1) * W + W - 1) * 4].map(px);
    const transparentBg = corners.some((p) => p[3] < 20);
    const bg = corners[0];
    const isBg = transparentBg
      ? (i) => d[i + 3] < 20
      : (i) => Math.abs(d[i] - bg[0]) + Math.abs(d[i + 1] - bg[1]) + Math.abs(d[i + 2] - bg[2]) < 40;
    let x0 = W, y0 = H, x1 = -1, y1 = -1;
    for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++) {
      if (!isBg((y * W + xx) * 4)) { if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    if (x1 < 0) return { blob: file, ext: extOf(file) };
    const pad = 2;
    x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(W - 1, x1 + pad); y1 = Math.min(H - 1, y1 + pad);
    const cw = x1 - x0 + 1, ch = y1 - y0 + 1;
    const s = Math.min(1, 720 / cw, 360 / ch); // plenty for a crisp logo, small file
    const o = document.createElement('canvas'); o.width = Math.round(cw * s); o.height = Math.round(ch * s);
    const ox = o.getContext('2d'); ox.imageSmoothingQuality = 'high';
    ox.drawImage(c, x0, y0, cw, ch, 0, 0, o.width, o.height);
    return { blob: await canvasBlob(o, 'image/png'), ext: 'png' };
  }

  // Crop dialog: drag to move, slider / wheel / pinch to zoom. Returns a JPEG blob or null if cancelled.
  async function cropImage(src, opts) {
    const o = Object.assign({ aspect: 16 / 9, outW: 1600, band: 1 / 2.49 * 16 / 9 }, opts || {});
    toast('Opening picture…', 1500);
    const img = await loadImg(src);
    return new Promise((resolve) => {
      const zoom = h('input', { type: 'range', min: '1', max: '4', step: '0.01', value: '1', 'aria-label': 'Zoom' });
      const pic = h('img', { class: 'cm-img', src: img.src, alt: '', draggable: 'false' });
      const bandTop = (1 - o.band) / 2 * 100;
      const stage = h('div', { class: 'cm-stage', style: `aspect-ratio:${o.aspect}` }, pic,
        h('div', { class: 'cm-band', style: `top:${bandTop}%;bottom:${bandTop}%` }, h('span', {}, 'Computer screens show this band')),
        h('div', { class: 'cm-grid' }));
      const done = (v) => { document.removeEventListener('keydown', onKey); ov.remove(); resolve(v); };
      const onKey = (e) => { if (e.key === 'Escape') done(null); };
      const ov = h('div', { class: 'cm', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Crop picture' },
        h('div', { class: 'cm-box' },
          h('h3', {}, 'Choose what shows on the card'),
          h('p', { class: 'tip' }, 'Drag the picture to move it. Use the slider (or scroll / pinch) to zoom. Phones show the whole frame; computers show the area between the dashed lines.'),
          stage,
          h('div', { class: 'cm-z' }, h('span', {}, '−'), zoom, h('span', {}, '+')),
          h('div', { class: 'cm-a' },
            h('button', { class: 'btn ghost', type: 'button', onclick: () => done(null) }, 'Cancel'),
            h('button', { class: 'btn y', type: 'button', onclick: async () => {
              const W = stage.clientWidth, H = stage.clientHeight, sc = base * st.s;
              const outH = Math.round(o.outW / o.aspect);
              const c = document.createElement('canvas'); c.width = o.outW; c.height = outH;
              const x = c.getContext('2d'); x.fillStyle = '#FFFFFF'; x.fillRect(0, 0, o.outW, outH); x.imageSmoothingQuality = 'high';
              x.drawImage(img, -st.x / sc, -st.y / sc, W / sc, H / sc, 0, 0, o.outW, outH);
              done(await canvasBlob(c, 'image/jpeg', 0.88));
            } }, 'Use this crop'))));
      document.body.appendChild(ov);
      document.addEventListener('keydown', onKey);
      const st = { s: 1, x: 0, y: 0 };
      let base = 1;
      const clamp = () => {
        const W = stage.clientWidth, H = stage.clientHeight, dw = img.naturalWidth * base * st.s, dh = img.naturalHeight * base * st.s;
        st.x = Math.min(0, Math.max(W - dw, st.x)); st.y = Math.min(0, Math.max(H - dh, st.y));
        pic.style.width = dw + 'px'; pic.style.height = dh + 'px';
        pic.style.transform = `translate(${st.x}px,${st.y}px)`;
      };
      const setZoom = (s, cx, cy) => {
        const W = stage.clientWidth, H = stage.clientHeight;
        cx = cx == null ? W / 2 : cx; cy = cy == null ? H / 2 : cy;
        const ns = Math.min(4, Math.max(1, s)), r = ns / st.s;
        st.x = cx - (cx - st.x) * r; st.y = cy - (cy - st.y) * r; st.s = ns; zoom.value = ns; clamp();
      };
      const init = () => {
        const W = stage.clientWidth, H = stage.clientHeight;
        base = Math.max(W / img.naturalWidth, H / img.naturalHeight);
        st.x = (W - img.naturalWidth * base * st.s) / 2; st.y = (H - img.naturalHeight * base * st.s) / 2; clamp();
      };
      requestAnimationFrame(init);
      zoom.addEventListener('input', () => setZoom(Number(zoom.value)));
      stage.addEventListener('wheel', (e) => { e.preventDefault(); const r = stage.getBoundingClientRect(); setZoom(st.s * (e.deltaY < 0 ? 1.08 : 1 / 1.08), e.clientX - r.left, e.clientY - r.top); }, { passive: false });
      const pts = new Map(); let last = null, pinch = null;
      stage.addEventListener('pointerdown', (e) => { stage.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); last = [e.clientX, e.clientY]; });
      stage.addEventListener('pointermove', (e) => {
        if (!pts.has(e.pointerId)) return;
        pts.set(e.pointerId, [e.clientX, e.clientY]);
        if (pts.size === 2) {
          const [a, b] = [...pts.values()], dist = Math.hypot(a[0] - b[0], a[1] - b[1]);
          if (pinch) { const r = stage.getBoundingClientRect(); setZoom(st.s * dist / pinch, (a[0] + b[0]) / 2 - r.left, (a[1] + b[1]) / 2 - r.top); }
          pinch = dist; return;
        }
        st.x += e.clientX - last[0]; st.y += e.clientY - last[1]; last = [e.clientX, e.clientY]; clamp();
      });
      const up = (e) => { pts.delete(e.pointerId); pinch = null; const p = [...pts.values()][0]; if (p) last = p; };
      stage.addEventListener('pointerup', up); stage.addEventListener('pointercancel', up);
    });
  }

  // ---------- file fields ----------
  function fileField(val, set, pk, owner, key) {
    const isProj = /^projects\.categories\.\*\.projects\.\*\./.test(pk);
    const kind = isProj && key === 'image' ? 'crop' : isProj && key === 'video' ? 'video' : key === 'logo' ? 'logo' : 'plain';
    const inp = h('input', { class: 'in', value: val || '', placeholder: kind === 'video' ? 'https://youtu.be/… or upload a file' : 'assets/…', oninput: (e) => { set(e.target.value); setDirty(true); upd(); } });
    const prev = h('div', { class: 'prev' });
    const setVal = (v) => { inp.value = v; set(v); setDirty(true); upd(); };
    const reg = refreshers.get(owner) || {}; reg[key] = () => { inp.value = owner[key] || ''; upd(); }; if (owner) refreshers.set(owner, reg);
    const refresh = (k) => { const r = owner && refreshers.get(owner); if (r && r[k]) r[k](); };

    // Crop a source picture, upload the result into the project's image (keeping the original for re-cropping)
    const cropInto = async (src, keepSource) => {
      try {
        const blob = await cropImage(src);
        if (!blob) return;
        toast('Uploading picture…', 60000);
        const p = await uploadBlob(blob, (owner && owner.title) || 'project', 'jpg');
        if (owner) { owner.image = p; owner.imageSource = keepSource || ''; }
        setDirty(true);
        if (kind === 'crop') setVal(p); else refresh('image');
        toast('Picture ready. Click “Save & publish” to put it on the site.', 4500);
      } catch (err) { toast('Could not use that picture: ' + err.message, 6000); }
    };

    const upd = () => {
      const v = inp.value;
      const kids = [];
      if (kind === 'video') {
        const id = ytId(v);
        if (id) {
          const yt = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
          kids.push(h('img', { class: 'thumb wide', src: yt, alt: '' }),
            h('div', { class: 'pv' }, owner && owner.image ? 'The card uses your own Image (below) instead of this thumbnail.' : 'The card shows this YouTube thumbnail.',
              h('button', { class: 'btn sm', type: 'button', onclick: async () => { const mx = `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`; let best = yt; try { if ((await loadImg(mx)).naturalWidth > 120) best = mx; } catch (e) {} cropInto(best, best); } }, 'Crop thumbnail…')));
        } else if (isVideoFile(v)) {
          kids.push(h('video', { class: 'thumb wide', src: srcFor(v) + '#t=1', muted: true, playsinline: true, preload: 'metadata' }),
            h('div', { class: 'pv' }, owner && owner.image ? 'The card uses your own Image (below).' : 'The card shows a frame from this video.'));
        } else if (v) kids.push(h('div', { class: 'pv' }, 'No thumbnail for this kind of link. Upload an Image below.'));
      } else if (v && (IMG_RE.test(v) || /^https?:/.test(v))) {
        kids.push(h('img', { class: 'thumb' + (kind === 'crop' ? ' wide' : '') + (kind === 'logo' ? ' logo' : ''), src: srcFor(v), alt: '', onerror: (e) => { if (!/^\.\.\//.test(e.target.getAttribute('src'))) e.target.src = '../' + v; } }));
        if (kind === 'crop') kids.push(h('div', { class: 'pv' },
          h('button', { class: 'btn sm', type: 'button', onclick: () => cropInto(srcFor((owner && owner.imageSource) || v), (owner && owner.imageSource) || v) }, 'Re-crop…'),
          h('button', { class: 'btn sm ghost', type: 'button', onclick: () => { if (owner) owner.imageSource = ''; setVal(''); refresh('video'); } }, 'Remove picture')));
      }
      prev.replaceChildren(...kids);
    };
    upd();

    const accept = kind === 'crop' ? 'image/*' : kind === 'logo' ? 'image/png,image/webp,image/svg+xml,image/jpeg' : kind === 'video' ? 'video/*' : null;
    const pick = h('input', { type: 'file', hidden: true, accept, onchange: async (e) => {
      const f = e.target.files[0]; e.target.value = ''; if (!f) return;
      if (offline) { toast('Uploading needs GitHub login. In offline mode, put the file in /assets and type its path.', 5000); return; }
      try {
        if (kind === 'crop') {
          toast('Uploading original…', 60000);
          const orig = await uploadBlob(f, f.name, extOf(f));
          await cropInto(previews[orig], orig);
          return;
        }
        if (kind === 'logo') {
          toast('Trimming and uploading ' + f.name + '…', 60000);
          const t = await trimLogo(f);
          setVal(await uploadBlob(t.blob, f.name, t.ext));
          toast('Logo uploaded. Click “Save & publish” to use it.', 4000);
          return;
        }
        toast('Uploading ' + f.name + '…', 120000);
        const p = await uploadBlob(f, f.name, extOf(f));
        setVal(p);
        if (kind === 'video' && owner && !owner.image) {
          toast('Uploaded. Now choose the card picture from the video…', 3000);
          try { await cropInto(await videoFrame(f), ''); } catch (err) { toast('Video uploaded. (Could not make a thumbnail: ' + err.message + ')', 6000); }
          return;
        }
        toast('Uploaded. Click “Save & publish” to use it.', 4000);
      } catch (err) { toast('Upload failed: ' + err.message, 6000); }
    } });
    const label = kind === 'crop' ? 'Upload & crop…' : kind === 'video' ? 'Upload video…' : kind === 'logo' ? 'Upload logo…' : 'Upload…';
    return h('div', { class: 'filewrap' }, h('div', { class: 'file' }, inp, h('button', { class: 'btn sm', type: 'button', onclick: () => pick.click() }, label), pick), prev);
  }

  // Several logos at once: each file becomes a client (or fills the matching name that has no logo yet)
  function bulkLogos(arr, redraw) {
    const pick = h('input', { type: 'file', hidden: true, multiple: true, accept: 'image/png,image/webp,image/svg+xml,image/jpeg', onchange: async (e) => {
      const files = [...e.target.files]; e.target.value = ''; if (!files.length) return;
      if (offline) { toast('Uploading needs GitHub login.', 4000); return; }
      let n = 0;
      for (const f of files) {
        toast(`Uploading logo ${++n} of ${files.length}…`, 60000);
        try {
          const t = await trimLogo(f);
          const p = await uploadBlob(t.blob, f.name, t.ext);
          const name = f.name.replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ').replace(/\s*logo\s*/i, ' ').trim();
          const match = arr.find((c) => c && !c.logo && String(c.name).toLowerCase() === name.toLowerCase());
          if (match) match.logo = p; else arr.push({ name, logo: p });
        } catch (err) { toast(f.name + ' failed: ' + err.message, 5000); await new Promise((r) => setTimeout(r, 1500)); }
      }
      redraw();
      toast('Logos uploaded. Check the names, then click “Save & publish”.', 5000);
    } });
    return h('span', {}, pick, h('button', { class: 'btn sm y', type: 'button', onclick: () => pick.click() }, 'Upload logos…'));
  }

  // ---------- save / backup ----------
  async function saveAll() {
    if (offline) return download('content.json');
    const btn = document.getElementById('savebtn');
    btn.disabled = true; btn.textContent = 'Saving…';
    try {
      const json = JSON.stringify(data, null, 2) + '\n';
      try { const latest = await getFile(CONTENT_PATH); sha = latest.sha; } catch (e) {}
      const r = await putFile(CONTENT_PATH, b64enc(json), 'Update site content via admin', sha);
      sha = r.content.sha;
      setDirty(false);
      toast('Saved! Your site will update in about a minute.', 4500);
    } catch (e) { toast('Save failed: ' + e.message, 7000); }
    btn.disabled = false; btn.textContent = 'Save & publish';
  }
  function download(name) {
    const blob = new Blob([JSON.stringify(data, null, 2) + '\n'], { type: 'application/json' });
    const a = h('a', { href: URL.createObjectURL(blob), download: typeof name === 'string' ? name : 'content-backup-' + new Date().toISOString().slice(0, 10) + '.json' });
    document.body.appendChild(a); a.click(); a.remove();
    if (offline && name === 'content.json') { setDirty(false); toast('Downloaded. Replace content/content.json in your project with it.', 5000); }
  }
  function importJson(e) {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => { try { const j = JSON.parse(r.result); if (!j.site || !j.hero) throw new Error('not a content file'); data = j; setDirty(true); editor(); toast('Imported. Review, then save.'); } catch (err) { toast('That file is not a valid content.json', 4000); } };
    r.readAsText(f);
  }

  // ---------- start ----------
  if (cfg.token && cfg.owner && cfg.repo) open(); else loginScreen();
})();
