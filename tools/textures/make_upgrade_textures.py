"""
画质升级 Demo 用的程序化贴图（全部程序化，无第三方素材）：
  python3 tools/textures/make_upgrade_textures.py
输出（assets/tex/）：
  paint_d / paint_n / paint_orm     漆面（建筑 / 列车 / 道具）的细腻微颗粒（干净，不脏）
  *_n                               补齐缺的法线：concrete / asphalt / grass / facade / steel
  *_orm                             打包 ORM：R = AO，G = 粗糙度，B = 金属度（恒 1 = 直接用材质标量 metallic）
  water_n1 / water_n2               两张可平铺的水波法线（反向滚动叠加）
  sky_day / sky_dusk                2048×1024 等距柱状天空（上午 / 黄金夕阳）
输出：
  tools/textures/hdr/env_day.hdr / env_dusk.hdr / env_indoor.hdr（不入库）   真浮点 Radiance RGBE 全景，和天空同源（tools/textures/make_env.py 转成 .env）
约定：ORM 都从已有的反照率 / 法线贴图推出来（缝 / 砖缝 = 暗 + 法线倾斜 → AO 低、粗糙度高），所以和原贴图逐像素对齐。
天空 / 全景方向约定与 Babylon FIXED_EQUIRECTANGULAR 和 HDRCubeTexture 一致：天空 jpg：u = atan2(z, -x) / 2π + 0.5；.hdr：u = atan2(z, x) / 2π + 0.5，v = acos(y) / π（第 0 行 = 天顶）。
"""
import numpy as np, os
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
TEX = os.path.join(HERE, '..', '..', 'assets', 'tex')
ENV = os.path.join(HERE, '..', '..', 'vendor', 'env')
HDR = os.path.join(HERE, 'hdr')   # .hdr 源文件不入库（可重新生成），make_env.py 从这里读
os.makedirs(HDR, exist_ok=True)

def load(name):
    return np.asarray(Image.open(os.path.join(TEX, name)).convert('RGB')).astype(np.float64) / 255.0
def save(name, arr, q=84):
    a = np.clip(arr * 255 + 0.5, 0, 255).astype(np.uint8)
    Image.fromarray(a).save(os.path.join(TEX, name), quality=q, optimize=True, progressive=True)
def lum(c): return c[..., 0] * 0.2126 + c[..., 1] * 0.7152 + c[..., 2] * 0.0722
def gblur(a, sigma):
    """可平铺（环绕）高斯模糊：FFT 域相乘，保证贴图边缘无缝"""
    n0, n1 = a.shape
    fy = np.fft.fftfreq(n0)[:, None]; fx = np.fft.fftfreq(n1)[None, :]
    k = np.exp(-2 * (np.pi * sigma) ** 2 * (fx * fx + fy * fy))
    return np.real(np.fft.ifft2(np.fft.fft2(a) * k))
def fnoise(n, scale, seed, aniso=(1, 1)):
    r = np.random.default_rng(seed); w = r.standard_normal((n, n))
    fy = np.fft.fftfreq(n)[:, None] * aniso[1]; fx = np.fft.fftfreq(n)[None, :] * aniso[0]
    amp = np.exp(-((fx * fx + fy * fy) * (n / scale) ** 2))
    o = np.real(np.fft.ifft2(np.fft.fft2(w) * amp)); o -= o.min(); o /= max(1e-9, o.max()); return o
def normal_from_height(h, strength):
    dx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * strength
    dy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * strength
    l = np.sqrt(dx * dx + dy * dy + 1)
    return np.stack([-dx / l, dy / l, 1 / l], -1) * 0.5 + 0.5
def orm(ao, rough):
    return np.stack([np.clip(ao, 0, 1), np.clip(rough, 0.02, 1), np.ones_like(ao)], -1)
def seam_mask(name, nname=None, sigma=5.0, gain=6.0):
    """缝隙遮罩：局部比周围暗（反照率）+ 法线倾斜（有法线贴图时）"""
    L = lum(load(name)); hp = L - gblur(L, sigma)
    s = np.clip(-hp * gain, 0, 1)
    if nname and os.path.exists(os.path.join(TEX, nname)):
        n = load(nname) * 2 - 1; tilt = np.clip((1 - n[..., 2]) * 8, 0, 1)
        s = np.maximum(s, tilt)
    return np.clip(gblur(s, 0.7), 0, 1)

