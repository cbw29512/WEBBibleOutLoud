# WEB Bible Out Loud

**Live website:** https://webbibleoutloud.netlify.app/
**Source repository:** https://github.com/cbw29512/WEBBibleOutLoud
**Existing Netlify project:** https://app.netlify.com/projects/webbibleoutloud

## Deployment

The original production website was recovered unchanged from Netlify deploy 6ad27f5a1e2ae144ba523478 on October 29, 2026. It is a single-file static site located at site/index.html. The original deploy had no separate published assets or build dependencies.

GitHub Actions verifies the source on pull requests and pushes to main. The root netlify.toml sets the publish directory to site; no build command is required.

## One-time step: connect the EXISTING Netlify project

In the existing Netlify project, navigate to Project configuration > Developer settings > Continuous deployment > Repository > Link repository. Choose GitHub repository cbw29512/WEBBibleOutLoud, production branch main, repository root as base, leave build command empty, and publish directory site. Do NOT create a replacement Netlify project.

After linking, changes merged into main should trigger Netlify automatically. Confirm the deployed commit matches the GitHub merge.

## Recovery records

- site/index.html: original browser-served website
- recovery-manifest.json: immutable deployment and file details
- scripts/recover_netlify.py: source recovery utility
- .github/workflows/recover-netlify.yml: manual-only recovery workflow
- scripts/verify_site.py: static website verification
- .github/workflows/verify-site.yml: source checks for PRs and main

The original page preserves YouTube and TikTok links, videos, store links, CSS, donation links, and GoatCounter analytics. Recovering browser-served files does not grant access to private source, Netlify secrets, or unpublished configuration.
