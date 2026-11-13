# 用法：/workspace/.venv-geo/bin/python tools/fzriver/gen_e.py（需要 shapely ≥ 2.1）
# 福州内河 1B（东线）：晋安河（温泉公园 → 河口，沿河 1:4）+ 光明港（河口 → 光明港码头，沿河 1:5），游船 B 线（白篷）。
# 输入 rivers_osm_m.json（© OpenStreetMap contributors，ODbL；米，原点东街口站）。坐标系与 1A 相同：W = 真实米 / 3（x 东、z 北）；
# 光明港以晋安河口为基点按 1:4 缩（W = 河口/3 + (P − 河口)/4），两条河在河口严丝合缝接上。
# 生成 js/data/fz-river-data-e.js（结构同 fz-river-data.js，导出 FZR_E）。
import json, math, sys, os, random
import shapely
from shapely.geometry import LineString, Polygon, Point, box
from shapely.ops import substring, unary_union
K = float(os.environ.get('FZR_KJ', 4.0)); K_GM = float(os.environ.get('FZR_KG', 5.0)); WY = -3.0   # 小美定：晋安河 1:4、光明港 1:5（单程约 479 s）；环境变量只为试算
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, '../../js/data/fz-river-data-e.js')
d = json.load(open(os.path.join(HERE, 'rivers_osm_m.json')))
RJ = LineString(d['rivers']['晋安河']); RG = LineString(d['rivers']['光明港'])
JR = Point(RJ.coords[-1])                    # 晋安河口（真实）
SGJ = RG.project(JR)                         # 光明港上河口的里程（真实，≈1562）
J3 = (JR.x / K, JR.y / K)
def chaikin(c, n=3):
  for _ in range(n):
    o = [c[0]]
    for a, b in zip(c, c[1:]): o += [(a[0]*.75+b[0]*.25, a[1]*.75+b[1]*.25), (a[0]*.25+b[0]*.75, a[1]*.25+b[1]*.75)]
    o.append(c[-1]); c = o
  return c
def scJ(c): return [(x / K, y / K) for x, y in c]
def scG(c): return [(J3[0] + (x - JR.x) / K_GM, J3[1] + (y - JR.y) / K_GM) for x, y in c]
JA0, GM0, GM1 = 2167 - 150, SGJ - 120, 3898 + 200     # 真实里程：晋安河起点（温泉公园路桥北 150 m）、光明港西头（河口以西 120 m）、东头
ja0 = LineString(scJ(list(substring(RJ, JA0, RJ.length).coords))).simplify(0.8)
ja = LineString(chaikin(list(ja0.coords), 3)).simplify(0.12)
gm0 = LineString(scG(list(substring(RG, GM0, GM1).coords))).simplify(0.8)
gm = LineString(chaikin(list(gm0.coords), 3)).simplify(0.12)
CL = {'ja': ja, 'gm': gm}
HW = {'ja': 13.0, 'gm': 21.0}               # 真实宽：晋安河约 30 m（26 m 水面 + 两侧驳岸），光明港整治段水面 30～50 m（取 42 m）
BAND = {'ja': 24.0, 'gm': 26.0}
NAME = {'ja': ['晋安河', 'Jin\'an River'], 'gm': ['光明港', 'Guangminggang River']}
def ja_s(r): return (r - JA0) / K                     # 真实里程 → 游戏里程（近似：中线简化前后长度差 < 1%）
def gm_s(r): return (r - GM0) / K_GM
# 用投影精确换算（真实点 → 游戏中线）
def real_pt(k, r):
  if k == 'ja': p = RJ.interpolate(r); return Point(p.x / K, p.y / K)
  p = RG.interpolate(r); return Point(*scG([(p.x, p.y)])[0])
def tan(k, s):
  g = CL[k]; s = min(max(s, 0), g.length); a0 = max(0, min(s - 1, g.length - 2)); a = g.interpolate(a0); b = g.interpolate(a0 + 2); l = math.hypot(b.x - a.x, b.y - a.y)
  return ((b.x - a.x) / l, (b.y - a.y) / l)
def at_s(k, s, lat=0.0):
  p = CL[k].interpolate(s); t = tan(k, s); n = (t[1], -t[0]); return (p.x + n[0] * lat, p.y + n[1] * lat), t, n
def proj(k, P):
  s = CL[k].project(P); (x, y), t, n = at_s(k, s); return s, (P.x - x) * n[0] + (P.y - y) * n[1]
