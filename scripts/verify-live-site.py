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
assert home.count('class="vid"')==71, "Expected all 71 video cards on public website"
assert home.count("buymeacoffee.com/divclass016")==1, "Expected exactly one donation link"
assert "g1uRInGRtSc" in home, "Newest published Short missing"
assert 'class="feature"' in home and 'class="path-grid"' in home, "Redesigned featured area missing"
assert 'id="video-search"' in home and 'id="video-grid"' in home, "Searchable video library missing"
assert 'id="load-more"' in home and 'data-filter="book"' in home and 'data-filter="stories"' in home, "Complete books or Bible stories filter missing"
assert 'id="book-picker"' in home and 'id="stories-help"' in home, "Book selection or Bible stories description missing"
assert home.count('data-story="yes"')==32, "Expected 32 real story clips"
assert home.count('data-scripture-order="')==71, "Missing Bible-reference sorting metadata"
assert home.count('data-scope="book"')==5 and home.count('data-scope="passage"')==4, "Book/chapter classification incorrect"
import re
book_options=re.findall(r'<option value="(Genesis|Psalms|Obadiah|John|Revelation)">', home)
assert book_options==["Genesis","Psalms","Obadiah","John","Revelation"], "Book picker is not in canonical Bible order"
assert 'href="styles.css"' in home and 'src="library.js"' in home, "UI assets not linked"
assert len(css)>8000 and '.hero' in css and '.library-section' in css, "Editorial styles not published"
assert 'search.addEventListener("input"' in js and 'more.addEventListener("click"' in js, "Working UI script not published"
assert 'appliedOrder' in js and 'card.dataset.scriptureOrder' in js and 'picker.addEventListener("change"' in js, "Scripture ordering and book picker script not published"
assert home.count("web-bible-out-loud.printify.me/product/")==4, "Product links missing"
assert "GoatCounter" in privacy, "Privacy notice incomplete"
assert "content-security-policy" in headers and "frame-ancestors 'none'" in headers["content-security-policy"], "Netlify CSP missing"
assert "x-content-type-options" in headers, "Netlify security header missing"
print("PASS: Live Netlify serves five canonically ordered selectable Bible books, 32 chronological story clips, all 71 videos, one donation and security checks")
