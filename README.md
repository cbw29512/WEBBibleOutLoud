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

The site was matched to the public @WEBBibleOutLoud channel on October 29, 2026: **62 Shorts and 9 full-length readings (71 total)**. All 71 are linked on the homepage. The 12 newest Shorts appear first, full readings follow, and the remaining 50 Shorts can be expanded on demand. The page includes a direct link to the YouTube channel for future uploads.

Edit **`data/videos.json`** whenever new videos go public. Each entry has **`title`**, **`url`**, **`type`** (`short` or `long`), and **`publishedAt`** (the YouTube publication timestamp). Videos are sorted newest-first inside each category automatically, and duplicate IDs are rejected. The `featuredShorts` number controls how many Shorts appear before the expandable archive.

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
