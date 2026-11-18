# Notes for Claude Code

- Static site. **Source of truth for all copy is `content/content.json`**. Never hard-code text into `build.mjs`; add a field to content.json and render it.
- `node build.mjs` renders `dist/` (index.html, sitemap.xml, robots.txt, 404.html) and copies assets/css/js/admin/content into it. `node serve.mjs` previews dist on :8080. There are no npm dependencies; keep it that way.
- Deploy: `.github/workflows/deploy.yml` runs the build on push to `main` and publishes `dist/` to GitHub Pages.
- The admin (`admin/`) commits `content/content.json` and uploads to `assets/uploads/` through the GitHub Contents API with the user's fine-grained token. If you add a new content field, the admin form picks it up automatically (it renders any JSON). Add dropdown options in `OPTIONS` and help text in `HINTS` in `admin/admin.js`.
- Markup in content strings: `==marker==`, `**bold**`, `*italic*`, `\n` → `<br>` (see `md()` in build.mjs).
- Layout is sized with container units (`cqw`) on `.nomi-root` (container name `nomi`). Desktop sections are scroll-pinned; every frame uses the page height `min(100vh, 62.36cqw)` and is vertically centred. Under 1000px wide (`@container nomi (max-width: 999px)` and `small()` in js/main.js) pinning is switched off and sections stack.
- Design language: background #EAEAEA, ink #111111, yellow #FFE14D; Space Grotesk headings, Inter body; hard black offset shadows; horizontal scanline "pen-stroke" textures. Keep new UI consistent with this.
- Test at 390×844, 768×1024, 1280×720, 1440×900 and 1920×1080 before shipping layout changes.
