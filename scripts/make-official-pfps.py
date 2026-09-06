#!/usr/bin/env python3
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from pathlib import Path
import hashlib, json, time

brand = Path("public/brand")
out_dir = Path("public/pfps")
out_dir.mkdir(parents=True, exist_ok=True)
data_path = Path("data/pfp-profiles.json")

BG = (11, 15, 20, 255)
WHITE = (245, 245, 247, 255)
XBLUE = (29, 155, 240, 255)
GREEN = (34, 197, 94, 255)

orbit = Image.open(brand / "graav-orbit-g-white-1024.png").convert("RGBA")

def knock_black(im, thr=30):
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a > 8 and r < thr and g < thr and b < thr:
                px[x, y] = (0, 0, 0, 0)
    return im

orbit = knock_black(orbit)
bbox = orbit.getbbox()
if bbox:
    orbit = orbit.crop(bbox)

def make_pfp(ticker, accent, subtitle):
    size = 1024
    canvas = Image.new("RGBA", (size, size), BG)
    draw = ImageDraw.Draw(canvas)
    ring = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    rd = ImageDraw.Draw(ring)
    rd.ellipse([48, 48, size - 48, size - 48], outline=(*accent[:3], 55), width=3)
    canvas = Image.alpha_composite(canvas, ring)

    mark_h = 420
    mark_w = int(orbit.size[0] * (mark_h / orbit.size[1]))
    mark = orbit.resize((mark_w, mark_h), Image.Resampling.LANCZOS)
    glow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    cx, cy = size // 2, int(size * 0.42)
    gd.ellipse([cx - 180, cy - 180, cx + 180, cy + 180], fill=(*accent[:3], 40))
    glow = glow.filter(ImageFilter.GaussianBlur(40))
    canvas = Image.alpha_composite(canvas, glow)
    canvas.paste(mark, (cx - mark_w // 2, cy - mark_h // 2), mark)

    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 96)
        font_sm = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 36)
    except Exception:
        font = ImageFont.load_default()
        font_sm = font
    label = "$" + ticker
    tb = draw.textbbox((0, 0), label, font=font)
    tw, th = tb[2] - tb[0], tb[3] - tb[1]
    draw.text(((size - tw) // 2, int(size * 0.72)), label, font=font, fill=WHITE)
    sb = draw.textbbox((0, 0), subtitle, font=font_sm)
    sw = sb[2] - sb[0]
    draw.text(((size - sw) // 2, int(size * 0.72) + th + 18), subtitle, font=font_sm, fill=(*accent[:3], 220))

    sha = hashlib.sha256(canvas.tobytes()).hexdigest()[:12]
    fname = f"{ticker.lower()}.{sha}.png"
    path = out_dir / fname
    canvas.save(path, optimize=True)
    print("wrote", path, path.stat().st_size)
    return path, sha, f"/pfps/{fname}"

profiles = {}
if data_path.exists():
    try:
        profiles = json.loads(data_path.read_text() or "{}")
    except Exception:
        profiles = {}

now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
for ticker, accent, sub in [
    ("gSWAP", XBLUE, "graduated · V2"),
    ("g589", GREEN, "on curve · M2"),
]:
    path, sha, uri = make_pfp(ticker, accent, sub)
    entry = {
        "ticker": ticker,
        "pfpURI": uri,
        "contentType": "image/png",
        "sha256": sha,
        "generated": False,
        "source": "official-simple",
        "updatedAt": now,
    }
    profiles[ticker] = entry
    profiles[ticker.lower()] = entry
    profiles[ticker.upper()] = entry

data_path.write_text(json.dumps(profiles, indent=2) + "\n")
print("profiles ok", data_path)
