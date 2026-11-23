#!/usr/bin/env python3
"""Protect site links, privacy, generated story and Full Book cards, and Netlify settings."""
from html.parser import HTMLParser
from pathlib import Path
import json
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "site"
HOME = "https://webbibleoutloud.com/"
SUPPORT = "https://buymeacoffee.com/divclass016"
SHORTS = "https://www.youtube.com/@webbibleoutloud/shorts"

class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []
        self.images = []
        self.scripts = []
        self.canonicals = []
        self.videos = []
        self.story_hrefs = []
        self.book_hrefs = []
        self.capture = None
        self.text = []
    def handle_starttag(self, tag, attrs):
        d = dict(attrs)
        if tag == "a" and d.get("href"):
            self.links.append(d["href"])
            classes = d.get("class", "").split()
            if "vid" in classes:
                self.videos.append(d["href"])
                if d.get("data-scope") == "passage":
                    self.story_hrefs.append(d["href"])
                if d.get("data-scope") == "book":
                    self.book_hrefs.append(d["href"])
            if d.get("id") == "shorts-button":
                self.capture = "shorts"
        if tag == "img" and d.get("src"):
            self.images.append(d["src"])
        if tag == "script" and d.get("src"):
            self.scripts.append(d["src"])
        if tag == "link" and d.get("rel") == "canonical":
            self.canonicals.append(d["href"])
    def handle_data(self, data):
        if self.capture == "shorts":
            self.text.append(data)
    def handle_endtag(self, tag):
        if tag == "a" and self.capture == "shorts":
            self.capture = None

html = (SITE / "index.html").read_text(encoding="utf-8")
privacy = (SITE / "privacy.html").read_text(encoding="utf-8")
headers = (SITE / "_headers").read_text(encoding="utf-8")
robots = (SITE / "robots.txt").read_text(encoding="utf-8")
sitemap = (SITE / "sitemap.xml").read_text(encoding="utf-8")
config = (ROOT / "netlify.toml").read_text(encoding="utf-8")
css = (SITE / "styles.css").read_text(encoding="utf-8")
data = json.loads((ROOT / "data/videos.json").read_text(encoding="utf-8"))
merch = json.loads((ROOT / "data/merch.json").read_text(encoding="utf-8"))
page = Page()
page.feed(html)
errors = []
def verify(condition, issue):
    if not condition:
        errors.append(issue)

shorts = [x for x in data["videos"] if x["type"] == "short"]
readings = [x for x in data["videos"] if x["type"] == "long"]
books = [x for x in readings if x.get("scope") == "book"]
passages = [x for x in readings if x.get("scope") == "passage"]

verify('id="hero-title">Scripture,' in html and 'class="brand-title">Bible Out Loud' in html, "missing site heading or branding")
verify(page.canonicals == [HOME], "incorrect canonical homepage")
verify('name="description"' in html and 'property="og:image"' in html and 'name="twitter:card"' in html,
       "SEO metadata or social preview missing")
verify('id="full-books-schema"' in html and 'id="stories-schema"' in html, "structured data missing")
verify('href="favicon.svg"' in html and (SITE / "favicon.svg").exists(), "favicon missing")
verify('<a class="brand" href="/">' in html, "brand link should use its visible text for accessibility")
verify(len(shorts) >= 1 and len(books) >= 1 and len(passages) >= 1, "catalog must still include Shorts, books, and passages")
verify(len(shorts) + len(readings) == len(data["videos"]), "catalog types do not add up")
verify(all("Full Book" in x["title"] for x in books), "full books must have all chapters")
verify(all("Full Book" not in x["title"] for x in passages), "chapter readings mislabeled as books")
verify(html.count('data-scope="book"') == len(books), "Full Book card count does not match the catalog")
verify(html.count('data-scope="passage"') == len(passages), "story card count does not match the catalog")
verify(len(page.videos) == len(books) + len(passages), "only stories and Full Books should be rendered as cards")
verify(set(page.story_hrefs) == {x["url"] for x in passages}, "story links differ from longer passages in JSON")
verify(set(page.book_hrefs) == {x["url"] for x in books}, "Full Book links differ from JSON")
verify(len(set(page.videos)) == len(page.videos), "duplicate video cards")
verify(all("/shorts/" not in url for url in page.videos), "Shorts must not be rendered as cards")
verify('data-type="short"' not in html and 'data-filter="short"' not in html, "Shorts filter or Shorts cards still present")
verify('id="video-search"' not in html and 'id="load-more"' not in html, "old library search or load-more controls still present")
verify(html.count('id="shorts-button"') == 1, "expected one Shorts button")
verify(html.count(SHORTS) == 1, "Shorts button URL missing or duplicated")
verify("".join(page.text).strip() == "Watch the Shorts on YouTube", "Shorts button text is wrong")
verify(html.count(SUPPORT) == 1, "expected exactly one Buy Me a Coffee button")
for required in [
    "https://www.youtube.com/@WEBBibleOutLoud",
    "https://www.tiktok.com/@webbibleoutloud",
    "https://www.instagram.com/webbibleoutloud/",
    "https://www.facebook.com/people/WEB-Bible-Out-Loud/61595111923682/",
    "https://web-bible-out-loud.printify.me",
]:
    verify(required in page.links or required.rstrip("/") in [x.rstrip("/") for x in page.links], "missing profile or shop link: " + required)
