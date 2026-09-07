#!/usr/bin/env python3
"""
Draws the toolbar icon: the same animal, from above, at four sizes.

No image library, because the extension should not need one installed to be
rebuilt. A PNG is a zlib stream of scanlines with a filter byte, and that is the
whole of what this writes.

The shape is the body plan out of `src/tools/lizard/geometry.js`: a spine, a
half-width at each joint, and four legs hung off joints 3 and 7. Rendered as a
distance field so the edges are round, and supersampled so they are smooth.
"""

import math
import struct
import zlib
from pathlib import Path

SAND = (0xC2, 0xA4, 0x70)
BACK = (0x75, 0x5A, 0x37)
DARK = (0x3B, 0x2B, 0x18)
GROUND = (0x0B, 0x0E, 0x1C)

# Half-width at each joint, snout to tail tip. Same proportions as the app's.
WIDTH = [2.1, 5.4, 3.6, 5.6, 6.0, 5.0, 5.2, 6.0, 4.5, 3.8, 3.2, 2.7, 2.2, 1.7, 1.15, 0.55]
SPACING = [4.4, 4.0, 4.6, 5.0, 5.4, 5.4, 5.2, 5.4, 5.6, 5.8, 6.0, 6.0, 5.8, 5.4, 5.0]


def spine():
    """A gentle S down the diagonal, so the tail curls and the body reads alive."""
    pts = []
    x, y, a = 0.0, 0.0, 0.0
    pts.append((x, y))
    for i, gap in enumerate(SPACING):
        # Bend more toward the tail: a straight lizard is a newt.
        a += 0.16 * math.sin(i * 0.55) + 0.05
        x += math.cos(a) * gap
        y += math.sin(a) * gap
        pts.append((x, y))
    return pts


def seg_dist(p, a, b):
    """Distance from p to the segment a-b."""
    px, py = p
    ax, ay = a
    bx, by = b
    dx, dy = bx - ax, by - ay
    span = dx * dx + dy * dy
    t = 0.0 if span == 0 else max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / span))
    cx, cy = ax + dx * t, ay + dy * t
    return math.hypot(px - cx, py - cy), t


def build(size, ss=4):
    """One icon, supersampled `ss` times in each direction and averaged down."""
    body = spine()
    n = len(body)

    # Legs: (joint, sideways, forward) in body units, as capsules.
    legs = []
    for joint, side, fore in ((3, 1, 0.6), (3, -1, 0.6), (7, 1, -0.5), (7, -1, -0.5)):
        jx, jy = body[joint]
        ax, ay = body[max(0, joint - 1)]
        bx, by = body[min(n - 1, joint + 1)]
        fwd = math.atan2(ay - by, ax - bx)
        out = fwd + (math.pi / 2) * side
        knee = (jx + math.cos(out) * 7.5 + math.cos(fwd) * fore * 4,
                jy + math.sin(out) * 7.5 + math.sin(fwd) * fore * 4)
        foot = (knee[0] + math.cos(out + 0.5 * side) * 8,
                knee[1] + math.sin(out + 0.5 * side) * 8)
        legs.append(((jx, jy), knee, foot))

    # Fit the whole animal, legs included, into the icon with a margin.
    xs = [p[0] for p in body] + [c for leg in legs for c in (leg[1][0], leg[2][0])]
    ys = [p[1] for p in body] + [c for leg in legs for c in (leg[1][1], leg[2][1])]
    pad = 7.0
    minx, maxx = min(xs) - pad, max(xs) + pad
    miny, maxy = min(ys) - pad, max(ys) + pad
    scale = min(size / (maxx - minx), size / (maxy - miny))
    ox = (size - (maxx - minx) * scale) / 2 - minx * scale
    oy = (size - (maxy - miny) * scale) / 2 - miny * scale

    dim = size * ss
    px = bytearray(dim * dim * 4)

    radius = size * 0.22  # rounded square, the way a Chrome icon looks right

    for iy in range(dim):
        for ix in range(dim):
            # Icon space, then body space.
            sx = (ix + 0.5) / ss
            sy = (iy + 0.5) / ss
            bx = (sx - ox) / scale
            by = (sy - oy) / scale

            # Rounded-square ground.
            cx = abs(sx - size / 2) - (size / 2 - radius)
            cy = abs(sy - size / 2) - (size / 2 - radius)
            outside = math.hypot(max(cx, 0), max(cy, 0)) - radius
            if outside > 0:
                continue
            r, g, b = GROUND

            # Legs, under the body.
            for root, knee, foot in legs:
                d1, _ = seg_dist((bx, by), root, knee)
                d2, _ = seg_dist((bx, by), knee, foot)
                if min(d1, d2) < 1.7:
                    r, g, b = BACK
                    break

            # The body: inside if within the interpolated half-width anywhere.
            hit = False
            for i in range(n - 1):
                d, t = seg_dist((bx, by), body[i], body[i + 1])
                w = WIDTH[i] + (WIDTH[i + 1] - WIDTH[i]) * t
                if d < w:
                    hit = True
                    # A darker band down the middle of the back.
                    r, g, b = BACK if d < w * 0.45 else SAND
                    break
            if not hit:
                # The head is a touch fatter than the first joint alone gives.
                hd = math.hypot(bx - body[1][0], by - body[1][1])
                if hd < WIDTH[1]:
                    hit = True
                    r, g, b = SAND

            # One eye, so it is looking at you.
            ex = body[1][0] + 1.0
            ey = body[1][1] - 2.6
            if hit and math.hypot(bx - ex, by - ey) < 1.5:
                r, g, b = DARK

            o = (iy * dim + ix) * 4
            px[o] = r
            px[o + 1] = g
            px[o + 2] = b
            px[o + 3] = 255

    # Average the supersamples down to the real size.
    out = bytearray()
    for y in range(size):
        out.append(0)  # PNG filter: none
        for x in range(size):
            acc = [0, 0, 0, 0]
            for sy in range(ss):
                for sx in range(ss):
                    o = ((y * ss + sy) * dim + (x * ss + sx)) * 4
                    for c in range(4):
                        acc[c] += px[o + c]
            total = ss * ss
            out.extend(bytes(v // total for v in acc))
    return bytes(out)


def png(path, size):
    raw = build(size)

    def chunk(tag, data):
        return (struct.pack(">I", len(data)) + tag + data
                + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF))

    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    blob = (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr)
            + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b""))
    path.write_bytes(blob)
    return len(blob)


if __name__ == "__main__":
    here = Path(__file__).resolve().parent.parent / "src" / "icons"
    here.mkdir(parents=True, exist_ok=True)
    for size in (16, 32, 48, 128):
        n = png(here / f"icon-{size}.png", size)
        print(f"icon-{size}.png  {n} bytes")
