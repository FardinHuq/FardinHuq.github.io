# Fardin Huq — Portfolio

A fast, static portfolio site with scroll animations, a built-in **admin panel**, and **SEO** set up so a search for "Fardin Huq" can surface this site. It's hosted free on **GitHub Pages**.

```
content/content.json   ← ALL the text, projects, papers, links (the admin panel edits this file)
assets/                ← video, images, CV, icons (admin uploads go to assets/uploads/)
css/style.css          ← all styles (desktop + phone/tablet)
js/main.js             ← scroll effects, typing bubbles, globe, menu
admin/                 ← the admin panel (yoursite/admin/)
src/partials.json      ← SVG drawings (devices, icons, logo) used by the build
build.mjs              ← turns content.json into dist/index.html + sitemap + robots
serve.mjs              ← local preview server
.github/workflows/deploy.yml  ← builds & publishes on every push to main
```

No npm installs are needed. Only Node 18+ is required.

---

## 1. Put it on GitHub (one time, ~10 minutes)

1. Create a GitHub account if you don't have one.
2. Create a **new public repository**.
   - **Best for your name in Google:** name it `YOUR-USERNAME.github.io`. Your site will then live at `https://YOUR-USERNAME.github.io/`.
   - Any other name works too, but the address becomes `https://YOUR-USERNAME.github.io/REPO-NAME/`.
3. Open `content/content.json` and set `"url"` (near the top) to that address, ending with `/`.
4. Upload everything in this folder to the repository. With Claude Code, just ask: *"push this project to my GitHub repo `<name>`"*.
5. In the repository, go to **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**.
6. Open the **Actions** tab. When the green tick appears (about 1 minute), the site is live.

## 2. Edit content with the admin panel

1. Go to `https://YOUR-SITE/admin/`.
2. Create a token (one time):
   - Open **GitHub → Settings → Developer settings → Fine-grained tokens → Generate new token**.
   - Under **Repository access**, choose **Only select repositories** and pick your site's repo.
   - Under **Permissions**, set **Contents** to **Read and write**.
   - Click **Generate**, then copy the token.
3. Paste the token into the admin login along with your username and repo name. It's stored only in that browser.
4. Edit any section, then click **Save & publish**. The site rebuilds automatically and updates in about a minute.

Admin tips:
- Text tricks: `==words==` gives a yellow marker, `**words**` bold, `*words*` italic. A new line becomes a line break.
- Project **image**: click **Upload…** to replace the striped placeholder with a screenshot.
- **Download backup** saves a copy of all your content; **Import** restores it.
- Projects, papers, process levels and nav links can all be added, removed and reordered.

## 3. Help Google rank this site for your name

All the technical SEO is already built in:
- Title and description
- Canonical URL
- Open Graph and Twitter share image (`assets/og-image.jpg`)
- `Person` + `ProfilePage` + `ScholarlyArticle` structured data, which tells Google this site is the official page for "Fardin Huq" and links it to your profiles
- `sitemap.xml` and `robots.txt`

What you still need to do (this is what actually moves rankings):

1. **Fill in your profile links** in admin → Site & SEO → Profiles. Your Google Scholar, ORCID, ResearchGate and GitHub links go into the structured data (`sameAs`).
2. **Google Search Console**:
   - Go to https://search.google.com/search-console and add your site (URL prefix).
   - Choose the **HTML tag** method and copy only the `content="…"` code.
   - Paste that code into admin → Site & SEO → Google Verification, then save.
   - Back in Search Console, click **Verify**.
   - Then open **Sitemaps**, submit `sitemap.xml`, and use **URL inspection → Request indexing** on your home page.
3. **Link back to the site** from everywhere:
   - LinkedIn: Contact info → Website, and your Featured section
   - Google Scholar profile homepage
   - ORCID, GitHub profile, ResearchGate
   - Your email signature and your CV

   Google trusts a site that your other profiles point to.
4. **Optional, strongest boost:** buy a domain like `fardinhuq.com` (about $10 a year).
   - Set it up in **Settings → Pages → Custom domain**.
   - Change `"url"` in content.json to the new domain.

> Honest note: no site can *guarantee* ranking above LinkedIn or Scholar, which are very strong domains. With the steps above, a personal site usually appears at or near the top for an exact-name search within a few weeks.

## 4. Work on it locally / with Claude Code

```bash
node build.mjs        # builds into dist/
node serve.mjs        # preview at http://localhost:8080  (admin at /admin/)
```

- Text and content changes go in `content/content.json`, or use the admin panel.
- For design changes, edit `css/style.css`, `js/main.js` or `build.mjs` (the HTML templates).
- Phone and tablet styles are in the `@container nomi (max-width: 999px)` block near the end of `css/style.css`.