product_urls = [p["url"] for p in merch["products"]]
verify(all(url in page.links for url in product_urls), "published merch product missing from the shop section")
verify(len([x for x in page.links if "printify.me/product/" in x]) == len(product_urls), "shop product links do not match merch.json")
verify(any(x.rstrip("/") == merch["shopUrl"].rstrip("/") for x in page.links), "full shop link missing")
verify("buymeacoffee" not in json.dumps(merch).lower(), "Buy Me a Coffee must not be added to merch.json")
canonical_book_order = ["Genesis","Exodus","Leviticus","Numbers","Deuteronomy","Joshua","Judges","Ruth","1 Samuel","2 Samuel","1 Kings","2 Kings","1 Chronicles","2 Chronicles","Ezra","Nehemiah","Esther","Job","Psalms","Proverbs","Ecclesiastes","Song of Solomon","Isaiah","Jeremiah","Lamentations","Ezekiel","Daniel","Hosea","Joel","Amos","Obadiah","Jonah","Micah","Nahum","Habakkuk","Zephaniah","Haggai","Zechariah","Malachi","Matthew","Mark","Luke","John","Acts","Romans","1 Corinthians","2 Corinthians","Galatians","Ephesians","Philippians","Colossians","1 Thessalonians","2 Thessalonians","1 Timothy","2 Timothy","Titus","Philemon","Hebrews","James","1 Peter","2 Peter","1 John","2 John","3 John","Jude","Revelation"]
def scripture_key(item):
    return (canonical_book_order.index(item["bibleBook"]), item["chapter"], item["verse"], 0 if item.get("scope")=="book" else 1, item["publishedAt"])
ordered_books = sorted(books, key=scripture_key)
ordered_passages = sorted(passages, key=scripture_key)
# Parse cards in document order so Bible-order checks follow the rendered HTML.
ordered_cards = re.findall(r'<a class="vid"[^>]*>', html)
book_order_hrefs = []
passage_order_hrefs = []
for tag in ordered_cards:
    href = re.search(r'href="([^"]+)"', tag)
    scope = re.search(r'data-scope="([^"]+)"', tag)
    if not href or not scope:
        continue
    if scope.group(1) == "book":
        book_order_hrefs.append(href.group(1))
    elif scope.group(1) == "passage":
        passage_order_hrefs.append(href.group(1))
verify(book_order_hrefs == [x["url"] for x in ordered_books], "Full Books must appear in canonical Bible order")
verify(passage_order_hrefs == [x["url"] for x in ordered_passages], "stories must appear in canonical Bible order")
for video in books + passages:
    verify(video["title"] in html, "missing exact public title: " + video["title"])
verify('id="book-picker"' not in html, "redundant full-book dropdown must stay removed")
verify("instagram.com/webbibleoutloud" in html and "facebook.com/people/WEB-Bible-Out-Loud/61595111923682" in html, "social profile links missing")
verify("GoatCounter" in privacy and "/privacy.html" in html, "privacy page or footer link missing")
verify("prefers-reduced-motion" in css and 'class="skip"' in html, "accessibility affordances missing")
verify("Content-Security-Policy:" in headers and "frame-ancestors 'none'" in headers, "baseline security policy missing")
verify("X-Content-Type-Options: nosniff" in headers, "sniffing protection missing")
verify("Sitemap: " + HOME + "sitemap.xml" in robots, "robots.txt points to wrong sitemap")
verify(HOME + "privacy.html" in sitemap and "<loc>" + HOME + "</loc>" in sitemap, "sitemap incomplete")
verify('publish = "site"' in config and 'command = "node scripts/render-videos.cjs"' in config,
       "Git-based Netlify build or publish settings wrong")
verify("<!-- STORIES_START -->" in html and "<!-- FULL_BOOKS_START -->" in html, "render markers missing")
verify('src="library.js"' not in html, "old library filter script should not be loaded")
for link in page.links:
    if link.startswith("/") and not link.startswith("//"):
        verify((SITE / (link.lstrip("/") or "index.html")).exists(), "missing internal link: " + link)
if errors:
    print("WEB Bible Out Loud audit failed:\n" + "\n".join(" - " + e for e in errors), file=sys.stderr)
    sys.exit(1)
print("PASS: " + str(len(passages)) + " stories, " + str(len(books)) + " complete books, " + str(len(merch["products"])) + " merch items, one Shorts button, one support link, privacy, security and Netlify configuration")
