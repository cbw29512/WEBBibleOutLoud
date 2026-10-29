# Web Bible Out Loud

Production: https://webbibleoutloud.netlify.app/

## Source recovery

The first production release was deployed manually to Netlify. The existing browser-served files are being recovered from immutable Netlify deploy `6ad27f5a1e2ae144ba523478` into a review branch, without changing production.

After reviewing the recovered site and merging it, connect this repository to the **existing** Netlify project `webbibleoutloud` (site ID `66a4ede1-5bb8-4c97-9e30-85c0c1cd3d06`) with production branch `main`, build command empty, and publish directory `site`.

Do not create a replacement Netlify site or switch publishing before recovery validation.
