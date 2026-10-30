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
page = Page()
page.feed(html)
errors = []
def verify(condition, issue):
    if not condition:
        errors.append(issue)

verify('id="hero-title">Scripture,' in html and 'class="brand-title">Bible Out Loud' in html, "missing site heading or branding")
verify(page.canonicals == [HOME], "incorrect canonical homepage")
verify(len(page.videos) == len(data["videos"]) >= 1, "video cards do not match the JSON list")
shorts = sorted([x for x in data["videos"] if x["type"] == "short"], key=lambda x: x["publishedAt"], reverse=True)
readings = sorted([x for x in data["videos"] if x["type"] == "long"], key=lambda x: x["publishedAt"], reverse=True)
featured_count = data.get("featuredShorts", 12)
expected_order = sorted(data["videos"], key=lambda x: x["publishedAt"], reverse=True)
verify(page.videos == [x["url"] for x in expected_order], "video order or URLs differ from JSON")
verify(len(page.images) == len(data["videos"]) + 3, "missing library, hero or featured thumbnail")
verify(len(set(page.videos)) == len(page.videos), "duplicate video cards")
verify(len(shorts) == 62 and len(readings) == 9 and len(page.videos) == 71,
       "baseline public channel library should contain 62 Shorts and 9 full readings")
verify('id="video-search"' in html and 'id="video-grid"' in html, "searchable library markup missing")
verify('id="load-more"' in html and 'data-filter="long"' in html, "video filters or pagination missing")
verify('<!-- HERO_VIDEO_START -->' in html and '<!-- START_PATHS_START -->' in html, "generated hero missing")
verify('href="styles.css"' in html and 'src="library.js"' in html, "site scripts/styles missing")
verify((SITE / "styles.css").exists() and (SITE / "library.js").exists(), "UI asset files missing")
verify("https://www.youtube.com/@WEBBibleOutLoud/videos" in page.links, "full channel link missing")
verify(all(x.startswith("https://i.ytimg.com/vi/") for x in page.images), "unexpected thumbnail source")
verify(any("youtube.com/@WEBBibleOutLoud" in x for x in page.links), "YouTube channel missing")
verify(any("tiktok.com/@webbibleoutloud" in x for x in page.links), "TikTok channel missing")
verify(len([x for x in page.links if "printify.me" in x]) == 5, "shop or product links missing")
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
