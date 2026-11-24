#!/usr/bin/env node
"use strict";
// Single source of canonical Bible ordering for every generated list on the site.
// Both renderers and both browser/site tests import this, so "Bible order" means
// the same thing on the homepage, /books/ and /sleep/.
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = rel => JSON.parse(fs.readFileSync(path.join(root, rel), "utf8"));

const BIBLE_BOOKS = read("data/bible-order.json").books;
if (BIBLE_BOOKS.length !== 66) throw Error("data/bible-order.json must list all 66 books");

const HOME_LAYOUT = read("data/home-layout.json");

// A video belongs in For Sleep when its public YouTube title says so, so a newly
// published "<Book> for Sleep" lands in the For Sleep section with no code change.
const isSleep = video => /\bfor Sleep\b/.test(video.title);

const bookIndex = video => {
  const index = BIBLE_BOOKS.indexOf(video.bibleBook);
  if (index < 0) throw Error("Unknown Bible book: " + video.bibleBook);
  return index;
};

// Genesis 1:1 sorts before Revelation 22:21 for every list on the site.
const scriptureOrder = video => (bookIndex(video) + 1) * 1000000 + video.chapter * 1000 + video.verse;
const scopeRank = video => (video.scope === "book" ? 0 : video.scope === "passage" ? 1 : 2);
const compare = (a, b) =>
  scriptureOrder(a) - scriptureOrder(b) ||
  scopeRank(a) - scopeRank(b) ||
  a.publishedAt.localeCompare(b.publishedAt);
const sortByScripture = videos => videos.slice().sort(compare);

const slugOf = book => book.toLowerCase().replace(/ /g, "-");
const bookPagePath = video => "/books/" + slugOf(video.bibleBook) + "/";

// The three homepage video collections, each already in Bible order.
function collections(videos) {
  const longs = videos.filter(v => v.type === "long");
  return {
    stories: sortByScripture(longs.filter(v => v.scope === "passage" && !isSleep(v))),
    books: sortByScripture(longs.filter(v => v.scope === "book" && !isSleep(v))),
    sleep: sortByScripture(longs.filter(isSleep)),
  };
}

module.exports = {
  BIBLE_BOOKS,
  HOME_LAYOUT,
  HOME_SECTION_IDS: HOME_LAYOUT.sections.map(s => s.id),
  SUPPORT_URL: HOME_LAYOUT.supportUrl,
  isSleep,
  scriptureOrder,
  sortByScripture,
  collections,
  slugOf,
  bookPagePath,
};
