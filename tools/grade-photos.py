"""
Grade the site photos into the brand palette.

Reads the source photo for each slot from images/_src/<slot>.jpg, downsizes it to
a web-friendly size, maps its luminance onto the brand tritone
(#0D0D0D -> #E8471C -> warm light) and writes the result to images/<slot>.jpg.

Usage:  python tools/grade-photos.py
Requires:  pip install Pillow

To change a photo: drop a new colour photo into images/_src/ named after the slot
(e.g. images/_src/hero.jpg) and re-run. To tune the look, edit STOPS below.
Extra files in images/_src/ that aren't slots are ignored.
"""
from PIL import Image, ImageOps
import os

SLOTS = ["hero", "trainer", "arm", "tennis", "boxing"] + [f"gallery-{i}" for i in range(1, 7)]
MAX_SIDE = 1400   # longest edge of the output, px

# tritone control stops: luminance position (0..1) -> (r, g, b) in the brand palette
STOPS = [
    (0.00, (13, 13, 13)),     # #0D0D0D  shadows
    (0.25, (58, 26, 16)),     #          deep warm
    (0.52, (150, 45, 18)),    #          burnt orange
    (0.78, (232, 71, 28)),    # #E8471C  brand orange
    (1.00, (242, 226, 208)),  #          warm light
]


def build_luts():
    lr, lg, lb = [], [], []
    for i in range(256):
        t = i / 255
        for k in range(len(STOPS) - 1):
            p0, c0 = STOPS[k]
            p1, c1 = STOPS[k + 1]
            if p0 <= t <= p1:
                f = (t - p0) / (p1 - p0) if p1 > p0 else 0
                lr.append(round(c0[0] + (c1[0] - c0[0]) * f))
                lg.append(round(c0[1] + (c1[1] - c0[1]) * f))
                lb.append(round(c0[2] + (c1[2] - c0[2]) * f))
                break
    return lr, lg, lb


LR, LG, LB = build_luts()


def grade(path):
    im = ImageOps.exif_transpose(Image.open(path)).convert("RGB")
    if max(im.size) > MAX_SIDE:
        im.thumbnail((MAX_SIDE, MAX_SIDE))
    g = ImageOps.grayscale(im)
    g = ImageOps.autocontrast(g, cutoff=1)
    return Image.merge("RGB", (g.point(LR), g.point(LG), g.point(LB)))


def main():
    done = 0
    for slot in SLOTS:
        src = os.path.join("images", "_src", slot + ".jpg")
        if not os.path.exists(src):
            continue
        out = grade(src)
        out.save(os.path.join("images", slot + ".jpg"), quality=82, optimize=True)
        print(f"graded {slot:12} {out.size}")
        done += 1
    print(f"done: {done}/{len(SLOTS)} slots")


if __name__ == "__main__":
    main()
