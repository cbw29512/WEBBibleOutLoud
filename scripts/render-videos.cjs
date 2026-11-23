#!/usr/bin/env node
"use strict";
// Render semantic HTML from the one authoritative, editable video catalog.
// This runs at Netlify build time; no API token or browser-side data fetch.
// Shorts stay in data/videos.json for the weekly routine, but are not rendered as cards.
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const htmlPath = path.join(root, "site/index.html");
const dataset = JSON.parse(fs.readFileSync(path.join(root, "data/videos.json"),"utf8"));
const merch = JSON.parse(fs.readFileSync(path.join(root, "data/merch.json"),"utf8"));
if(!Array.isArray(merch.products) || merch.products.length<1 || merch.products.length>80) throw Error("Expected 1-80 published merch products");
for(const product of merch.products){
  if(typeof product.name!=="string" || !product.name.trim() || product.name.length>180) throw Error("Invalid merch name");
  const shopUrl=new URL(product.url);
  if(shopUrl.protocol!=="https:" || shopUrl.hostname!=="web-bible-out-loud.printify.me" || !/^\/product\/\d+$/.test(shopUrl.pathname))
    throw Error("Invalid Printify product URL: "+product.url);
}
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
  const titleMatchesBook = v.bibleBook === "Psalms"
    ? (v.title.startsWith("Psalms") || v.title.startsWith("Psalm "))
    : v.title.startsWith(v.bibleBook);
  if(!titleMatchesBook)throw Error("Bible book metadata does not match title: "+v.title);
  if(v.story && (v.type!=="short" || typeof v.story!=="string" || !v.story.trim()))
    throw Error("Only known short video story clips may carry a story field");
  return {...v,id,scriptureOrder:(bookIndex+1)*1000000+v.chapter*1000+v.verse};
}).sort((a,b)=>a.scriptureOrder-b.scriptureOrder ||
  (a.scope==="book"?0:a.scope==="passage"?1:2) -
  (b.scope==="book"?0:b.scope==="passage"?1:2) ||
  a.publishedAt.localeCompare(b.publishedAt));
