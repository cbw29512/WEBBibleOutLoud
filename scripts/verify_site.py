#!/usr/bin/env python3
"""Protect site links, privacy, generated video cards and Netlify deployment settings."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse
import json
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "site"
HOME = "https://webbibleoutloud.netlify.app/"
SUPPORT = "https://buymeacoffee.com/divclass016"

class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []
        self.images = []
        self.scripts = []
        self.canonicals = []
        self.videos = []
    def handle_starttag(self, tag, attrs):
        d = dict(attrs)
        if tag == "a" and d.get("href"):
            self.links.append(d["href"])
            if "vid" in d.get("class", "").split():
                self.videos.append(d["href"])
        if tag == "img" and d.get("src"):
            self.images.append(d["src"])
        if tag == "script" and d.get("src"):
            self.scripts.append(d["src"])
        if tag == "link" and d.get("rel") == "canonical":
            self.canonicals.append(d["href"])

html = (SITE / "index.html").read_text(encoding="utf-8")
privacy = (SITE / "privacy.html").read_text(encoding="utf-8")
headers = (SITE / "_headers").read_text(encoding="utf-8")
robots = (SITE / "robots.txt").read_text(encoding="utf-8")
sitemap = (SITE / "sitemap.xml").read_text(encoding="utf-8")
config = (ROOT / "netlify.toml").read_text(encoding="utf-8")
data = json.loads((ROOT / "data/videos.json").read_text(encoding="utf-8"))
merch = json.loads((ROOT / "data/merch.json").read_text(encoding="utf-8"))
page = Page()
page.feed(html)
errors = []
def verify(condition, issue):
    if not condition:
        errors.append(issue)

verify('id="hero-title">Scripture,' in html and 'class="brand-title">Bible Out Loud' in html, "missing site heading or branding")
verify(page.canonicals == [HOME], "incorrect canonical homepage")
verify('name="description"' in html and 'property="og:image"' in html and 'name="twitter:card"' in html,
       "SEO metadata or social preview missing")
verify('id="full-books-schema"' in html, "full-book structured data missing")
verify('href="favicon.svg"' in html and (SITE/"favicon.svg").exists(), "favicon missing")
verify('<a class="brand" href="/">' in html, "brand link should use its visible text for accessibility")
verify(len(page.videos) == len(data["videos"]) >= 1, "video cards do not match the JSON list")
shorts = sorted([x for x in data["videos"] if x["type"] == "short"], key=lambda x: x["publishedAt"], reverse=True)
readings = sorted([x for x in data["videos"] if x["type"] == "long"], key=lambda x: x["publishedAt"], reverse=True)
featured_count = data.get("featuredShorts", 12)
verify(set(page.videos) == {x["url"] for x in data["videos"]}, "video URLs differ from JSON")
ranks = [int(n) for n in re.findall(r'data-scripture-order="(\d+)"', html)]
verify(len(ranks) == len(page.videos) and ranks == sorted(ranks), "All Videos must follow Bible order")
verify(len(page.images) == len(data["videos"]) + 3, "missing library, hero or featured thumbnail")
verify(len(set(page.videos)) == len(page.videos), "duplicate video cards")
books=[x for x in readings if x.get("scope")=="book"]
passages=[x for x in readings if x.get("scope")=="passage"]
verify(len(books)>=1 and all("Full Book" in x["title"] for x in books), "full books must have all chapters")
verify(len(passages)>=1 and all("Full Book" not in x["title"] for x in passages), "chapter readings mislabeled as books")
verify(html.count('data-scope="book"')==len(books) and html.count('data-scope="passage"')==len(passages), "wrong on-page category labels")
verify(len(shorts)+len(readings)==len(data["videos"])==len(page.videos),
       "video cards must match the published catalog")
verify('id="video-search"' in html and 'id="video-grid"' in html, "searchable library markup missing")
verify('id="load-more"' in html and 'data-filter="book"' in html and 'data-filter="passage"' in html,
       "separate full-book and longer-passage filters missing")
verify('data-filter="stories"' in html and 'id="stories-help"' in html, "Bible stories tab or description missing")
verify('id="book-picker"' not in html and 'BOOK_OPTIONS_START' not in html, "redundant full-book dropdown must stay removed")
verify('id="sort-label"' in html, "sorting status text missing")

verify(all(page.links.count("?view=" + view + "#library") == 1
           for view in ("book", "short", "stories")),
       "missing direct, shareable library collection links")
verify('class="quick-browse"' in html and 'aria-label="Browse Bible recordings by collection"' in html,
       "accessible category navigation is missing")
schema_match = re.search(r'<script type="application/ld[+]json" id="full-books-schema">([^<]+)</script>', html)
try:
    book_schema = json.loads(schema_match.group(1)) if schema_match else {}
except (ValueError, AttributeError) as exc:
    print(f"Full-book JSON-LD could not be parsed: {exc}", file=sys.stderr)
    book_schema = {}
schema_entries = book_schema.get("itemListElement", [])
canonical_book_order=["Genesis","Exodus","Leviticus","Numbers","Deuteronomy","Joshua","Judges","Ruth","1 Samuel","2 Samuel","1 Kings","2 Kings","1 Chronicles","2 Chronicles","Ezra","Nehemiah","Esther","Job","Psalms","Proverbs","Ecclesiastes","Song of Solomon","Isaiah","Jeremiah","Lamentations","Ezekiel","Daniel","Hosea","Joel","Amos","Obadiah","Jonah","Micah","Nahum","Habakkuk","Zephaniah","Haggai","Zechariah","Malachi","Matthew","Mark","Luke","John","Acts","Romans","1 Corinthians","2 Corinthians","Galatians","Ephesians","Philippians","Colossians","1 Thessalonians","2 Thessalonians","1 Timothy","2 Timothy","Titus","Philemon","Hebrews","James","1 Peter","2 Peter","1 John","2 John","3 John","Jude","Revelation"]
verify([x.get("name") for x in schema_entries] ==
       [x["title"].split("|")[0].strip() for x in sorted(books, key=lambda b: canonical_book_order.index(b["bibleBook"]))],
       "SEO full-book list must be in canonical Bible order")
verify(book_schema.get("numberOfItems")==len(books)==len(schema_entries), "SEO book count must match the catalog")
verify([x.get("position") for x in schema_entries] == list(range(1, len(schema_entries) + 1)),
       "SEO book list positions must be consecutive")

story_clips=[v for v in data["videos"] if v.get("story")]
story_names=set(v["story"] for v in story_clips)
verify(len(story_clips)>=1 and len(story_names)>=1, "greatest stories curated catalog is empty")
verify(html.count('data-story="yes"')==len(story_clips), "curated story clips not rendered")
verify(html.count('class="story-collection"')==len(story_names) and html.count('class="story-clip-link"')==len(story_clips), "incorrect story/clip collection totals")
verify('<!-- STORY_COLLECTIONS_START -->' in html and '<!-- STORY_COLLECTIONS_END -->' in html, "story markers missing")
verify(html.count('data-book="John"')>=62, "missing canonical book attributes on Shorts")
verify(html.count('data-scripture-order="')==len(data["videos"]), "missing Bible reference ordering for videos")
verify('<!-- HERO_VIDEO_START -->' in html and '<!-- START_PATHS_START -->' in html, "generated hero missing")
verify('href="styles.css"' in html and 'src="library.js"' in html, "site scripts/styles missing")
verify((SITE / "styles.css").exists() and (SITE / "library.js").exists(), "UI asset files missing")
verify('href="story-collections.css"' in html and (SITE / "story-collections.css").exists(), "story styles missing")
verify("https://www.youtube.com/@WEBBibleOutLoud/videos" in page.links, "full channel link missing")
verify(all(x.startswith("https://i.ytimg.com/vi/") for x in page.images), "unexpected thumbnail source")
verify(any("youtube.com/@WEBBibleOutLoud" in x for x in page.links), "YouTube channel missing")
verify(any("tiktok.com/@webbibleoutloud" in x for x in page.links), "TikTok channel missing")
product_urls=[p["url"] for p in merch["products"]]
verify(all(url in page.links for url in product_urls), "published merch product missing from the shop section")
verify(len([x for x in page.links if "printify.me/product/" in x]) == len(product_urls), "shop product links do not match merch.json")
verify(any(x.rstrip("/") == merch["shopUrl"].rstrip("/") for x in page.links), "full shop link missing")
verify(any("instagram.com/webbibleoutloud" in x for x in page.links), "Instagram profile missing")
verify(any("facebook.com/people/WEB-Bible-Out-Loud/61595111923682" in x for x in page.links), "Facebook page missing")
verify(page.links.count(SUPPORT) == 1, "there must be exactly one optional support link")
verify(page.links.count("/privacy.html") == 1, "privacy link missing")
verify(any("gc.zgo.at/count.js" in x for x in page.scripts), "existing GoatCounter analytics missing")
verify("GoatCounter" in privacy and "i.ytimg.com" in privacy and "third-party" in privacy,
       "privacy notice omits visitors analytics, thumbnails or external sites")
css = (SITE / "styles.css").read_text(encoding="utf-8")
js = (SITE / "library.js").read_text(encoding="utf-8")
verify(re.search(r"@media\s*\(max-width:480px\)", css) is not None, "phone layout rule missing")
verify("prefers-reduced-motion" in css and 'class="skip"' in html, "accessibility affordances missing")
verify('aria-pressed="true"' in html and 'aria-live="polite"' in html, "accessible search state missing")
verify('button.dataset.filter' in js and 'search.addEventListener("input"' in js, "interactive video filters or search missing")
verify('card.dataset.scriptureOrder' in js and 'card.dataset.story === "yes"' in js,
       "Bible-order filtering or Greatest Stories is not functional")
verify('book-picker' not in js, "unused book picker JavaScript remains")
verify('group.dataset.storySearch' in js and 'storyContainer.hidden' in js, "story filtering missing")
verify('new URLSearchParams(window.location.search)' in js and 'window.addEventListener("popstate"' in js,
       "shareable views must synchronize with navigation history")
verify("Content-Security-Policy:" in headers and "frame-ancestors 'none'" in headers,
       "baseline security policy missing")
verify("X-Content-Type-Options: nosniff" in headers, "sniffing protection missing")
verify("Sitemap: " + HOME + "sitemap.xml" in robots, "robots.txt points to wrong sitemap")
verify(HOME + "privacy.html" in sitemap and "<loc>" + HOME + "</loc>" in sitemap, "sitemap incomplete")
verify('publish = "site"' in config and 'command = "node scripts/render-videos.cjs"' in config,
       "Git-based Netlify build or publish settings wrong")
verify("<!-- VIDEO_CARDS_START -->" in html and "<!-- VIDEO_CARDS_END -->" in html,
       "video render markers missing")
for link in page.links:
    if link.startswith("/") and not link.startswith("//"):
        verify((SITE / (link.lstrip("/") or "index.html")).exists(), "missing internal link: " + link)
if errors:
    print("WEB Bible Out Loud audit failed:\n" + "\n".join(" - " + e for e in errors), file=sys.stderr)
    sys.exit(1)
print("PASS: " + str(len(page.videos)) + " videos, all shop links, one support link, privacy, security and Netlify configuration")
