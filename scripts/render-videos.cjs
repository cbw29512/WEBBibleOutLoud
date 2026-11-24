#!/usr/bin/env node
"use strict";
// Render semantic HTML from the one authoritative, editable video catalog.
// This runs at Netlify build time; no API token or browser-side data fetch.
// Shorts stay in data/videos.json for the weekly routine, but are not rendered as cards.
// Section order comes from data/home-layout.json and card order from data/bible-order.json,
// so a new video or a reordered homepage never needs hand-edited HTML.
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const htmlPath = path.join(root, "site/index.html");
const {HOME_LAYOUT, SUPPORT_URL, BIBLE_BOOKS, isSleep, scriptureOrder, collections, bookPagePath} = require("./bible-order.cjs");
const dataset = JSON.parse(fs.readFileSync(path.join(root, "data/videos.json"),"utf8"));
const merch = JSON.parse(fs.readFileSync(path.join(root, "data/merch.json"),"utf8"));
// The homepage shows a short, hand-picked set of products with photos, not the whole catalog;
// the full line stays one click away behind merch.shopUrl.
if(!Array.isArray(merch.products) || merch.products.length<2 || merch.products.length>8) throw Error("Expected 2-8 featured merch products");
const SHOP_HOST="web-bible-out-loud.printify.me";
if(new URL(merch.shopUrl).hostname!==SHOP_HOST) throw Error("Invalid Printify shop URL: "+merch.shopUrl);
for(const product of merch.products){
  if(typeof product.name!=="string" || !product.name.trim() || product.name.length>180) throw Error("Invalid merch name");
  // The displayed name is the storefront title, optionally without the shop-name suffix the
  // storefront appends for SEO. Nothing about a product may be invented here.
  if(product.storefrontTitle!==product.name && product.storefrontTitle!==product.name+" | WEB Bible Out Loud")
    throw Error("Merch name must come from the storefront title: "+product.name);
  const shopUrl=new URL(product.url);
  if(shopUrl.protocol!=="https:" || shopUrl.hostname!==SHOP_HOST || !new RegExp("^/product/"+product.id+"(/[a-z0-9-]+)?$").test(shopUrl.pathname))
    throw Error("Invalid Printify product URL: "+product.url);
  for(const key of ["image","imageFallback"]){
    if(!/^assets\/merch\/[a-z0-9-]+\.(webp|jpg)$/.test(product[key]||"")) throw Error("Invalid merch image path: "+product[key]);
    if(!fs.existsSync(path.join(root,"site",product[key]))) throw Error("Missing merch image, run scripts/fetch-merch-images.py: "+product[key]);
  }
  if(!Number.isInteger(product.imageWidth) || !Number.isInteger(product.imageHeight))
    throw Error("Merch photos need width and height so the grid never shifts: "+product.name);
}
if(new Set(merch.products.map(p=>p.url)).size!==merch.products.length) throw Error("Duplicate featured merch product");
if(JSON.stringify(merch).toLowerCase().includes("buymeacoffee")) throw Error("Buy Me a Coffee must not appear in data/merch.json");
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
  if(!Number.isInteger(v.chapter)||v.chapter<1||v.chapter>150 ||
     !Number.isInteger(v.verse)||v.verse<1||v.verse>176)
    throw Error("Invalid Bible reference metadata for "+v.title);
  const titleMatchesBook = v.bibleBook === "Psalms"
    ? (v.title.startsWith("Psalms") || v.title.startsWith("Psalm "))
    : v.title.startsWith(v.bibleBook);
  if(!titleMatchesBook)throw Error("Bible book metadata does not match title: "+v.title);
  if(v.story && (v.type!=="short" || typeof v.story!=="string" || !v.story.trim()))
    throw Error("Only known short video story clips may carry a story field");
  return {...v,id,scriptureOrder:scriptureOrder(v)};
});
const shorts=videos.filter(v=>v.type==="short"),long=videos.filter(v=>v.type==="long");
const {build:buildBookPages}=require("./render-book-pages.cjs");
const {stories:passages,books,sleep}=collections(videos);
if(books.length+passages.length+sleep.length!==long.length)throw Error("Every long reading needs a book/passage scope");
if(books.some(v=>!/Full Book/i.test(v.title)) || passages.some(v=>/Full Book/i.test(v.title)))throw Error("Inaccurate full-book label in video catalog");
if(!shorts.length||!long.length)throw Error("Expected both Shorts and full-length videos in the catalog");
if(!books.length||!passages.length)throw Error("Expected published complete books and longer readings");
if(sleep.some(v=>!isSleep(v)))throw Error("For Sleep videos are identified by their public title");
// Greatest Stories Ever Told sits at the top of the page, so the hero features its first entry.
const featured=passages[0];
const escape=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const thumb=v=>"https://i.ytimg.com/vi/"+v.id+"/hqdefault.jpg";
const hero='<article class="feature" aria-label="Featured Bible reading">\n'+
'  <a class="feature-media" href="'+escape(featured.url)+'" target="_blank" rel="noopener noreferrer" aria-label="Watch '+escape(featured.title)+' on YouTube">\n'+
'    <img src="'+thumb(featured)+'" alt="'+escape(featured.title)+' video thumbnail" width="480" height="360" fetchpriority="high">\n'+
'    <span class="play-circle" aria-hidden="true">▶</span>\n'+
'  </a>\n'+
'  <div class="feature-info">\n'+
'    <p class="feature-label">Featured · Greatest stories ever told</p>\n'+
'    <h2 class="feature-title"><a href="'+escape(featured.url)+'" target="_blank" rel="noopener noreferrer">'+escape(featured.title)+'</a></h2>\n'+
'    <p class="feature-sub">World English Bible · Captions · No music</p>\n'+
'  </div>\n</article>';
const ogImage='<meta property="og:image" content="'+thumb(featured)+'">\n  '+
'<meta property="og:image:alt" content="'+escape(featured.title)+'">\n  '+
'<meta name="twitter:card" content="summary_large_image">';
// One line of whole-Bible progress instead of a tally of what is on the page. A book counts
// once it has any public whole-book recording — the read-along Full Book or the voice-only
// For Sleep reading — and a second recording of the same book does not count again. The total
// is the canon in data/bible-order.json, so neither number is written by hand.
const booksReadAloud=[...new Set(long.filter(v=>v.scope==="book").map(v=>v.bibleBook))];
if(booksReadAloud.length<1 || booksReadAloud.length>BIBLE_BOOKS.length) throw Error("Whole-Bible progress is outside the canon");
const canonSize=BIBLE_BOOKS.length;
const fillWidth=(booksReadAloud.length*100/canonSize).toFixed(2);
const stats='<div class="bible-progress">\n'+
'  <p class="bible-progress-label" id="bible-progress-label"><strong>'+booksReadAloud.length+'</strong> of <strong>'+canonSize+'</strong> books read aloud, word for word</p>\n'+
'  <div class="bible-progress-bar" role="progressbar" aria-valuenow="'+booksReadAloud.length+'" aria-valuemin="0" aria-valuemax="'+canonSize+'" aria-labelledby="bible-progress-label">\n'+
'    <span class="bible-progress-fill" style="width:'+fillWidth+'%"></span>\n'+
'  </div>\n</div>';
// Cards never show a posting date; the Bible book is the only metadata on a card.
const card=(v,kind)=>'<a class="vid" data-type="long" data-scope="'+kind+'" data-book="'+escape(v.bibleBook)+'" data-scripture-order="'+v.scriptureOrder+'" href="'+escape(kind==="book"?bookPagePath(v):v.url)+'"'+(kind==="book"?'':' target="_blank" rel="noopener noreferrer"')+'>\n'+
'  <span class="thumb"><img src="'+thumb(v)+'" alt="" loading="lazy" decoding="async" width="480" height="360"><span class="type-tag">'+(kind==="book"?"Complete book":kind==="sleep"?"For Sleep":"Story")+'</span></span>\n'+
'  <span class="vid-content"><span class="vid-title">'+escape(v.title)+'</span><span class="vid-meta"><span>'+escape(v.bibleBook)+'</span><span class="vid-cta">'+(kind==="book"?"Open →":"Watch ↗")+'</span></span></span>\n</a>';
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
  "itemListElement":books.map((v,i)=>({"@type":"ListItem","position":i+1,"name":v.title,"url":"https://webbibleoutloud.com"+bookPagePath(v)}))
};
const storiesSchema={
  "@context":"https://schema.org",
  "@type":"ItemList",
  "name":"Greatest Stories Ever Told on WEB Bible Out Loud",
  "numberOfItems":passages.length,
  "itemListElement":passages.map((v,i)=>({"@type":"ListItem","position":i+1,"name":v.title,"url":v.url}))
};
const sleepSchema={
  "@context":"https://schema.org",
  "@type":"ItemList",
  "name":"For Sleep readings on WEB Bible Out Loud",
  "numberOfItems":sleep.length,
  "itemListElement":sleep.map((v,i)=>({"@type":"ListItem","position":i+1,"name":v.title,"url":v.url}))
};
// Each card is the product's own storefront mockup: lazy, sized up front so nothing shifts,
// WebP first with a JPEG fallback, and alt text that is exactly the product name on the card.
const shopCards=merch.products.map(product=>
  '<a class="product" href="'+escape(product.url)+'" target="_blank" rel="noopener noreferrer" data-merch-id="'+escape(product.id)+'">'+
  '<span class="product-photo"><picture>'+
  '<source srcset="'+escape(product.image)+'" type="image/webp">'+
  '<img src="'+escape(product.imageFallback)+'" alt="'+escape(product.name)+'" loading="lazy" decoding="async" width="'+product.imageWidth+'" height="'+product.imageHeight+'">'+
  '</picture></span>'+
  '<span class="product-body">'+
  '<span class="product-name">'+escape(product.name)+'</span>'+
  '<span class="product-action">View product ↗</span></span></a>'
).join("\n        ");
const shopFooter='<p>'+escape(merch.shopFooterNote)+'</p>\n        '+
  '<a class="shop-cta" href="'+escape(merch.shopUrl)+'" target="_blank" rel="noopener noreferrer">'+escape(merch.shopLinkLabel)+'</a>';