N = 512
# ---------------- ORM（各桶）----------------
#  name: (albedo, normal, 平面粗糙度, 缝粗糙度, AO 强度, 粗糙度起伏, seam gain)
SPEC = {
    'floor':     ('floor.jpg', 'floor_n.jpg', 0.06, 0.93, 0.45, 0.03, 6),
    'paving':    ('paving.jpg', 'paving_n.jpg', 0.74, 0.95, 0.45, 0.10, 5),
    'tactile':   ('tactile.jpg', 'tactile_n.jpg', 0.55, 0.92, 0.40, 0.06, 5),
    'ceiling':   ('ceiling.jpg', 'ceiling_n.jpg', 0.40, 0.90, 0.40, 0.05, 5),
    'wall':      ('wall.jpg', 'wall_n.jpg', 0.12, 0.92, 0.42, 0.03, 6),
    'concrete':  ('concrete.jpg', None, 0.86, 0.97, 0.35, 0.10, 4),
    'brick':     ('brick.jpg', 'brick_n.jpg', 0.78, 0.95, 0.45, 0.10, 4),
    'qingzhuan': ('qingzhuan.jpg', 'qingzhuan_n.jpg', 0.62, 0.92, 0.42, 0.10, 5),
    'granite':   ('granite.jpg', 'granite_n.jpg', 0.88, 0.97, 0.40, 0.08, 4),
    'asphalt':   ('asphalt.jpg', None, 0.82, 0.95, 0.30, 0.14, 3),
    'grass':     ('grass.jpg', None, 0.88, 0.98, 0.35, 0.08, 3),
}
def make_orms():
    for key, (alb, nrm, r0, r1, aok, rv, gain) in SPEC.items():
        s = seam_mask(alb, nrm, gain=gain)
        var = fnoise(N if key != 'tactile' else 256, 24, seed=hash(key) % 9999) - 0.5
        ao = 1 - aok * s
        rough = r0 + (r1 - r0) * s + rv * var
        out = 'pave' if key == 'paving' else key
        save(out + '_orm.jpg', orm(ao, rough), 88)
        print('orm', out)

# ---------------- 补齐法线 ----------------
def make_normals():
    # 混凝土：细孔 + 起伏（从反照率暗点推高度）
    L = lum(load('concrete.jpg')); h = gblur(L, 1.0) * 0.6 + 0.4 * fnoise(N, 40, 11)
    save('concrete_n.jpg', normal_from_height(h, 2.2), 86)
    # 沥青：骨料颗粒
    L = lum(load('asphalt.jpg')); h = gblur(L - gblur(L, 3), 0.6) * 3 + 0.3 * fnoise(N, 30, 12)
    save('asphalt_n.jpg', normal_from_height(h, 3.0), 86)
    # 草地：短草叶（竖向各向异性噪声）+ 簇
    h = 0.6 * fnoise(N, 2.5, 13, aniso=(1.0, 0.25)) + 0.4 * fnoise(N, 10, 14)
    save('grass_n.jpg', normal_from_height(h, 3.5), 86)
    # 不锈钢：拉丝（水平细纹）
    h = fnoise(N, 1.2, 15, aniso=(0.02, 1.0)) * 0.7 + 0.3 * fnoise(N, 20, 16)
    save('steel_n.jpg', normal_from_height(h, 1.4), 86)
    # 立面：窗洞内凹、窗台 / 层间线外凸
    c = load('facade.jpg'); L = lum(c)
    win = ((c[..., 2] - c[..., 0] > 0.06) | ((c[..., 0] > 0.92) & (c[..., 2] < 0.75))).astype(float)
    sill = (L > 0.96).astype(float)
    h = 0.5 - 0.5 * gblur(win, 1.2) + 0.35 * gblur(sill, 1.0) + 0.05 * fnoise(N, 30, 17)
    save('facade_n.jpg', normal_from_height(h, 4.0), 86)
    # 立面 ORM：玻璃光滑（0.08）、抹灰 0.72、窗框 0.4；窗洞四周 AO
    frame = ((np.abs(c[..., 0] - 0.48) < 0.06) & (np.abs(c[..., 2] - 0.52) < 0.06)).astype(float)
    rough = 0.72 - 0.64 * gblur(win, 0.6) - 0.3 * frame + 0.06 * (fnoise(N, 20, 18) - 0.5)
    ao = 1 - 0.35 * np.clip(gblur(win, 6) - win, 0, 1) * 2
    save('facade_orm.jpg', orm(ao, rough), 88)
    # 钢 ORM：拉丝纹带来粗糙度条纹
    r = 0.30 + 0.12 * (fnoise(N, 1.2, 19, aniso=(0.02, 1.0)) - 0.5)
    save('steel_orm.jpg', orm(np.ones((N, N)) * 0.98, r), 88)
    print('normals ok')