def rs(k, r): return proj(k, real_pt(k, r))[0]
def minRat(g):
  c = list(g.coords); out = (1e9, None)
  for a, b, cc in zip(c, c[1:], c[2:]):
    A = math.dist(a, b); B = math.dist(b, cc); C = math.dist(a, cc); s = (A + B + C) / 2; ar = max(s * (s - A) * (s - B) * (s - C), 0) ** .5
    if ar > 1e-6 and A * B * C / (4 * ar) < out[0]: out = (A * B * C / (4 * ar), b, g.project(Point(b)))
  return out
for k, g in CL.items(): print(k, 'len', round(g.length, 1), 'pts', len(g.coords), 'minR', minRat(g)[0])
SJ = gm.project(Point(J3))   # 河口在光明港游戏中线上的里程
print('junction gm s', round(SJ, 1), 'dist', round(gm.distance(Point(J3)), 2), 'ja end', ja.coords[-1])

# ---------- 水面：两条河道 + 河口喇叭（丁字口转角放宽） ----------
chan = {k: CL[k].buffer(HW[k], cap_style='flat', join_style='round', quad_segs=6) for k in CL}
def flarePoly(k, s0, s1, w0, w1, n=10):
  L_ = [at_s(k, s0 + (s1 - s0) * i / n, -(w0 + (w1 - w0) * (i / n) ** 1.5))[0] for i in range(n + 1)]
  R_ = [at_s(k, s0 + (s1 - s0) * i / n, (w0 + (w1 - w0) * (i / n) ** 1.5))[0] for i in range(n + 1)]
  return Polygon(L_ + R_[::-1])
flare = flarePoly('ja', ja.length - HW['gm'] - 10, ja.length - HW['gm'] + 1, HW['ja'], HW['ja'] + 12)
# 丁字口两个岸角倒圆（落水回岸找最近岸线时不会卡在尖角上）
water = unary_union([*chan.values(), flare]).buffer(6, quad_segs=6).buffer(-6, quad_segs=6).simplify(0.05)
if water.geom_type != 'Polygon': water = max(water.geoms, key=lambda g: g.area)
water = Polygon(water.exterior)

# ---------- 桥（OSM 位置；双幅桥合一） ----------
BR = []
def bridge(k, s, w, kind, name=None, plate=None, ext=2.2, note=None):
  (cx, cz), t, n = at_s(k, s)
  b = {'id': f'{k}{len([x for x in BR if x["river"] == k]) + 1}', 'river': k, 's': round(s, 2), 'x': round(cx, 2), 'z': round(cz, 2), 't': [round(t[0], 4), round(t[1], 4)], 'n': [round(n[0], 4), round(n[1], 4)],
       'hw': HW[k], 'half': HW[k] + ext, 'w': w, 'kind': kind, 'name': name, 'plate': plate}
  if note: b['note'] = note
  BR.append(b); return b
