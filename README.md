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

## Update latest videos

Edit **`data/videos.json`**. Each entry contains the display title and official YouTube video URL. Place the newest videos first and merge the change into `main`.

Netlify automatically runs `node scripts/render-videos.cjs` during its Git-driven build, generating the cards and thumbnail URLs in `site/index.html`. No dependencies or API tokens are required. To render locally before committing, run:

```bash
node scripts/render-videos.cjs
```

Keep the video URL to either a YouTube Shorts link (`https://youtube.com/shorts/VIDEOID`) or the short YouTube URL (`https://youtu.be/VIDEOID`). The generator rejects unsupported URLs or duplicates.

## Quality and security

- `scripts/verify_site.py`: confirms videos, links, one optional donation button, responsive styles, privacy, security headers and Netlify config
- `scripts/verify-browser.cjs`: tests mobile and desktop layouts in Chrome through GitHub Actions
- `.github/workflows/verify-site.yml`: runs both tests on pull requests and `main`
- `site/privacy.html`: discloses GoatCounter analytics, external video thumbnails, and external links
- `site/_headers`: Content Security Policy, framing protection, referrer protection and disabled unnecessary browser capabilities

## Recovery history

`scripts/recover_netlify.py` and `.github/workflows/recover-netlify.yml` retain the one-time original deployment recovery method. Recovery is manual-only, never invoked during normal publishing. Secrets, unpublished source and private Netlify configuration are not assumed to have been recovered.