# ---------------- 漆面：干净的细腻微颗粒（类似细砂外墙漆 / 高级塑料）----------------
def make_paint():
    g1 = fnoise(N, 1.4, 21); g2 = fnoise(N, 5, 22); g3 = fnoise(N, 48, 23)
    h = 0.55 * g1 + 0.30 * g2 + 0.15 * g3
    # 反照率接近白：只在 0.93..1.0 之间轻微起伏（乘顶点色），保证不脏
    a = 0.965 + 0.035 * (g3 - 0.5) * 2 * 0.6 + 0.02 * (g2 - 0.5)
    col = np.stack([a * 1.0, a * 0.997, a * 0.992], -1)
    save('paint_d.jpg', col, 86)
    save('paint_n.jpg', normal_from_height(h, 1.6), 86)
    rough = 0.50 + 0.10 * (g2 - 0.5) + 0.05 * (g1 - 0.5)
    ao = 0.97 + 0.03 * g3
    save('paint_orm.jpg', orm(ao, rough), 88)
    print('paint ok')

# ---------------- 水波法线（两张，频谱合成，可平铺）----------------
def make_water():
    for name, seed, L0, wind in [('water_n1.jpg', 31, 18, (1.0, 0.35)), ('water_n2.jpg', 32, 9, (-0.4, 1.0))]:
        r = np.random.default_rng(seed); n = 512
        fy = np.fft.fftfreq(n)[:, None] * n; fx = np.fft.fftfreq(n)[None, :] * n
        k = np.sqrt(fx * fx + fy * fy) + 1e-6
        wx, wy = wind; wl = np.hypot(wx, wy); dirf = np.abs((fx * wx + fy * wy) / (k * wl)) ** 1.5
        spec = np.exp(-((k - L0) / (L0 * 0.8)) ** 2) * (0.35 + 0.65 * dirf) / np.sqrt(k)
        spec += 0.25 * np.exp(-((k - L0 * 3) / (L0 * 1.5)) ** 2) / np.sqrt(k)
        spec[0, 0] = 0
        w = r.standard_normal((n, n)) + 1j * r.standard_normal((n, n))
        h = np.real(np.fft.ifft2(w * spec)); h /= np.abs(h).max()
        save(name, normal_from_height(h, 9.0), 88)
    print('water ok')

# ---------------- 天空 / HDR 全景 ----------------
def dirs(W, H, flip=True):
    u = (np.arange(W) + 0.5) / W; v = (np.arange(H) + 0.5) / H
    lon = (u - 0.5) * 2 * np.pi; lat = v * np.pi
    lon, lat = np.meshgrid(lon, lat)
    y = np.cos(lat); s = np.sin(lat)
    # Babylon 实测（tools/textures/env_check.html：太阳 / 镜面球倒影 / 平行光高光三者对齐）：
    #   天空球 FIXED_EQUIRECTANGULAR 贴图的 u 对应世界 -x（flip=True）；HDRCubeTexture 全景→立方体则是 +x（flip=False）
    return (-np.cos(lon) if flip else np.cos(lon)) * s, y, np.sin(lon) * s
def sph_noise(x, y, z, seed, octaves=5, base=2.0):
    """三维值噪声在球面上取样（无接缝）"""
    r = np.random.default_rng(seed); out = np.zeros_like(x); amp = 0.5; f = base; tot = 0
    for o in range(octaves):
        G = 64; grid = r.random((G, G, G))
        px = (x * f + 7.3 * o) % G; py = (y * f + 3.1 * o) % G; pz = (z * f + 5.7 * o) % G
        ix, iy, iz = px.astype(int), py.astype(int), pz.astype(int); tx, ty, tz = px - ix, py - iy, pz - iz
        tx, ty, tz = [t * t * (3 - 2 * t) for t in (tx, ty, tz)]
        def g(a, b, c): return grid[(ix + a) % G, (iy + b) % G, (iz + c) % G]
        v = 0
        for a in (0, 1):
            for b in (0, 1):
                for c in (0, 1):
                    v = v + g(a, b, c) * (tx if a else 1 - tx) * (ty if b else 1 - ty) * (tz if c else 1 - tz)
        out += amp * v; tot += amp; amp *= 0.5; f *= 2.03
    return out / tot
