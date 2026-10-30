# WEB Bible Out Loud — SEO and Accessibility Production Audit

Reviewed October 29, 2026 (America/New_York). Automated CI executed October 30, 2026 UTC.

## Scope and verified corrections

- Exactly 71 public YouTube videos remain catalogued: 62 Shorts, **5 complete books**, 4 longer chapter/multi-chapter readings.
- Only titles explicitly identified as "Full Book" appear under the **Complete books** filter: John, Psalms, Revelation, Obadiah, and Genesis. The John 1, John 6, John 7–8, and John 9–10 recordings are categorized as **Longer passages** instead.
- Both filters, title search, Show more, and results updates are tested in Chrome.
- Existing YouTube, TikTok, and Printify destinations and single Buy Me a Coffee link remain unchanged.
- Search metadata includes a title/description, self-canonical URL, indexable robots directive, Open Graph social image and Twitter card.
- The homepage includes WebSite JSON-LD and a valid ItemList of the five complete-book links; robots.txt publishes the sitemap and the sitemap includes homepage and privacy page.
- WCAG-related improvements include a color contrast fix, more legible metadata text, larger target areas, visible keyboard-focus styles, and matching visible/accessibility naming for the brand link.
- A missing favicon (404) was replaced with an SVG icon, removing one Lighthouse console issue.

## Automated checks (PASS)

- [Chrome functional and axe-core CI, run 40992679481](https://github.com/cbw29512/WEBBibleOutLoud/actions/runs/40992679481): 320, 390, 768 and 1366 CSS-pixel viewports; all catalog filters; complete-book label check; search; pagination; no horizontal overflow; privacy; no uncaught browser exceptions; no detected axe-core violations in WCAG 2.0, 2.1, or 2.2 A/AA rule sets at the tested states.
- [Lighthouse mobile audit, run 40992679479](https://github.com/cbw29512/WEBBibleOutLoud/actions/runs/40992679479), using Lighthouse 13.5.0 against a locally served copy of the actual Netlify build:
  - Performance **100/100**
  - Accessibility **100/100**
  - Best Practices **100/100**
  - SEO **100/100**
- Lighthouse reported zero browser-console errors and no visible-label/accessibility-name mismatch on the final run.

## What these results do not certify

- **Legal ADA compliance cannot be guaranteed or certified by axe-core/Lighthouse alone.** A manual screen-reader audit (NVDA/JAWS/VoiceOver), keyboard-only journey review, zoom and reflow with assistive settings, and testing with disabled users are still recommended.
- **Video accessibility** requires review of each YouTube video's synchronized captions, transcript accuracy, and the accessibility of the YouTube watching experience. Site checks alone cannot verify or repair those third-party videos.
- **100/100 is a lab measurement, not a permanent guarantee.** Real visitor performance and Core Web Vitals depend on devices, network speed, third-party thumbnails, analytics, and caching. Lighthouse had informational insights about cache lifetimes, request latency and render-blocking dependencies even with 100/100 in all four categories.
- **Google indexing and search ranking have not been certified.** Google Search Console indexing/coverage data was unavailable for this review. An SEO 100/100 Lighthouse result measures selected technical signals, not the site's placement in Google results.
- The five recordings are identified as full books **according to their published titles**; video-by-video verification that every verse was spoken accurately was not part of this audit.

Official references:
- [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- [US DOJ ADA guidance for websites](https://www.ada.gov/resources/web-guidance/)
- [Google Search Central SEO Starter Guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide)
- [Google video SEO best practices](https://developers.google.com/search/docs/appearance/video)

## Ongoing guardrails

On each PR or main push: source check, generated HTML reproducibility, 4-viewport Chrome tests with axe-core, and the existing privacy/link checks. The Lighthouse workflow runs against relevant site/content changes in a PR and can be launched manually; the full JSON audit report is kept as a GitHub Actions artifact.
