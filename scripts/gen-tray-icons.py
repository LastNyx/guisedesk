# Writes resources/tray.png and resources/tray-dot.png (32x32): a light ring with a gap, plus a red dot variant.
# Plain stdlib. Run: python3 scripts/gen-tray-icons.py
import math, struct, zlib, os
N, SS = 32, 4
def px(x, y, dot):
    cx = cy = 16.0
    r = math.hypot(x - cx, y - cy)
    if 9 <= r <= 14 and not (-0.5 < math.atan2(y - cy, x - cx) < 0.5 and x > cx):
        a = (232, 232, 238, 255)
    elif r < 5:
        a = (232, 232, 238, 255)
    else:
        a = (0, 0, 0, 0)
    if dot and math.hypot(x - 24, y - 8) <= 7.5:
        return (229, 56, 59, 255)
    return a
def png(dot):
    rows = b''
    for j in range(N):
        rows += b'\0'
        for i in range(N):
            acc = [0, 0, 0, 0]; n = 0
            for sj in range(SS):
                for si in range(SS):
                    c = px(i + (si + .5) / SS, j + (sj + .5) / SS, dot)
                    w = c[3]
                    acc[0] += c[0] * w; acc[1] += c[1] * w; acc[2] += c[2] * w; acc[3] += w; n += 1
            a = acc[3]
            rows += bytes((round(acc[k] / a) if a else 0) for k in range(3)) + bytes([round(a / n)])
    def ch(t, d):
        c = struct.pack('>I', len(d)) + t + d
        return c + struct.pack('>I', zlib.crc32(t + d))
    return b'\x89PNG\r\n\x1a\n' + ch(b'IHDR', struct.pack('>IIBBBBB', N, N, 8, 6, 0, 0, 0)) + ch(b'IDAT', zlib.compress(rows)) + ch(b'IEND', b'')
out = os.path.join(os.path.dirname(__file__), '..', 'resources')
os.makedirs(out, exist_ok=True)
open(os.path.join(out, 'tray.png'), 'wb').write(png(False))
open(os.path.join(out, 'tray-dot.png'), 'wb').write(png(True))
