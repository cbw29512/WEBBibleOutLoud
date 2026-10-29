"use strict";
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--no-sandbox"] });
  try {
    const url = pathToFileURL(path.resolve(__dirname, "../site/index.html")).href;
    for (const [width, height, columns] of [[390, 844, 1], [1366, 768, 2]]) {
      const page = await browser.newPage({ viewport: { width, height } });
      await page.goto(url, { waitUntil: "domcontentloaded" });
      assert.equal(await page.locator("h1").innerText(), "WEB Bible Out Loud");
      assert.equal(await page.locator("#videos .vid").count(), 5);
      assert.equal(await page.locator("a[href='https://buymeacoffee.com/divclass016']").count(), 1);
      assert.equal(await page.locator("a[href='/privacy.html']").count(), 1);
      assert.equal(await page.locator(".product-grid .product").count(), 4);
      const state = await page.evaluate(() => ({
        viewport: window.innerWidth,
        scroll: document.documentElement.scrollWidth,
        videoColumns: getComputedStyle(document.querySelector(".video-grid")).gridTemplateColumns.split(" ").length,
        supportVisible: (() => {
          const r = document.querySelector(".coffee").getBoundingClientRect();
          return r.width > 90 && r.height >= 48;
        })()
      }));
      assert.ok(state.scroll <= state.viewport + 2, width + "px viewport horizontal overflow: " + JSON.stringify(state));
      assert.equal(state.videoColumns, columns, "Wrong grid column count at " + width);
      assert.equal(state.supportVisible, true);
      await page.close();
    }
    const privacy = await browser.newPage();
    await privacy.goto(pathToFileURL(path.resolve(__dirname, "../site/privacy.html")).href, { waitUntil: "domcontentloaded" });
    assert.match(await privacy.locator("main").innerText(), /GoatCounter/);
    console.log("PASS: Chrome mobile and desktop responsive layouts, video cards, support, privacy, and shop");
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
