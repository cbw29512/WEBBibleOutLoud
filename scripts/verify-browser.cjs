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
const shorts = catalog.videos.filter(v => v.type === "short");
const books = catalog.videos.filter(v => v.scope === "book");
const passages = catalog.videos.filter(v => v.scope === "passage");
const storyClips = catalog.videos.filter(v => v.story);
const storyNames = [...new Set(storyClips.map(v => v.story))];
const total = catalog.videos.length;
const bookOrder = ["Genesis","Exodus","Leviticus","Numbers","Deuteronomy","Joshua","Judges","Ruth","1 Samuel","2 Samuel","1 Kings","2 Kings","1 Chronicles","2 Chronicles","Ezra","Nehemiah","Esther","Job","Psalms","Proverbs","Ecclesiastes","Song of Solomon","Isaiah","Jeremiah","Lamentations","Ezekiel","Daniel","Hosea","Joel","Amos","Obadiah","Jonah","Micah","Nahum","Habakkuk","Zephaniah","Haggai","Zechariah","Malachi","Matthew","Mark","Luke","John","Acts","Romans","1 Corinthians","2 Corinthians","Galatians","Ephesians","Philippians","Colossians","1 Thessalonians","2 Thessalonians","1 Timothy","2 Timothy","Titus","Philemon","Hebrews","James","1 Peter","2 Peter","1 John","2 John","3 John","Jude","Revelation"];
const expectedBookNames = books.slice().sort((a,b)=>bookOrder.indexOf(a.bibleBook)-bookOrder.indexOf(b.bibleBook)).map(v=>v.bibleBook);
const firstShortTitle = shorts.slice().sort((a,b)=>{
  const oa = (bookOrder.indexOf(a.bibleBook)+1)*1000000+a.chapter*1000+a.verse;
  const ob = (bookOrder.indexOf(b.bibleBook)+1)*1000000+b.chapter*1000+b.verse;
  return oa-ob || a.publishedAt.localeCompare(b.publishedAt);
})[0].title.split("|")[0].trim();

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
      assert.equal(await page.locator("#video-grid .vid").count(), total);
      assert.equal(await page.locator("#video-grid .vid:visible").count(), 9, "default view displays nine cards");
      assert.match(await page.locator("#video-count").innerText(), new RegExp("9 of " + total));
      const defaultRanks = await page.locator("#video-grid .vid").evaluateAll(nodes=>nodes.map(n=>Number(n.dataset.scriptureOrder)));
      assert.deepEqual(defaultRanks,[...defaultRanks].sort((a,b)=>a-b), "All Videos must follow Scripture order across every card");
      assert.match(await page.locator("#video-grid .vid:visible").first().innerText(), /Genesis/);
      assert.equal(await page.locator("a[href='https://buymeacoffee.com/divclass016']").count(), 1);
      assert.equal(await page.locator("#shop .product").count(), merch.products.length);
      assert.equal(await page.locator("a[href='/privacy.html']").count(), 1);
      assert.equal(await page.locator("link[href='styles.css']").count(), 1);

      await page.locator('[data-filter="book"]').click();
      assert.equal(await page.locator('#video-grid .vid:visible').count(), books.length);
      assert.match(await page.locator("#video-count").innerText(), new RegExp(books.length + " of " + books.length));
      assert.equal(await page.locator('[data-filter="book"]').getAttribute("aria-pressed"), "true");
      assert.equal(await page.locator('#book-picker').count(), 0, "No unnecessary book dropdown");
      const bookTitles = await page.locator('#video-grid .vid:visible .vid-title').allInnerTexts();
      assert.ok(bookTitles.every(t => /Full Book/i.test(t)), "Complete Books tab must contain complete books only");
      const bibleBooks = await page.locator('#video-grid .vid:visible').evaluateAll(nodes => nodes.map(n => n.dataset.book));
      assert.deepEqual(bibleBooks, expectedBookNames, "Books must appear in canonical Bible order");
      // All five complete books are directly clickable; no additional selector.
      const bookLinks = await page.locator('#video-grid .vid:visible').evaluateAll(nodes => nodes.map(n => n.href));
      assert.equal(new Set(bookLinks).size, books.length, "Each book card links to a unique video");
      assert.ok(bookLinks.every(link => link.startsWith("https://youtu.be/")), "Full books must open YouTube");
      await page.locator('[data-filter="passage"]').click();
      assert.equal(await page.locator('#video-grid .vid:visible').count(), passages.length);
      assert.match(await page.locator("#video-count").innerText(), new RegExp(passages.length + " of " + passages.length));
      const chapterTitles = await page.locator('#video-grid .vid:visible .vid-title').allInnerTexts();
      assert.ok(chapterTitles.every(t => !/Full Book/i.test(t)), "Longer passages tab must not claim to be complete books");
      await page.locator('[data-filter="stories"]').click();
      assert.equal(await page.locator('#stories-help').isVisible(), true);
      assert.match(await page.locator("#video-count").innerText(), new RegExp(storyNames.length + " of " + storyNames.length + " stories · " + storyClips.length + " clips"));
      assert.equal(await page.locator("#video-grid").isHidden(), true);
      assert.equal(await page.locator(".story-collection:visible").count(), storyNames.length);
      assert.equal(await page.locator(".story-clip-link:visible").count(), storyClips.length);
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
      assert.match(await page.locator("#video-count").innerText(), new RegExp("9 of " + shorts.length));
      assert.match(await page.locator('#video-grid .vid:visible').first().innerText(), new RegExp(firstShortTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      assert.equal(await page.locator('#sort-label').innerText(), "Bible order");
      assert.equal(await page.locator('#video-grid .vid:visible').count(), 9);
      await page.locator('#load-more').click();
      assert.equal(await page.locator('#video-grid .vid:visible').count(), 18);
      assert.match(await page.locator("#video-count").innerText(), new RegExp("18 of " + shorts.length));
      await page.locator('#video-search').fill("Lazarus");
      const lazarus = await page.locator('#video-grid .vid:visible').count();
      assert.ok(lazarus >= 3 && lazarus <= 9, "Lazarus search filtered the Shorts");
      await page.locator('#video-search').fill("not-a-real-passage-zz");
      assert.equal(await page.locator('#video-grid .vid:visible').count(), 0);
      assert.equal(await page.locator('#empty-state').isVisible(), true);
      await page.locator('#video-search').fill("Obadiah");
      await page.locator('[data-filter="all"]').click();
      assert.equal(await page.locator('#video-grid .vid:visible').count(), 1);
      assert.match(await page.locator('#video-grid .vid:visible').first().innerText(), /Obadiah/);
      await page.locator('#video-search').fill("");
      assert.equal(await page.locator('#video-grid .vid:visible').count(), 9);
      assert.match(await page.locator('#video-grid .vid:visible').first().innerText(), /Genesis/);
      assert.equal(await page.locator('#sort-label').innerText(), "Bible order");

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
        ["book", books.length, "Genesis"],
        ["short", shorts.length, firstShortTitle],
        ["stories", storyNames.length, "Calling the first disciples"],
      ]) {
        await page.goto(url + "?view=" + view + "#library", { waitUntil: "domcontentloaded" });
        await page.waitForFunction(n => document.getElementById("video-count")?.textContent.includes("of " + n), expectedCount);
        assert.equal(await page.locator('[data-filter="' + view + '"]').getAttribute("aria-pressed"), "true");
        const first = view === "stories" ? page.locator(".story-collection:visible h3").first() : page.locator("#video-grid .vid:visible").first();
        const titlePattern = expectedTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        assert.match(await first.innerText(), new RegExp(titlePattern));
      }
      await page.goto(url + "?view=not-a-category#library", { waitUntil: "domcontentloaded" });
      await page.waitForFunction(n => document.getElementById("video-count")?.textContent.includes("9 of " + n), total);
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
    console.log("PASS: Bible-order library, " + shorts.length + " Shorts, " + storyClips.length + " story clips, " + total + " videos and axe WCAG across 4 viewports");
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