J = lambda r: rs('ja', r); G = lambda r: rs('gm', r)
bridge('ja', J(2166), 16, 'road', '温泉公园路')
bridge('ja', J(2542), 4, 'foot', note='温泉公园步行桥（OSM 无名 footway）')
bridge('ja', J(2643), 30, 'road', '六一北路', note='六一北路双幅合一')
bridge('ja', J(3139), 14, 'road', note='OSM 无名路桥')
bridge('ja', J(3513), 26, 'road', '塔头路', note='塔头路双幅合一（东门站北侧）')
bridge('ja', J(4358), 26, 'road', note='OSM 无名次干道双幅合一')
bridge('ja', J(4875), 22, 'road', note='OSM 无名主干道')
bridge('ja', J(5401), 12, 'flat', note='OSM 无名')
bridge('ja', J(5653), 16, 'road', note='OSM 无名次干道')
bridge('ja', J(6125), 20, 'road', '国货东路', note='国货东路匝道双幅合一')
# 文博路桥（s6312）不建：1:4 后它夹在国货东路桥（47 m）和北光明港路桥（52 m）中间，坐船视角会同时看到 3 座（小美：≤ 2 座，见单测 bridgesInView）
VIEW_DROPPED = [{'river': 'ja', 'real_s': 6312, 'name': '文博路', 'why': '坐船视角 150 m 内与国货东路、北光明港路三桥同框'}]
# 北光明港路桥真实就在河口（s6522）；1:4 后离光明港岸太近（东头会落进光明港水面），往上游挪到喇叭口之前
_hk_max = ja.length - HW['gm'] - 10 - 3 - 6 - 3.0
bridge('ja', min(J(6522), _hk_max), 12, 'road', '北光明港路', note=('真实在河口 s6522；1:4 后往上游挪 %.0f m，桥头别落进光明港' % (J(6522) - _hk_max)) if J(6522) > _hk_max else None)
bridge('gm', G(2200), 30, 'road', '长乐南路', note='长乐南路双幅合一')
bridge('gm', G(2790), 30, 'road', '连江中路', note='连江中路双幅合一')
bridge('gm', G(3752), 30, 'road', '前横南路', note='前横南路双幅合一（光明港码头旁）')
BR.sort(key=lambda b: (b['river'] != 'ja', b['s']))
# 压缩后的桥距（小美）：相邻两桥桥面边到边 ≥ BRIDGE_GAP，否则去掉其中无名 / 较窄的那座（记进 DROPPED）
BRIDGE_GAP = 20.0
DROPPED = []
changed = True
while changed:
  changed = False
  for a, b in zip(BR, BR[1:]):
    if a['river'] != b['river']: continue
    gap = (b['s'] - b['w'] / 2) - (a['s'] + a['w'] / 2)
    if gap < BRIDGE_GAP:
      drop = min((a, b), key=lambda x: (x['name'] is not None, x['w']))
      keep = b if drop is a else a
      DROPPED.append({'river': drop['river'], 's': drop['s'], 'name': drop['name'], 'kind': drop['kind'], 'note': drop.get('note'), 'why': f'桥面边距 {gap:.1f} m < {BRIDGE_GAP:.0f} m（紧挨 {keep["name"] or keep["id"]}）'})
      BR.remove(drop); changed = True; break
cnt = {}
for b in BR: cnt[b['river']] = cnt.get(b['river'], 0) + 1; b['id'] = f"{b['river']}{cnt[b['river']]}"
print('dropped', DROPPED)
for b in BR: print('bridge', b['id'], b['s'], b['kind'], b['name'], b['w'])

# ---------- 码头 ----------
def bank_pier(k, s, side, nid, zh, en, note=None):
  (bx, bz), t, n = at_s(k, s, side * HW[k]); nn = (n[0] * side, n[1] * side)
  p = {'id': nid, 'zh': zh, 'en': en, 'river': k, 's': round(s, 2), 'side': side, 'x': round(bx, 2), 'z': round(bz, 2), 't': [round(t[0], 4), round(t[1], 4)], 'n': [round(nn[0], 4), round(nn[1], 4)]}
  if note: p['note'] = note
  return p
bs = {b['name']: b for b in BR if b['name']}
# 码头和桥的间距（小美）：浮码头沿河占 [s-10.2（台阶口）, s+8.4（浮码头尾）]，泊位在 s+2.4。
#   规则：码头占地离桥面边 ≥ PIER_GAP_EDGE，泊位离桥中线 ≥ PIER_GAP_CENTRE。从真实位置出发先往 prefer 方向 1 m 一步找第一个合规的位置（60 m 内），没有再往反方向。
PIER_GAP_EDGE, PIER_GAP_CENTRE = 8.0, 25.0
def pier_ok(k, s):
  for b in BR:
    if b['river'] != k: continue
    if min(s + 8.4, b['s'] + b['w'] / 2) - max(s - 10.2, b['s'] - b['w'] / 2) > -PIER_GAP_EDGE: return False
    if abs(s + 2.4 - b['s']) < PIER_GAP_CENTRE: return False
  return 12 < s < CL[k].length - (HW['gm'] + 14 if k == 'ja' else 30)
def pier_s(k, s0, prefer):
  for sg in (prefer, -prefer):            # 先只往 prefer 方向找（最多 60 m），找不到再往回找
    for d in range(0, 61):
      if pier_ok(k, s0 + sg * d): return float(s0 + sg * d), sg * d
  raise SystemExit('no pier spot near ' + str(s0))
PIER_MOVES = {}
def place(k, real, prefer, side, nid, zh, en, note):
  s0 = rs(k, real); s, dd = pier_s(k, s0, prefer); PIER_MOVES[nid] = round(dd, 1)
  return bank_pier(k, s, side, nid, zh, en, note + (f'；按桥距规则挪 {dd:+.0f} m（游戏米，+ = 顺流）' if abs(dd) >= 1 else ''))