const cardKind={stories:"passage",books:"book",sleep:"sleep"};
const collectionCards={stories:passages,books:books,sleep:sleep};
const sectionHead=s=>'      <div class="section-head">\n        <div>\n          <p class="section-kicker">'+escape(s.kicker)+'</p>\n'+
'          <h2 id="'+s.id+'-title">'+escape(s.heading)+'</h2>\n'+
'          <p class="section-desc">'+escape(s.description)+
  (s.descriptionLink?' <a href="'+escape(s.descriptionLink.href)+'">'+escape(s.descriptionLink.label)+'</a>':'')+'</p>\n'+
'        </div>\n      </div>';
const sectionClass={stories:"library-section section-pad",books:"library-section section-pad",sleep:"library-section section-pad sleep-band",shop:"shop section-pad",support:"support-band section-pad"};
function renderSection(s){
  const open='  <section id="'+s.id+'" class="'+sectionClass[s.id]+'" aria-labelledby="'+s.id+'-title" data-home-section="'+s.id+'">\n    <div class="wrap">\n';
  const close='    </div>\n  </section>';
  if(s.kind==="videos"){
    const list=collectionCards[s.collection];
    if(!list)throw Error("Unknown homepage collection: "+s.collection);
    return open+sectionHead(s)+'\n      <div id="'+s.collection+'-grid" class="video-grid" aria-label="'+escape(s.gridLabel)+'">\n'+
      list.map(v=>card(v,cardKind[s.collection])).join("\n")+'\n      </div>\n'+close;
  }
  if(s.kind==="shop"){
    return open+'      <div class="shop-head">\n        <p class="section-kicker">'+escape(s.kicker)+'</p>\n        <h2 id="shop-title">'+escape(s.heading)+'</h2>\n        <p class="section-desc">'+escape(s.description)+'</p>\n      </div>\n'+
      '      <div class="shop-grid">\n        '+shopCards+'\n      </div>\n'+
      '      <div class="shop-footer">\n        '+shopFooter+'\n      </div>\n'+close;
  }
  if(s.kind==="support"){
    return open+'      <div class="support-inner">\n        <p class="section-kicker">'+escape(s.kicker)+'</p>\n        <h2 id="support-title">'+escape(s.heading)+'</h2>\n        <p class="section-desc">'+escape(s.description)+'</p>\n'+
      '        <a class="support-cta" href="'+escape(SUPPORT_URL)+'" target="_blank" rel="noopener noreferrer">'+escape(s.linkLabel)+'</a>\n      </div>\n'+close;
  }
  throw Error("Unknown homepage section kind: "+s.kind);
}
const sectionIds=HOME_LAYOUT.sections.map(s=>s.id);
if(new Set(sectionIds).size!==sectionIds.length)throw Error("Duplicate homepage section id in data/home-layout.json");
for(const s of HOME_LAYOUT.sections) if(!sectionClass[s.id])throw Error("Unstyled homepage section: "+s.id);
inject("OG_IMAGE",ogImage);
inject("HERO_VIDEO",hero);
inject("VIDEO_STATS",stats);
inject("HOME_SECTIONS",HOME_LAYOUT.sections.map(renderSection).join("\n\n"));
inject("FULL_BOOKS_SCHEMA",'<script type="application/ld+json" id="full-books-schema">'+JSON.stringify(bookSchema)+"</script>");
inject("STORIES_SCHEMA",'<script type="application/ld+json" id="stories-schema">'+JSON.stringify(storiesSchema)+"</script>");
inject("FOR_SLEEP_SCHEMA",'<script type="application/ld+json" id="for-sleep-schema">'+JSON.stringify(sleepSchema)+"</script>");
if((html.match(/https:\/\/www\.youtube\.com\/@webbibleoutloud\/shorts/g)||[]).length!==1)
  throw Error("Expected exactly one Watch the Shorts on YouTube button URL");
