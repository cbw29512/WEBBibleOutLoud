"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require("playwright-core");
const axeScript = require.resolve("axe-core/axe.min.js");
const root = path.resolve(__dirname, "..");
const catalog = JSON.parse(fs.readFileSync(path.join(root, "data/videos.json"), "utf8"));
const merch = JSON.parse(fs.readFileSync(path.join(root, "data/merch.json"), "utf8"));
// The test orders cards with the same shared module the renderer uses, then asserts the
// rendered page matches, so a new video has to land in its Bible-order slot to pass.
const { HOME_LAYOUT, SUPPORT_URL, BIBLE_BOOKS, collections, slugOf } = require("./bible-order.cjs");
const { stories: passages, books, sleep } = collections(catalog.videos);
// Same definition the renderer uses: distinct books with any public whole-book recording.
const booksReadAloud = new Set(catalog.videos.filter(v => v.type === "long" && v.scope === "book").map(v => v.bibleBook)).size;
const progressLabel = booksReadAloud + " of " + BIBLE_BOOKS.length + " books read aloud, word for word";
const expectedSections = HOME_LAYOUT.sections.map(s => s.id);
const titlesOf = list => list.map(v => v.title);
const booksOf = list => list.map(v => v.bibleBook);
const SHORTS = "https://www.youtube.com/@webbibleoutloud/shorts";

