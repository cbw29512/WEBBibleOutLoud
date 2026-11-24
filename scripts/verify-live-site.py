#!/usr/bin/env python3
"""Verify the public website shows stories, Full Books, merch, and one Shorts button."""
import time
from urllib.request import Request, urlopen
import json, re
from pathlib import Path

ORIGIN = "https://webbibleoutloud.com"
SHORTS = "https://www.youtube.com/@webbibleoutloud/shorts"
LAYOUT_PATH = "data/home-layout.json"
BIBLE_ORDER_PATH = "data/bible-order.json"

def fetch(path):
    last = None
    for attempt in range(3):
        try:
            with urlopen(Request(ORIGIN + path, headers={
                "User-Agent":"WEBBibleOutLoud production verification"
            }), timeout=25) as response:
                assert response.status == 200, f"{path}: HTTP {response.status}"
                return response.read().decode("utf-8"), {k.lower():v for k,v in response.headers.items()}
        except Exception as error:
            last=error
            if attempt<2: time.sleep(3)
    raise RuntimeError(f"Unable to fetch {path}: {last}")

home, headers=fetch("/")
privacy, _=fetch("/privacy.html")
css,_=fetch("/styles.css")
root=Path(__file__).resolve().parents[1]
catalog=json.loads((root/"data/videos.json").read_text(encoding="utf-8"))
merch=json.loads((root/"data/merch.json").read_text(encoding="utf-8"))
layout=json.loads((root/LAYOUT_PATH).read_text(encoding="utf-8"))
canonical=json.loads((root/BIBLE_ORDER_PATH).read_text(encoding="utf-8"))["books"]
support=layout["supportUrl"]
is_sleep=lambda v: re.search(r"\bfor Sleep\b", v["title"]) is not None
sleep=[v for v in catalog["videos"] if v["type"]=="long" and is_sleep(v)]
books=[v for v in catalog["videos"] if v.get("scope")=="book" and not is_sleep(v)]
passages=[v for v in catalog["videos"] if v.get("scope")=="passage" and not is_sleep(v)]
key=lambda v:(canonical.index(v["bibleBook"]), v["chapter"], v["verse"], v["publishedAt"])
assert home.count(support)==1, "Expected exactly one donation link"
assert [m.group(1) for m in re.finditer(r'data-home-section="([^"]+)"', home)]==[s["id"] for s in layout["sections"]], \
    "Live homepage section order does not match data/home-layout.json"
assert home.count('id="shorts-button"')==1, "Expected one Shorts button"
assert home.count(SHORTS)==1, "Shorts button URL missing or duplicated"
assert "Watch the Shorts on YouTube" in home, "Shorts button text missing"
assert 'data-type="short"' not in home and 'data-filter="short"' not in home, "Shorts cards or Shorts filter still on the live site"
assert not re.search(r"youtube\.com/shorts/[A-Za-z0-9_-]{11}", home), "Shorts video cards still on the live site"
assert home.count('data-scope="book"')==len(books), "Full Book count does not match the catalog"
assert home.count('data-scope="passage"')==len(passages), "story count does not match the catalog"
assert home.count('data-scope="sleep"')==len(sleep), "For Sleep count does not match the catalog"
assert home.count('class="vid"')==len(books)+len(passages)+len(sleep), "only stories, Full Books and For Sleep should appear as cards"
for v in books:
    page,_=fetch("/books/"+v["bibleBook"].lower().replace(" ","-")+"/")
    assert v["title"] in page and v["url"] in page, "book page wrong for "+v["bibleBook"]
sleep_page,_=fetch("/sleep/")
assert all(v["url"] in sleep_page for v in sleep), "For Sleep page incomplete"
assert 'id="stories"' in home and 'id="books"' in home and 'id="sleep"' in home and 'id="shop"' in home, "Stories, Full Books, For Sleep, or shop section missing"
for section_id, expected in (("books", [f"/books/{v['bibleBook'].lower().replace(' ','-')}/" for v in sorted(books,key=key)]),
                             ("stories", [v["url"] for v in sorted(passages,key=key)]),
                             ("sleep", [v["url"] for v in sorted(sleep,key=key)])):
    block=re.search(r'<section id="'+section_id+r'"(.*?)</section>', home, re.S)
    assert block, f"{section_id} section missing from the live homepage"
    assert [m.group(1) for m in re.finditer(r'<a class="vid"[^>]*?href="([^"]+)"', block.group(1))]==expected, \
        f"live {section_id} section is not in canonical Bible order"
assert 'class="feature"' in home, "Featured full-book area missing"
assert 'id="video-search"' not in home and 'id="load-more"' not in home, "Old library controls still published"
assert 'href="styles.css"' in home and 'src="library.js"' not in home, "Unexpected UI assets"
assert len(css)>8000 and '.hero' in css, "Editorial styles not published"
assert home.count("web-bible-out-loud.printify.me/product/")==len(merch["products"]), "Product links do not match merch.json"
assert "instagram.com/webbibleoutloud" in home and "facebook.com/people/WEB-Bible-Out-Loud/61595111923682" in home, "Social profile links missing"
assert 'rel="canonical" href="https://webbibleoutloud.com/"' in home, "Canonical URL missing"
assert "GoatCounter" in privacy, "Privacy notice incomplete"
assert "content-security-policy" in headers and "frame-ancestors 'none'" in headers["content-security-policy"], "Netlify CSP missing"
assert "x-content-type-options" in headers, "Netlify security header missing"
print(f"PASS: Live site shows {len(passages)} stories, {len(books)} complete books, {len(merch['products'])} merch items, one Shorts button, one support link and security checks")
