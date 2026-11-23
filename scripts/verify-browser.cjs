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
const books = catalog.videos.filter(v => v.scope === "book");
const passages = catalog.videos.filter(v => v.scope === "passage");
const bookOrder = ["Genesis","Exodus","Leviticus","Numbers","Deuteronomy","Joshua","Judges","Ruth","1 Samuel","2 Samuel","1 Kings","2 Kings","1 Chronicles","2 Chronicles","Ezra","Nehemiah","Esther","Job","Psalms","Proverbs","Ecclesiastes","Song of Solomon","Isaiah","Jeremiah","Lamentations","Ezekiel","Daniel","Hosea","Joel","Amos","Obadiah","Jonah","Micah","Nahum","Habakkuk","Zephaniah","Haggai","Zechariah","Malachi","Matthew","Mark","Luke","John","Acts","Romans","1 Corinthians","2 Corinthians","Galatians","Ephesians","Philippians","Colossians","1 Thessalonians","2 Thessalonians","1 Timothy","2 Timothy","Titus","Philemon","Hebrews","James","1 Peter","2 Peter","1 John","2 John","3 John","Jude","Revelation"];
const expectedBookNames = books.slice().sort((a,b)=>
  bookOrder.indexOf(a.bibleBook)-bookOrder.indexOf(b.bibleBook) ||
  a.chapter-b.chapter || a.verse-b.verse || a.publishedAt.localeCompare(b.publishedAt)
).map(v=>v.bibleBook);
const expectedBookTitles = books.slice().sort((a,b)=>
  bookOrder.indexOf(a.bibleBook)-bookOrder.indexOf(b.bibleBook) ||
  a.chapter-b.chapter || a.verse-b.verse || a.publishedAt.localeCompare(b.publishedAt)
).map(v => v.title);
const expectedStoryTitles = passages.slice().sort((a,b)=>
  bookOrder.indexOf(a.bibleBook)-bookOrder.indexOf(b.bibleBook) ||
  a.chapter-b.chapter || a.verse-b.verse || a.publishedAt.localeCompare(b.publishedAt)
).map(v => v.title);
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
      assert.equal(await page.locator("a[href='https://buymeacoffee.com/divclass016']").count(), 1);
      assert.equal(await page.locator("#shorts-button").count(), 1, "Expected one Shorts button");
      assert.equal(await page.locator("#shorts-button").innerText(), "Watch the Shorts on YouTube");
      assert.equal(await page.locator("#shorts-button").getAttribute("href"), SHORTS);
      assert.equal(await page.locator("a[href='https://www.youtube.com/@webbibleoutloud/shorts']").count(), 1);
      assert.equal(await page.locator("a[href*='youtube.com/shorts/']").count(), 0, "Shorts video cards should not be present");
      assert.equal(await page.locator('[data-filter="short"], [data-type="short"]').count(), 0, "Shorts cards or Shorts filter still present");
      assert.equal(await page.locator("#video-search, #load-more").count(), 0, "Old library controls still present");
      assert.equal(await page.locator("#stories-grid .vid").count(), passages.length);
      assert.equal(await page.locator("#stories-grid .vid:visible").count(), passages.length);
      assert.equal(await page.locator('#stories-grid .vid').evaluateAll(nodes => nodes.filter(n => n.dataset.scope === "passage").length), passages.length);
      const storyTitles = await page.locator("#stories-grid .vid-title").allInnerTexts();
      assert.deepEqual(storyTitles, expectedStoryTitles, "Story cards must use the exact public titles in Bible order");
      const storyLinks = await page.locator("#stories-grid .vid").evaluateAll(nodes => nodes.map(n => n.href));
      assert.equal(new Set(storyLinks).size, passages.length, "Each story card links to a unique video");
      assert.ok(storyLinks.every(link => link.startsWith("https://youtu.be/")), "Stories must open YouTube");
      assert.equal(await page.locator("#books-grid .vid").count(), books.length);
      assert.equal(await page.locator("#books-grid .vid:visible").count(), books.length);
      const bookTitles = await page.locator("#books-grid .vid-title").allInnerTexts();
      assert.deepEqual(bookTitles, expectedBookTitles, "Complete book cards must use the exact public titles in Bible order");
      const bookTags = await page.locator("#books-grid .type-tag").allInnerTexts();
      assert.ok(bookTags.every(t => t.toLowerCase() === "complete book"), "Full Books section must contain complete books only");
      const bibleBooks = await page.locator("#books-grid .vid").evaluateAll(nodes => nodes.map(n => n.dataset.book));
      assert.deepEqual(bibleBooks, expectedBookNames, "Books must appear in canonical Bible order");
      const bookLinks = await page.locator("#books-grid .vid").evaluateAll(nodes => nodes.map(n => n.href));
      assert.equal(new Set(bookLinks).size, books.length, "Each book card links to a unique video");
      assert.ok(bookLinks.every(link => link.startsWith("https://youtu.be/")), "Full books must open YouTube");
      assert.equal(await page.locator("#shop .product").count(), merch.products.length);
      assert.equal(await page.locator("a[href='/privacy.html']").count(), 1);
      assert.equal(await page.locator("link[href='styles.css']").count(), 1);
      await page.addScriptTag({path:axeScript});
      const audit = await page.evaluate(async () => window.axe.run(document, {runOnly:{type:"tag",values:["wcag2a","wcag2aa","wcag21a","wcag21aa","wcag22aa"]}}));
      assert.deepEqual(audit.violations.map(v=>v.id), [], "Accessibility violations on " + width + "x" + height);
      assert.deepEqual(failures, [], "page errors: " + failures.join("; "));
      await page.close();
    }
    console.log("PASS: " + passages.length + " stories, " + books.length + " complete books, " + merch.products.length + " merch items, one Shorts button, and axe WCAG across 4 viewports");
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exit(1);
});