wq = place('ja', 2167, 1, 1, 'wq', '温泉公园码头', 'Wenquan Park Pier', '真实在温泉公园路桥旁（OSM s2167）')
fx = place('ja', 2640, 1, 1, 'fx', '福新问渡码头', 'Fuxin Wendu Pier', '真实在六一北路桥旁（s2640）')
dm = place('ja', 3600, 1, -1, 'dmn', '东门停靠点', 'Dongmen Boat Stop', '游戏增设（现实无码头，东门站旁 s3600）；牌子不写“码头”')
hk = place('ja', 6480, -1, 1, 'hk', '河口码头', 'Hekou Pier', '真实在晋安河口（s6480，光明港夜市旁）')
gmp = place('gm', 3898, 1, 1, 'gmg', '光明港码头', 'Guangminggang Pier', '真实在前横南路桥东（光明港 s3898）')
print('pier moves (game m)', PIER_MOVES)
PIERS = [wq, fx, dm, hk, gmp]
for p in PIERS: print('pier', p['id'], p['river'], p['s'], p['side'], p['x'], p['z'])
DRY = []; GAPS = []
def pier_geo(p):
  x, z = p['x'], p['z']; t = p['t']; n = p['n']
  def P(a, b): return (x + t[0] * a - n[0] * b, z + t[1] * a - n[1] * b)
  return Polygon([P(-10, 0.0), P(-3.6, 0.0), P(-3.6, 1.5), P(-10, 1.5)]), Polygon([P(-3.6, 0.0), P(8.4, 0.0), P(8.4, 2.7), P(-3.6, 2.7)]), P(2.4, 2.7 + 0.4 + 1.2)
for p in PIERS:
  st, po, be = pier_geo(p); p['berth'] = [round(be[0], 2), round(be[1], 2)]; DRY += [st, po]
  x, z = p['x'], p['z']; t = p['t']; n = p['n']
  GAPS.append(Polygon([(x + t[0] * a + n[0] * b, z + t[1] * a + n[1] * b) for a, b in [(-10.2, -1), (-8.3, -1), (-8.3, 1), (-10.2, 1)]]))
  p['sign'] = [round(x + t[0] * -11.6 + n[0] * 1.6, 2), round(z + t[1] * -11.6 + n[1] * 1.6, 2)]
STEPS = []
def step_at(k, s, side, sid):
  (bx, bz), t, n = at_s(k, s, side * HW[k]); nn = (n[0] * side, n[1] * side)
  def P(a, b): return (bx + t[0] * a - nn[0] * b, bz + t[1] * a - nn[1] * b)
  STEPS.append({'id': sid, 'river': k, 's': round(s, 2), 'x': round(bx, 2), 'z': round(bz, 2), 't': [round(t[0], 4), round(t[1], 4)], 'n': [round(nn[0], 4), round(nn[1], 4)]})
  DRY.append(Polygon([P(-4.2, 0), P(4.2, 0), P(4.2, 1.4), P(-4.2, 1.4)]))
  GAPS.append(Polygon([(bx + t[0] * a + nn[0] * b, bz + t[1] * a + nn[1] * b) for a, b in [(-4.6, -1), (-1.8, -1), (-1.8, 1), (-4.6, 1)]]))
for b in BR:
  x, z, t, n, half, w = b['x'], b['z'], b['t'], b['n'], b['half'], b['w']
  GAPS.append(Polygon([(x + t[0] * a + n[0] * c, z + t[1] * a + n[1] * c) for a, c in [(-w / 2 + 0.05, -half - 0.5), (w / 2 - 0.05, -half - 0.5), (w / 2 - 0.05, half + 0.5), (-w / 2 + 0.05, half + 0.5)]]))
  b['foot'] = Polygon([(x + t[0] * a + n[0] * c, z + t[1] * a + n[1] * c) for a, c in [(-w / 2, -half), (w / 2, -half), (w / 2, half), (-w / 2, half)]])
# 水埠头：避开桥和码头
def clear_s(k, s, r=18):
  return all(abs(b['s'] - s) > b['w'] / 2 + r for b in BR if b['river'] == k) and all(abs(p['s'] - s) > r + 10 for p in PIERS if p['river'] == k)
for k, s0, side, sid in [('ja', 300, 1, 'ja_e'), ('ja', 980, -1, 'ja_w'), ('gm', 300, -1, 'gm_n')]:
  s = s0
  while not clear_s(k, s): s += 4
  step_at(k, s, side, sid)
for s_ in STEPS: print('step', s_['id'], s_['s'])

