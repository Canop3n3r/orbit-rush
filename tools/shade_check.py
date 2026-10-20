# Cylindrical shading check for hero renders: the lit side of the hull must be clearly brighter than the shadow side.
# Samples a small patch at +-55 % of the hull radius either side of the axis (probe from hero.html), at 40 % height.
import json, sys
from PIL import Image
d, tag = sys.argv[1], sys.argv[2]; P = json.load(open(f'{d}/{tag}_probe.json')); bad = 0
for n, r in P.items():
  if not n.endswith('_hero') or n.startswith('payload') or n.startswith('catch'): continue
  im = Image.open(f'{d}/{tag}_{n}.png').convert('L'); W, H = im.size; sx = W / 1280 if W > 1000 else W / 844
  def mean(x): x0, y0 = int(x - 3), int(r['cy'] - 6); px = [im.getpixel((min(W - 1, max(0, i)), min(H - 1, max(0, j)))) for i in range(x0, x0 + 6) for j in range(y0, y0 + 12)]; return sum(px) / len(px)
  a, b = mean(r['cx'] - 0.55 * r['rpx']), mean(r['cx'] + 0.55 * r['rpx']); lit, sh = max(a, b), min(a, b); ratio = lit / max(1, sh)
  ok = ratio >= 1.5; bad += not ok; print(f"{'PASS' if ok else 'FAIL'} {n}: lit {lit:.0f} shadow {sh:.0f} ratio {ratio:.2f} fill {r.get('fill', 0):.2f}")
print('shade_check:', 'all pass' if not bad else f'{bad} failed'); sys.exit(1 if bad else 0)
