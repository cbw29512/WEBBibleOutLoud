#!/usr/bin/env node
"use strict";
// Render semantic HTML from the one authoritative, editable video catalog.
// This runs at Netlify build time; no API token or browser-side data fetch.
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const htmlPath = path.join(root, "site/index.html");
const dataset = JSON.parse(fs.readFileSync(path.join(root, "data/videos.json"),"utf8"));
if(!Array.isArray(dataset.videos) || dataset.videos.length<1 || dataset.videos.length>400) throw Error("Expected 1-400 published videos");
const seen=new Set();
const videos=dataset.videos.map(v=>{
  if(typeof v.title!=="string" || !v.title.trim() || v.title.length>220)throw Error("Invalid title");
  if(!["short","long"].includes(v.type))throw Error("Invalid video type");
  if(typeof v.publishedAt!=="string" || !/^\d{4}-\d{2}-\d{2}T/.test(v.publishedAt))throw Error("Missing publish date");
  const u=new URL(v.url);
  const valid=v.type==="short"
    ? u.hostname==="youtube.com" && /^\/shorts\/[A-Za-z0-9_-]{11}$/.test(u.pathname)
    : u.hostname==="youtu.be" && /^\/[A-Za-z0-9_-]{11}$/.test(u.pathname);
  if(u.protocol!=="https:" || !valid || u.search || u.hash)throw Error("Invalid YouTube URL: "+v.url);
  const id=u.pathname.split("/").pop();
  if(seen.has(id))throw Error("Duplicate YouTube video ID: "+id);
  seen.add(id);
  return {...v,id};
}).sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt));
const shorts=videos.filter(v=>v.type==="short"),long=videos.filter(v=>v.type==="long");
if(!shorts.length||!long.length)throw Error("Expected both Shorts and full-length videos");
const featured=long.find(v=>/Full Book/i.test(v.title))||long[0];
const escape=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const title=v=>v.title.split("|")[0].trim();
const thumb=v=>"https://i.ytimg.com/vi/"+v.id+"/hqdefault.jpg";
const date=v=>new Date(v.publishedAt).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric",timeZone:"UTC"});
const hero='<article class="feature" aria-label="Featured full-length Bible reading">\n'+
'  <a class="feature-media" href="'+escape(featured.url)+'" target="_blank" rel="noopener noreferrer" aria-label="Watch '+escape(title(featured))+' on YouTube">\n'+
'    <img src="'+thumb(featured)+'" alt="'+escape(title(featured))+' video thumbnail" width="480" height="360" fetchpriority="high">\n'+
'    <span class="play-circle" aria-hidden="true">▶</span>\n'+
'  </a>\n'+
'  <div class="feature-info">\n'+
'    <p class="feature-label">Featured · Full book reading</p>\n'+
'    <h2 class="feature-title"><a href="'+escape(featured.url)+'" target="_blank" rel="noopener noreferrer">'+escape(title(featured))+'</a></h2>\n'+
'    <p class="feature-sub">World English Bible · Captions · No music</p>\n'+
'  </div>\n</article>';
const stats='<div class="metrics" aria-label="Video library overview"><div class="metric"><strong>'+videos.length+'</strong> videos</div><div class="metric"><strong>'+shorts.length+'</strong> Shorts</div><div class="metric"><strong>'+long.length+'</strong> longer readings</div></div>';
const pathCard=(v,label,action)=>'<a class="path-card" href="'+escape(v.url)+'" target="_blank" rel="noopener noreferrer">\n'+
'  <img class="path-thumb" src="'+thumb(v)+'" alt="" width="112" height="84" loading="lazy">\n'+
'  <span><span class="path-eyebrow">'+label+'</span><span class="path-name">'+escape(title(v))+'</span><span class="path-action">'+action+' ↗</span></span>\n</a>';
const paths=pathCard(shorts[0],"Latest short · Listen in minutes","Watch the latest Short")+
  pathCard(featured,"Featured long reading · Take your time","Start listening");
const card=v=>'<a class="vid" data-type="'+v.type+'" data-search="'+escape(v.title.toLocaleLowerCase())+'" href="'+escape(v.url)+'" target="_blank" rel="noopener noreferrer">\n'+
'  <span class="thumb"><img src="'+thumb(v)+'" alt="" loading="lazy" decoding="async" width="480" height="360"><span class="type-tag">'+(v.type==="short"?"Short":"Full reading")+'</span></span>\n'+
'  <span class="vid-content"><span class="vid-title">'+escape(title(v))+'</span><span class="vid-meta"><span>'+escape(date(v))+'</span><span class="vid-cta">Watch ↗</span></span></span>\n</a>';
let html=fs.readFileSync(htmlPath,"utf8");
function inject(name,body){
  const a="<!-- "+name+"_START -->",b="<!-- "+name+"_END -->";
  if(html.split(a).length!==2||html.split(b).length!==2)throw Error("Expected exactly one "+name+" marker pair");
  const start=html.indexOf(a)+a.length,end=html.indexOf(b);
  if(end<start)throw Error(name+" markers out of order");
  html=html.slice(0,start)+"\n"+body+"\n"+html.slice(end);
}
inject("HERO_VIDEO",hero);
inject("VIDEO_STATS",stats);
inject("START_PATHS",paths);
inject("VIDEO_CARDS",videos.map(card).join("\n"));
const original=fs.readFileSync(htmlPath,"utf8");
if(process.argv.includes("--check")){
  if(original!==html)throw Error("Generated HTML is stale. Run node scripts/render-videos.cjs");
  console.log("PASS: "+shorts.length+" Shorts and "+long.length+" full readings match the editorial homepage");
}else{
  if(html!==original)fs.writeFileSync(htmlPath,html);
  console.log("Rendered "+videos.length+" videos to editorial homepage");
}