# ---------- 出口亭 ----------
KIOSK = {}; ROADS = []
def rect(cx, cz, ux, uz, a0, a1, b0, b1):
  vx, vz = uz, -ux
  return Polygon([(cx + ux * a + vx * b, cz + uz * a + vz * b) for a, b in [(a0, b0), (a1, b0), (a1, b1), (a0, b1)]])
def kiosk_near(p, code, n, along=18, off=13):
  kx = p['x'] + p['t'][0] * along + p['n'][0] * off; kz = p['z'] + p['t'][1] * along + p['n'][1] * off
  KIOSK[code] = {'code': code, 'n': n, 'x': round(kx, 2), 'z': round(kz, 2), 'pier': p['id']}
  ROADS.append({'id': 'k' + code, 'poly': box(kx - 5, kz - 8, kx + 5, kz + 3), 'plaza': True})
kiosk_near(wq, 'fzdm', 'C', 16, 14)
kiosk_near(dm, 'fzdmn', 'C', 16, 14)
kiosk_near(gmp, 'fzgmg', 'D', 18, 16)
for b in BR:
  if b['kind'] != 'road': continue
  for sg in (-1, 1):
    ROADS.append({'id': b['id'] + ('e' if sg > 0 else 'w'), 'name': b['name'], 'poly': rect(b['x'], b['z'], b['n'][0] * sg, b['n'][1] * sg, b['hw'] + 2, b['hw'] + BAND[b['river']] + 2, -b['w'] / 2, b['w'] / 2), 'dir': [b['n'][0] * sg, b['n'][1] * sg], 'w': b['w'], 'stub': True})
print('kiosks', KIOSK)

# ---------- 可走范围 / 岸地 ----------
def ext(g, m=5.0):
  c = list(g.coords); (a0, a1), (b0, b1) = c[0], c[1]; l = math.dist(c[0], c[1]); h = (a0 - (b0 - a0) / l * m, a1 - (b1 - a1) / l * m)
  (y0, y1), (z0, z1) = c[-1], c[-2]; l2 = math.dist(c[-1], c[-2]); e = (y0 + (y0 - z0) / l2 * m, y1 + (y1 - z1) / l2 * m)
  return LineString([h] + c + [e])
# 可走范围比水面两头各多 5 m（河道尽头的岸角落水回岸时不会被推到边界外）
reg = [ext(CL[k]).buffer(HW[k] + BAND[k], cap_style='flat', quad_segs=6) for k in CL] + [flare.buffer(BAND['ja'])]
reg += [r['poly'] for r in ROADS]
region = unary_union(reg).buffer(0.01).buffer(-0.01).simplify(0.1)
if region.geom_type != 'Polygon': region = max(region.geoms, key=lambda g: g.area)
region = Polygon(region.exterior)
water = water.intersection(region.buffer(-0.05)).buffer(0)
if water.geom_type != 'Polygon': water = max(water.geoms, key=lambda g: g.area)
land = region.difference(water).buffer(0)
for K_ in KIOSK.values(): land = land.difference(box(K_['x'] - 1.9, K_['z'] - 6.4, K_['x'] + 1.9, K_['z'] - 2.6)).buffer(0)
print('region', round(region.area), 'land', round(land.area))
def tri(poly):
  out = []
  for t in shapely.constrained_delaunay_triangles(poly).geoms:
    c = list(t.exterior.coords)[:3]
    if Polygon(c).area > 1e-4: out.append(c)
  return out
def ccw_up(c):
  (ax, az), (bx, bz), (cx, cz) = c
  return c if (bx - ax) * (cz - az) - (bz - az) * (cx - ax) > 0 else [c[0], c[2], c[1]]
CELL = 60
def tris_by_cell(poly):
  out = {}; minx, minz, maxx, maxz = poly.bounds
  for i in range(math.floor(minx / CELL), math.floor(maxx / CELL) + 1):
    for jz in range(math.floor(minz / CELL), math.floor(maxz / CELL) + 1):
      part = poly.intersection(box(i * CELL, jz * CELL, (i + 1) * CELL, (jz + 1) * CELL))
      if part.is_empty: continue
      geoms = [part] if part.geom_type == 'Polygon' else [g for g in getattr(part, 'geoms', []) if g.geom_type == 'Polygon']
      L = [ccw_up(c) for g in geoms if g.area >= 0.05 for c in tri(g)]
      if L: out[f'{i},{jz}'] = L
  return out