def sky_radiance(W, H, preset, flip=True):
    """线性 HDR 辐射度（RGB），preset = 'day' / 'dusk'"""
    x, y, z = dirs(W, H, flip)
    if preset == 'day':
        L = np.array([-0.48, -0.78, 0.40]); zen = np.array([0.10, 0.30, 1.10]) * 1.35; hor = np.array([1.55, 1.95, 2.45]) * 0.95
        glowC = np.array([2.2, 1.9, 1.5]); sunC = np.array([25.0, 23.5, 21.0]); cloudLit = np.array([3.1, 3.0, 2.9]); cloudSh = np.array([1.25, 1.35, 1.6])
        gnd = np.array([0.36, 0.34, 0.31]); cover = 0.44
    else:
        L = np.array([-0.78, -0.34, 0.52]); zen = np.array([0.14, 0.24, 0.70]); hor = np.array([3.2, 1.85, 0.95])
        glowC = np.array([6.0, 2.9, 1.1]); sunC = np.array([30.0, 20.0, 9.0]); cloudLit = np.array([4.2, 2.3, 1.2]); cloudSh = np.array([1.05, 0.72, 0.78])
        gnd = np.array([0.27, 0.22, 0.18]); cover = 0.47
    S = -L / np.linalg.norm(L)
    up = np.clip(y, 0, 1)
    t = np.power(1 - up, 3.2)[..., None]
    col = zen * (1 - t) + hor * t
    cosS = np.clip(x * S[0] + y * S[1] + z * S[2], -1, 1)
    ang = np.arccos(cosS)
    # 太阳周围的光晕（Mie）+ 地平线方向的暖色大气辉光
    halo = (np.exp(-ang / 0.10) * 0.9 + np.exp(-ang / 0.45) * 0.35)[..., None]
    horizonBand = np.exp(-np.abs(y) / 0.10)[..., None]
    azi = np.clip((x * S[0] + z * S[2]) / max(1e-6, np.hypot(S[0], S[2])) / np.maximum(1e-6, np.sqrt(1 - y * y)), -1, 1)
    glow = horizonBand * (0.35 + 0.65 * ((azi + 1) / 2) ** 3)[..., None]
    col = col + glowC * (halo * 0.55 + glow * 0.45)
    # 云：三维噪声 + 只在上半球，越靠地平线越扁越密
    yy = np.maximum(y, 0.02)
    cx, cz = x / (yy + 0.10) * 1.6, z / (yy + 0.10) * 1.6
    n = sph_noise(cx * 0.35, np.zeros_like(cx) + 0.5, cz * 0.35, 7, octaves=6, base=1.6)
    m = np.clip((n - cover) / 0.16, 0, 1) * np.clip((y - 0.03) / 0.10, 0, 1)
    dens = m ** 0.8
    # 朝太阳一侧更亮（简单的向光面），云底更暗
    n2 = sph_noise(cx * 0.35 + S[0] * 0.04, np.zeros_like(cx) + 0.5, cz * 0.35 + S[2] * 0.04, 7, octaves=6, base=1.6)
    lit = np.clip(0.5 + (n - n2) * 9, 0, 1)
    sunSide = (0.55 + 0.45 * (cosS + 1) / 2)
    cc = cloudSh * (1 - lit[..., None]) + cloudLit * lit[..., None]
    cc = cc * sunSide[..., None] + glowC * 0.6 * np.exp(-ang / 0.35)[..., None] * lit[..., None]
    col = col * (1 - dens[..., None] * 0.92) + cc * dens[..., None]
    # 太阳圆盘（半径约 1.3°，边缘柔和；被云挡住的地方减弱）
    disc = np.clip((0.024 - ang) / 0.006, 0, 1)[..., None]
    col = col * (1 - disc) + sunC * disc * (1 - 0.8 * dens[..., None]) + col * disc * 0.8 * dens[..., None]
    # 下半球：地面反弹色（越往下越暗），地平线附近融进雾色
    below = np.clip(-y, 0, 1)[..., None]
    tb = np.clip(below / 0.14, 0, 1); tb = tb * tb * (3 - 2 * tb)
    gcol = (hor * 0.85) * (1 - tb) + gnd * (1 - 0.35 * below) * tb
    col = np.where((y < 0)[..., None], gcol, col)
    return col.astype(np.float32)
