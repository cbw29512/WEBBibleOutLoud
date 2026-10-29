#!/usr/bin/env python3
"""Verify the recovered site remains complete and safe to publish."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse, unquote
import json, sys

class Page(HTMLParser):
    def __init__(self):
        super().__init__(); self.links=[]; self.images=[]; self.scripts=[]; self.canonical=[]
    def handle_starttag(self, tag, attrs):
        d=dict(attrs)
        if tag=="a" and d.get("href"):self.links.append(d["href"])
        if tag=="img" and d.get("src"):self.images.append(d["src"])
        if tag=="script" and d.get("src"):self.scripts.append(d["src"])
        if tag=="link" and d.get("rel")=="canonical":self.canonical.append(d.get("href"))

root=Path(__file__).resolve().parents[1]
site=root/"site"
html=(site/"index.html").read_text(encoding="utf-8")
manifest=json.loads((root/"recovery-manifest.json").read_text())
p=Page();p.feed(html)
errors=[]
if "<title>WEB Bible Out Loud" not in html:errors.append("site title missing")
if p.canonical!=["https://webbibleoutloud.netlify.app/"]:errors.append("canonical URL mismatch")
if not any("youtube" in u for u in p.links):errors.append("YouTube link missing")
if not any("tiktok" in u for u in p.links):errors.append("TikTok link missing")
if not any("printify.me" in u for u in p.links):errors.append("shop link missing")
if len(p.images)<5:errors.append("video thumbnails missing")
if not any("gc.zgo.at/count.js" in x for x in p.scripts):errors.append("original analytics missing")
for value in p.links+p.images+p.scripts:
    u=urlparse(value)
    if not u.scheme and not u.netloc and u.path and not u.path.startswith(("#","/")):
        rel=unquote(u.path)
        if not (site/rel).is_file():errors.append("missing local asset: "+rel)
if (site/"index.html").stat().st_size < 200:
    errors.append("homepage is missing or empty")
config=(root/"netlify.toml").read_text()
if "[build]" not in config or 'publish = "site"' not in config:
    errors.append("Netlify publish directory is not site")
print(f"Checked {len(p.links)} links, {len(p.images)} thumbnail images, {len(p.scripts)} scripts")
if errors:
    print("\n".join("FAIL: "+x for x in errors),file=sys.stderr);sys.exit(1)
print("PASS: recovered Netlify site verified for Git-based deployment")