const shorts=videos.filter(v=>v.type==="short"),long=videos.filter(v=>v.type==="long");
const books=long.filter(v=>v.scope==="book"),passages=long.filter(v=>v.scope==="passage");
if(books.length+passages.length!==long.length)throw Error("Every long reading needs a book/passage scope");
if(books.some(v=>!/Full Book/i.test(v.title)) || passages.some(v=>/Full Book/i.test(v.title)))throw Error("Inaccurate full-book label in video catalog");
if(!shorts.length||!long.length)throw Error("Expected both Shorts and full-length videos in the catalog");
if(!books.length||!passages.length)throw Error("Expected published complete books and longer readings");
const featured=books.find(v=>/^John 1.21/i.test(v.title))||books[0];
const escape=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const thumb=v=>"https://i.ytimg.com/vi/"+v.id+"/hqdefault.jpg";
const date=v=>new Date(v.publishedAt).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric",timeZone:"UTC"});
const hero='<article class="feature" aria-label="Featured full-length Bible reading">\n'+
'  <a class="feature-media" href="'+escape(featured.url)+'" target="_blank" rel="noopener noreferrer" aria-label="Watch '+escape(featured.title)+' on YouTube">\n'+
'    <img src="'+thumb(featured)+'" alt="'+escape(featured.title)+' video thumbnail" width="480" height="360" fetchpriority="high">\n'+
'    <span class="play-circle" aria-hidden="true">▶</span>\n'+
'  </a>\n'+
'  <div class="feature-info">\n'+
'    <p class="feature-label">Featured · Full book reading</p>\n'+
'    <h2 class="feature-title"><a href="'+escape(featured.url)+'" target="_blank" rel="noopener noreferrer">'+escape(featured.title)+'</a></h2>\n'+
'    <p class="feature-sub">World English Bible · Captions · No music</p>\n'+
'  </div>\n</article>';
const stats='<div class="metrics" aria-label="What is on this page"><div class="metric"><strong>'+passages.length+'</strong> stories</div><div class="metric"><strong>'+books.length+'</strong> complete books</div><div class="metric"><strong>'+merch.products.length+'</strong> shop items</div></div>';
const card=(v,kind)=>'<a class="vid" data-type="long" data-scope="'+kind+'" data-book="'+escape(v.bibleBook)+'" data-scripture-order="'+v.scriptureOrder+'" href="'+escape(v.url)+'" target="_blank" rel="noopener noreferrer">\n'+
'  <span class="thumb"><img src="'+thumb(v)+'" alt="" loading="lazy" decoding="async" width="480" height="360"><span class="type-tag">'+(kind==="book"?"Complete book":"Story")+'</span></span>\n'+
'  <span class="vid-content"><span class="vid-title">'+escape(v.title)+'</span><span class="vid-meta"><span>'+escape(date(v))+'</span><span class="vid-cta">Watch ↗</span></span></span>\n</a>';
let html=fs.readFileSync(htmlPath,"utf8");
function inject(name,body){
  const a="<!-- "+name+"_START -->",b="<!-- "+name+"_END -->";
  if(html.split(a).length!==2||html.split(b).length!==2)throw Error("Expected exactly one "+name+" marker pair");
  const start=html.indexOf(a)+a.length,end=html.indexOf(b);
  if(end<start)throw Error(name+" markers out of order");
  html=html.slice(0,start)+"\n"+body+"\n"+html.slice(end);
}
const bookSchema={
  "@context":"https://schema.org",
  "@type":"ItemList",
  "name":"Complete World English Bible books available on WEB Bible Out Loud",
  "numberOfItems":books.length,
  "itemListElement":books.map((v,i)=>({"@type":"ListItem","position":i+1,"name":v.title,"url":v.url}))
};
const storiesSchema={
  "@context":"https://schema.org",
  "@type":"ItemList",
  "name":"Longer World English Bible readings available on WEB Bible Out Loud",
  "numberOfItems":passages.length,
  "itemListElement":passages.map((v,i)=>({"@type":"ListItem","position":i+1,"name":v.title,"url":v.url}))
};
const shopCards=merch.products.map(product=>
  '<a class="product" href="'+escape(product.url)+'" target="_blank" rel="noopener noreferrer">'+
  '<span class="product-mark" aria-hidden="true">✦</span>'+
  '<span class="product-name">'+escape(product.name)+'</span>'+
  '<span class="product-action">View product ↗</span></a>'
).join("\n        ");
const shopFooter='<p>'+merch.products.length+' '+(merch.products.length===1?"item":"items")+' from the Printify shop. Each product opens its own Printify page.</p>\n        <a href="'+escape(merch.shopUrl)+'" target="_blank" rel="noopener noreferrer">Visit the full shop ↗</a>';
inject("HERO_VIDEO",hero);
inject("VIDEO_STATS",stats);
inject("STORIES",passages.map(v=>card(v,"passage")).join("\n"));
inject("FULL_BOOKS",books.map(v=>card(v,"book")).join("\n"));
inject("FULL_BOOKS_SCHEMA",'<script type="application/ld+json" id="full-books-schema">'+JSON.stringify(bookSchema)+"</script>");
inject("STORIES_SCHEMA",'<script type="application/ld+json" id="stories-schema">'+JSON.stringify(storiesSchema)+"</script>");
inject("SHOP_PRODUCTS",shopCards);
inject("SHOP_FOOTER",shopFooter);
if((html.match(/https:\/\/www\.youtube\.com\/@webbibleoutloud\/shorts/g)||[]).length!==1)
  throw Error("Expected exactly one Watch the Shorts on YouTube button URL");
if(/youtube\.com\/shorts\/[A-Za-z0-9_-]{11}/.test(html))
  throw Error("Shorts must not be rendered as video cards");
if(html.includes('data-filter="short"') || html.includes('data-type="short"'))
  throw Error("Shorts cards or Shorts filters must not be rendered");
const original=fs.readFileSync(htmlPath,"utf8");
if(process.argv.includes("--check")){
  if(original!==html)throw Error("Generated HTML is stale. Run node scripts/render-videos.cjs");
  console.log("PASS: "+passages.length+" stories, "+books.length+" complete books, "+merch.products.length+" merch items; "+shorts.length+" Shorts kept in the catalog and not rendered as cards");
}else{
  if(html!==original)fs.writeFileSync(htmlPath,html);
  console.log("Rendered "+passages.length+" stories and "+books.length+" complete books; "+shorts.length+" Shorts left in the catalog only");
}
