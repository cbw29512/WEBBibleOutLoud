#!/usr/bin/env node
"use strict";
// Zero-dependency build: video cards are generated from data/videos.json.
// On Netlify, the output is site/index.html (other files are left untouched).
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const videosPath = path.join(root, "data", "videos.json");
const homepagePath = path.join(root, "site", "index.html");
const begin = "<!-- VIDEO_CARDS_START -->";
const end = "<!-- VIDEO_CARDS_END -->";
const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
})[c]);

function videoInfo(url) {
  const u = new URL(url);
  if (u.protocol !== "https:") throw Error("Video URL must be HTTPS");
  let id = "";
  if (["youtube.com", "www.youtube.com"].includes(u.hostname) && /^\/shorts\/[A-Za-z0-9_-]{11}$/.test(u.pathname)) {
    id = u.pathname.slice("/shorts/".length);
  } else if (u.hostname === "youtu.be" && /^\/[A-Za-z0-9_-]{11}$/.test(u.pathname)) {
    id = u.pathname.slice(1);
  }
  if (!id || u.search || u.hash) throw Error("Unsupported YouTube video URL: " + url);
  return id;
}

const data = JSON.parse(fs.readFileSync(videosPath, "utf8"));
if (!Array.isArray(data.videos) || data.videos.length < 1 || data.videos.length > 20) {
  throw Error("data/videos.json must contain 1–20 videos");
}
const seen = new Set();
const cards = data.videos.map((video, i) => {
  if (typeof video.title !== "string" || !video.title.trim() || video.title.length > 180) {
    throw Error("Missing or overly long title for video #" + (i + 1));
  }
  const id = videoInfo(video.url);
  if (seen.has(id)) throw Error("Duplicate video: " + id);
  seen.add(id);
  const title = escapeHtml(video.title.trim());
  return '<a class="vid" href="' + escapeHtml(video.url) + '" target="_blank" rel="noopener noreferrer">' +
    '<img src="https://i.ytimg.com/vi/' + id + '/hqdefault.jpg" alt="' + title +
    ' video thumbnail" loading="lazy" width="480" height="360">' +
    '<span>' + title + '</span></a>';
});
const content = fs.readFileSync(homepagePath, "utf8");
if (content.split(begin).length !== 2 || content.split(end).length !== 2) {
  throw Error("Expected one pair of video markers in site/index.html");
}
const start = content.indexOf(begin) + begin.length;
const finish = content.indexOf(end);
if (finish < start) throw Error("Video markers out of order");
const output = content.slice(0, start) + "\n" + cards.join("\n") + "\n" + content.slice(finish);
if (process.argv.includes("--check")) {
  if (output !== content) throw Error("Homepage video cards are stale; run node scripts/render-videos.cjs");
  console.log("PASS: homepage cards match " + cards.length + " configured videos");
} else {
  if (output !== content) fs.writeFileSync(homepagePath, output);
  console.log("Rendered " + cards.length + " videos into site/index.html");
}