(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--no-sandbox"] });
  try {
    const url = pathToFileURL(path.resolve(__dirname, "../site/index.html")).href;
    for (const [width, height] of [[320, 720], [390, 844], [768, 1024], [1366, 768]]) {
      const page = await browser.newPage({ viewport: { width, height } });
      const failures = [];
      page.on("pageerror", error => failures.push(error.message));
      await page.goto(url, { waitUntil: "domcontentloaded" });
      assert.equal(await page.locator("h1").innerText(), "Scripture,\nclearly heard.");
      assert.equal(await page.locator(".site-header .brand-title").innerText(), "Bible Out Loud");
      assert.equal(await page.locator(".feature-media").count(), 1);
      // The featured card sits straight at every width: no tilt, skew or other transform.
      assert.equal(await page.locator(".feature").evaluate(n => getComputedStyle(n).transform), "none",
        "The featured card must not be tilted at " + width + "x" + height);
      assert.equal((await page.locator(".bible-progress-label").innerText()).replace(/\s+/g, " ").trim(), progressLabel,
        "Hero progress must state the computed whole-Bible count");
      assert.equal(await page.locator(".metrics").count(), 0, "The old four-count hero strip must be gone");
      const bar = page.locator(".bible-progress-bar");
      assert.equal(await bar.getAttribute("role"), "progressbar");
      assert.equal(await bar.getAttribute("aria-valuenow"), String(booksReadAloud));
      assert.equal(await bar.getAttribute("aria-valuemin"), "0");
      assert.equal(await bar.getAttribute("aria-valuemax"), String(BIBLE_BOOKS.length));
      assert.equal(await bar.getAttribute("aria-labelledby"), "bible-progress-label");
      const share = await page.locator(".bible-progress-fill").evaluate(el => {
        const track = el.parentElement.getBoundingClientRect().width;
        return track ? el.getBoundingClientRect().width / track : 0;
      });
      assert.ok(Math.abs(share - booksReadAloud / BIBLE_BOOKS.length) < 0.02,
        "Progress fill must be " + booksReadAloud + "/" + BIBLE_BOOKS.length + " of the track");
      assert.equal(await page.locator("#shorts-button").count(), 1, "Expected one Shorts button");
      assert.equal(await page.locator("#shorts-button").innerText(), "Watch the Shorts on YouTube");
      assert.equal(await page.locator("#shorts-button").getAttribute("href"), SHORTS);
      assert.equal(await page.locator("a[href='https://www.youtube.com/@webbibleoutloud/shorts']").count(), 1);
      assert.equal(await page.locator("a[href*='youtube.com/shorts/']").count(), 0, "Shorts video cards should not be present");
      assert.equal(await page.locator('[data-filter="short"], [data-type="short"]').count(), 0, "Shorts cards or Shorts filter still present");
      assert.equal(await page.locator("#video-search, #load-more").count(), 0, "Old library controls still present");

      // Top to bottom: Greatest Stories Ever Told, Full Books, For Sleep, merch, support.
      const sectionOrder = await page.locator("main [data-home-section]").evaluateAll(nodes => nodes.map(n => n.dataset.homeSection));
      assert.deepEqual(sectionOrder, expectedSections, "Homepage sections are in the wrong order");

      assert.equal(await page.locator("#stories-grid .vid").count(), passages.length);
      assert.equal(await page.locator("#stories-grid .vid:visible").count(), passages.length);
      assert.equal(await page.locator('#stories-grid .vid').evaluateAll(nodes => nodes.filter(n => n.dataset.scope === "passage").length), passages.length);
      assert.deepEqual(await page.locator("#stories-grid .vid-title").allInnerTexts(), titlesOf(passages),
        "Story cards must use the exact public titles in Bible order");
      const storyLinks = await page.locator("#stories-grid .vid").evaluateAll(nodes => nodes.map(n => n.href));
      assert.equal(new Set(storyLinks).size, passages.length, "Each story card links to a unique video");
      assert.ok(storyLinks.every(link => link.startsWith("https://youtu.be/")), "Stories must open YouTube");

      assert.equal(await page.locator("#books-grid .vid").count(), books.length);
      assert.equal(await page.locator("#books-grid .vid:visible").count(), books.length);
      assert.deepEqual(await page.locator("#books-grid .vid-title").allInnerTexts(), titlesOf(books),
        "Complete book cards must use the exact public titles in Bible order");
      const bookTags = await page.locator("#books-grid .type-tag").allInnerTexts();
      assert.ok(bookTags.every(t => t.toLowerCase() === "complete book"), "Full Books section must contain complete books only");
      assert.deepEqual(await page.locator("#books-grid .vid").evaluateAll(nodes => nodes.map(n => n.dataset.book)), booksOf(books),
        "Books must appear in canonical Bible order");
      const bookLinks = await page.locator("#books-grid .vid").evaluateAll(nodes => nodes.map(n => n.href));
      assert.equal(new Set(bookLinks).size, books.length, "Each book card links to a unique video");
      assert.ok(bookLinks.every(link => /\/books\/[a-z0-9-]+\/$/.test(link)), "Full book cards must open their on-site book pages");

      assert.equal(await page.locator("#sleep-grid .vid").count(), sleep.length, "For Sleep cards must match the catalog");
      assert.equal(await page.locator("#sleep-grid .vid:visible").count(), sleep.length);
      assert.deepEqual(await page.locator("#sleep-grid .vid-title").allInnerTexts(), titlesOf(sleep),
        "For Sleep cards must use the exact public titles in Bible order");
      assert.deepEqual(await page.locator("#sleep-grid .vid").evaluateAll(nodes => nodes.map(n => n.dataset.book)), booksOf(sleep),
        "For Sleep must appear in canonical Bible order");

      // No card anywhere shows a posting date.
      const cardMeta = await page.locator(".vid-meta > span:first-child").allInnerTexts();
      assert.ok(cardMeta.length > 0 && cardMeta.every(t => /^[1-3]? ?[A-Za-z ]+$/.test(t.trim()) && !/\d/.test(t)),
        "Cards must show the Bible book, never a posting date");

      // Merch shows a few real product photos, each card opening that product on the storefront.
      assert.equal(await page.locator("#shop .product").count(), merch.products.length);
      assert.deepEqual(await page.locator("#shop .product").evaluateAll(nodes => nodes.map(n => n.href)),
        merch.products.map(p => p.url), "Each merch card must link to its own storefront product page");
      assert.deepEqual(await page.locator("#shop .product-name").allInnerTexts(), merch.products.map(p => p.name),
        "Merch cards must show the exact storefront product titles");
      await page.locator("#shop").scrollIntoViewIfNeeded();
      await page.waitForFunction(
        () => Array.from(document.querySelectorAll("#shop .product img")).every(i => i.complete && i.naturalWidth > 0),
        null, { timeout: 20000 });
      const photos = await page.locator("#shop .product img").evaluateAll(nodes => nodes.map(i => ({
        alt: i.alt, loading: i.loading, width: i.getAttribute("width"), height: i.getAttribute("height"),
        rendered: Math.round(i.getBoundingClientRect().width), chosen: i.currentSrc.split("/").pop()
      })));
      assert.equal(photos.length, merch.products.length, "Every merch card needs one photo");
      assert.deepEqual(photos.map(p => p.alt), merch.products.map(p => p.name),
        "Merch photo alt text must be the product title");
      assert.ok(photos.every(p => p.loading === "lazy"), "Merch photos must be lazy-loaded");
      assert.deepEqual(photos.map(p => `${p.width}x${p.height}`),
        merch.products.map(p => `${p.imageWidth}x${p.imageHeight}`),
        "Merch photos need width and height so the grid never shifts");
      assert.ok(photos.every(p => p.rendered > 60), "Merch photos must actually render at " + width + "px wide");
      assert.deepEqual(photos.map(p => decodeURIComponent(p.chosen)),
        merch.products.map(p => p.image.split("/").pop()), "Chrome should pick the WebP source");
      assert.equal(await page.locator(`#shop .shop-cta[href='${merch.shopUrl}']:visible`).count(), 1,
        "The merch section needs one prominent link to the whole storefront");
      assert.ok(!(await page.locator("#shop").innerText()).includes("$"), "Merch must not show prices");
      assert.equal(await page.locator(`#shop a[href='${SUPPORT_URL}']`).count(), 0, "Merch must not contain the Buy Me a Coffee link");
      assert.equal(await page.locator(`a[href='${SUPPORT_URL}']`).count(), 1, "Expected exactly one Buy Me a Coffee link");
      assert.equal(await page.locator(`#support a[href='${SUPPORT_URL}']:visible`).count(), 1, "The support link belongs in the support section");
      assert.equal(await page.locator("a[href='/privacy.html']").count(), 1);
      assert.equal(await page.locator("link[href='styles.css']").count(), 1);
      await page.addScriptTag({path:axeScript});
      const audit = await page.evaluate(async () => window.axe.run(document, {runOnly:{type:"tag",values:["wcag2a","wcag2aa","wcag21a","wcag21aa","wcag22aa"]}}));
      assert.deepEqual(audit.violations.map(v=>v.id), [], "Accessibility violations on " + width + "x" + height);
      assert.deepEqual(failures, [], "page errors: " + failures.join("; "));
      await page.close();
    }
    // Book pages, book index and For Sleep page: exact title, player button, axe WCAG at phone and desktop widths.
    const slugs = books.map(v => "books/" + slugOf(v.bibleBook) + "/index.html");
    for (const rel of ["books/index.html", "sleep/index.html"].concat(slugs)) {
      for (const [width, height] of [[390, 844], [1366, 768]]) {
        const page = await browser.newPage({ viewport: { width, height } });
        const failures = [];
        page.on("pageerror", error => failures.push(error.message));
        await page.goto(pathToFileURL(path.resolve(__dirname, "../site/" + rel)).href, { waitUntil: "domcontentloaded" });
        assert.equal(await page.locator("h1").count(), 1, rel + " needs one h1");
        if (rel === "books/index.html") {
          assert.deepEqual(await page.locator("#book-pages-grid .vid-title").allInnerTexts(), titlesOf(books),
            "/books/ must list complete books in Bible order");
        }
        if (rel === "sleep/index.html") {
          assert.deepEqual(await page.locator("#sleep-grid .vid-title").allInnerTexts(), titlesOf(sleep),
            "/sleep/ must list For Sleep readings in Bible order");
          assert.equal(await page.locator("a[href='https://www.youtube.com/playlist?list=PLF5WA__O4zfE']").count(), 1,
            "/sleep/ needs the For Sleep playlist link");
        }
        if (rel.startsWith("books/") && rel !== "books/index.html") {
          const v = books.find(b => rel === "books/" + slugOf(b.bibleBook) + "/index.html");
          assert.ok((await page.content()).includes(v.url), rel + " must link its YouTube video");
          assert.equal(await page.locator(".lite-play").count(), 1, rel + " needs one play button");
        }
        await page.addScriptTag({path:axeScript});
        const audit = await page.evaluate(async () => window.axe.run(document, {runOnly:{type:"tag",values:["wcag2a","wcag2aa","wcag21a","wcag21aa","wcag22aa"]}}));
        assert.deepEqual(audit.violations.map(v=>v.id), [], "Accessibility violations on " + rel + " " + width);
        assert.deepEqual(failures.filter(f => !/goatcounter|gc\.zgo/i.test(f)), [], "page errors on " + rel + ": " + failures.join("; "));
        await page.close();
      }
    }
    console.log("PASS: sections " + expectedSections.join(" → ") + "; " + passages.length + " stories, " + books.length + " complete books, " + sleep.length + " For Sleep, " + merch.products.length + " merch items, one Shorts button, one support link, axe WCAG across 4 viewports, plus " + (slugs.length + 2) + " book/sleep pages");
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exit(1);
});
