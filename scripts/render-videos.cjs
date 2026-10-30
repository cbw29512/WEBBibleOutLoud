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
const canonicalBooks=["Genesis","Exodus","Leviticus","Numbers","Deuteronomy","Joshua","Judges","Ruth","1 Samuel","2 Samuel","1 Kings","2 Kings","1 Chronicles","2 Chronicles","Ezra","Nehemiah","Esther","Job","Psalms","Proverbs","Ecclesiastes","Song of Solomon","Isaiah","Jeremiah","Lamentations","Ezekiel","Daniel","Hosea","Joel","Amos","Obadiah","Jonah","Micah","Nahum","Habakkuk","Zephaniah","Haggai","Zechariah","Malachi","Matthew","Mark","Luke","John","Acts","Romans","1 Corinthians","2 Corinthians","Galatians","Ephesians","Philippians","Colossians","1 Thessalonians","2 Thessalonians","1 Timothy","2 Timothy","Titus","Philemon","Hebrews","James","1 Peter","2 Peter","1 John","2 John","3 John","Jude","Revelation"];
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
  const bookIndex=canonicalBooks.indexOf(v.bibleBook);
  if(bookIndex<0 || !Number.isInteger(v.chapter)||v.chapter<1||v.chapter>150 ||
     !Number.isInteger(v.verse)||v.verse<1||v.verse>176)
    throw Error("Invalid Bible reference metadata for "+v.title);
  if(!v.title.startsWith(v.bibleBook))throw Error("Bible book metadata does not match title: "+v.title);
  if(v.story && (v.type!=="short" || typeof v.story!=="string" || !v.story.trim()))
    throw Error("Only known short video story clips may enter the greatest-stories collection");
  return {...v,id,scriptureOrder:(bookIndex+1)*1000000+v.chapter*1000+v.verse};

}).sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt));
const shorts=videos.filter(v=>v.type==="short"),long=videos.filter(v=>v.type==="long");
const books=long.filter(v=>v.scope==="book"),passages=long.filter(v=>v.scope==="passage");
if(books.length+passages.length!==long.length)throw Error("Every long reading needs a book/passage scope");
if(books.some(v=>!/Full Book/i.test(v.title)) || passages.some(v=>/Full Book/i.test(v.title)))throw Error("Inaccurate full-book label in video catalog");
if(!shorts.length||!long.length)throw Error("Expected both Shorts and full-length videos");
const featured=books.find(v=>/^John 1.21/i.test(v.title))||books[0];
const storyClips=videos.filter(v=>Boolean(v.story));
const escape=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const title=v=>v.title.split("|")[0].trim();
const thumb=v=>"https://i.ytimg.com/vi/"+v.id+"/hqdefault.jpg";
const date=v=>new Date(v.publishedAt).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric",timeZone:"UTC"});
/* Story collections derive from the same published video records as regular cards.
   Sorting uses the canonical book/chapter/verse key, never publication date. */
const storyCollections=[...storyClips.reduce((map,video)=>{
  if(!map.has(video.story))map.set(video.story,[]);
  map.get(video.story).push(video);
  return map;
},new Map())].map(([name,clips])=>({
  name,clips:clips.sort((a,b)=>a.scriptureOrder-b.scriptureOrder||a.publishedAt.localeCompare(b.publishedAt))
})).sort((a,b)=>a.clips[0].scriptureOrder-b.clips[0].scriptureOrder);
const storySection=(story,index)=>{
  const first=story.clips[0];
  const parts=story.clips.map((video,position)=>
    '    <li><a class="story-clip-link" href="'+escape(video.url)+'" target="_blank" rel="noopener noreferrer">'+
    '<span class="story-part-label">Part '+(position+1)+' of '+story.clips.length+'</span>'+
    '<span class="story-part-title">'+escape(title(video))+'</span>'+
    '<span class="story-part-action">Watch on YouTube ↗</span></a></li>').join("\n");
  const search=(story.name+" "+story.clips.map(v=>v.title).join(" ")).toLocaleLowerCase();
  return '<section class="story-collection" aria-labelledby="story-title-'+(index+1)+'" data-story-search="'+escape(search)+'">\n'+
    '  <div class="story-collection-head"><span class="story-number">Story '+(index+1)+'</span>'+
    '<h3 id="story-title-'+(index+1)+'">'+escape(story.name)+'</h3>'+
    '<p class="story-reference">Starts at '+escape(first.bibleBook)+' '+first.chapter+':'+first.verse+
    ' · '+story.clips.length+' '+(story.clips.length===1?'clip':'clips')+' available</p></div>\n'+
    '  <ol class="story-clip-list">\n'+parts+'\n  </ol>\n</section>';
};
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
const stats='<div class="metrics" aria-label="Video library overview"><div class="metric"><strong>'+videos.length+'</strong> videos</div><div class="metric"><strong>'+shorts.length+'</strong> Shorts</div><div class="metric"><strong>'+books.length+'</strong> complete books</div><div class="metric"><strong>'+passages.length+'</strong> longer passages</div></div>';
const pathCard=(v,label,action)=>'<a class="path-card" href="'+escape(v.url)+'" target="_blank" rel="noopener noreferrer">\n'+
'  <img class="path-thumb" src="'+thumb(v)+'" alt="" width="112" height="84" loading="lazy">\n'+
'  <span><span class="path-eyebrow">'+label+'</span><span class="path-name">'+escape(title(v))+'</span><span class="path-action">'+action+' ↗</span></span>\n</a>';
const paths=pathCard(shorts[0],"Latest short · Listen in minutes","Watch the latest Short")+
  pathCard(featured,"Featured complete book · Take your time","Start listening");
const card=v=>'<a class="vid" data-type="'+v.type+'" data-scope="'+(v.scope||"")+'" data-book="'+escape(v.bibleBook)+'" data-scripture-order="'+v.scriptureOrder+'" data-published="'+Date.parse(v.publishedAt)+'" data-story="'+(v.story?"yes":"no")+'" data-search="'+escape((v.title+" "+(v.story||"")).toLocaleLowerCase())+'" href="'+escape(v.url)+'" target="_blank" rel="noopener noreferrer">\n'+
'  <span class="thumb"><img src="'+thumb(v)+'" alt="" loading="lazy" decoding="async" width="480" height="360"><span class="type-tag">'+(v.type==="short"?"Short":v.scope==="book"?"Complete book":"Chapter reading")+'</span></span>\n'+
'  <span class="vid-content"><span class="vid-title">'+escape(title(v))+'</span>'+(v.story?'<span class="vid-story">'+escape(v.story)+'</span>':'')+'<span class="vid-meta"><span>'+escape(date(v))+'</span><span class="vid-cta">Watch ↗</span></span></span>\n</a>';
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
inject("STORY_COLLECTIONS",storyCollections.map(storySection).join("\n"));
const original=fs.readFileSync(htmlPath,"utf8");
if(process.argv.includes("--check")){
  if(original!==html)throw Error("Generated HTML is stale. Run node scripts/render-videos.cjs");
  console.log("PASS: "+shorts.length+" Shorts, "+books.length+" ordered complete books, "+passages.length+" longer passages and "+storyClips.length+" story clips");
}else{
  if(html!==original)fs.writeFileSync(htmlPath,html);
  console.log("Rendered "+videos.length+" videos; "+books.length+" complete books and "+passages.length+" chapter readings");
}
