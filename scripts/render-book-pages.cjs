#!/usr/bin/env node
"use strict";
// One page per complete book (/books/<slug>/), a book index (/books/), and a For Sleep page (/sleep/).
// Built from data/videos.json (exact public titles) + data/books.json (our summaries and the published chapter markers).
// Called by render-videos.cjs at Netlify build time; also writes sitemap.xml. No API calls, no tokens.
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const site = path.join(root, "site");
const HOME = "https://webbibleoutloud.com/";
const FULL_BOOKS_PLAYLIST = "https://www.youtube.com/playlist?list=PLVdofbBWuaIo";
const {isSleep, collections, slugOf} = require("./bible-order.cjs");
const esc = s => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const idOf = v => new URL(v.url).pathname.split("/").pop();
const hms = s => { const h = Math.floor(s/3600), m = Math.floor(s/60)%60, x = s%60; return (h ? h+":"+String(m).padStart(2,"0") : m)+":"+String(x).padStart(2,"0"); };
const iso = s => "PT"+(Math.floor(s/3600)?Math.floor(s/3600)+"H":"")+(Math.floor(s/60)%60)+"M"+(s%60)+"S";
function build(){
  const catalog = JSON.parse(fs.readFileSync(path.join(root, "data/videos.json"), "utf8")).videos;
  const meta = JSON.parse(fs.readFileSync(path.join(root, "data/books.json"), "utf8")).books;
  // /books/ and /sleep/ use the same Bible ordering as the homepage sections.
  const {books: fullBooks, sleep} = collections(catalog);
  const pages = [];
  const header = '<a class="skip" href="#main">Skip to content</a>\n<header class="site-header">\n  <div class="wrap header-inner">\n    <a class="brand" href="/">\n      <span class="brand-mark" aria-hidden="true">W</span>\n      <span><span class="brand-title">Bible Out Loud</span><span class="brand-kicker">World English Bible</span></span>\n    </a>\n    <nav class="site-nav" aria-label="Main navigation">\n      <a href="/#stories">Stories</a>\n      <a href="/books/">Books</a>\n      <a href="/sleep/">For Sleep</a>\n      <a class="nav-shop" href="/#shop">Shop</a>\n    </nav>\n  </div>\n</header>';
  const footer = '<footer class="site-footer">\n  <div class="wrap footer-inner">\n    <div><p class="footer-name">WEB Bible Out Loud</p><p class="footer-copy">The World English Bible, read with clarity. © 2026.</p></div>\n    <nav class="footer-links" aria-label="Footer navigation">\n      <a href="/">Home</a>\n      <a href="/books/">Complete books</a>\n      <a href="/sleep/">For Sleep</a>\n      <a href="https://www.youtube.com/@WEBBibleOutLoud" target="_blank" rel="noopener noreferrer">YouTube</a>\n      <a href="/privacy.html">Privacy</a>\n    </nav>\n  </div>\n</footer>';
  const head = (title, desc, canonical, extra, up) => '<!doctype html>\n<html lang="en">\n<head>\n  <meta charset="utf-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n  <meta name="theme-color" content="#10191d">\n  <title>'+esc(title)+'</title>\n  <meta name="description" content="'+esc(desc)+'">\n  <link rel="canonical" href="'+canonical+'">\n  <link rel="stylesheet" href="'+up+'styles.css">\n  <link rel="icon" href="'+up+'favicon.svg" type="image/svg+xml">\n  <meta property="og:type" content="website">\n  <meta property="og:title" content="'+esc(title)+'">\n  <meta property="og:description" content="'+esc(desc)+'">\n  <meta property="og:url" content="'+canonical+'">\n'+(extra||"")+'  <meta name="robots" content="index,follow">\n  <script data-goatcounter="https://chrisgrowth-webbible.goatcounter.com/count" async src="https://gc.zgo.at/count.js"></script>\n  <script src="'+up+'embed.js" defer></script>\n</head>\n<body>\n';
  const player = (v, label) => '<div class="lite-yt" data-id="'+idOf(v)+'" data-title="'+esc(v.title)+'">\n  <img src="https://i.ytimg.com/vi/'+idOf(v)+'/hqdefault.jpg" alt="" width="480" height="360" fetchpriority="high">\n  <button type="button" class="lite-play" aria-label="Play '+esc(label)+' here (loads YouTube)"><span aria-hidden="true">▶</span></button>\n</div>\n<p class="lite-note">Press play to load the video from YouTube (privacy-enhanced mode). Or <a href="'+esc(v.url)+'" target="_blank" rel="noopener noreferrer">watch on YouTube ↗</a>.</p>';
  const write = (rel, html) => { const p = path.join(site, rel); fs.mkdirSync(path.dirname(p), {recursive:true}); fs.writeFileSync(p, html); pages.push(rel.replace(/index\.html$/, "")); };
  const metaBy = Object.fromEntries(meta.map(m => [m.bibleBook, m]));
  const slug = slugOf;
  fullBooks.forEach((v, i) => {
    const m = metaBy[v.bibleBook]; if(!m) throw Error("data/books.json missing "+v.bibleBook);
    if(m.videoId !== idOf(v)) throw Error("data/books.json video ID differs from catalog for "+v.bibleBook);
    const b = v.bibleBook, url = HOME+"books/"+slug(b)+"/";
    const prev = fullBooks[i-1], next = fullBooks[i+1];
    const sl = sleep.find(s => s.bibleBook === b);
    const desc = "Listen to the whole book of "+b+" read aloud, word for word from the World English Bible, with captions and no music. "+m.summary.split(". ")[0].replace(/\.$/, "")+".";
    const ld = {"@context":"https://schema.org","@type":"VideoObject","name":v.title,"description":"The whole book of "+b+" read aloud from the World English Bible (public domain), word for word, with captions and no music. Summary (not scripture): "+m.summary,
      "thumbnailUrl":["https://i.ytimg.com/vi/"+m.videoId+"/hqdefault.jpg"],"uploadDate":v.publishedAt,"contentUrl":"https://www.youtube.com/watch?v="+m.videoId,"embedUrl":"https://www.youtube-nocookie.com/embed/"+m.videoId,
      ...(m.durationSeconds ? {"duration": iso(m.durationSeconds)} : {}), "inLanguage":"en","isFamilyFriendly":true,
      "hasPart": m.chapters.length >= 3 ? m.chapters.map(c => ({"@type":"Clip","name":c.label,"startOffset":c.t,"url":"https://www.youtube.com/watch?v="+m.videoId+"&t="+c.t})) : undefined};
    const crumbs = {"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Home","item":HOME},{"@type":"ListItem","position":2,"name":"Complete books","item":HOME+"books/"},{"@type":"ListItem","position":3,"name":b,"item":url}]};
    const extra = '  <meta property="og:image" content="https://i.ytimg.com/vi/'+m.videoId+'/hqdefault.jpg">\n  <meta name="twitter:card" content="summary_large_image">\n  <script type="application/ld+json">'+JSON.stringify(ld)+'</script>\n  <script type="application/ld+json">'+JSON.stringify(crumbs)+'</script>\n';
    const chapterList = m.chapters.length >= 3 ? '<h2 id="chapters-title">Jump to a chapter</h2>\n<ol class="chapter-list" aria-labelledby="chapters-title">\n'+m.chapters.map(c => '  <li><a href="https://youtu.be/'+m.videoId+'?t='+c.t+'" target="_blank" rel="noopener noreferrer">'+esc(c.label)+' <span>'+hms(c.t)+'</span></a></li>').join("\n")+'\n</ol>' : "";
    const html = head(b+" Full Book Audio Bible — World English Bible, No Music | WEB Bible Out Loud", desc, url, extra, "../../")+header+'\n<main id="main" class="book-page">\n  <div class="wrap">\n    <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> › <a href="/books/">Complete books</a> › <span aria-current="page">'+esc(b)+'</span></nav>\n'+
      '    <p class="section-kicker">Complete book · World English Bible</p>\n    <h1>The Book of '+esc(b)+' — Full Book Audio Bible</h1>\n    <p class="book-sub">Every verse of '+esc(b)+', read word for word from the World English Bible, with the words on screen, captions, and no music.</p>\n'+
      player(v, b+" full book")+'\n    <p class="book-yt-title">On YouTube: <strong>'+esc(v.title)+'</strong></p>\n    <p class="book-summary"><strong>Summary (not scripture):</strong> '+esc(m.summary)+'</p>\n'+
      (sl ? '    <p class="book-sleep">Want to fall asleep to it? <a href="'+esc(sl.url)+'" target="_blank" rel="noopener noreferrer">'+esc(sl.title)+' ↗</a> (voice only, black screen).</p>\n' : "")+
      chapterList+'\n    <nav class="book-nav" aria-label="Other complete books">\n'+(prev ? '      <a class="book-prev" href="/books/'+slug(prev.bibleBook)+'/">← '+esc(prev.bibleBook)+'</a>\n' : '')+'      <a href="/books/">All complete books</a>\n'+(next ? '      <a class="book-next" href="/books/'+slug(next.bibleBook)+'/">'+esc(next.bibleBook)+' →</a>\n' : '')+'    </nav>\n'+
      '    <p class="book-more"><a href="'+FULL_BOOKS_PLAYLIST+'" target="_blank" rel="noopener noreferrer">Every full book, in Bible order (YouTube playlist) ↗</a></p>\n    <p class="book-source">Scripture: World English Bible (WEB), public domain, read word for word and unchanged. Voice: AI-generated (text-to-speech). Chapter names and summaries are ours (not scripture).</p>\n  </div>\n</main>\n'+footer+'\n</body>\n</html>\n';
    write("books/"+slug(b)+"/index.html", html);
  });
  const card = (v, href, tag, ext) => '<a class="vid" href="'+esc(href)+'"'+(ext?' target="_blank" rel="noopener noreferrer"':'')+'>\n  <span class="thumb"><img src="https://i.ytimg.com/vi/'+idOf(v)+'/hqdefault.jpg" alt="" loading="lazy" decoding="async" width="480" height="360"><span class="type-tag">'+tag+'</span></span>\n  <span class="vid-content"><span class="vid-title">'+esc(v.title)+'</span><span class="vid-meta"><span>'+esc(v.bibleBook)+'</span><span class="vid-cta">'+(ext?"Watch ↗":"Open →")+'</span></span></span>\n</a>';
  const listLd = (name, items) => '  <script type="application/ld+json">'+JSON.stringify({"@context":"https://schema.org","@type":"ItemList","name":name,"numberOfItems":items.length,"itemListElement":items.map((x,i)=>({"@type":"ListItem","position":i+1,"name":x[0],"url":x[1]}))})+'</script>\n';
  write("books/index.html", head("Complete Books of the Bible Read Aloud — World English Bible, No Music | WEB Bible Out Loud", "Whole books of the Bible read aloud word for word from the World English Bible, in Bible order, with captions and no music.", HOME+"books/", listLd("Complete books on WEB Bible Out Loud", fullBooks.map(v=>[v.title, HOME+"books/"+slug(v.bibleBook)+"/"])), "../")+header+
    '\n<main id="main" class="library-section section-pad">\n  <div class="wrap">\n    <div class="section-head"><div>\n      <p class="section-kicker">Complete books</p>\n      <h1 class="page-h1">Whole books of the Bible, read aloud in Bible order.</h1>\n      <p class="section-desc">Each page has the full reading, a short summary, and chapter links. Every word is the World English Bible, with no music.</p>\n    </div></div>\n    <div id="book-pages-grid" class="video-grid">\n'+fullBooks.map(v => card(v, "/books/"+slug(v.bibleBook)+"/", "Complete book", false)).join("\n")+'\n    </div>\n    <p class="book-more"><a href="/sleep/">Voice-only For Sleep versions →</a></p>\n  </div>\n</main>\n'+footer+'\n</body>\n</html>\n');
  write("sleep/index.html", head("Bible for Sleep — Whole Books, Voice Only, Black Screen, No Music | WEB Bible Out Loud", "Fall asleep to whole books of the Bible: the World English Bible read aloud word for word, voice only, on a black screen, with no music.", HOME+"sleep/", listLd("For Sleep on WEB Bible Out Loud", sleep.map(v=>[v.title, v.url])), "../")+header+
    '\n<main id="main" class="library-section section-pad sleep-page">\n  <div class="wrap">\n    <div class="section-head"><div>\n      <p class="section-kicker">For Sleep</p>\n      <h1 class="page-h1">Whole books of the Bible, voice only, for sleep.</h1>\n      <p class="section-desc">After a short title card the screen stays black. A calm voice reads every word of the World English Bible, with no music. Want the words on screen? Each one has a read-along complete book too.</p>\n    </div></div>\n    <div id="sleep-grid" class="video-grid">\n'+sleep.map(v => card(v, v.url, "For Sleep", true)).join("\n")+'\n    </div>\n    <p class="book-more"><a href="/books/">Read-along complete books →</a></p>\n  </div>\n</main>\n'+footer+'\n</body>\n</html>\n');
  const urls = [HOME, HOME+"privacy.html"].concat(pages.map(p => HOME+p));
  fs.writeFileSync(path.join(site, "sitemap.xml"), '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+urls.map(u => '  <url><loc>'+u+'</loc></url>').join("\n")+'\n</urlset>\n');
  return {fullBooks, sleep, pages};
}
module.exports = {build};
if(require.main === module){ const r = build(); console.log("Rendered "+r.pages.length+" pages ("+r.fullBooks.length+" book pages, "+r.sleep.length+" For Sleep)"); }
