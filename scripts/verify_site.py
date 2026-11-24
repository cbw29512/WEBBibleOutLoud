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
SHORTS = "https://www.youtube.com/@webbibleoutloud/shorts"
# Section order and Bible order both come from data, so this test fails whenever the
# generated HTML stops matching the catalog instead of encoding an order of its own.
LAYOUT = json.loads((ROOT / "data/home-layout.json").read_text(encoding="utf-8"))
CANONICAL_BOOKS = json.loads((ROOT / "data/bible-order.json").read_text(encoding="utf-8"))["books"]
SUPPORT = LAYOUT["supportUrl"]
EXPECTED_SECTIONS = [s["id"] for s in LAYOUT["sections"]]

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
is_sleep = lambda x: re.search(r"\bfor Sleep\b", x["title"]) is not None
sleep = [x for x in readings if is_sleep(x)]
books = [x for x in readings if x.get("scope") == "book" and not is_sleep(x)]
passages = [x for x in readings if x.get("scope") == "passage" and not is_sleep(x)]
book_page = lambda x: "/books/" + x["bibleBook"].lower().replace(" ", "-") + "/"

verify('id="hero-title">Scripture,' in html and 'class="brand-title">Bible Out Loud' in html, "missing site heading or branding")
verify(page.canonicals == [HOME], "incorrect canonical homepage")
verify('name="description"' in html and 'property="og:image"' in html and 'name="twitter:card"' in html,
       "SEO metadata or social preview missing")
verify('id="full-books-schema"' in html and 'id="stories-schema"' in html and 'id="for-sleep-schema"' in html,
       "structured data missing")
verify('href="favicon.svg"' in html and (SITE / "favicon.svg").exists(), "favicon missing")
verify('<a class="brand" href="/">' in html, "brand link should use its visible text for accessibility")
verify(len(shorts) >= 1 and len(books) >= 1 and len(passages) >= 1, "catalog must still include Shorts, books, and passages")
verify(len(shorts) + len(readings) == len(data["videos"]), "catalog types do not add up")
verify(all("Full Book" in x["title"] for x in books), "full books must have all chapters")
verify(all("Full Book" not in x["title"] for x in passages), "chapter readings mislabeled as books")
verify(html.count('data-scope="book"') == len(books), "Full Book card count does not match the catalog")
verify(html.count('data-scope="passage"') == len(passages), "story card count does not match the catalog")
verify(html.count('data-scope="sleep"') == len(sleep), "For Sleep card count does not match the catalog")
verify(len(page.videos) == len(books) + len(passages) + len(sleep), "only stories, Full Books and For Sleep should be rendered as cards")
verify(set(page.story_hrefs) == {x["url"] for x in passages}, "story links differ from longer passages in JSON")
verify(set(page.book_hrefs) == {book_page(x) for x in books}, "Full Book cards must open their on-site book pages")
for x in books:
    bp = (SITE / book_page(x).strip("/") / "index.html")
    verify(bp.exists(), "missing book page " + book_page(x))
    if bp.exists():
        t = bp.read_text(encoding="utf-8")
        verify(x["title"] in t and x["url"] in t and 'rel="canonical" href="' + HOME + book_page(x).lstrip("/") + '"' in t, "book page title/link/canonical wrong: " + book_page(x))
        verify(HOME + book_page(x).lstrip("/") in sitemap, "book page missing from sitemap: " + book_page(x))
verify((SITE / "sleep/index.html").exists() and all(x["url"] in (SITE / "sleep/index.html").read_text(encoding="utf-8") for x in sleep), "For Sleep page missing a sleep video")
books_index = (SITE / "books/index.html").read_text(encoding="utf-8")
sleep_index = (SITE / "sleep/index.html").read_text(encoding="utf-8")
verify("frame-src https://www.youtube-nocookie.com" in headers, "book-page player needs frame-src youtube-nocookie")
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

def scripture_key(item):
    return (CANONICAL_BOOKS.index(item["bibleBook"]), item["chapter"], item["verse"],
            0 if item.get("scope") == "book" else 1, item["publishedAt"])
ordered_books = sorted(books, key=scripture_key)
ordered_passages = sorted(passages, key=scripture_key)
ordered_sleep = sorted(sleep, key=scripture_key)

# Homepage sections are generated in the order declared in data/home-layout.json.
sections = {m.group(1): m.group(2)
            for m in re.finditer(r'<section id="([^"]+)"[^>]*data-home-section="[^"]*"(.*?)</section>', html, re.S)}
rendered_order = re.findall(r'data-home-section="([^"]+)"', html)
verify(rendered_order == EXPECTED_SECTIONS,
       "homepage sections must be rendered in data/home-layout.json order, got " + " → ".join(rendered_order))
verify("<!-- HOME_SECTIONS_START -->" in html, "homepage section render marker missing")

def card_hrefs(section_id):
    block = sections.get(section_id, "")
    return [m.group(1) for m in re.finditer(r'<a class="vid"[^>]*?href="([^"]+)"', block)]
verify(card_hrefs("stories") == [x["url"] for x in ordered_passages],
       "Greatest Stories Ever Told must appear in canonical Bible order")
