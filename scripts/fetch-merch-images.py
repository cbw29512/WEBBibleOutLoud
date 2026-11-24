#!/usr/bin/env python3
"""Download the featured Printify mockups listed in data/merch.json and write web-sized copies.

Run by hand after editing data/merch.json, never during the Netlify build: the committed
images under site/assets/merch/ are what ships, so the build stays offline and dependency-free.

    python3 scripts/fetch-merch-images.py           # download and re-compress
    python3 scripts/fetch-merch-images.py --check   # verify the committed files match the catalog

Needs Pillow (pip install Pillow) for the resize; --check does not.
"""
import json
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "site"
MERCH = json.loads((ROOT / "data/merch.json").read_text(encoding="utf-8"))
EDGE = 640
WEBP_QUALITY = 72
JPEG_QUALITY = 78
USER_AGENT = "Mozilla/5.0 (compatible; WEBBibleOutLoud/1.0; +https://webbibleoutloud.com/)"


def check() -> int:
    problems = []
    for product in MERCH["products"]:
        for key in ("image", "imageFallback"):
            path = SITE / product[key]
            if not path.exists():
                problems.append("missing " + product[key] + " — run scripts/fetch-merch-images.py")
                continue
            if path.stat().st_size > 160_000:
                problems.append(product[key] + " is larger than 160 kB")
        if (product["imageWidth"], product["imageHeight"]) != (EDGE, EDGE):
            problems.append(product["image"] + " should be declared " + str(EDGE) + "x" + str(EDGE))
    for stray in sorted((SITE / "assets/merch").glob("*")):
        rel = stray.relative_to(SITE).as_posix()
        if rel not in {p[k] for p in MERCH["products"] for k in ("image", "imageFallback")}:
            problems.append("orphaned merch image not listed in data/merch.json: " + rel)
    if problems:
        print("merch image check failed:\n" + "\n".join(" - " + p for p in problems), file=sys.stderr)
        return 1
    print("PASS: " + str(len(MERCH["products"])) + " merch photos present, web-sized and listed in data/merch.json")
    return 0


def build() -> int:
    from PIL import Image  # imported late so --check works without Pillow

    out_dir = SITE / "assets/merch"
    out_dir.mkdir(parents=True, exist_ok=True)
    for product in MERCH["products"]:
        request = urllib.request.Request(product["sourceImage"], headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(request, timeout=90) as response:
            raw = response.read()
        original = SITE / (product["image"] + ".original")
        original.write_bytes(raw)
        with Image.open(original) as image:
            image = image.convert("RGB")
            # Printify mockups are square; cover-crop defensively so the grid never shifts.
            side = min(image.size)
            left = (image.width - side) // 2
            top = (image.height - side) // 2
            image = image.crop((left, top, left + side, top + side)).resize((EDGE, EDGE), Image.LANCZOS)
            image.save(SITE / product["image"], "WEBP", quality=WEBP_QUALITY, method=6)
            image.save(SITE / product["imageFallback"], "JPEG", quality=JPEG_QUALITY, optimize=True, progressive=True)
        original.unlink()
        sizes = [(SITE / product[k]).stat().st_size for k in ("image", "imageFallback")]
        print("%-70s webp %5.1f kB  jpg %5.1f kB" % (product["name"][:70], sizes[0] / 1024, sizes[1] / 1024))
    return check()


if __name__ == "__main__":
    sys.exit(check() if "--check" in sys.argv else build())
