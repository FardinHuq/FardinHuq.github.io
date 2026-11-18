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
    ['clients', 'Clients', 'Three scrolling rows of client names.'],
    ['projects', 'Projects', 'Scoreboard numbers and every project card, grouped by category. Add a screenshot in “image” to replace the striped placeholder.'],
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
    'site.whatsapp': 'Country code + number, digits only.',
    'hero.highlight': 'A new line here becomes a line break.',
    'hero.bubble': 'A new line here becomes a line break in the bubble.',
    'projects.categories.*.projects.*.video': 'YouTube or any video link. Leave empty to hide the “Watch video” button.',
    'projects.categories.*.projects.*.image': 'Optional screenshot (landscape works best).',
    'publications.papers.*.url': 'Link to the paper (DOI link is best).',
  };
  const FILE_KEY = /^(image|portrait|poster|video|cv|ogImage)$/;
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
  function renderValue(val, path, parent, set) {
    const key = path[path.length - 1];
    const pk = pathKey(path);
    if (Array.isArray(val)) return renderArray(val, path, parent);
    if (val && typeof val === 'object') {
      const box = path.length === 1 ? parent : h('div', { class: 'grp' }, h('div', { class: 'gh' }, h('b', {}, human(key))), h('div', { class: 'gb' }));
      const body = path.length === 1 ? parent : box.lastChild;
      Object.keys(val).forEach((k) => renderValue(val[k], path.concat(k), body, (v) => { val[k] = v; }));
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
      input = fileField(val, set);
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

  function renderArray(arr, path, parent) {
    const key = path[path.length - 1];
    const grp = h('div', { class: 'grp' });
    const rerender = () => { setDirty(true); editor(); };
    const objects = arr.length ? arr.every((x) => x && typeof x === 'object' && !Array.isArray(x)) : guessObjects(path);
    const add = () => {
      if (objects) arr.push(blank(arr[0] || templateFor(path)));
      else if (arr.length && Array.isArray(arr[0])) arr.push([]);
      else arr.push('');
      rerender();
    };
    grp.appendChild(h('div', { class: 'gh' }, h('b', {}, typeof key === 'number' ? 'Row ' + (key + 1) : human(key)), h('span', { class: 'tip', style: 'margin:0' }, arr.length + ' item' + (arr.length === 1 ? '' : 's')), h('span', { class: 'sp' }, h('button', { class: 'btn sm', onclick: add }, '+ Add'))));
    const body = h('div', { class: 'gb lst' });
    arr.forEach((it, i) => {
      const tools = [
        h('button', { class: 'ico', title: 'Move up', 'aria-label': 'Move up', onclick: () => { if (i > 0) { [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]; rerender(); } } }, '↑'),
        h('button', { class: 'ico', title: 'Move down', 'aria-label': 'Move down', onclick: () => { if (i < arr.length - 1) { [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]]; rerender(); } } }, '↓'),
        h('button', { class: 'ico del', title: 'Remove', 'aria-label': 'Remove', onclick: () => { if (confirm('Remove this item?')) { arr.splice(i, 1); rerender(); } } }, '✕'),
      ];
      if (it && typeof it === 'object' && !Array.isArray(it)) {
        const card = h('div', { class: 'grp collapsed' });
        const head = h('div', { class: 'gh' }, h('button', { class: 'ico', 'aria-label': 'Expand', onclick: () => card.classList.toggle('collapsed') }, '▸'), h('b', { style: 'cursor:pointer', onclick: () => card.classList.toggle('collapsed') }, itemTitle(it, i)), h('span', { class: 'sp' }, tools));
        const cb = h('div', { class: 'gb' });
        Object.keys(it).forEach((k) => renderValue(it[k], path.concat(i, k), cb, (v) => { it[k] = v; }));
        card.append(head, cb);
        body.appendChild(card);
      } else if (Array.isArray(it)) {
        const wrap = h('div', {});
        renderArray(it, path.concat(i), wrap);
        wrap.firstChild.querySelector('.sp').append(...tools);
        body.appendChild(wrap);
      } else {
        const long = String(it).length > 70;
        const inp = long ? h('textarea', { class: 'in', rows: 2, oninput: (e) => { arr[i] = e.target.value; setDirty(true); } }, String(it))
          : h('input', { class: 'in', value: String(it), oninput: (e) => { arr[i] = e.target.value; setDirty(true); } });
        body.appendChild(h('div', { class: 'li' }, inp, tools));
      }
    });
    grp.appendChild(body);
    parent.appendChild(grp);
  }
  function guessObjects(path) { const k = pathKey(path); return /(nav|panels|items|bigStats|smallStats|categories|projects|steps|papers|buttons)$/.test(k) && !/toolbox\.steps$/.test(k); }
  function templateFor(path) {
    const k = pathKey(path);
    if (/projects\.categories\.\*\.projects$/.test(k)) return { title: '', client: '', desc: '', tech: [], role: [], video: '', image: '' };
    if (/categories$/.test(k)) return { name: '', label: '', device: 'web', projects: [] };
    if (/process\.steps$/.test(k)) return { title: '', line: '' };
    if (/papers$/.test(k)) return { venue: '', place: '', title: '', authors: '', line: '', url: '', publisher: 'ACM', year: new Date().getFullYear() };
    if (/nav$/.test(k)) return { label: '', href: '#' };
    if (/buttons$/.test(k)) return { label: '', href: '', style: 'outline', icon: '→' };
    return { title: '' };
  }

  function fileField(val, set) {
    const inp = h('input', { class: 'in', value: val || '', placeholder: 'assets/…', oninput: (e) => { set(e.target.value); setDirty(true); upd(); } });
    const prev = h('span', {});
    const upd = () => {
      const v = inp.value;
      prev.replaceChildren(/\.(png|jpe?g|webp|gif|svg|avif)$/i.test(v) ? h('img', { class: 'thumb', src: /^https?:/.test(v) ? v : '../' + v, alt: '' }) : '');
    };
    upd();
    const pick = h('input', { type: 'file', hidden: true, onchange: async (e) => {
      const f = e.target.files[0]; if (!f) return;
      if (offline) { toast('Uploading needs GitHub login. In offline mode, put the file in /assets and type its path.', 5000); return; }
      if (f.size > 25 * 1024 * 1024) { toast('That file is over 25 MB. Please compress it first.', 5000); return; }
      const name = 'assets/uploads/' + Date.now().toString(36) + '-' + f.name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-');
      toast('Uploading ' + f.name + '…', 60000);
      try {
        const b64 = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(f); });
        await putFile(name, b64, 'Upload ' + f.name + ' via admin');
        inp.value = name; set(name); setDirty(true); upd();
        toast('Uploaded. Click “Save & publish” to use it.', 4000);
      } catch (err) { toast('Upload failed: ' + err.message, 6000); }
    } });
    return h('div', { class: 'file' }, inp, h('button', { class: 'btn sm', type: 'button', onclick: () => pick.click() }, 'Upload…'), pick, prev);
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
