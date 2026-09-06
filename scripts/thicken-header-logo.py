#!/usr/bin/env python3
from PIL import Image, ImageFilter
from pathlib import Path

official = Path("/workspace/sandbox-labs/graav/brand/official")
brand = Path("/workspace/sandbox-labs/graav/testnet-console/public/brand")
orbit = brand / "graav-orbit-g-white-1024.png"

mark = Image.open(orbit).convert("RGBA")
wm = Image.open(official / "graav-wordmark.png").convert("RGBA")

def knock_black(im, thr=40):
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 8:
                continue
            if r < thr and g < thr and b < thr:
                px[x, y] = (0, 0, 0, 0)
    return im

def crop_alpha(im, pad=4):
    bbox = im.getbbox()
    if not bbox:
        return im
    l, t, r, b = bbox
    l = max(0, l - pad)
    t = max(0, t - pad)
    r = min(im.size[0], r + pad)
    b = min(im.size[1], b + pad)
    return im.crop((l, t, r, b))

def thicken_white(im, passes=4):
    alpha = im.split()[-1]
    for _ in range(max(1, passes)):
        alpha = alpha.filter(ImageFilter.MaxFilter(3))
    alpha = alpha.filter(ImageFilter.GaussianBlur(0.6))
    out = Image.new("RGBA", im.size, (0, 0, 0, 0))
    white = Image.new("RGBA", im.size, (255, 255, 255, 255))
    return Image.composite(white, out, alpha)

wm = crop_alpha(knock_black(wm))
mark = crop_alpha(mark)
mark_thick = crop_alpha(thicken_white(mark, passes=4))
wm_thick = crop_alpha(thicken_white(wm, passes=3))

master_h = 96
mh = master_h
mw = int(mark_thick.size[0] * (mh / mark_thick.size[1]))
mark_r = mark_thick.resize((mw, mh), Image.Resampling.LANCZOS)
wh = int(master_h * 0.62)
ww = int(wm_thick.size[0] * (wh / wm_thick.size[1]))
wm_r = wm_thick.resize((ww, wh), Image.Resampling.LANCZOS)
gap = int(master_h * 0.28)
pad = int(master_h * 0.08)
out_w = pad * 2 + mw + gap + ww
out_h = pad * 2 + max(mh, wh)
master = Image.new("RGBA", (out_w, out_h), (0, 0, 0, 0))
master.paste(mark_r, (pad, pad + (out_h - 2 * pad - mh) // 2), mark_r)
master.paste(wm_r, (pad + mw + gap, pad + (out_h - 2 * pad - wh) // 2), wm_r)
master.save(brand / "graav-header-lockup-master.png", optimize=True)
print("master", master.size)

def scale_to_h(im, h):
    w = int(im.size[0] * (h / im.size[1]))
    return im.resize((w, h), Image.Resampling.LANCZOS)

for name, h in [
    ("graav-header-lockup.png", 32),
    ("graav-header-lockup@2x.png", 64),
    ("graav-header-lockup@3x.png", 96),
]:
    s = scale_to_h(master, h)
    s = s.filter(ImageFilter.UnsharpMask(radius=1.2, percent=140, threshold=2))
    path = brand / name
    s.save(path, optimize=True)
    print(name, s.size, path.stat().st_size)

(brand / "graav-wordmark.png").write_bytes((official / "graav-wordmark.png").read_bytes())
print("done")