if((html.match(new RegExp(SUPPORT_URL.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),"g"))||[]).length!==1)
  throw Error("Expected exactly one Buy Me a Coffee link on the homepage");
if(/youtube\.com\/shorts\/[A-Za-z0-9_-]{11}/.test(html))
  throw Error("Shorts must not be rendered as video cards");
if(html.includes('data-filter="short"') || html.includes('data-type="short"'))
  throw Error("Shorts cards or Shorts filters must not be rendered");
const original=fs.readFileSync(htmlPath,"utf8");
if(process.argv.includes("--check")){
  if(original!==html)throw Error("Generated HTML is stale. Run node scripts/render-videos.cjs");
  console.log("PASS: homepage sections "+sectionIds.join(" → ")+"; "+passages.length+" stories, "+books.length+" complete books, "+sleep.length+" For Sleep, "+merch.products.length+" merch items; "+shorts.length+" Shorts kept in the catalog and not rendered as cards");
}else{
  if(html!==original)fs.writeFileSync(htmlPath,html);
  const r=buildBookPages();
  console.log("Rendered "+r.pages.length+" book/sleep pages and sitemap.xml");
  console.log("Homepage sections: "+sectionIds.join(" → "));
  console.log("Rendered "+passages.length+" stories, "+books.length+" complete books and "+sleep.length+" For Sleep; "+shorts.length+" Shorts left in the catalog only");
}
