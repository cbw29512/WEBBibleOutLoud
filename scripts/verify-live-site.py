#!/usr/bin/env python3
"""Verify what the *public* Netlify origin serves after GitHub is connected."""
import re
import time
from urllib.request import Request, urlopen

ORIGIN = "https://webbibleoutloud.netlify.app"

def fetch(path):
    last = None
    for i in range(3):
        try:
            with urlopen(Request(ORIGIN+path,headers={"User-Agent":"WEBBibleOutLoud GitHub production smoke check"}),timeout=25) as r:
                if r.status != 200:
                    raise RuntimeError(f"{path}: HTTP {r.status}")
                return r.read().decode("utf-8"), {k.lower():v for k,v in r.headers.items()}
        except Exception as e:
            last=e
            if i<2: time.sleep(3)
    raise RuntimeError(f"Could not fetch {path}: {last}")

home, headers=fetch("/")
privacy,_=fetch("/privacy.html")
assert home.count('class="vid"')==71, f"Expected 71 video cards, got {home.count(chr(34)+'vid'+chr(34))}"
assert home.count("buymeacoffee.com/divclass016")==1, "Multiple/missing Buy Me a Coffee buttons"
assert "g1uRInGRtSc" in home, "Newest October 29 Short is missing"
assert 'class="older-videos"' in home and 'class="video-grid full-readings"' in home, "Older Shorts/full-length categories missing"
assert "GoatCounter" in privacy, "Privacy page missing analytics disclosure"
assert "content-security-policy" in headers and "frame-ancestors 'none'" in headers["content-security-policy"],"Netlify CSP missing"
assert "X-Content-Type-Options".lower() in headers, "Netlify security header missing"
print("PASS: Public production homepage serves 71 video cards, 1 support link, archives, privacy page, and security headers")
