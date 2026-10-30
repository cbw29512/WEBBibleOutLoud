#!/usr/bin/env node
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const file = path.join(root, "data/videos.json");
const htmlFile = path.join(root, "site/index.html");
const startMarker = "<!-- VIDEO_CARDS_START -->";
const endMarker = "<!-- VIDEO_CARDS_END -->";
const escapeHtml = s => String(s).replace(/[&<>"']/g, c => ({
  "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
})[c]);
const data = JSON.parse(fs.readFileSync(file,"utf8"));
if(!Array.isArray(data.videos) || data.videos.length<1 || data.videos.length>400)
  throw Error("data/videos.json requires 1–400 public videos");
const seen = new Set();
const videos = data.videos.map((video, i) => {
  if(typeof video.title!=="string" || !video.title.trim() || video.title.length>220)throw Error("Invalid video title at index "+i);
  if(!["short","long"].includes(video.type))throw Error("Invalid video type at index "+i);
  if(typeof video.publishedAt!=="string" || !/^\d{4}-\d{2}-\d{2}T/.test(video.publishedAt))throw Error("Missing video publication date at index "+i);
  if(typeof video.url!=="string")throw Error("Missing video URL at index "+i);
  const u = new URL(video.url);
  const short = u.hostname==="youtube.com" && /^\/shorts\/[A-Za-z0-9_-]{11}$/.test(u.pathname);
  const long = u.hostname==="youtu.be" && /^\/[A-Za-z0-9_-]{11}$/.test(u.pathname);
  if(u.protocol!=="https:" || u.search || u.hash || (video.type==="short"?!short:!long))
    throw Error("Invalid YouTube URL or type: "+video.url);
  const id=video.type==="short"?u.pathname.slice(8):u.pathname.slice(1);
  if(seen.has(id))throw Error("Duplicate YouTube video ID: "+id);
  seen.add(id);
  return { ...video,id };
});
const byNewest=(a,b)=>b.publishedAt.localeCompare(a.publishedAt);
const shorts=videos.filter(x=>x.type==="short").sort(byNewest);
const long=videos.filter(x=>x.type==="long").sort(byNewest);
const featured = Number(data.featuredShorts) || 12;
if(!Number.isInteger(featured) || featured<1 || featured>30) throw Error("featuredShorts must be between 1 and 30");
const card = v => '<a class="vid" href="'+escapeHtml(v.url)+'" target="_blank" rel="noopener noreferrer">'+
  '<img src="https://i.ytimg.com/vi/'+v.id+'/hqdefault.jpg" alt="'+escapeHtml(v.title)+
  ' video thumbnail" loading="lazy" width="480" height="360"><span>'+escapeHtml(v.title)+'</span></a>';
const grid = (css,entries) => '<div class="video-grid '+css+'">\n'+entries.map(card).join("\n")+'\n</div>';
const first=shorts.slice(0,featured);
const earlier=shorts.slice(featured);
let blocks=[
 '<h3 class="video-subheading">Recent Shorts <small>('+shorts.length+' total)</small></h3>',
 grid("featured-shorts",first),
 '<h3 class="video-subheading">Full-length Bible readings <small>('+long.length+')</small></h3>',
 grid("full-readings",long)
];
if(earlier.length){
 blocks.push('<details class="older-videos"><summary>Browse '+earlier.length+' more Shorts</summary>',
 grid("older-shorts",earlier),'</details>');
}
const content=fs.readFileSync(htmlFile,"utf8");
if(content.split(startMarker).length!==2 || content.split(endMarker).length!==2) throw Error("Video markers missing or duplicated");
const start=content.indexOf(startMarker)+startMarker.length;
const end=content.indexOf(endMarker);
if(end<start)throw Error("Video markers in wrong order");
const output=content.slice(0,start)+"\n"+blocks.join("\n")+"\n"+content.slice(end);
if(process.argv.includes("--check")){
 if(output!==content)throw Error("Video cards are out of sync. Run node scripts/render-videos.cjs");
 console.log("PASS: "+shorts.length+" Shorts and "+long.length+" full readings match data/videos.json");
}else{
 if(output!==content)fs.writeFileSync(htmlFile,output);
 console.log("Rendered "+videos.length+" videos ("+shorts.length+" Shorts, "+long.length+" full readings)");
}
