#!/usr/bin/env python3
"""Verify the public Netlify website contains the deployed editorial redesign."""
import time
from urllib.request import Request, urlopen

ORIGIN = "https://webbibleoutloud.netlify.app"

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
js,_=fetch("/library.js")
import json, re
from pathlib import Path
root=Path(__file__).resolve().parents[1]
catalog=json.loads((root/"data/videos.json").read_text(encoding="utf-8"))
merch=json.loads((root/"data/merch.json").read_text(encoding="utf-8"))
total=len(catalog["videos"])
shorts=[v for v in catalog["videos"] if v["type"]=="short"]
books=[v for v in catalog["videos"] if v.get("scope")=="book"]
passages=[v for v in catalog["videos"] if v.get("scope")=="passage"]
story_clips=[v for v in catalog["videos"] if v.get("story")]
newest_short=max(shorts, key=lambda v: v["publishedAt"])
newest_id=newest_short["url"].rstrip("/").split("/")[-1]
assert home.count('class="vid"')==total, f"Expected all {total} video cards on public website"
assert home.count("buymeacoffee.com/divclass016")==1, "Expected exactly one donation link"
assert newest_id in home, "Newest published Short missing"
assert 'class="feature"' in home and 'class="path-grid"' in home, "Redesigned featured area missing"
assert 'id="video-search"' in home and 'id="video-grid"' in home, "Searchable video library missing"
assert 'id="load-more"' in home and 'data-filter="book"' in home and 'data-filter="stories"' in home, "Complete books or Bible stories filter missing"
assert 'id="book-picker"' not in home and 'BOOK_OPTIONS_START' not in home, "Redundant complete-book dropdown reappeared"
assert 'data-filter="book"' in home and 'id="stories-help"' in home, "Complete books and Bible story library missing"
assert home.count('data-story="yes"')==len(story_clips), "Story clip count does not match the catalog"
assert home.count('data-scripture-order="')==total, "Missing Bible-reference sorting metadata"
assert home.count('data-scope="book"')==len(books) and home.count('data-scope="passage"')==len(passages), "Book/chapter classification incorrect"
book_cards=re.findall(r'<a class="vid" data-type="long" data-scope="book" data-book="([^"]+)"[^>]*href="(https://youtu.be/[^"]+)"', home)
assert len(book_cards)==len(books), "Complete-book video card count does not match the catalog"
assert len(set(href for _,href in book_cards))==len(books), "Each complete book must link to a distinct video"
assert 'href="styles.css"' in home and 'src="library.js"' in home, "UI assets not linked"
assert len(css)>8000 and '.hero' in css and '.library-section' in css, "Editorial styles not published"
assert 'search.addEventListener("input"' in js and 'more.addEventListener("click"' in js, "Working UI script not published"
assert 'appliedOrder' in js and 'card.dataset.scriptureOrder' in js and 'card.dataset.story === "yes"' in js, "Scripture ordering and stories filtering script missing"
assert 'book-picker' not in js, "Unused book-picker code still published"
assert home.count("web-bible-out-loud.printify.me/product/")==len(merch["products"]), "Product links do not match merch.json"
assert "instagram.com/webbibleoutloud" in home and "facebook.com/people/WEB-Bible-Out-Loud/61595111923682" in home, "Social profile links missing"
assert "GoatCounter" in privacy, "Privacy notice incomplete"
assert "content-security-policy" in headers and "frame-ancestors 'none'" in headers["content-security-policy"], "Netlify CSP missing"
assert "x-content-type-options" in headers, "Netlify security header missing"
print(f"PASS: Live Netlify shows {len(books)} complete books, {len(story_clips)} story clips, {total} videos, {len(merch['products'])} merch items, one support link and security checks")