verify(card_hrefs("books") == [book_page(x) for x in ordered_books],
       "Full Books must appear in canonical Bible order")
verify(card_hrefs("sleep") == [x["url"] for x in ordered_sleep],
       "For Sleep must appear in canonical Bible order")

# Merch stays free of the donation link; the one support link lives in its own last section.
verify(SUPPORT not in sections.get("shop", ""), "Buy Me a Coffee must not appear inside the merch section")

# The merch section is a short featured selection shown with real storefront photos. Every card
# carries one product photo and opens that product's own page on the Printify storefront.
shop = sections.get("shop", "")
shop_cards = re.findall(r'<a class="product"[^>]*href="([^"]+)"[^>]*>(.*?)</a>', shop, re.S)
verify(2 <= len(merch["products"]) <= 8, "the homepage shows a few featured products, not the whole catalog")
verify([href for href, _ in shop_cards] == [p["url"] for p in merch["products"]],
       "merch cards must link to each product's storefront page, in data/merch.json order")
verify(shop.count("<img ") == len(merch["products"]), "every merch card needs exactly one product photo")
for (_, inner), product in zip(shop_cards, merch["products"]):
    tag = re.search(r"<img ([^>]*)>", inner)
    img = dict(re.findall(r'([a-z-]+)="([^"]*)"', tag.group(1))) if tag else {}
    verify(img.get("src") == product["imageFallback"], "merch card photo missing: " + product["name"])
    verify(img.get("alt") == product["name"], "merch photo alt text must be the product title: " + product["name"])
    verify(img.get("loading") == "lazy" and img.get("decoding") == "async",
           "merch photos must be lazy-loaded: " + product["name"])
    verify(img.get("width") == str(product["imageWidth"]) and img.get("height") == str(product["imageHeight"]),
           "merch photos need width and height so nothing shifts: " + product["name"])
    verify('<source srcset="' + product["image"] + '" type="image/webp">' in inner,
           "merch card needs a WebP source with a fallback: " + product["name"])
    verify(product["storefrontTitle"] in (product["name"], product["name"] + " | WEB Bible Out Loud"),
           "merch card titles must come from the storefront: " + product["name"])
    for key in ("image", "imageFallback"):
        asset = SITE / product[key]
        verify(asset.exists(), "merch image missing, run scripts/fetch-merch-images.py: " + product[key])
        verify(not asset.exists() or asset.stat().st_size <= 160_000, "merch image is too heavy: " + product[key])
verify('class="shop-cta" href="' + merch["shopUrl"] + '"' in shop and merch["shopLinkLabel"] in shop,
       "the merch section needs a prominent link to the whole storefront")
verify("$" not in re.sub(r"<[^>]+>", " ", shop), "merch cards must not show prices")
verify(sections.get("support", "").count(SUPPORT) == 1, "the support section needs exactly one Buy Me a Coffee link")
verify(EXPECTED_SECTIONS[-1] == "support" and rendered_order[-1] == "support",
       "the support section belongs at the very bottom, after merch")

# /books/ and /sleep/ use the same Bible order as the matching homepage sections.
verify([m.group(1) for m in re.finditer(r'<a class="vid"[^>]*?href="([^"]+)"', books_index)]
       == [book_page(x) for x in ordered_books], "/books/ must list complete books in canonical Bible order")
verify([m.group(1) for m in re.finditer(r'<a class="vid"[^>]*?href="([^"]+)"', sleep_index)]
       == [x["url"] for x in ordered_sleep], "/sleep/ must list For Sleep readings in canonical Bible order")

# Cards carry the Bible book, never a posting date.
card_meta = re.findall(r'<span class="vid-meta"><span>([^<]*)</span>', html)
verify(card_meta and all(x in CANONICAL_BOOKS for x in card_meta),
       "video cards must show the Bible book and no posting date")
for page_file in SITE.rglob("*.html"):
    text = page_file.read_text(encoding="utf-8")
    verify(not re.search(r'>\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},\s*\d{4}\s*<', text),
           "posting date shown on " + page_file.relative_to(SITE).as_posix())

for video in books + passages + sleep:
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
verify(all("<!-- " + m + "_START -->" in html for m in
           ["OG_IMAGE", "HERO_VIDEO", "VIDEO_STATS", "HOME_SECTIONS", "FULL_BOOKS_SCHEMA", "STORIES_SCHEMA", "FOR_SLEEP_SCHEMA"]),
       "render markers missing")
verify('src="library.js"' not in html, "old library filter script should not be loaded")
for link in page.links:
    if link.startswith("/") and not link.startswith("//"):
        verify((SITE / (link.lstrip("/") or "index.html")).exists(), "missing internal link: " + link)
if errors:
    print("WEB Bible Out Loud audit failed:\n" + "\n".join(" - " + e for e in errors), file=sys.stderr)
    sys.exit(1)
print("PASS: " + str(len(passages)) + " stories, " + str(len(books)) + " complete books, " + str(len(sleep)) + " For Sleep, " + str(len(merch["products"])) + " merch items, one Shorts button, one support link, privacy, security and Netlify configuration")