def indoor_radiance(W, H):
    x, y, z = dirs(W, H, False)
    col = np.zeros((H, W, 3), np.float32)
    wall = np.array([0.62, 0.60, 0.56]); floorC = np.array([0.34, 0.37, 0.42]); ceilC = np.array([0.55, 0.53, 0.50])
    col[:] = wall
    up = y > 0.25; dn = y < -0.25
    col[dn] = floorC
    # 天花：投到 y=1 平面上的网格灯带（暖白 12.0）
    with np.errstate(divide='ignore', invalid='ignore'):
        px = x / np.maximum(y, 1e-3) * 2.2; pz = z / np.maximum(y, 1e-3) * 2.2
    strip = (np.abs(((px + 0.5) % 3.0) - 1.5) < 0.16) | (np.abs(((pz + 0.5) % 6.0) - 3.0) < 0.10)
    c = np.where(up[..., None], ceilC, col)
    lights = (strip & up)
    c[lights] = np.array([12.0, 11.2, 9.6])
    # 灯带周围的柔光
    soft = np.exp(-np.maximum(0, np.minimum(np.abs(((px + 0.5) % 3.0) - 1.5) - 0.16, 9)) / 0.25) * up
    c = c + (np.array([1.4, 1.3, 1.1]) * soft[..., None])
    # 竖向的明亮广告灯箱（墙面上几个暖色块）
    band = (np.abs(y) < 0.18) & ((np.sin(np.arctan2(z, x) * 6) > 0.85))
    c[band] = np.array([3.0, 2.8, 2.4])
    # 地砖：干净的冷色反弹 + 墙脚过渡
    t = np.clip((y + 0.25) / 0.5, 0, 1)[..., None]
    mid = (~up) & (~dn)
    c = np.where(mid[..., None] & ~band[..., None], floorC * (1 - t) + wall * t, c)
    return c.astype(np.float32)
def tonemap_ldr(col, exposure):
    c = col * exposure
    c = c / (1 + c * 0.42)   # 柔和肩部，保留云的层次
    return np.power(np.clip(c, 0, 1), 1 / 2.2)
def write_hdr(path, img):
    """Radiance RGBE（非 RLE，每行原样写；Babylon HDRTools 支持）"""
    H, W, _ = img.shape
    m = np.max(img, -1)
    e = np.ceil(np.log2(np.maximum(m, 1e-32)))
    e = np.where(m < 1e-32, -128, e)
    sc = np.where(m < 1e-32, 0, 256.0 / np.power(2.0, e))
    rgb = np.clip(img * sc[..., None], 0, 255).astype(np.uint8)
    ee = np.clip(e + 128, 0, 255).astype(np.uint8)
    ee = np.where(m < 1e-32, 0, ee).astype(np.uint8)
    data = np.concatenate([rgb, ee[..., None]], -1)
    with open(path, 'wb') as f:
        f.write(b'#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n')
        f.write(('-Y %d +X %d\n' % (H, W)).encode())
        f.write(data.tobytes())
def make_skies():
    for preset, exp in [('day', 0.62), ('dusk', 0.52)]:
        hdr = sky_radiance(2048, 1024, preset)
        save('sky_' + preset + '.jpg', tonemap_ldr(hdr, exp), 86)
        small = sky_radiance(1024, 512, preset, flip=False)
        write_hdr(os.path.join(HDR, 'env_' + preset + '.hdr'), small)
        print('sky', preset, 'max', float(hdr.max()), 'mean', float(hdr.mean()))
    write_hdr(os.path.join(HDR, 'env_indoor.hdr'), indoor_radiance(1024, 512))
    print('indoor ok')

if __name__ == '__main__':
    import sys
    which = sys.argv[1:] or ['orm', 'normals', 'paint', 'water', 'sky']
    if 'orm' in which: make_orms()
    if 'normals' in which: make_normals()
    if 'paint' in which: make_paint()
    if 'water' in which: make_water()
    if 'sky' in which: make_skies()
