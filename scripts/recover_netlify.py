#!/usr/bin/env python3
"""Reconstruct browser-served static files from an immutable Netlify deployment."""
import json
import re
import sys
from collections import deque
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin, urlparse, unquote
from urllib.request import Request, urlopen

DEPLOY = "https://6ad27f5a1e2ae144ba523478--webbibleoutloud.netlify.app/"
LIVE = "https://webbibleoutloud.netlify.app/"
HOSTS = {urlparse(DEPLOY).hostname, urlparse(LIVE).hostname}
ROOT = Path("site")
EXTS = {"js","mjs","css","json","svg","png","jpg","jpeg","webp","ico","gif","avif","mp3","wav","ogg","mp4","webm","webmanifest","txt","xml","woff","woff2","ttf","pdf","html","htm","map"}
asset_re = re.compile(r"""["'\x60]((?:/|\./|\.\./)?[A-Za-z0-9_@./%-]+\.(?:js|mjs|css|json|svg|png|jpe?g|webp|gif|avif|ico|mp3|wav|ogg|webmanifest|woff2?|ttf|pdf|txt|xml|map)(?:\?[^"'\x60\s]*)?)["'\x60]""", re.I)
css_re = re.compile(r"""url\(\s*['"]?([^)'"]+)['"]?\s*\)|@import\s+['"]([^'"]+)['"]""", re.I)

class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.refs = []
    def handle_starttag(self, tag, attrs):
        d = dict(attrs)
        for key in ("href", "src", "poster", "data-src", "data-href", "action"):
            if d.get(key): self.refs.append(d[key])
        for key in ("srcset", "data-srcset"):
            if d.get(key):
                self.refs.extend(entry.strip().split()[0] for entry in d[key].split(",") if entry.strip())

def normalize(ref, source):
    ref = ref.strip()
    if not ref or ref.startswith(("#","data:","blob:","javascript:","mailto:","tel:")): return None
    u = urlparse(urljoin(source, ref))
    if u.scheme not in ("http","https") or u.hostname not in HOSTS: return None
    path = unquote(u.path)
    if path.startswith(("/.netlify/","/api/")) or ".." in path.split("/") or "\\" in path or "\x00" in path: return None
    return DEPLOY.rstrip("/") + path + ("?" + u.query if u.query else "")

pending=deque([DEPLOY]); seen=set(); items=[]; failures=[]; skipped=[]; total=0
def queue(ref, source):
    target=normalize(ref,source)
    if target and target not in seen and target not in pending and len(pending)+len(seen)<600: pending.append(target)

while pending:
    url=pending.popleft()
    if url in seen: continue
    seen.add(url)
    try:
        request=Request(url,headers={"User-Agent":"Mozilla/5.0 (GitHub Netlify website recovery)"})
        with urlopen(request,timeout=25) as response:
            if response.status != 200: raise ValueError("HTTP "+str(response.status))
            data=response.read(70*1024*1024+1)
            mime=response.headers.get("Content-Type","").split(";")[0].lower()
            if len(data)>70*1024*1024: raise ValueError("File size limit exceeded")
    except (HTTPError,URLError,TimeoutError,ValueError,OSError) as e:
        failures.append({"url":url,"error":str(e)[:180]}); continue
    path=unquote(urlparse(url).path).lstrip("/")
    if not path or path.endswith("/"): path+="index.html"
    elif not Path(path).suffix:
        if "html" in mime: path+="/index.html"
        else: skipped.append(url); continue
    output=(ROOT/path).resolve()
    if not output.is_relative_to(ROOT.resolve()): skipped.append(url); continue
    if output.exists(): continue
    output.parent.mkdir(parents=True,exist_ok=True)
    output.write_bytes(data); total+=len(data)
    items.append({"path":output.relative_to(ROOT).as_posix(),"bytes":len(data),"mime":mime})
    text=data.decode("utf-8","replace")
    if "html" in mime or output.suffix.lower() in (".html",".htm"):
        parser=Links(); parser.feed(text)
        for ref in parser.refs: queue(ref,url)
    elif "css" in mime or output.suffix.lower()==".css":
        for m in css_re.finditer(text): queue(m.group(1) or m.group(2),url)
    elif output.suffix.lower() in (".js",".mjs"):
        for m in asset_re.finditer(text): queue(m.group(1),url)

if not (ROOT/"index.html").exists() or (ROOT/"index.html").stat().st_size<150:
    print("RECOVERY FAILED: immutable Netlify deployment did not serve usable HTML",file=sys.stderr)
    print(json.dumps(failures,indent=2)[:3000],file=sys.stderr)
    sys.exit(1)
manifest={"source":"immutable public Netlify deployment","deploy_id":"6ad27f5a1e2ae144ba523478","url":DEPLOY,"recovered_at":datetime.now(timezone.utc).isoformat(),"files":items,"file_count":len(items),"bytes":total,"failed":failures,"skipped":skipped,"limitations":"Published browser files only; unreferenced files, unpublished source, Netlify functions, configuration and secrets cannot be inferred."}
Path("recovery-manifest.json").write_text(json.dumps(manifest,indent=2)+"\n")
print("RECOVERED",len(items),"files",total,"bytes;",len(failures),"failures")
for item in items: print(item["path"])
for entry in failures: print("FAILED",entry["url"],entry["error"])
