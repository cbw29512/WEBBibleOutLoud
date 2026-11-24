# WEB Bible Out Loud

**Live site:** https://webbibleoutloud.com/  
**GitHub:** https://github.com/cbw29512/WEBBibleOutLoud  
**Existing Netlify project:** https://app.netlify.com/projects/webbibleoutloud

## Source and deployment

The original site was recovered from immutable Netlify deploy `6ad27f5a1e2ae144ba523478` on October 29, 2026. Its exact original HTML remains tracked in `recovery-manifest.json` and Git history.

The active website is a static site in `site/`. The root `netlify.toml` specifies the **publish directory `site`** and a dependency-free build command: `node scripts/render-videos.cjs`.

### One-time step: connect the EXISTING Netlify project

Open the **existing** [Netlify project](https://app.netlify.com/projects/webbibleoutloud), go to **Project configuration → Developer settings → Continuous deployment → Repository**, and link GitHub repo `cbw29512/WEBBibleOutLoud`. Use production branch `main`, repository root as base, and publish directory `site`. The committed `netlify.toml` supplies the build command. Do **not** create a second Netlify project.

After linking, every merge or push to `main` should build and deploy automatically. Verify the live Netlify deploy's `commit_ref` matches the merged GitHub commit.

## Homepage layout

The homepage runs top to bottom in this order:

1. **Greatest Stories Ever Told** — the longer story readings, in Bible order
2. **Full Books** — complete book readings, in Bible order
3. **For Sleep** — voice-only whole-book readings, in Bible order
4. **Wear the words** — a few featured products, with photos, from `data/merch.json`
5. **Support our mission** — one quiet link to Buy Me a Coffee (proposed; pending approval)

That order lives in `data/home-layout.json`, and the order inside every list lives in `data/bible-order.json`. Nothing on the homepage, `/books/` or `/sleep/` is hand-ordered: `scripts/render-videos.cjs` generates all of it, so adding a video to `data/videos.json` drops it into its Bible-order position everywhere it belongs. To reorder the homepage, reorder `data/home-layout.json` and re-run the renderer.

Cards never show a posting date. The only metadata on a card is the Bible book.

The hero carries one progress line, "N of 66 books read aloud, word for word", with a bar. N is the number of distinct Bible books that have a public whole-book recording in `data/videos.json` (a read-along Full Book or a For Sleep reading of that book, counted once), and 66 is the length of `data/bible-order.json`. Adding a book's first whole-book recording moves the line; nothing about it is typed in by hand.

## Update the public video catalog

The public catalog lives in `data/videos.json`. Shorts stay in the JSON catalog so the weekly routine can keep tracking them, but they are not rendered as cards. A single button, **Watch the Shorts on YouTube**, links to `https://www.youtube.com/@webbibleoutloud/shorts`. Do not list unpublished, Unlisted, or scheduled videos.

Complete-book cards appear in canonical order from Genesis to Revelation, each directly linked to its book page. When two recordings of the same book are published, the earlier one is listed first. Longer readings use the exact public YouTube title and link. This page is not presented as a complete list of every story or book in the Bible.

A reading joins the **For Sleep** section when its exact public title contains `for Sleep`; no other flag is needed. Only add a For Sleep video once it is Public on the channel — Unlisted and Private videos must never appear on the site.

Edit **`data/videos.json`** whenever new videos go public. Entries require `title`, `url`, `type` (`short` or `long`), `publishedAt` (ISO YouTube timestamp), **`bibleBook`** (canonical Bible book name), **`chapter`**, and **`verse`** (the starting reference). Longer readings additionally require `scope`: `book` only for recordings of an entire Bible book, or `passage` for chapters and other sections. A Short may optionally have a `story` field in the catalog; that field is not used to render homepage cards. All videos are validated for URL uniqueness and Scripture metadata.

The Git-driven Netlify build runs `node scripts/render-videos.cjs` to generate all cards and thumbnails in `site/index.html` from the JSON catalog. Run locally to keep the HTML source synchronized:

```bash
node scripts/render-videos.cjs
node scripts/render-videos.cjs --check
```

Use canonical YouTube Shorts links (`https://youtube.com/shorts/VIDEOID`) for Shorts or `https://youtu.be/VIDEOID` for full readings. This is a curated snapshot, not automatic YouTube synchronization; refresh the JSON after new publications.

## Update the merch section

**Wear the words** shows a short, hand-picked set of products as real photos, not the whole Printify catalog. `data/merch.json` holds that selection and the shop link; the storefront itself carries the full line, linked under the grid by **See the full line in the store**.

Pick products that look different from each other — different garment, different color, different verse design — and only ones that are currently published on https://web-bible-out-loud.printify.me/ (its `sitemap.xml` lists exactly the visible products). Each entry needs the product `id`, the `url` of its own storefront page, the `storefrontTitle` exactly as the shop shows it, and a `name` that is that title with nothing added — at most the ` | WEB Bible Out Loud` suffix removed. The card's alt text is the `name`, so an invented title would become an inaccurate image description. Prices are never shown. Buy Me a Coffee never belongs in `data/merch.json`.

After editing the list, re-download and re-compress the photos, then re-render:

```bash
python3 scripts/fetch-merch-images.py          # needs Pillow; writes site/assets/merch/*.webp + *.jpg
python3 scripts/fetch-merch-images.py --check  # what CI runs
node scripts/render-videos.cjs
```

The images are committed to the repository so the Netlify build stays offline and dependency-free. Cards serve WebP with a JPEG fallback, lazy-loaded and with explicit width and height so the grid never shifts.

## Quality and security

- `scripts/verify_site.py`: confirms videos, links, one optional donation button, the merch photo grid, responsive styles, privacy, security headers and Netlify config
- `scripts/fetch-merch-images.py --check`: confirms every featured product photo is committed, web-sized and listed in `data/merch.json`
- `scripts/verify-browser.cjs`: tests mobile and desktop layouts in Chrome through GitHub Actions
- `.github/workflows/verify-site.yml`: runs both tests on pull requests and `main`
- `site/privacy.html`: discloses GoatCounter analytics, external video thumbnails, and external links
- `site/_headers`: Content Security Policy, framing protection, referrer protection and disabled unnecessary browser capabilities

## Recovery history

`scripts/recover_netlify.py` and `.github/workflows/recover-netlify.yml` retain the one-time original deployment recovery method. Recovery is manual-only, never invoked during normal publishing. Secrets, unpublished source and private Netlify configuration are not assumed to have been recovered.
