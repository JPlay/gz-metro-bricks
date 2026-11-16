# 3C 夜空贴图（等距柱状：上边 = 天顶、中线 = 地平线；同 assets/tex/sky.jpg 的排布）：
# 深蓝不是黑（天顶 #1B2440 → 地平线 #2E3A5C），地平线以下同地平线色（雾 / clearColor 同色），稀疏暗星，一轮淡月（冷白蓝，很弱）。
# 用法：python3 tools/fzriver/sky_night.py  → assets/tex/sky_night.jpg（确定性随机种子，重跑结果一致）
import random, math
from PIL import Image, ImageDraw, ImageFilter
W, H = 2048, 1024
# 渲染管线（KHR PBR Neutral 色调映射 + 对比度 1.12 + 饱和度 +22）会把暗蓝压得更饱和、红绿掉到 0：贴图按实测预补偿，
# 让屏幕上天顶 ≈ #1B2440、地平线 ≈ #2E3A5C（3C 调参：tune1 贴图原值渲出来天顶是 (1, 22, 65)）
Z, HZ = (0x34, 0x36, 0x4A), (0x4A, 0x50, 0x68)
im = Image.new('RGB', (W, H))
px = im.load()
for y in range(H):
    t = min(1.0, y / (H / 2))          # 0 天顶 → 1 地平线
    k = t ** 2.2                        # 大部分天空偏天顶色，靠近地平线才亮起来
    c = tuple(round(Z[i] + (HZ[i] - Z[i]) * k) for i in range(3)) if y < H // 2 else HZ
    for x in range(W): px[x, y] = c
rnd = random.Random(3)
d = ImageDraw.Draw(im)
for _ in range(260):                    # 稀疏的暗星（只在上半部分、离地平线远一点）
    x, y = rnd.randrange(W), int((rnd.random() ** 1.6) * H * 0.4)
    b = rnd.randint(70, 150); r = 1 if rnd.random() < 0.85 else 1.6
    d.ellipse([x - r, y - r, x + r, y + r], fill=(b, b + 6, min(255, b + 22)))
moon = Image.new('RGB', (W, H), (0, 0, 0)); md = ImageDraw.Draw(moon)
mx, my = int(W * 0.62), int(H * 0.2)
md.ellipse([mx - 60, my - 60, mx + 60, my + 60], fill=(40, 48, 70))   # 月晕
moon = moon.filter(ImageFilter.GaussianBlur(28))
md = ImageDraw.Draw(moon); md.ellipse([mx - 11, my - 11, mx + 11, my + 11], fill=(150, 165, 190))
im = Image.fromarray(__import__('numpy').minimum(255, __import__('numpy').asarray(im, dtype='int32') + __import__('numpy').asarray(moon, dtype='int32')).astype('uint8'))
im.save('assets/tex/sky_night.jpg', quality=88)
print('ok', im.getpixel((10, 0)), im.getpixel((10, H // 2 - 2)), im.getpixel((10, H - 10)))
