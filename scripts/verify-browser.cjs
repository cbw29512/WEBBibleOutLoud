"use strict";
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require("playwright-core");
const axeScript = require.resolve("axe-core/axe.min.js");

(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--no-sandbox"] });
  try {
    const url = pathToFileURL(path.resolve(__dirname, "../site/index.html")).href;
    for (const [width, height, columns] of [[320, 720, 1], [390, 844, 1], [768, 1024, 2], [1366, 768, 3]]) {
      const page = await browser.newPage({ viewport: { width, height } });
      const failures = [];
      page.on("pageerror", error => failures.push(error.message));
      await page.goto(url, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => document.getElementById("video-count")?.textContent.includes("Showing 9"));
      assert.equal(await page.locator("h1").innerText(), "Scripture,\nclearly heard.");
      assert.equal(await page.locator(".site-header .brand-title").innerText(), "Bible Out Loud");
      assert.equal(await page.locator(".feature-media").count(), 1);
      assert.equal(await page.locator(".path-card").count(), 2);
      assert.equal(await page.locator(".quick-browse a").count(), 3, "Three direct collection links");
      const destinations = await page.locator(".quick-browse a").evaluateAll(nodes => nodes.map(a => a.getAttribute("href")));
      assert.deepEqual(destinations, ["?view=book#library", "?view=short#library", "?view=stories#library"]);
      assert.equal(await page.locator("#video-grid .vid").count(), 71);
      assert.equal(await page.locator("#video-grid .vid:visible").count(), 9, "default view displays nine cards");
      assert.match(await page.locator("#video-count").innerText(), /9 of 71/);
      assert.equal(await page.locator("a[href='https://buymeacoffee.com/divclass016']").count(), 1);
      assert.equal(await page.locator("#shop .product").count(), 4);
      assert.equal(await page.locator("a[href='/privacy.html']").count(), 1);
      assert.equal(await page.locator("link[href='styles.css']").count(), 1);

      await page.locator('[data-filter="book"]').click();
      assert.equal(await page.locator('#video-grid .vid:visible').count(), 5);
      assert.match(await page.locator("#video-count").innerText(), /5 of 5/);
      assert.equal(await page.locator('[data-filter="book"]').getAttribute("aria-pressed"), "true");
      assert.equal(await page.locator('#book-picker').count(), 0, "No unnecessary book dropdown");
      const bookTitles = await page.locator('#video-grid .vid:visible .vid-title').allInnerTexts();
      assert.ok(bookTitles.every(t => /Full Book/i.test(t)), "Complete Books tab must contain complete books only");
      const bibleBooks = await page.locator('#video-grid .vid:visible').evaluateAll(nodes => nodes.map(n => n.dataset.book));
      assert.deepEqual(bibleBooks, ["Genesis","Psalms","Obadiah","John","Revelation"], "Books must appear in canonical Bible order");
      // All five complete books are directly clickable; no additional selector.
      const bookLinks = await page.locator('#video-grid .vid:visible').evaluateAll(nodes => nodes.map(n => n.href));
      assert.equal(new Set(bookLinks).size, 5, "Each book card links to a unique video");
      assert.ok(bookLinks.every(link => link.startsWith("https://youtu.be/")), "Full books must open YouTube");
      await page.locator('[data-filter="passage"]').click();
      assert.equal(await page.locator('#video-grid .vid:visible').count(), 4);
      assert.match(await page.locator("#video-count").innerText(), /4 of 4/);
      const chapterTitles = await page.locator('#video-grid .vid:visible .vid-title').allInnerTexts();
      assert.ok(chapterTitles.every(t => !/Full Book/i.test(t)), "Longer passages tab must not claim to be complete books");
      await page.locator('[data-filter="stories"]').click();
      assert.equal(await page.locator('#stories-help').isVisible(), true);
      assert.match(await page.locator("#video-count").innerText(), /14 of 14 stories · 32 clips/);
      assert.equal(await page.locator("#video-grid").isHidden(), true);
      assert.equal(await page.locator(".story-collection:visible").count(), 14);
      assert.equal(await page.locator(".story-clip-link:visible").count(), 32);
      await page.addScriptTag({path:axeScript});
      const storyAudit = await page.evaluate(async () => window.axe.run(document, {runOnly:{type:"tag",values:["wcag2a","wcag2aa","wcag21a","wcag21aa","wcag22aa"]}}));
      assert.deepEqual(storyAudit.violations.map(v=>v.id), [], "Grouped story accessibility violations");
      assert.match(await page.locator(".story-collection:visible h3").first().innerText(), /Calling the first disciples/);
      const lazarusGroup = page.locator(".story-collection").filter({has: page.locator("h3:text-is('Jesus raises Lazarus')")});
      assert.deepEqual(await lazarusGroup.locator(".story-part-label").allTextContents(), ["Part 1 of 4","Part 2 of 4","Part 3 of 4","Part 4 of 4"]);
      await page.locator("#video-search").fill("Lazarus");
      assert.equal(await page.locator(".story-collection:visible").count(), 1);
      assert.equal(await page.locator(".story-clip-link:visible").count(), 4);
      await page.locator("#video-search").fill("");
      await page.locator('[data-filter="short"]').click();
      assert.equal(await page.locator('#book-picker').count(), 0);
      assert.match(await page.locator("#video-count").innerText(), /9 of 62/);
      assert.match(await page.locator('#video-grid .vid:visible').first().innerText(), /John 1:1–5/);
      assert.equal(await page.locator('#sort-label').innerText(), "Bible order");
      assert.equal(await page.locator('#video-grid .vid:visible').count(), 9);
      await page.locator('#load-more').click();
      assert.equal(await page.locator('#video-grid .vid:visible').count(), 18);
      assert.match(await page.locator("#video-count").innerText(), /18 of 62/);
      await page.locator('#video-search').fill("Lazarus");
      const lazarus = await page.locator('#video-grid .vid:visible').count();
      assert.ok(lazarus >= 3 && lazarus <= 9, "Lazarus search filtered the Shorts");
      await page.locator('#video-search').fill("not-a-real-passage-zz");
      assert.equal(await page.locator('#video-grid .vid:visible').count(), 0);
      assert.equal(await page.locator('#empty-state').isVisible(), true);
      await page.locator('#video-search').fill("Psalms");
      await page.locator('[data-filter="all"]').click();
      assert.equal(await page.locator('#video-grid .vid:visible').count(), 1);
      assert.match(await page.locator('#video-grid .vid:visible').first().innerText(), /Psalms/);
      await page.locator('#video-search').fill("");
      assert.equal(await page.locator('#video-grid .vid:visible').count(), 9);
      assert.match(await page.locator('#video-grid .vid:visible').first().innerText(), /John 12:20–36/);
      assert.equal(await page.locator('#sort-label').innerText(), "Newest uploads first");

      const layout = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        viewport: innerWidth,
        columns: getComputedStyle(document.getElementById("video-grid")).gridTemplateColumns.split(" ").length,
        background: getComputedStyle(document.querySelector(".library-section")).backgroundColor,
        heroVisible: document.querySelector(".hero").getBoundingClientRect().height > 350,
      }));
      assert.ok(layout.scroll <= layout.viewport + 2, "Horizontal overflow at " + width + "px: " + JSON.stringify(layout));
      assert.equal(layout.columns, columns, "Wrong columns at " + width + "px");
      assert.equal(layout.heroVisible, true);
      assert.notEqual(layout.background, "rgba(0, 0, 0, 0)", "Library theme CSS not loaded");

      // axe-core checks detectable WCAG 2.0/2.1/2.2 A & AA failures.
      await page.addScriptTag({ path: axeScript });
      const audit = await page.evaluate(async () => window.axe.run(document, {
        runOnly: { type: "tag", values: ["wcag2a","wcag2aa","wcag21a","wcag21aa","wcag22aa"] }
      }));
      const issues = audit.violations.map(v => ({
        id: v.id, impact: v.impact,
        nodes: v.nodes.slice(0,4).map(n => ({target:n.target,summary:n.failureSummary?.slice(0,200)}))
      }));
      assert.deepEqual(issues, [], "axe-core accessibility violations at " + width + "px: " + JSON.stringify(issues));
      assert.deepEqual(failures, [], "No uncaught client errors");

      // Query-string links must open the correct category directly without
      // an extra dropdown, including on narrow mobile screens.
      for (const [view, expectedCount, expectedTitle] of [
        ["book", 5, "Genesis"],
        ["short", 62, "John 1:1–5"],
        ["stories", 14, "Calling the first disciples"],
      ]) {
        await page.goto(url + "?view=" + view + "#library", { waitUntil: "domcontentloaded" });
        await page.waitForFunction(n => document.getElementById("video-count")?.textContent.includes("of " + n), expectedCount);
        assert.equal(await page.locator('[data-filter="' + view + '"]').getAttribute("aria-pressed"), "true");
        const first = view === "stories" ? page.locator(".story-collection:visible h3").first() : page.locator("#video-grid .vid:visible").first();
        assert.match(await first.innerText(), new RegExp(expectedTitle));
      }
      await page.goto(url + "?view=not-a-category#library", { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => document.getElementById("video-count")?.textContent.includes("9 of 71"));
      assert.equal(await page.locator('[data-filter="all"]').getAttribute("aria-pressed"), "true");
      assert.deepEqual(failures, [], "Deep-link routes must not trigger browser errors");
      await page.close();
    }
    const privacy=await browser.newPage();
    await privacy.goto(pathToFileURL(path.resolve(__dirname,"../site/privacy.html")).href,{waitUntil:"domcontentloaded"});
    assert.match(await privacy.locator("main").innerText(),/GoatCounter/);
    await privacy.addScriptTag({path:axeScript});
    const privacyAudit=await privacy.evaluate(async () => window.axe.run(document, {
      runOnly:{type:"tag",values:["wcag2a","wcag2aa","wcag21a","wcag21aa","wcag22aa"]}
    }));
    assert.deepEqual(privacyAudit.violations.map(v=>v.id),[],"Privacy page accessibility failures");
    console.log("PASS: Bible-order book picker, 62 canonical Shorts, 32 curated story clips, chronological filters, 71 videos and axe WCAG across 4 viewports");
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