def pack(tris):
  V = {}; P = []; I = []
  for c in tris:
    for x, z in c:
      key = (round(x, 2), round(z, 2))
      if key not in V: V[key] = len(P); P.append(key)
      I.append(V[key])
  return {'p': [v for xz in P for v in xz], 'i': I}
LAND = {k: pack(v) for k, v in tris_by_cell(land).items()}
WATER = {k: pack(v) for k, v in tris_by_cell(water).items()}
mnx, mnz, mxx, mxz = region.bounds
skirt = box(mnx - 160, mnz - 160, mxx + 160, mxz + 160).difference(region).buffer(0).simplify(1.0)
def tris_flat(poly):
  out = []
  for g in (poly.geoms if hasattr(poly, 'geoms') else [poly]):
    if g.geom_type == 'Polygon' and g.area > 0.5: out += [ccw_up(c) for c in tri(g)]
  return out
SKIRT = pack(tris_flat(skirt))
# 远处河道（可走范围外的晋安河上游 / 光明港两头）：只画水面（无碰撞），免得河在边界墙处“断掉”
far = []
for (k, a, b) in [('ja', -1, 0), ('gm', -1, 0), ('gm', 1, 0)]:
  pass
print('land cells', len(LAND), 'tris', sum(len(v['i']) // 3 for v in LAND.values()), 'water cells', len(WATER), 'tris', sum(len(v['i']) // 3 for v in WATER.values()), 'skirt', len(SKIRT['i']) // 3)

# ---------- 岸墙 + 栏杆 ----------
ends = []
for k in CL:
  for s in (0.0, CL[k].length):
    (x, z), t, n = at_s(k, s); ends.append((k, x, z, t))
gapU = unary_union(GAPS)
def seg_kind(a, b):
  mx, mz = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
  for k, x, z, t in ends:
    if math.hypot(mx - x, mz - z) < HW[k] + 0.5:
      dx_, dz_ = b[0] - a[0], b[1] - a[1]; l = math.hypot(dx_, dz_) or 1
      if abs(dx_ / l * t[0] + dz_ / l * t[1]) < 0.3: return 'cap'
  return 'bank'
WALL = []
for ring in [water.exterior] + list(water.interiors):
  c = list(ring.coords)
  for a, b in zip(c, c[1:]):
    kd = seg_kind(a, b); L = math.dist(a, b)
    if kd != 'bank': WALL.append([round(a[0], 2), round(a[1], 2), round(b[0], 2), round(b[1], 2), 2]); continue
    n = max(1, math.ceil(L / 2.0))
    for i in range(n):
      p0 = (a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n); p1 = (a[0] + (b[0] - a[0]) * (i + 1) / n, a[1] + (b[1] - a[1]) * (i + 1) / n)
      m = Point((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2)
      WALL.append([round(p0[0], 2), round(p0[1], 2), round(p1[0], 2), round(p1[1], 2), 1 if gapU.contains(m) else 0])
def merge(W):
  out = []
  for w in W:
    if out:
      o = out[-1]
      if o[4] == w[4] and abs(o[2] - w[0]) < 1e-3 and abs(o[3] - w[1]) < 1e-3:
        a1 = math.atan2(o[3] - o[1], o[2] - o[0]); a2 = math.atan2(w[3] - w[1], w[2] - w[0]); da = abs((a1 - a2 + math.pi) % (2 * math.pi) - math.pi)
        if da < math.radians(4) and math.dist(o[:2], w[2:4]) < 24: o[2], o[3] = w[2], w[3]; continue
    out.append(list(w))
  return out
WALL = merge(WALL)
for w in WALL:
  L_ = math.dist(w[:2], w[2:4]) or 1; dx_, dz_ = (w[2] - w[0]) / L_, (w[3] - w[1]) / L_; rx, rz = dz_, -dx_
  mx, mz = (w[0] + w[2]) / 2, (w[1] + w[3]) / 2
  w.append(1 if water.contains(Point(mx + rx * 0.25, mz + rz * 0.25)) else -1)
print('wall segs', len(WALL), {f: sum(1 for w in WALL if w[4] == f) for f in range(4)})
BOUND = [[round(x, 2), round(z, 2)] for x, z in Polygon(region.exterior).simplify(0.3).exterior.coords]

# ---------- 房子（现代楼，远段稀一些）/ 榕树 ----------
random.seed(11)
HOUSES = []; TREES = []
occ = unary_union([water.buffer(7.5)] + [r['poly'].buffer(0.5) for r in ROADS] + [b['foot'].buffer(3) for b in BR])
def try_house(poly, h, ry, info):
  global occ
  if not region.buffer(-0.5).contains(poly) or poly.intersects(occ): return False
  occ = occ.union(poly.buffer(0.6)); HOUSES.append({**info, 'h': h, 'kind': 'mod', 'ry': round(ry, 4)}); return True
for k in CL:
  g = CL[k]; hw = HW[k]; band = BAND[k]
  for side in (-1, 1):
    s = 4.0
    while s < g.length - 4:
      w = random.uniform(16, 24); d_ = random.uniform(10, 13); h = random.choice([15, 18, 21, 24])   # 立面贴图最多 8 层（fzRiver.js facades）
      off = hw + band - 1.0 - d_ / 2
      (cx, cz), t, n = at_s(k, s + w / 2, side * off); ry = math.atan2(t[0], t[1])
      poly = Polygon([(cx + t[0] * a + n[0] * side * b, cz + t[1] * a + n[1] * side * b) for a, b in [(-w / 2, -d_ / 2), (w / 2, -d_ / 2), (w / 2, d_ / 2), (-w / 2, d_ / 2)]])
      fx_, fz_ = -n[0] * side, -n[1] * side
      ok = try_house(poly, h, ry, {'x': round(cx, 2), 'z': round(cz, 2), 'w': round(w, 2), 'd': round(d_, 2), 't': [round(t[0], 4), round(t[1], 4)], 'f': [round(fx_, 4), round(fz_, 4)], 'river': k})
      s += w + (random.uniform(4, 9) if ok else 3.0)   # 比 1A 稀：楼间留绿地（预算）
print('houses', len(HOUSES))
treeOcc = unary_union([b['foot'].buffer(2.5) for b in BR] + [g.buffer(1.5) for g in GAPS] + [r['poly'] for r in ROADS if not r.get('plaza')] + [box(K_['x'] - 6, K_['z'] - 8, K_['x'] + 6, K_['z'] + 4) for K_ in KIOSK.values()] + [p.buffer(1.0) for p in DRY])
for k in CL:
  g = CL[k]; hw = HW[k]
  for side in (-1, 1):
    s = random.uniform(3, 8)
    while s < g.length - 3:
      (x, z), t, n = at_s(k, s, side * (hw + 1.7)); P = Point(x, z)
      if region.contains(P) and not water.buffer(1.0).contains(P) and not treeOcc.contains(P):
        TREES.append([round(x, 2), round(z, 2), round(-n[0] * side, 3), round(-n[1] * side, 3), round(random.uniform(0.85, 1.15), 2), k])
      s += random.uniform(15, 22)
print('trees', len(TREES))

# ---------- 船线 B ----------
def ss(e0, e1, x):
  u = min(1, max(0, (x - e0) / (e1 - e0))); return u * u * (3 - 2 * u)
def latfn(k, first=None, last=None):
  ps = [p for p in PIERS if p['river'] == k]
  def f(s):
    best = 0.0
    for p in ps:
      sp = p['s']; boff = p['side'] * (HW[k] - 4.3)
      up = 1.0 if p is first else ss(sp - 48, sp - 15, s)
      dn = 1.0 if p is last else (1 - ss(sp + 18, sp + 50, s))
      w = up * dn
      if abs(boff * w) > abs(best): best = boff * w
    return best
  return f
def path_for(k, s0, s1, lf, step=1.0):
  out = []; n = max(2, int(abs(s1 - s0) / step))
  for i in range(n + 1):
    s = s0 + (s1 - s0) * i / n; (x, z), t, nn = at_s(k, s, lf(s)); out.append((x, z))
  return out
def hermite(p0, t0, p1, t1, n=24):
  L = math.dist(p0, p1) * 0.7; out = []
  for i in range(1, n):
    u = i / n; h00 = 2*u**3 - 3*u**2 + 1; h10 = u**3 - 2*u**2 + u; h01 = -2*u**3 + 3*u**2; h11 = u**3 - u**2
    out.append((h00*p0[0] + h10*L*t0[0] + h01*p1[0] + h11*L*t1[0], h00*p0[1] + h10*L*t0[1] + h01*p1[1] + h11*L*t1[1]))
  return out
def tdir(a, b): l = math.dist(a, b); return ((b[0] - a[0]) / l, (b[1] - a[1]) / l)
jaLeg = path_for('ja', wq['s'] - 12, ja.length - HW['gm'] - 8, latfn('ja', first=wq))
gmLeg = path_for('gm', SJ + HW['ja'] + 10, gmp['s'] + 14, latfn('gm', last=gmp))
pts = jaLeg + hermite(jaLeg[-1], tdir(jaLeg[-2], jaLeg[-1]), gmLeg[0], tdir(gmLeg[0], gmLeg[1]), 40) + gmLeg
rl = LineString(chaikin(pts, 2)).simplify(0.03)
L = rl.length; RP = []
for i in range(int(L) + 1): q = rl.interpolate(i); RP.append([round(q.x, 2), round(q.y, 2)])
STOPS = []
for p in PIERS:
  s = rl.project(Point(*p['berth'])); q = rl.interpolate(s)
  STOPS.append({'id': p['id'], 's': round(s, 2), 'd': round(math.dist((q.x, q.y), p['berth']), 2)})
dryU = unary_union(DRY); navi = water.difference(dryU.buffer(0.08)); bad = []
for i in range(2, len(RP) - 2):
  a, b = RP[i - 2], RP[i + 2]; tx, tz = tdir(a, b); nx, nz = tz, -tx; x, z = RP[i]
  nearB = min(math.dist((x, z), p['berth']) for p in PIERS) < 14.5
  for u, v in [(-4, -1.2), (4, -1.2), (4, 1.2), (-4, 1.2), (0, 1.2), (0, -1.2)]:
    q = Point(x + tx * u + nx * v, z + tz * u + nz * v)
    if not (navi.buffer(-0.1) if nearB else navi.buffer(-0.3)).contains(q): bad.append((i, round(q.x, 1), round(q.y, 1))); break
print('hull outside water at', len(bad), bad[:12])
# 速度分区（小美）：晋安河窄，全程 3.5 m/s（同 A 线）；进出码头、过桥也 3.5；只有开阔的光明港段（出了河口转弯以后）快到 5.5，平滑加减速
FAST0 = rl.project(Point(*gmLeg[0]))
ZONES = {'cruise': 3.5, 'fast': [round(FAST0, 1), round(L, 1)], 'vFast': 5.5, 'vBridge': 3.5, 'vPier': 3.5, 'pierZone': 45}
print('zones', ZONES)
print('route len', round(L, 1), 'stops', STOPS, 'minR', minRat(LineString(RP))[0])

def r2(v): return round(v, 2)
DATA = {
  'id': 'e', 'K': K, 'Kgm': K_GM, 'WY': WY,
  'rivers': {k: {'zh': NAME[k][0], 'en': NAME[k][1], 'hw': HW[k], 'band': BAND[k], 'p': [v for x, z in CL[k].coords for v in (r2(x), r2(z))]} for k in CL},
  'land': LAND, 'water': WATER, 'cell': CELL, 'skirt': SKIRT, 'lakeFar': {'p': [], 'i': []}, 'lakeShore': [],
  'wall': WALL, 'bound': BOUND,
  'bridges': [{k_: v for k_, v in b.items() if k_ != 'foot'} for b in BR],
  'piers': PIERS, 'steps': STEPS, 'dry': [[v for x, z in list(p.exterior.coords)[:-1] for v in (r2(x), r2(z))] for p in DRY],
  'kiosks': KIOSK, 'roads': [{**{k_: v for k_, v in r.items() if k_ != 'poly'}, 'poly': [v for x, z in list(r['poly'].exterior.coords)[:-1] for v in (r2(x), r2(z))]} for r in ROADS],
  'sfqx': None, 'houses': HOUSES, 'trees': TREES,
  'spacing': {'bridgeGap': BRIDGE_GAP, 'pierGapEdge': PIER_GAP_EDGE, 'pierGapCentre': PIER_GAP_CENTRE, 'dropped': DROPPED + VIEW_DROPPED, 'pierMoves': PIER_MOVES},
  'route': {'id': 'B', 'canopy': 'white', 'zones': ZONES, 'p': [v for xz in RP for v in xz], 'stops': STOPS},
}
js = ('// 自动生成：tools/fzriver/gen_e.py（OSM 晋安河 1:4 + 光明港 1:5 → 游戏坐标；x 东、z 北，原点 = 东街口站 / 3）。不要手改。\n'
      'export const FZR_E = ' + json.dumps(DATA, ensure_ascii=False, separators=(',', ':')) + ';\n')
open(OUT, 'w').write(js); print('wrote', OUT, len(js))
