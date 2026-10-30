# WEB Bible Out Loud

**Live site:** https://webbibleoutloud.netlify.app/  
**GitHub:** https://github.com/cbw29512/WEBBibleOutLoud  
**Existing Netlify project:** https://app.netlify.com/projects/webbibleoutloud

## Source and deployment

The original site was recovered from immutable Netlify deploy `6ad27f5a1e2ae144ba523478` on October 29, 2026. Its exact original HTML remains tracked in `recovery-manifest.json` and Git history.

The active website is a static site in `site/`. The root `netlify.toml` specifies the **publish directory `site`** and a dependency-free build command: `node scripts/render-videos.cjs`.

### One-time step: connect the EXISTING Netlify project

Open the **existing** [Netlify project](https://app.netlify.com/projects/webbibleoutloud), go to **Project configuration → Developer settings → Continuous deployment → Repository**, and link GitHub repo `cbw29512/WEBBibleOutLoud`. Use production branch `main`, repository root as base, and publish directory `site`. The committed `netlify.toml` supplies the build command. Do **not** create a second Netlify project.

After linking, every merge or push to `main` should build and deploy automatically. Verify the live Netlify deploy's `commit_ref` matches the merged GitHub commit.

## Update the public video catalog

The channel snapshot contains **71 public videos**: 62 Shorts, 5 complete Bible books (Genesis, Psalms, Obadiah, John, Revelation), and 4 longer chapter readings.

The website's **All videos** tab shows newest uploads first. The **Complete books**, **Shorts**, and **Longer passages** tabs present available videos in *Scripture order*, not upload order. All five complete-book cards appear immediately in canonical order from Genesis to Revelation, each directly linked to its video without a dropdown.

The **Greatest Bible stories** tab groups 32 existing Short clips across 14 narrated stories from the Gospel of John and displays their parts in the order they appear in Scripture. Other Old or New Testament stories should be added *only after actual matching videos have been published*. This collection is not presented as a complete list of every major story in the Bible.

Edit **`data/videos.json`** whenever new videos go public. Entries require `title`, `url`, `type` (`short` or `long`), `publishedAt` (ISO YouTube timestamp), **`bibleBook`** (canonical Bible book name), **`chapter`**, and **`verse`** (the starting reference). Longer readings additionally require `scope`: `book` only for recordings of an entire Bible book, or `passage` for chapters and other sections. A Short may optionally have `story` with a meaningful name, placing that *existing video* in the Greatest Bible Stories tab. All videos are validated for URL uniqueness and Scripture metadata.

The Git-driven Netlify build runs `node scripts/render-videos.cjs` to generate all cards and thumbnails in `site/index.html` from the JSON catalog. Run locally to keep the HTML source synchronized:

```bash
node scripts/render-videos.cjs
node scripts/render-videos.cjs --check
```

Use canonical YouTube Shorts links (`https://youtube.com/shorts/VIDEOID`) for Shorts or `https://youtu.be/VIDEOID` for full readings. This is a curated snapshot, not automatic YouTube synchronization; refresh the JSON after new publications.

## Quality and security

- `scripts/verify_site.py`: confirms videos, links, one optional donation button, responsive styles, privacy, security headers and Netlify config
- `scripts/verify-browser.cjs`: tests mobile and desktop layouts in Chrome through GitHub Actions
- `.github/workflows/verify-site.yml`: runs both tests on pull requests and `main`
- `site/privacy.html`: discloses GoatCounter analytics, external video thumbnails, and external links
- `site/_headers`: Content Security Policy, framing protection, referrer protection and disabled unnecessary browser capabilities

## Recovery history

`scripts/recover_netlify.py` and `.github/workflows/recover-netlify.yml` retain the one-time original deployment recovery method. Recovery is manual-only, never invoked during normal publishing. Secrets, unpublished source and private Netlify configuration are not assumed to have been recovered.
