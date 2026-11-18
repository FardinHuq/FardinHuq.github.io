// Builds the static site from content/content.json.
// Usage: node build.mjs   -> builds the whole site into ./dist (open dist/index.html or serve that folder)
//        OUT=_site node build.mjs  -> same, into another folder
import { readFileSync, writeFileSync, mkdirSync, cpSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const OUT = join(ROOT, process.env.OUT || 'dist');
const C = JSON.parse(readFileSync(join(ROOT, 'content/content.json'), 'utf8'));
const P = JSON.parse(readFileSync(join(ROOT, 'src/partials.json'), 'utf8'));

// ---------- helpers ----------
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// Tiny markup: ==marker==  **bold**  *italic*  and new lines -> <br>
const md = (s, boldTag = 'strong') => esc(s)
  .replace(/==(.+?)==/g, '<span class="hl">$1</span>')
  .replace(/\*\*(.+?)\*\*/g, `<${boldTag}>$1</${boldTag}>`)
  .replace(/\*(.+?)\*/g, '<em>$1</em>')
  .replace(/\n/g, '<br>');
const plain = (s) => String(s ?? '').replace(/==|\*\*|\*/g, '').replace(/\n/g, ' ');
// YouTube id from watch / youtu.be / shorts / embed / live links
const ytId = (u) => { const m = String(u || '').match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/|v\/))([\w-]{11})/); return m ? m[1] : ''; };
const isVideoFile = (u) => /\.(mp4|webm|mov|m4v|ogv)(\?|#|$)/i.test(String(u || ''));
// Card picture: uploaded image first, else the YouTube thumbnail, else a frame of an uploaded video file
function projectThumb(p) {
  const alt = esc(p.title) + ' preview';
  if (p.image) return `<img class="pj-img" src="${esc(p.image)}" alt="${alt}" loading="lazy">`;
  const id = ytId(p.video);
  if (id) return `<img class="pj-img" src="https://i.ytimg.com/vi/${id}/maxresdefault.jpg" data-fallback="https://i.ytimg.com/vi/${id}/hqdefault.jpg" alt="${alt}" loading="lazy" referrerpolicy="no-referrer">`;
  if (isVideoFile(p.video)) return `<video class="pj-img" src="${esc(p.video)}#t=1" muted playsinline preload="metadata" aria-hidden="true"></video>`;
  return '';
}
const pad2 = (n) => (n < 10 ? '0' : '') + n;
const ext = (h) => /^https?:/.test(h);
const linkAttrs = (h) => (ext(h) ? ' target="_blank" rel="noopener"' : '');
const S = C.site;

// ---------- sections ----------
function nav() {
  const links = C.nav.map((n) => `<a class="nomi-navlink" href="${esc(n.href)}">${esc(n.label)}</a>`).join('\n      ');
  return `<nav class="nomi-nav" aria-label="Main">
      <a class="nav-brand" href="#top">${esc(S.name)}</a>
      <button type="button" class="nav-toggle" aria-expanded="false" aria-controls="nav-links"><span class="nav-burger" aria-hidden="true"></span>Menu</button>
      <div class="nav-links" id="nav-links">
      ${links}
      </div>
      <a class="nomi-navlink nomi-navcv" href="${esc(S.cv)}" download>Download CV</a>
    </nav>`;
}

function hero() {
  const H = C.hero;
  return `<header class="nomi-stage" id="top">
    <video class="nomi-video" src="${esc(H.video)}" poster="${esc(H.poster)}" autoplay muted loop playsinline preload="auto" aria-hidden="true"></video>
    <a class="nomi-logo" href="#top" aria-label="${esc(S.name)} — home">${P.logo}</a>
    ${nav()}
    <h1 class="nomi-h1">${esc(H.name)}<span class="nomi-role">${esc(H.role)}</span><span class="nomi-pron">${esc(H.pronouns)}</span></h1>
    <p class="nomi-copy">${md(H.highlight)}</p>
    <div class="nomi-ctas">
      <a href="${esc(S.cv)}" download class="nomi-btn nomi-cvglow">Download CV</a>
      <a class="nomi-btn nomi-cvglow" href="#contact">Contact ${P.ctaArrow}</a>
    </div>
    <div class="nomi-bubble" aria-hidden="true">
      <p class="nomi-bubble-p"><span class="nomi-typed">${esc(H.bubble)}</span><span class="nomi-caret-b"></span></p>
      ${P.bubbleTail}
    </div>
  </header>`;
}

function aboutPanel(p) {
  const body = (p.body || []).filter(Boolean).map((t) => `<p class="st-p">${md(t)}</p>`).join('');
  const bullets = (p.bullets || []).filter(Boolean).length
    ? `<ul class="st-ul">${p.bullets.filter(Boolean).map((b) => `<li><span aria-hidden="true" class="st-sq"></span><span>${md(b)}</span></li>`).join('')}</ul>` : '';
  const big = p.bigLine ? `<span class="st-big">${md(p.bigLine)}</span>` : '';
  const cta = p.cta && p.cta.label ? `<a class="st-cta" href="${esc(p.cta.href || '#contact')}"${linkAttrs(p.cta.href || '')}><span class="hl">${esc(p.cta.label)}</span></a>` : '';
  const st = p.style || 'intro';
  if (st === 'quote') return `<p class="st-quote"><span class="st-qh">${md(p.heading)}</span>${big}</p>${body}${bullets}${cta}`;
  if (st === 'cta') return `<div class="st-box st-w1000"><p class="st-ctaq">${md(p.heading)}</p>${body}${bullets}${big}${cta}</div>`;
  if (st === 'statement') return `<div class="st-box st-w1100"><h2 class="st-h st-h-statement">${md(p.heading)}</h2>${body}${bullets}${big}${cta}</div>`;
  return `<div class="st-box ${st === 'pitch' ? 'st-w920' : 'st-w900'}"><h2 class="st-h st-h-${st}">${md(p.heading)}</h2>${body}${bullets}${big}${cta}</div>`;
}

function about() {
  const A = C.about;
  return `<section id="about" class="nomi-story" aria-label="About ${esc(S.name)}">
    <div class="st-pin">
      ${A.panels.map((p) => `<div class="st-panel">${aboutPanel(p)}</div>`).join('\n      ')}
      <img class="st-portrait" src="${esc(A.portrait)}" alt="${esc(A.portraitAlt)}">
    </div>
  </section>`;
}

function experience() {
  const X = C.experience, T = X.toolbox;
  const items = X.items.map((it) => `<article class="xp-item">
          <div class="xp-badge${it.side ? ' is-side' : ''}"><span>${esc(it.badge)}</span></div>
          <div class="xp-card">
            <h3 class="xp-role">${esc(it.role)}</h3>
            <p class="xp-meta"><strong>${esc(it.company)}</strong> · ${esc(it.dates)}</p>
            ${it.tagline ? `<p class="xp-tag">${md(it.tagline)}</p>` : ''}
            <ul class="xp-list">${(it.bullets || []).filter(Boolean).map((b) => `<li>${md(b)}</li>`).join('')}</ul>
          </div>
        </article>`).join('\n        ');
  const keys = new Set(T.highlighted || []);
  const tags = T.tools.map((t) => `<span class="tg-tag${keys.has(t) ? ' is-key' : ''}" aria-hidden="true">${esc(t)}</span>`).join('');
  return `<section id="experience" class="xp" aria-labelledby="xp-title">
    <div class="xp-wrap">
      <p class="xp-eyebrow">${esc(X.eyebrow)}</p>
      <h2 id="xp-title" class="xp-h2">${md(X.heading)}</h2>
      <p class="xp-intro">${md(X.intro)}</p>
      <div class="xp-line">
        <div class="xp-fill" aria-hidden="true"></div>
        ${items}
      </div>
      <div class="xp-tools">
        <div class="tg-globe" role="img" aria-label="Tools I use: ${esc(T.tools.join(', '))}">${tags}</div>
        <div class="tg-copy">
          <p class="xp-eyebrow">${esc(T.eyebrow)}</p>
          <h3 class="tg-h">${md(T.heading)}</h3>
          <ol class="tg-steps">${T.steps.map((s, i) => `<li><span>${i + 1}</span>${md(s)}</li>`).join('')}</ol>
        </div>
      </div>
    </div>
  </section>`;
}

function clients() {
  const K = C.clients;
  const dirs = ['l2r', 'r2l', 'l2r slow'];
  // One list of clients (name + optional logo), dealt into 1–3 scrolling rows
  const list = (K.logos || []).filter((c) => c && (c.name || c.logo));
  const nRows = list.length >= 9 ? 3 : list.length >= 4 ? 2 : 1;
  const split = Array.from({ length: nRows }, (_, i) => list.filter((_, j) => j % nRows === i));
  const item = (c) => c.logo
    ? `<span class="cl-item is-logo"><img class="cl-logo" src="${esc(c.logo)}" alt="${esc(c.name)}" decoding="async"></span>`
    : `<span class="cl-item"><span class="cl-n">${esc(c.name)}</span></span>`;
  const rows = split.filter((r) => r.length).map((r, i) => {
    let base = r; while (base.length < 8) base = base.concat(r); // fill wide screens
    const twice = [].concat(base, base);
    return `<div class="cl-row ${dirs[i % 3]}">${twice.map(item).join('')}</div>`;
  }).join('\n      ');
  const names = K.fullList || list.map((c) => c.name).filter(Boolean).join(', ');
  return `<section id="clients" class="cl" aria-labelledby="cl-title">
    <div class="cl-head">
      <p class="xp-eyebrow">${esc(K.eyebrow)}</p>
      <h2 id="cl-title" class="cl-h">${md(K.heading)}</h2>
    </div>
    <p class="cl-sr">Clients include: ${esc(names)}</p>
    <div class="cl-rows" aria-hidden="true">
      ${rows}
    </div>
  </section>`;
}

function projects() {
  const J = C.projects;
  const total = J.categories.reduce((a, c) => a + c.projects.length, 0);
  let n = 0;
  const big = J.bigStats.map((s) => `<div class="sc-tile is-big"><span class="sc-num"><span class="sc-n" data-to="${s.value}" data-dec="${s.decimals || 0}">${Number(s.value).toFixed(s.decimals || 0)}</span><span class="sc-plus">+</span></span><p class="sc-line">${md(s.line)}</p><span class="sc-label">${esc(s.label)}</span></div>`).join('');
  const small = J.smallStats.map((s) => `<div class="sc-tile is-cat">${P.icons[s.icon] || P.icons.web}<span class="sc-num"><span class="sc-n" data-to="${s.value}" data-dec="0">${s.value}</span><span class="sc-plus">+</span></span><span class="sc-label">${esc(s.label)}</span></div>`).join('');
  // Each category shows its 3D model (loaded by main.js only when that category is on screen); the drawing stays as a fallback until the model is ready.
  const devs = J.categories.map((c, i) => {
    const svg = (P.devices[c.device] || P.devices.web).replace(/id="pjs(\d)"/g, `id="pjs$1c${i}"`).replace(/url\(#pjs(\d)\)/g, `url(#pjs$1c${i})`);
    const model = c.model ? `<model-viewer class="pj-model" data-src="${esc(c.model)}" alt="" aria-hidden="true" auto-rotate auto-rotate-delay="0" rotation-per-second="16deg" interaction-prompt="none" disable-zoom disable-pan disable-tap environment-image="neutral" exposure="1.05" shadow-intensity="0.9" shadow-softness="1"${c.modelView ? ` camera-orbit="${esc(c.modelView)}"` : ''}></model-viewer>` : '';
    const credit = c.model && c.modelCredit ? `<a class="pj-credit" href="${esc(c.modelCreditUrl || '#')}" target="_blank" rel="noopener" tabindex="-1">3D: ${esc(c.modelCredit)}</a>` : '';
    return `<div class="pj-dev${i === 0 ? ' is-on' : ''}${c.model ? ' has-model' : ''}" data-k="${i}"><div class="pj-svg">${svg}</div>${model}${credit}</div>`;
  }).join('\n          ');
  const credits = J.categories.filter((c) => c.model && c.modelCredit).map((c) => `<a href="${esc(c.modelCreditUrl || '#')}" target="_blank" rel="noopener">${esc(c.modelCredit)}</a>`).join(', ');
  const cards = J.categories.map((c, ci) => c.projects.map((p) => {
    n += 1;
    const img = projectThumb(p);
    return `<article class="pj-card" data-cat="${ci}" data-catname="${esc(c.name)}">
             <div class="pj-in">
              <div class="pj-thumb${img ? ' has-img' : ''}">
                ${img}
                <span class="pj-num" aria-hidden="true">${pad2(n)}</span>
                ${p.video ? `<a class="pj-play" href="${esc(p.video)}" target="_blank" rel="noopener"><i aria-hidden="true">▶</i>Watch video</a>` : ''}
              </div>
              <div class="pj-body">
                <h3 class="pj-title">${esc(p.title)}</h3>
                <p class="pj-client">${esc(p.client)}</p>
                <p class="pj-desc">${md(p.desc)}</p>
                <div class="pj-chips">${(p.tech || []).filter(Boolean).map((t) => `<span class="pj-chip">${esc(t)}</span>`).join('')}</div>
                <p class="pj-role-label">My role</p>
                <div class="pj-chips">${(p.role || []).filter(Boolean).map((r) => `<span class="pj-chip is-role">${esc(r)}</span>`).join('')}</div>
              </div>
             </div>
            </article>`;
  }).join('\n')).join('\n');
  return `<section id="projects" class="pj" aria-labelledby="pj-title" data-total="${total}">
    <div class="pj-track">
      <div class="pj-pin">
        <div class="pj-head">
          <p class="xp-eyebrow">${esc(J.eyebrow)}</p>
          <h2 id="pj-title" class="pj-h">${md(J.heading)}</h2>
        </div>
        <div class="pj-score" role="group" aria-label="Career in numbers">${big}${small}</div>
        <div class="pj-stage-side" aria-hidden="true">
          <div class="pj-st is-top"></div>
          <div class="pj-st is-bot"></div>
          <div class="pj-catbig">${esc(J.categories[0] ? J.categories[0].name : '')}</div>
          <div class="pj-devs">
          ${devs}
          </div>
        </div>
        <div class="pj-cards">
${cards}
        </div>
        ${credits ? `<p class="cl-sr">${esc(J.modelCreditsLabel || '3D models')}: ${credits}</p>` : ''}
      </div>
    </div>
  </section>`;
}

function processSec() {
  const R = C.process;
  const N = R.steps.length;
  const xs = R.steps.map((_, i) => (N === 1 ? 600 : 90 + i * (1020 / (N - 1))));
  const ys = R.steps.map((_, i) => (i % 2 === 0 ? 430 : 210));
  let d = `M${xs[0].toFixed(1)} ${ys[0]}`;
  for (let i = 0; i < N - 1; i++) { const m = ((xs[i] + xs[i + 1]) / 2).toFixed(1); d += ` C${m} ${ys[i]} ${m} ${ys[i + 1]} ${xs[i + 1].toFixed(1)} ${ys[i + 1]}`; }
  const lis = R.steps.map((s, i) => {
    const cls = ['pr-step', 'is-on', ys[i] === 430 ? 'is-bot' : 'is-top'];
    if (i === 0) cls.push('is-first');
    if (i === N - 1) cls.push('is-last', 'is-cur');
    const node = i === N - 1 ? `${P.flag}<span class="sr-only">${i + 1}</span>` : String(i + 1);
    return `<li class="${cls.join(' ')}" data-x="${xs[i].toFixed(1)}" data-y="${ys[i]}" style="left: ${(xs[i] / 12).toFixed(4)}%; top: ${(ys[i] / 6.2).toFixed(4)}%"><span class="pr-node">${node}</span><span class="pr-bub"><b class="pr-bt"><small>LV ${i + 1}</small>${esc(s.title)}</b><span class="pr-bd">${md(s.line)}</span></span></li>`;
  }).join('\n              ');
  return `<section id="process" class="pr" aria-labelledby="pr-title">
    <div class="pr-track">
      <div class="pr-pin">
        <div class="deco-sun" aria-hidden="true" style="left: -7cqw; top: -6%; width: 26cqw"></div>
        <div class="deco-bb is-flip" aria-hidden="true" style="right: -1cqw; bottom: -3%; height: 42%"></div>
        <div class="pr-head">
          <p class="xp-eyebrow">${esc(R.eyebrow)}</p>
          <h2 id="pr-title" class="pr-h">${md(R.heading)}</h2>
          <p class="pr-hint">${esc(R.hint)} <i aria-hidden="true">↓</i></p>
        </div>
        <div class="pr-stage">
          <div class="pr-map">
            <svg viewBox="0 0 1200 620" aria-hidden="true"><path class="pr-trail" d="${d}"></path><path class="pr-done" d="${d}"></path></svg>
            <ol class="pr-steps">
              ${lis}
            </ol>
            <div class="pr-stamp is-on" aria-hidden="true">${esc(R.stamp)}<small>${esc(R.stampSub)}</small></div>
            <div class="pr-panda" aria-hidden="true"><img src="assets/panda-token.webp" alt=""></div>
          </div>
        </div>
      </div>
    </div>
  </section>`;
}

function publications() {
  const B = C.publications;
  const tilt = ['is-a', 'is-b', 'is-c'];
  const sheets = B.papers.map((p, i) => `<li class="pb-sheet ${tilt[i % 3]}">
              <article class="pb-paper">
                <div class="pb-top"><div><span class="pb-venue">${esc(p.venue)}</span><span class="pb-place">${esc(p.place)}</span></div><span class="pb-num" aria-hidden="true">${pad2(i + 1)}</span></div>
                <h3 class="pb-title">${esc(p.title)}</h3>
                <p class="pb-auth">${md(p.authors, 'b')}</p>
                <p class="pb-line">${md(p.line)}</p>
                <div class="pb-foot"><span class="pb-acm">${esc(p.publisher || 'ACM')}</span><a class="pb-read nomi-btn" href="${esc(p.url)}" target="_blank" rel="noopener">Read paper <i aria-hidden="true">→</i></a></div>
              </article>
            </li>`).join('\n');
  return `<section id="publications" class="pb" aria-labelledby="pb-title">
    <div class="pb-track">
      <div class="pb-pin">
        <div class="deco-sun" aria-hidden="true" style="left: -6cqw; top: 3%; width: 24cqw"></div>
        <div class="deco-bb" aria-hidden="true" style="left: -2.5cqw; bottom: -4%; height: 72%"></div>
        <div class="deco-bb is-flip" aria-hidden="true" style="right: -2.5cqw; bottom: -4%; height: 56%"></div>
        <div class="pb-head">
          <p class="xp-eyebrow">${esc(B.eyebrow)}</p>
          <h2 id="pb-title" class="pb-h">${md(B.heading)}</h2>
          <p class="pb-sub">${md(B.sub)}</p>
        </div>
        <div class="pb-stage">
          <ol class="pb-deck">
${sheets}
          </ol>
        </div>
      </div>
    </div>
  </section>`;
}

function contact() {
  const K = C.contact;
  const btns = K.buttons.map((b) => `<a class="ct-btn ${b.style === 'yellow' ? 'is-cv' : 'nomi-btn'}" href="${esc(b.href)}"${linkAttrs(b.href)}>${esc(b.label)} <i aria-hidden="true">${esc(b.icon || '→')}</i></a>`).join('\n      ');
  // "Email me" opens this menu (main.js) because a plain mailto: link does nothing on computers without a mail app set up
  const EM = K.emailMenu || {};
  const to = encodeURIComponent(S.email || '');
  const mailMenu = `<div class="ct-mailmenu" role="menu" hidden>
        <a role="menuitem" href="https://mail.google.com/mail/?view=cm&amp;fs=1&amp;to=${to}" target="_blank" rel="noopener">${esc(EM.gmail || 'Gmail')}</a>
        <a role="menuitem" href="https://outlook.live.com/mail/0/deeplink/compose?to=${to}" target="_blank" rel="noopener">${esc(EM.outlook || 'Outlook')}</a>
        <a role="menuitem" href="mailto:${esc(S.email)}" data-mailto>${esc(EM.app || 'Mail app')}</a>
        <button role="menuitem" type="button" data-copy="${esc(S.email)}" data-done="${esc(EM.copied || 'Copied!')}">${esc(EM.copy || 'Copy email address')}</button>
      </div>`;
  const meta = K.meta.map((m, i) => `<span>${i === 1 ? '<i class="ct-dot" aria-hidden="true"></i>' : ''}${esc(m)}</span>`).join('');
  return `<section id="contact" class="ct" aria-labelledby="ct-title">
    <div class="deco-bb" aria-hidden="true" style="left: 1cqw; bottom: -3%; height: 66%"></div>
    <div class="deco-sun" aria-hidden="true" style="right: 2cqw; top: 2%; width: 15cqw"></div>
    <p class="xp-eyebrow">${esc(K.eyebrow)}</p>
    <h2 id="ct-title" class="ct-h">${md(K.heading)}</h2>
    <p class="ct-sub">${md(K.sub)}</p>
    <div class="ct-mailwrap">
      <span class="ct-toast" role="status" aria-live="polite">${esc(K.copied)}</span>
      <button type="button" class="ct-mail" data-email="${esc(S.email)}" aria-label="Copy email address ${esc(S.email)}">${esc(S.email)}</button>
      <span class="ct-hint">${esc(K.copyHint)}</span>
    </div>
    <div class="ct-ctas">
      ${btns}
      ${mailMenu}
    </div>
    <p class="ct-meta">${meta}</p>
    <div class="ct-panda" aria-hidden="true">
      <div class="ct-bub"><span class="ct-typed" data-text="${esc(K.pandaBubble)}">${esc(K.pandaBubble)}</span><i class="ct-caret"></i></div>
      <img src="assets/panda-peek.webp" alt="" loading="lazy">
    </div>
  </section>`;
}

function footer() {
  const F = C.footer;
  // Icon-only links to every profile that is filled in (Site & SEO → Profiles, WhatsApp, Email)
  const B = P.brands || {};
  const pr = S.profiles || {};
  const links = [
    ['linkedin', pr.linkedin], ['github', pr.github], ['scholar', pr.scholar], ['researchgate', pr.researchgate], ['orcid', pr.orcid],
    ['website', pr.website], ['whatsapp', S.whatsapp ? 'https://wa.me/' + String(S.whatsapp).replace(/\D/g, '') : ''], ['email', S.email ? 'https://mail.google.com/mail/?view=cm&fs=1&to=' + encodeURIComponent(S.email) : ''],
  ].filter(([k, u]) => u && B[k]);
  const social = links.length ? `<ul class="ft-social" aria-label="${esc(F.socialLabel || 'Profiles')}">
        ${links.map(([k, u]) => `<li><a class="ft-ico" href="${esc(u)}" target="_blank" rel="noopener me" aria-label="${esc(B[k].title)}" title="${esc(B[k].title)}" style="--b:${B[k].hex}"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${B[k].path}"/></svg></a></li>`).join('\n        ')}
      </ul>` : '';
  return `<footer class="ft">
    <div class="ft-row">
      <div class="ft-name">${esc(S.name)}<span>${esc(S.jobTitle)}</span></div>
      <nav class="ft-links" aria-label="Footer">
        ${C.nav.map((n) => `<a href="${esc(n.href)}">${esc(n.label.replace(/ Me$/, ''))}</a>`).join('')}
      </nav>
      <button type="button" class="ft-top">Back to top ↑</button>
    </div>
    ${social}
    <div class="ft-bot"><span>${esc(F.left)}</span><span>${esc(F.right)} <b>${esc(F.rightBold)}</b></span></div>
  </footer>`;
}

// ---------- SEO ----------
function head() {
  const url = S.url.replace(/\/?$/, '/');
  const sameAs = Object.values(S.profiles || {}).filter(Boolean);
  const person = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: S.name,
    alternateName: S.alternateName || undefined,
    url,
    image: url + 'assets/portrait.png',
    jobTitle: S.jobTitle,
    worksFor: S.worksFor ? { '@type': 'Organization', name: S.worksFor } : undefined,
    alumniOf: S.alumniOf ? { '@type': 'CollegeOrUniversity', name: S.alumniOf } : undefined,
    address: { '@type': 'PostalAddress', addressLocality: (S.location || '').split(',')[0], addressCountry: 'BD' },
    email: 'mailto:' + S.email,
    sameAs,
    knowsAbout: ['Project Management', 'Project Coordination', 'Agile', 'Scrum', 'Human-Computer Interaction', 'VR', 'AR', 'Simulation'],
  };
  const site = { '@context': 'https://schema.org', '@type': 'WebSite', name: S.name, url };
  const papers = C.publications.papers.map((p) => ({
    '@context': 'https://schema.org', '@type': 'ScholarlyArticle', headline: p.title, url: p.url,
    datePublished: String(p.year || ''), publisher: { '@type': 'Organization', name: p.publisher || 'ACM' },
    author: plain(p.authors).split(',').map((a) => ({ '@type': 'Person', name: a.trim() === 'F. Huq' ? S.name : a.trim() })),
  }));
  const ld = [{ '@context': 'https://schema.org', '@type': 'ProfilePage', mainEntity: person, url }, site, ...papers];
  return `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(S.title)}</title>
<meta name="description" content="${esc(S.description)}">
<meta name="keywords" content="${esc(S.keywords)}">
<meta name="author" content="${esc(S.name)}">
<meta name="robots" content="index, follow, max-image-preview:large">
<link rel="canonical" href="${esc(url)}">
<meta name="theme-color" content="#EAEAEA">
${S.googleVerification ? `<meta name="google-site-verification" content="${esc(S.googleVerification)}">` : ''}
<meta property="og:type" content="profile">
<meta property="og:title" content="${esc(S.title)}">
<meta property="og:description" content="${esc(S.description)}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:image" content="${esc(url + S.ogImage)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="profile:first_name" content="${esc(S.name.split(' ')[0])}">
<meta property="profile:last_name" content="${esc(S.name.split(' ').slice(1).join(' '))}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(S.title)}">
<meta name="twitter:description" content="${esc(S.description)}">
<meta name="twitter:image" content="${esc(url + S.ogImage)}">
<link rel="icon" href="assets/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="assets/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400;1,800&family=Space+Grotesk:wght@500;600;700&display=swap">
<link rel="preload" as="image" href="${esc(C.hero.poster)}">
<link rel="stylesheet" href="css/style.css">
<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>`;
}

const html = `<!doctype html>
<html lang="en">
<head>
${head()}
</head>
<body>
<a class="skip" href="#about">Skip to content</a>
<div class="nomi-root">
  ${hero()}
  <main>
  ${about()}
  ${experience()}
  ${clients()}
  ${projects()}
  ${processSec()}
  ${publications()}
  ${contact()}
  </main>
  ${footer()}
</div>
<script>window.SITE=${JSON.stringify({ bubble: C.hero.bubble, email: S.email }).replace(/</g, '\\u003c')};</script>
<script src="js/main.js" defer></script>
</body>
</html>
`;

// ---------- write ----------
mkdirSync(OUT, { recursive: true });
if (OUT !== ROOT) {
  for (const d of ['assets', 'css', 'js', 'admin', 'content']) if (existsSync(join(ROOT, d))) cpSync(join(ROOT, d), join(OUT, d), { recursive: true });
  for (const f of ['.nojekyll', 'CNAME']) if (existsSync(join(ROOT, f))) cpSync(join(ROOT, f), join(OUT, f));
}
writeFileSync(join(OUT, 'index.html'), html);
const url = S.url.replace(/\/?$/, '/');
const today = new Date().toISOString().slice(0, 10);
writeFileSync(join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${url}</loc><lastmod>${today}</lastmod><changefreq>monthly</changefreq><priority>1.0</priority></url>\n</urlset>\n`);
writeFileSync(join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /admin/\n\nSitemap: ${url}sitemap.xml\n`);
writeFileSync(join(OUT, '404.html'), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Page not found — ${esc(S.name)}</title><meta name="robots" content="noindex"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@700&display=swap"><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#EAEAEA;font-family:'Space Grotesk',sans-serif;color:#111;text-align:center}h1{font-size:clamp(40px,8vw,96px);margin:0}a{display:inline-block;margin-top:24px;padding:14px 26px;border:2px solid #111;border-radius:999px;color:#111;text-decoration:none;font-weight:700;background:#FFE14D}</style></head><body><div><h1>Lost the trail.</h1><p>This page doesn’t exist.</p><a href="${url}">Back to ${esc(S.name)}</a></div></body></html>`);
console.log('Built', join(OUT, 'index.html'));
