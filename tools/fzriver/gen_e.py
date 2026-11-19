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
kiosk_clear = (
  [LineString([(K_['x'], K_['z']), (K_['x'], K_['z'] + 28)]).buffer(9) for K_ in KIOSK.values()]
  + [LineString([(K_['x'], K_['z'] + 1), (p['x'], p['z'])]).buffer(10) for K_ in KIOSK.values() for p in PIERS if p['id'] == K_['pier']]
  + [LineString([(K_['x'], K_['z'] + 1), (p['sign'][0], p['sign'][1])]).buffer(8) for K_ in KIOSK.values() for p in PIERS if p['id'] == K_['pier']]
)
occ = unary_union([water.buffer(7.5)] + [r['poly'].buffer(0.5) for r in ROADS] + [b['foot'].buffer(3) for b in BR] + kiosk_clear)
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


# =====================================================================================================
# 3A（PLAN-3 §3 / §8 小美定稿）：光明港东段（光明港码头 → 魁岐九门闸，1:5）+ 九门闸（只看不过船、人不能上）+ 闸外闽江远景 + D 线（白篷）光明港码头 ⇄ 魁岐停靠点
#   1B 已验收的部分一律不动（同 2C 接白马河下段的做法）：上面算好的 1B 码头 / 桥 / 房子 / 树 / B 线逐个不变；岸地 / 水面格子几何没变的沿用旧三角网；
#   岸墙只换掉旧光明港东头那道封口（和接缝两边并段）；房子 / 树追加在列表末尾（颜色按下标取，1B 的下标不动）。
#   输入 gm_east_osm_m.json（tools/fzriver/osm_3a.py 从 OSM relation 11108281 竖切 / 横切取中线 + 魁岐坝 + 有名路桥）
# =====================================================================================================
A3 = os.environ.get('FZR_3A', '1') != '0'
if A3:
  E3 = json.load(open(os.path.join(HERE, 'gm_east_osm_m.json')))
  gmA = CL['gm']; GM_A_LEN = gmA.length
  _p0 = RG.interpolate(GM1); _real = [(_p0.x, _p0.y)] + [(x, z) for x, z, _ in E3['mid'] if x > _p0.x + 20 or z < -3200] + [tuple(E3['gate'])]
  _rE = LineString(_real).simplify(float(os.environ.get('FZR_3A_SIMP', 14.0)))
  _gE = scG(list(_rE.coords)); _e0 = gmA.coords[-1]; _t0 = tan('gm', GM_A_LEN)
  _gE = [_e0, (_e0[0] + _t0[0] * 14, _e0[1] + _t0[1] * 14)] + [c for c in _gE if math.dist(c, _e0) > 30]
  gmE = LineString(chaikin(_gE, 4)).simplify(0.12)
  gmF = LineString(list(gmA.coords) + list(gmE.coords)[1:])
  print('3A junction minR', minRat(LineString([c for c in gmF.coords if math.dist(c, _e0) < 60])))
  print('3A gmE len', round(gmE.length, 1), 'pts', len(gmE.coords), 'minR', minRat(gmE), 'full gm len', round(gmF.length, 1), 'end', gmE.coords[-1])
  CL['gm'] = gmF   # 从这里起 at_s('gm', …) 用全长（1B 段坐标是前缀，一点不动）
  L3 = gmF.length
  # ---- 已经算好的 1B 结果，留一份做差分 / 沿用 ----
  water1B, region1B, land1B = water, region, land
  LAND1B, WATER1B, WALL1B = LAND, WATER, WALL
  # ---- 桥：OSM 有名字的路桥只有福光南路（双幅合一）；再往东（南北向一段）没核过桥，不放 ----
  _nb0 = len(BR)
  for nm, info in E3['bridges'].items():
    if nm == '前横南路': continue   # 1B 已有（gm3）
    _c = Point(*scG([tuple(min(info, key=lambda q: q['c'][0])['c'])])[0]); _s = gmF.project(_c)
    assert _s > GM_A_LEN, (nm, _s)
    _b = bridge('gm', _s, 30, 'road', nm, note=nm + '双幅合一（3A）'); _b['a3'] = 1
  BR3 = BR[_nb0:]
  for b in BR3: print('3A bridge', b['id'], b['name'], b['s'])
  for b in BR3:
    x, z, t, n, half, w = b['x'], b['z'], b['t'], b['n'], b['half'], b['w']
    GAPS.append(Polygon([(x + t[0] * a + n[0] * c, z + t[1] * a + n[1] * c) for a, c in [(-w / 2 + 0.05, -half - 0.5), (w / 2 - 0.05, -half - 0.5), (w / 2 - 0.05, half + 0.5), (-w / 2 + 0.05, half + 0.5)]]))
    b['foot'] = Polygon([(x + t[0] * a + n[0] * c, z + t[1] * a + n[1] * c) for a, c in [(-w / 2, -half), (w / 2, -half), (w / 2, half), (-w / 2, half)]])
  ROADS3 = []
  for b in BR3:
    for sg in (-1, 1):
      ROADS3.append({'id': b['id'] + ('e' if sg > 0 else 'w'), 'name': b['name'], 'poly': rect(b['x'], b['z'], b['n'][0] * sg, b['n'][1] * sg, b['hw'] + 2, b['hw'] + BAND['gm'] + 2, -b['w'] / 2, b['w'] / 2), 'dir': [b['n'][0] * sg, b['n'][1] * sg], 'w': b['w'], 'stub': True, 'a3': True})
  # ---- 九门闸（闸墩 + 九孔灰闸门 + 启闭房，同 2C 彬德水闸做法；只看，不过船、人上不去）----
  GATE_S = round(L3 - 4.5, 2)
  (_gx, _gz), _gt, _gn = at_s('gm', GATE_S)
  KQ_SIDE = 1   # 魁岐停靠点 / 观景处都在右岸（南北向一段 = 西岸），和光明港码头同一侧
  GATE = {'s': GATE_S, 'x': round(_gx, 2), 'z': round(_gz, 2), 't': [round(_gt[0], 4), round(_gt[1], 4)], 'n': [round(_gn[0], 4), round(_gn[1], 4)], 'hw': HW['gm'], 'bays': 9,
          'view': [round(v, 2) for v in at_s('gm', GATE_S - 30.0, KQ_SIDE * (HW['gm'] + 3.0))[0]], 'side': KQ_SIDE,
          # 小美 11-17：观景处原来在闸旁（L3 − 3），正对闸头石墩、看不见九孔 → 挪到闸上游 30 m 岸边步道，正面看全九孔；原位置只留作「看闽江」取景点（mjView）
          'mjView': [round(v, 2) for v in at_s('gm', L3 - 3.0, KQ_SIDE * (HW['gm'] + 6.5))[0]]}
  # 不让人上闸：闸的整个占地（闸墩 a −2.4…2.2，横向两头各伸进岸上 1.2 m）一块看不见的高碰撞体 + 岸上闸头两侧矮铁栏（fzRiver.js a3Gate）
  _blk = [(-3.2, -(HW['gm'] + 1.2)), (3.0, -(HW['gm'] + 1.2)), (3.0, HW['gm'] + 1.2), (-3.2, HW['gm'] + 1.2)]
  GATE['block'] = [[round(GATE['x'] + _gt[0] * a + _gn[0] * b_, 2), round(GATE['z'] + _gt[1] * a + _gn[1] * b_, 2)] for a, b_ in _blk]
  print('3A gate', GATE)
  # ---- 魁岐停靠点（游戏增设：魁岐一带真实码头位置未核实）——闸上游，木牌只写停靠点名 ----
  KQ_S = round(GATE_S - 62.0, 2)
  kq = bank_pier('gm', KQ_S, KQ_SIDE, 'kq', '魁岐停靠点', 'Kuiqi Stop', '游戏增设（魁岐一带真实码头位置未核实）；牌子只写停靠点名，不写线路、下一站（小美 3A ③）')
  kq['stopOnly'] = True
  _st, _po, _be = pier_geo(kq); kq['berth'] = [round(_be[0], 2), round(_be[1], 2)]; DRY.extend([_st, _po])
  GAPS.append(Polygon([(kq['x'] + kq['t'][0] * a + kq['n'][0] * b_, kq['z'] + kq['t'][1] * a + kq['n'][1] * b_) for a, b_ in [(-10.2, -1), (-8.3, -1), (-8.3, 1), (-10.2, 1)]]))
  kq['sign'] = [round(kq['x'] + kq['t'][0] * -11.6 + kq['n'][0] * 1.6, 2), round(kq['z'] + kq['t'][1] * -11.6 + kq['n'][1] * 1.6, 2)]
  for b in BR:
    if b['river'] == 'gm': assert min(KQ_S + 8.4, b['s'] + b['w'] / 2) - max(KQ_S - 10.2, b['s'] - b['w'] / 2) <= -PIER_GAP_EDGE and abs(KQ_S + 2.4 - b['s']) >= PIER_GAP_CENTRE, ('kq vs bridge', b['id'])
  # ---- 光明港码头 D 线泊位（共用 B 线台阶和木牌；B 线浮码头尾往下游接一段浮动栈道到 D 泊位，同 2C 西水关 C 线泊位）----
  def bandG(s0, s1, b0, b1, sd, n_=24):
    L_ = [at_s('gm', s0 + (s1 - s0) * i / n_, sd * (HW['gm'] - b0))[0] for i in range(n_ + 1)]
    R_ = [at_s('gm', s0 + (s1 - s0) * i / n_, sd * (HW['gm'] - b1))[0] for i in range(n_ + 1)]
    return Polygon(L_ + R_[::-1])
  def hullAt(s, lat, L_=4.0, W_=1.2):
    (x, z), t, n = at_s('gm', s, lat); return Polygon([(x + t[0] * u + n[0] * v, z + t[1] * u + n[1] * v) for u, v in [(-L_, -W_), (L_, -W_), (L_, W_), (-L_, W_)]])
  def hull_poly(R_, i, L_=4.0, W_=1.2):
    a, b = R_[max(0, i - 2)], R_[min(len(R_) - 1, i + 2)]; tx, tz = tdir(a, b); nx, nz = tz, -tx; x, z = R_[i]
    return Polygon([(x + tx * u + nx * v, z + tz * u + nz * v) for u, v in [(-L_, -W_), (L_, -W_), (L_, W_), (-L_, W_)]])
  _sdg = gmp['side']; _bdock = hull_poly(RP, int(round([st['s'] for st in STOPS if st['id'] == 'gmg'][0])))
  _poB = pier_geo(gmp)[1]
  GMGD_S = None
  for _i in range(0, 300):
    sd_ = gmp['s'] + 8.0 + _i * 0.1; hd = hullAt(sd_, _sdg * (HW['gm'] - 3.0))
    if hd.buffer(0.6).intersects(_bdock) or hd.buffer(0.3).intersects(_poB) or math.dist(at_s('gm', sd_, _sdg * (HW['gm'] - 3.0))[0], gmp['berth']) < 12.2: continue   # 泊位间距 ≥ 12 m（船长 8 m + 间隙，同 2C）
    GMGD_S = round(sd_, 2); break
  assert GMGD_S and GMGD_S < GM_A_LEN - 6, ('no room for D berth at gmg', GMGD_S)
  gmgD = bank_pier('gm', GMGD_S, _sdg, 'gmgD', gmp['zh'], gmp['en'], 'D 线泊位：和 B 线共用光明港码头的台阶、木牌（同 2C 西水关 C 线泊位）')
  gmgD['shared'] = 'gmg'; gmgD['sign'] = list(gmp['sign'])
  (_bx, _bz), _, _ = at_s('gm', GMGD_S, _sdg * (HW['gm'] - 3.0)); gmgD['berth'] = [round(_bx, 2), round(_bz, 2)]
  print('3A gmgD', GMGD_S, 'ds', round(GMGD_S - gmp['s'], 2), 'kq', KQ_S)
  PIERS3 = [gmgD, kq]
  # ---- 水面 / 可走范围（只并上去，不重新 buffer 1B 的那块）----
  chanE = unary_union([gmE.buffer(HW['gm'], cap_style='flat', join_style='round', quad_segs=6), Point(gmA.coords[-1]).buffer(HW['gm'], quad_segs=6)]).simplify(0.05)
  regE = unary_union([gmE.buffer(HW['gm'] + BAND['gm'], cap_style='flat', quad_segs=6), Point(gmA.coords[-1]).buffer(HW['gm'] + BAND['gm'], quad_segs=6)] + [r['poly'] for r in ROADS3]).simplify(0.1)
  region = region1B.union(regE).buffer(0)
  if region.geom_type != 'Polygon': region = max(region.geoms, key=lambda g: g.area)
  region = Polygon(region.exterior)
  water = water1B.union(chanE.intersection(region.buffer(-0.05))).buffer(0)   # 1B 水面原样并上（不重新裁，岸线一点不动）
  if water.geom_type != 'Polygon': water = max(water.geoms, key=lambda g: g.area)
  land = region.difference(water).buffer(0)
  for K_ in KIOSK.values(): land = land.difference(box(K_['x'] - 1.9, K_['z'] - 6.4, K_['x'] + 1.9, K_['z'] - 2.6)).buffer(0)
  def _keep_old(new_, newPoly, oldPoly, old_):
    n_ = 0
    for k_ in list(new_):
      if k_ not in old_: continue
      i_, j_ = map(int, k_.split(',')); cb = box(i_ * CELL, j_ * CELL, (i_ + 1) * CELL, (j_ + 1) * CELL)
      if newPoly.intersection(cb).symmetric_difference(oldPoly.intersection(cb)).area < 0.01: new_[k_] = old_[k_]; n_ += 1
    return n_
  LAND = {k_: pack(v) for k_, v in tris_by_cell(land).items()}; WATER = {k_: pack(v) for k_, v in tris_by_cell(water).items()}
  print('3A cells kept from 1B: land', _keep_old(LAND, land, land1B, LAND1B), '/', len(LAND), 'water', _keep_old(WATER, water, water1B, WATER1B), '/', len(WATER))
  # ---- 闽江远景（闸外；只看不走）：江面低 0.6 m、岸墙、闸两侧岸头观景石栏；对岸树 / 楼在 fzRiver.js（白天才画）----
  (_mx, _mz), _mt, _mn = at_s('gm', L3)
  MJ_LV = WY - 0.6
  def Lc(a, b_): return (_mx + _mt[0] * a + _mn[0] * b_, _mz + _mt[1] * a + _mn[1] * b_)
  mjPoly = Polygon([Lc(0, -430), Lc(0, 430), Lc(230, 430), Lc(230, -430)]).difference(region).buffer(0)
  if mjPoly.geom_type != 'Polygon': mjPoly = max(mjPoly.geoms, key=lambda g: g.area)
  MJ_SHORE = []
  for (x0, z0), (x1, z1) in zip(list(mjPoly.exterior.coords), list(mjPoly.exterior.coords)[1:]):
    if math.hypot(x1 - x0, z1 - z0) < 0.05: continue
    m_ = Point((x0 + x1) / 2, (z0 + z1) / 2)
    if water.buffer(0.3).contains(m_) or not region.buffer(0.3).contains(m_): continue
    MJ_SHORE.append([round(x0, 2), round(z0, 2), round(x1, 2), round(z1, 2)])
  _rl = region.exterior.intersection(Point(_mx, _mz).buffer(HW['gm'] + BAND['gm'] + 4)).difference(water.buffer(0.3))
  MJ_RAIL = []
  for g_ in (_rl.geoms if hasattr(_rl, 'geoms') else [_rl]):
    if g_.geom_type != 'LineString': continue
    c_ = list(g_.simplify(0.2).coords)
    for a, b_ in zip(c_, c_[1:]):
      m_ = ((a[0] + b_[0]) / 2, (a[1] + b_[1]) / 2); u_ = (m_[0] - _mx) * _mt[0] + (m_[1] - _mz) * _mt[1]
      if math.dist(a, b_) > 0.3 and u_ > -1.0: MJ_RAIL.append([round(a[0], 2), round(a[1], 2), round(b_[0], 2), round(b_[1], 2)])
  MJ = {'lv': MJ_LV, 'water': pack(tris_flat(mjPoly)), 'shore': MJ_SHORE, 'rail': MJ_RAIL, 'o': [round(_mx, 2), round(_mz, 2)], 't': [round(_mt[0], 4), round(_mt[1], 4)], 'n': [round(_mn[0], 4), round(_mn[1], 4)], 'far': [170, -430, 430]}   # 小美 11-17：对岸 230 → 170 m（河面雾 200 m 起：楼 / 地面 / 堤岸在雾前，不再像半透明白板）
  print('3A minjiang tris', len(MJ['water']['i']) // 3, 'shore', len(MJ_SHORE), 'rail', len(MJ_RAIL))
  # ---- 岸墙：旧的段在新水面边界上（两端 + 中点都在）就原样留着；新水面边界上没被旧段盖住的地方按 1B 同一套规则补（2 m 一段 → 并段）----
  gapU = unary_union(GAPS)
  _bnd = water.exterior; _on = lambda x, z: _bnd.distance(Point(x, z)) < 0.02
  _wd = water.symmetric_difference(water1B).buffer(0); _wd = unary_union([g for g in getattr(_wd, 'geoms', [_wd]) if g.area > 0.5])   # 并集重排节点留下的 1e-6 级碎片不算
  print('3A water changed area', round(_wd.area, 1), 'bounds', [round(v, 1) for v in _wd.bounds])
  WALL_keep = [w for w in WALL1B if LineString([(w[0], w[1]), (w[2], w[3])]).distance(_wd) > 0.5]
  _keepU = unary_union([LineString([(w[0], w[1]), (w[2], w[3])]) for w in WALL_keep]).buffer(0.3)
  _endG = (_mx, _mz)
  def kind3(a, b_):
    mx_, mz_ = (a[0] + b_[0]) / 2, (a[1] + b_[1]) / 2
    if math.hypot(mx_ - _endG[0], mz_ - _endG[1]) < HW['gm'] + 0.5:
      dx_, dz_ = b_[0] - a[0], b_[1] - a[1]; l_ = math.hypot(dx_, dz_) or 1
      if abs(dx_ / l_ * _mt[0] + dz_ / l_ * _mt[1]) < 0.3: return 4   # 4 = 口门（闸外就是闽江，不画暗洞；同 2C）
    return None
  W3 = []
  for c_ in [list(r_.coords) for r_ in [water.exterior] + list(water.interiors)]:
   for a, b_ in zip(c_, c_[1:]):
    L_ = math.dist(a, b_); n_ = max(1, math.ceil(L_ / 2.0))
    for i in range(n_):
      p0 = (a[0] + (b_[0] - a[0]) * i / n_, a[1] + (b_[1] - a[1]) * i / n_); p1 = (a[0] + (b_[0] - a[0]) * (i + 1) / n_, a[1] + (b_[1] - a[1]) * (i + 1) / n_)
      m_ = Point((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2)
      if _keepU.contains(m_): continue
      kd = kind3(p0, p1)
      W3.append([round(p0[0], 2), round(p0[1], 2), round(p1[0], 2), round(p1[1], 2), kd if kd else (1 if gapU.contains(m_) else 0)])
  W3 = merge(W3)
  for w in W3:
    L_ = math.dist(w[:2], w[2:4]) or 1; dx_, dz_ = (w[2] - w[0]) / L_, (w[3] - w[1]) / L_; rx, rz = dz_, -dx_
    mx_, mz_ = (w[0] + w[2]) / 2, (w[1] + w[3]) / 2
    w.append(1 if water.contains(Point(mx_ + rx * 0.25, mz_ + rz * 0.25)) else -1)
  WALL = WALL_keep + W3
  print('3A walls: kept', len(WALL_keep), '/', len(WALL1B), 'new', len(W3), {f: sum(1 for w in W3 if w[4] == f) for f in range(5)})
  BOUND = [[round(x, 2), round(z, 2)] for x, z in Polygon(region1B.exterior).simplify(0.3).union(regE.simplify(0.3)).buffer(0).exterior.coords]
  mnx, mnz, mxx, mxz = region.bounds
  skirt = box(mnx - 160, mnz - 160, mxx + 160, mxz + 160).difference(region).difference(mjPoly).buffer(0).simplify(1.0)
  SKIRT = pack(tris_flat(skirt))
  # ---- 房子 / 榕树（3A 段两岸；另一串随机数，追加在末尾；四面都贴立面，2C 教训）----
  R3 = random.Random(311)
  _nH, _nT = len(HOUSES), len(TREES)
  _view = Point(*GATE['mjView'])   # 房 / 树的避让仍按原观景处（挪观景处不重排房树）
  occ3 = unary_union([water.buffer(7.5)] + [r['poly'].buffer(0.5) for r in ROADS + ROADS3] + [b['foot'].buffer(3) for b in BR]
                     + [Polygon(GATE['block']).buffer(14), _view.buffer(16), Point(*kq['sign']).buffer(10), LineString([(kq['x'], kq['z']), tuple(kq['sign'])]).buffer(8)]
                     + [Polygon([(h['x'] + h['t'][0] * a + h['f'][0] * b_ * -1, h['z'] + h['t'][1] * a + h['f'][1] * b_ * -1) for a, b_ in [(-h['w'] / 2, -h['d'] / 2), (h['w'] / 2, -h['d'] / 2), (h['w'] / 2, h['d'] / 2), (-h['w'] / 2, h['d'] / 2)]]).buffer(0.6) for h in HOUSES])
  for side in (-1, 1):
    s_ = GM_A_LEN + 6.0
    while s_ < L3 - 10:
      w_ = R3.uniform(16, 24); d_ = R3.uniform(10, 13); h_ = R3.choice([15, 18, 21, 24])
      off = HW['gm'] + BAND['gm'] - 1.0 - d_ / 2
      (cx, cz), t, n = at_s('gm', s_ + w_ / 2, side * off); ry = math.atan2(t[0], t[1])
      poly = Polygon([(cx + t[0] * a + n[0] * side * b_, cz + t[1] * a + n[1] * side * b_) for a, b_ in [(-w_ / 2, -d_ / 2), (w_ / 2, -d_ / 2), (w_ / 2, d_ / 2), (-w_ / 2, d_ / 2)]])
      ok_ = region.buffer(-0.5).contains(poly) and not poly.intersects(occ3)
      if ok_:
        occ3 = occ3.union(poly.buffer(0.6))
        HOUSES.append({'x': round(cx, 2), 'z': round(cz, 2), 'w': round(w_, 2), 'd': round(d_, 2), 't': [round(t[0], 4), round(t[1], 4)], 'f': [round(-n[0] * side, 4), round(-n[1] * side, 4)], 'river': 'gm', 'h': h_, 'kind': 'mod', 'ry': round(ry, 4), 'back': True, 'a3': True})
      s_ += w_ + (R3.uniform(5, 10) if ok_ else 3.0)
  treeOcc3 = unary_union([b['foot'].buffer(2.5) for b in BR] + [g.buffer(1.5) for g in GAPS] + [r['poly'] for r in ROADS3] + [p.buffer(1.0) for p in DRY] + [Polygon(GATE['block']).buffer(4), _view.buffer(5)])
  for side in (-1, 1):
    s_ = GM_A_LEN + R3.uniform(3, 8)
    while s_ < L3 - 6:
      (x, z), t, n = at_s('gm', s_, side * (HW['gm'] + 1.7)); P_ = Point(x, z)
      if region.contains(P_) and not water.buffer(1.0).contains(P_) and not treeOcc3.contains(P_) and all(math.hypot(x - t_[0], z - t_[1]) > 6 for t_ in TREES[-40:]):
        TREES.append([round(x, 2), round(z, 2), round(-n[0] * side, 3), round(-n[1] * side, 3), round(R3.uniform(0.85, 1.15), 2), 'gm', 1])
      s_ += R3.uniform(15, 22)
  # 小美 11-17：新观景处（闸上游 30 m）看九门闸的视线里不留榕树（岸边一排树离栏杆只有 1.7 m，正挡在闸前）——事后剔掉，不动随机序列
  _vw = Point(*GATE['view']); _ends = [(GATE['x'] + _gn[0] * e * HW['gm'], GATE['z'] + _gn[1] * e * HW['gm']) for e in (-1, -0.5, 0, 0.5, 1)]
  _cone = unary_union([LineString([GATE['view'], e_]) for e_ in _ends]).buffer(3.0).union(_vw.buffer(6))
  _drop = [t_ for t_ in TREES[_nT:] if _cone.contains(Point(t_[0], t_[1]))]
  TREES[_nT:] = [t_ for t_ in TREES[_nT:] if t_ not in _drop]; print('3A trees dropped for the lookout sight lines', len(_drop), [t_[:2] for t_ in _drop])
  print('3A houses', len(HOUSES) - _nH, 'trees', len(TREES) - _nT)
  # ---- D 线（白篷）：光明港码头 D 泊位 ⇄ 魁岐停靠点；双头船，终点停靠后掉头（座位朝向转过来）----
  def lat_d(s):
    sc_, sk = GMGD_S, KQ_S + 2.4
    return _sdg * (HW['gm'] - 3.0) * (1 - ss(sc_ + 9, sc_ + 50, s)) + KQ_SIDE * (HW['gm'] - 4.3) * ss(sk - 47, sk - 17, s)
  dLeg = path_for('gm', GMGD_S - 6, KQ_S + 2.4 + 6, lat_d, step=4.0)
  rlD = LineString(chaikin(dLeg, 4)).simplify(0.03)
  LD = rlD.length; RPD = []
  for i in range(int(LD) + 1): q = rlD.interpolate(i); RPD.append([round(q.x, 2), round(q.y, 2)])
  STOPS_D0 = LineString(RPD).project(Point(*gmgD['berth']))
  _hullD = hullAt(GMGD_S, _sdg * (HW['gm'] - 3.0))
  _sweep = unary_union([_hullD.buffer(0.35)] + [hull_poly(RPD, i).buffer(0.25) for i in range(max(0, int(STOPS_D0) - 12), int(STOPS_D0) + 14)])
  _deck = bandG(gmp['s'] + 7.3, GMGD_S + 1.2, 0.0, 2.5, _sdg, 40).difference(_sweep).buffer(0)   # 栈道让开船进出泊位扫过的范围
  if _deck.geom_type != 'Polygon': _deck = max(_deck.geoms, key=lambda g: g.area)
  _deck = _deck.simplify(0.02); DRY.append(_deck)
  gmgD['deckRing'] = [v for x, z in list(_deck.exterior.coords)[:-1] for v in (round(x, 2), round(z, 2))]
  gmgD['deck'] = pack([ccw_up(c) for c in tri(_deck)])
  _out = LineString([at_s('gm', gmp['s'] + 8.6 + (GMGD_S - 4.8 - gmp['s'] - 8.6) * i / 30, _sdg * (HW['gm'] - 2.44))[0] for i in range(31)])
  gmgD['rail'] = [[round(x, 2), round(z, 2)] for x, z in _out.simplify(0.05).coords]
  print('3A gmgD deck area', round(_deck.area, 1))
  _gs_ = int(round([st['s'] for st in STOPS if st['id'] == 'gmg'][0])); _bh = [i for i in range(max(2, _gs_ - 60), min(len(RP) - 2, _gs_ + 8)) if hull_poly(RP, i).buffer(0.15).intersects(_deck)]
  assert not _bh, ('B boat hull hits the D deck', _bh[:5])
  STOPS_D = []
  for p in PIERS3:
    s_ = LineString(RPD).project(Point(*p['berth'])); q = LineString(RPD).interpolate(s_)
    STOPS_D.append({'id': p['id'], 's': round(s_, 2), 'd': round(math.dist((q.x, q.y), p['berth']), 2)})
  assert all(st['d'] < 0.05 for st in STOPS_D), STOPS_D
  dryU = unary_union(DRY); navi3 = water.difference(dryU.buffer(0.08)); badD = []
  for i in range(int(STOPS_D[0]['s']), int(STOPS_D[-1]['s']) + 1):
    hp = hull_poly(RPD, i); nearB = min(math.dist(RPD[i], p['berth']) for p in PIERS3) < 14.5
    if not (navi3.buffer(-0.1) if nearB else navi3.buffer(-0.3)).contains(hp): badD.append((i, RPD[i]))
  print('3A D hull outside water at', len(badD), badD[:8])
  assert not badD
  _ddock = hull_poly(RPD, int(round(STOPS_D[0]['s'])))
  _gs = int(round([st['s'] for st in STOPS if st['id'] == 'gmg'][0]))
  assert not [i for i in range(2, _gs + 1) if hull_poly(RP, i).buffer(0.1).intersects(_ddock)], 'B route hits docked D boat'
  assert not any(hull_poly(RPD, i).buffer(0.1).intersects(_bdock) for i in range(int(STOPS_D[0]['s']), len(RPD) - 2)), 'D route hits docked B boat'
  _fz0 = LineString(RPD).project(Point(*at_s('gm', GMGD_S + 50)[0])); _fz1 = LineString(RPD).project(Point(*at_s('gm', KQ_S - 50)[0]))
  ZONES_D = {'cruise': 3.5, 'fast': [round(_fz0, 1), round(_fz1, 1)], 'vFast': 5.5, 'vBridge': 3.5, 'vPier': 3.5, 'pierZone': 45}
  ROUTE_D = {'id': 'D', 'canopy': 'white', 'color': '#7A4E9C', 'zones': ZONES_D, 'p': [v for xz in RPD for v in xz], 'stops': STOPS_D}
  print('3A route D len', round(LD, 1), 'stops', STOPS_D, 'minR3m', minRat(LineString([rlD.interpolate(i * 3.0).coords[0] for i in range(int(LD // 3) + 1)]))[:3:2], 'zones', ZONES_D)
  PIERS = PIERS + PIERS3
  ROADS = ROADS + ROADS3
  A3DATA = {'gmALen': round(GM_A_LEN, 2), 'x0': round(min(x for x, z in gmE.coords) - 2, 1), 'gate': GATE, 'mj': MJ, 'bridges': [b['id'] for b in BR3],
            'note': '3A：光明港东段 1:5（OSM relation 11108281 竖切 / 横切取中线）；桥只放 OSM 有名的福光南路（东段南北向一段没核过桥）；魁岐九门闸取中间那组坝 way 780472906 / 780472912（未实地核实）'}

# =====================================================================================================
# 3B（PLAN-3 §3 / §6 ④⑤ / §8 小美定稿）：晋安河北段（温泉公园 → 琴亭湖，1:4，只走路）+ 琴亭湖（湖面 + 一圈步道，同 2A 西湖画湖面 + 岸）
#   + 凤坂河（光明港 → 前屿一带，1:4，只走路；晋安湖 OSM 没有几何，不做湖、不做「晋安湖 3 号码头」）。没有新船线、没有新码头、没有新出口亭（见 3b_progress.md）。
#   1B / 3A 已验收的部分不动（同 3A）：码头 / 桥 / 船线 / 3A 的闸和闽江逐个不变；岸地 / 水面格子几何没变的沿用旧三角网；岸墙只换掉
#   晋安河北头那道封口（接北段）和光明港北岸凤坂河口那一小段；凤坂河口占到的几栋 1B 楼 / 几棵 1B 榕树只打 gone 标记（下标不动，颜色不变）。
#   输入 b3_osm_m.json（tools/fzriver/osm_3b.py）。
# =====================================================================================================
B3 = A3 and os.environ.get('FZR_3B', '1') != '0'
if B3:
  E3B = json.load(open(os.path.join(HERE, 'b3_osm_m.json')))
  water3A, region3A, land3A = water, region, land
  LAND3A, WATER3A, WALL3A, BOUND3A = LAND, WATER, WALL, BOUND
  _nB0 = len(BR); _nH0 = len(HOUSES); _nT0 = len(TREES)
  HW['jn'] = HW['ja']; BAND['jn'] = BAND['ja']; NAME['jn'] = NAME['ja']          # 晋安河北段：同一条河，同河宽 / 岸带（真实水面约 30–35 m）
  HW['fb'] = 12.0; BAND['fb'] = 22.0; NAME['fb'] = ['凤坂河', 'Fengban River']    # 凤坂河：真实水面 15–34 m（中位约 29 m），取 24 m
  LB = 16.0                                                                       # 琴亭湖一圈步道宽
  # ---- 晋安河北段中线：湖口 → 晋安河 → 1B 晋安河起点（温泉公园路桥北 150 m），1:4（同 scJ），终点和 1B 起点严丝合缝、切线连续 ----
  _ja0 = CL['ja'].coords[0]; _tj = tan('ja', 0.0)
  _rJ = [tuple(q) for q in E3B['jnUp']] + list(substring(RJ, 0, JA0).coords)[1:]
  _gJ = [c for c in scJ(_rJ) if math.dist(c, _ja0) > 30] + [(_ja0[0] - _tj[0] * 14, _ja0[1] - _tj[1] * 14), _ja0]
  _t0 = tdir(_gJ[1], _gJ[0]); _gJ = [(_gJ[0][0] + _t0[0] * 8, _gJ[0][1] + _t0[1] * 8)] + _gJ   # 起点伸进湖里 8 m（湖口不留缝）
  jn = LineString(chaikin(list(LineString(_gJ).simplify(2.5).coords), 4)).simplify(0.12)
  assert math.dist(jn.coords[-1], _ja0) < 1e-6
  CL['jn'] = jn
  lakeG = Polygon(scJ(E3B['lake'])).buffer(0).simplify(0.3)
  # ---- 凤坂河中线：南口落在光明港中线上；1:4 绕南口缩（游戏点 = 南口 + (真实 − 真实南口) / 4）。南口离前横南路桥（gm3）太近就往上游（西）挪 ----
  _fbR = [tuple(q) for q in E3B['fb']]; _Mr = _fbR[-1]
  _sM0 = proj('gm', Point(*scG([_Mr])[0]))[0]
  _gm3 = [b for b in BR if b['river'] == 'gm' and b['name'] == '前横南路'][0]
  _sM = min(_sM0, _gm3['s'] - _gm3['w'] / 2 - HW['fb'] - 10.0)
  FB_MOUTH_MOVE = round(_sM - _sM0, 1)
  _Ag = at_s('gm', _sM)[0]
  fbG = LineString([(_Ag[0] + (x - _Mr[0]) / K, _Ag[1] + (z - _Mr[1]) / K) for x, z in _fbR])
  fb = LineString(chaikin(list(fbG.simplify(5).coords), 4)).simplify(0.12)
  CL['fb'] = fb
  for k_ in ('jn', 'fb'): print('3B', k_, 'len', round(CL[k_].length, 1), 'pts', len(CL[k_].coords), 'minR', minRat(CL[k_])[0])
  print('3B fb mouth gm s', round(_sM0, 1), '→', round(_sM, 1), 'move', FB_MOUTH_MOVE, 'gm3', _gm3['s'], _gm3['w'])
  # ---- 桥：只放 OSM 有名字的路桥（双幅合一，宽同 1B 口径）；温泉公园路桥 1B 已有（ja1） ----
  BW3 = {'农信路': 14, '北二环': 30, '华林路': 26, '远洋路': 30, '连凤路': 14, '连洋路': 24, '前屿西路': 26, '福马路': 30}
  for k_, sc_ in (('jn', lambda c: scJ([c])[0]), ('fb', lambda c: (_Ag[0] + (c[0] - _Mr[0]) / K, _Ag[1] + (c[1] - _Mr[1]) / K))):
    for nm, L_ in E3B['bridges'][k_].items():
      if nm == '温泉公园路': continue
      c_ = (sum(q['c'][0] for q in L_) / len(L_), sum(q['c'][1] for q in L_) / len(L_)); s_ = CL[k_].project(Point(*sc_(c_)))
      w_ = BW3[nm]; note_ = nm + ('双幅合一（3B）' if len(L_) > 1 else '（3B）')
      if k_ == 'fb':   # 南口那座：桥面边离光明港岸 ≥ 8 m（不压到光明港北岸步道）
        lim = CL['fb'].length - HW['gm'] - w_ / 2 - 8.0
        if s_ > lim: note_ += '；真实离南口 %.0f m，1:4 后往上游挪 %.1f m（桥面边离光明港岸 ≥ 8 m）' % ((CL['fb'].length - s_) * K, s_ - lim); s_ = lim
      b_ = bridge(k_, s_, w_, 'road', nm, note=note_); b_['b3'] = 1
  BR3B = sorted(BR[_nB0:], key=lambda b: (b['river'] != 'jn', b['s'])); BR[_nB0:] = BR3B
  _cnt = {}
  for b in BR3B: _cnt[b['river']] = _cnt.get(b['river'], 0) + 1; b['id'] = f"{b['river']}{_cnt[b['river']]}"
  for a, b in zip(BR3B, BR3B[1:]):
    if a['river'] == b['river']: assert (b['s'] - b['w'] / 2) - (a['s'] + a['w'] / 2) >= BRIDGE_GAP, ('3B bridge gap', a['id'], b['id'])
  _jbr = [b for b in BR if b['river'] == 'ja'][0]; assert (CL['jn'].length - BR3B[[b['river'] for b in BR3B].index('fb') - 1]['s'] - BR3B[[b['river'] for b in BR3B].index('fb') - 1]['w'] / 2) + (_jbr['s'] - _jbr['w'] / 2) >= BRIDGE_GAP
  for b in BR3B: print('3B bridge', b['id'], b['name'], round(b['s'], 1), b['w'], b.get('note'))
  for b in BR3B:
    x, z, t, n, half, w = b['x'], b['z'], b['t'], b['n'], b['half'], b['w']
    GAPS.append(Polygon([(x + t[0] * a + n[0] * c, z + t[1] * a + n[1] * c) for a, c in [(-w / 2 + 0.05, -half - 0.5), (w / 2 - 0.05, -half - 0.5), (w / 2 - 0.05, half + 0.5), (-w / 2 + 0.05, half + 0.5)]]))
    b['foot'] = Polygon([(x + t[0] * a + n[0] * c, z + t[1] * a + n[1] * c) for a, c in [(-w / 2, -half), (w / 2, -half), (w / 2, half), (-w / 2, half)]])
  ROADS3B = []
  for b in BR3B:
    for sg in (-1, 1):
      ROADS3B.append({'id': b['id'] + ('e' if sg > 0 else 'w'), 'name': b['name'], 'poly': rect(b['x'], b['z'], b['n'][0] * sg, b['n'][1] * sg, b['hw'] + 2, b['hw'] + BAND[b['river']] + 2, -b['w'] / 2, b['w'] / 2), 'dir': [b['n'][0] * sg, b['n'][1] * sg], 'w': b['w'], 'stub': True, 'b3': True})
  # ---- 水面 / 可走范围（只并上去，1B / 3A 的那块不重新 buffer）----
  chanJ = unary_union([jn.buffer(HW['jn'], cap_style='flat', join_style='round', quad_segs=6), lakeG, Point(_ja0).buffer(HW['jn'], quad_segs=6)])
  chanF = unary_union([fb.buffer(HW['fb'], cap_style='flat', join_style='round', quad_segs=6)])
  regJ = unary_union([jn.buffer(HW['jn'] + BAND['jn'], cap_style='flat', quad_segs=6), lakeG.buffer(LB, quad_segs=4), Point(_ja0).buffer(HW['jn'] + BAND['jn'], quad_segs=6)]).simplify(0.1)
  regF = unary_union([ext(fb).buffer(HW['fb'] + BAND['fb'], cap_style='flat', quad_segs=6)]).simplify(0.1)
  region = unary_union([region3A, regJ, regF] + [r['poly'] for r in ROADS3B]).buffer(0)
  if region.geom_type != 'Polygon': region = max(region.geoms, key=lambda g: g.area)
  region = Polygon(region.exterior)
  _wN = unary_union([water3A, chanJ.intersection(region.buffer(-0.05)), chanF.intersection(region.buffer(-0.05))]).buffer(0)
  _wC = _wN.buffer(6, quad_segs=6).buffer(-6, quad_segs=6)   # 丁字口 / 湖口两个岸角倒圆（落水回岸不卡尖角）—— 只在新河道 10 m 内加
  water = unary_union([_wN, _wC.difference(_wN).intersection(unary_union([chanJ, chanF]).buffer(10))]).buffer(0).simplify(0.05)
  water = water.intersection(region.buffer(-0.05)).buffer(0)
  if water.geom_type != 'Polygon': water = max(water.geoms, key=lambda g: g.area)
  water = Polygon(water.exterior, [i for i in water.interiors])
  land = region.difference(water).buffer(0)
  for K_ in KIOSK.values(): land = land.difference(box(K_['x'] - 1.9, K_['z'] - 6.4, K_['x'] + 1.9, K_['z'] - 2.6)).buffer(0)
  LAND = {k_: pack(v) for k_, v in tris_by_cell(land).items()}; WATER = {k_: pack(v) for k_, v in tris_by_cell(water).items()}
  print('3B cells kept from 3A: land', _keep_old(LAND, land, land3A, LAND3A), '/', len(LAND), 'water', _keep_old(WATER, water, water3A, WATER3A), '/', len(WATER))
  # ---- 凤坂河口占到的 1B 楼 / 榕树：打 gone 标记（不删：楼按下标取色，删了后面的楼全变色）----
  _corr = unary_union([water.difference(water3A).buffer(7.5), fb.buffer(HW['fb'] + 9.0, cap_style='flat'), jn.buffer(HW['jn'] + 9.0, cap_style='flat')] + [r['poly'].buffer(0.5) for r in ROADS3B])
  def _hpoly(h): return Polygon([(h['x'] + h['t'][0] * a + h['f'][0] * b_ * -1, h['z'] + h['t'][1] * a + h['f'][1] * b_ * -1) for a, b_ in [(-h['w'] / 2, -h['d'] / 2), (h['w'] / 2, -h['d'] / 2), (h['w'] / 2, h['d'] / 2), (-h['w'] / 2, h['d'] / 2)]])
  GONE_H = [i for i, h in enumerate(HOUSES) if _hpoly(h).intersects(_corr)]
  for i in GONE_H: HOUSES[i]['gone'] = '3B'
  _tcorr = unary_union([water.buffer(1.0).difference(water3A.buffer(1.0)), fb.buffer(HW['fb'] + 3.5, cap_style='flat')] + [r['poly'] for r in ROADS3B] + [b['foot'].buffer(2.5) for b in BR3B])
  GONE_T = [i for i, t_ in enumerate(TREES) if _tcorr.contains(Point(t_[0], t_[1]))]
  for i in GONE_T: TREES[i][5] = 'gone'
  print('3B 1B items under the new river mouths: houses', [(i, HOUSES[i]['x'], HOUSES[i]['z']) for i in GONE_H], 'trees', [(i, TREES[i][:2]) for i in GONE_T])
  for st_ in STEPS: assert not _corr.contains(Point(st_['x'], st_['z'])), ('3B step under the mouth', st_['id'])
  for p_ in PIERS: assert Point(p_['x'], p_['z']).distance(unary_union([chanF, chanJ.difference(water3A)])) > 20, ('3B pier too close', p_['id'])
  for K_ in KIOSK.values(): assert Point(K_['x'], K_['z']).distance(unary_union([chanF, chanJ.difference(water3A)])) > 20, ('3B kiosk too close', K_['code'])
  # ---- 岸墙：旧段在新水面边界上就原样留；新边界没被旧段盖住的地方按同一套规则补（2 m 一段 → 并段）；凤坂河北头 = 封口（暗洞，河继续往北流）----
  gapU = unary_union(GAPS)
  _wd = water.symmetric_difference(water3A).buffer(0); _wd = unary_union([g for g in getattr(_wd, 'geoms', [_wd]) if g.area > 0.5])
  WALL_keep = [w for w in WALL3A if LineString([(w[0], w[1]), (w[2], w[3])]).distance(_wd) > 0.5]
  _keepU = unary_union([LineString([(w[0], w[1]), (w[2], w[3])]) for w in WALL_keep]).buffer(0.3)
  (_fx0, _fz0), _ft0, _ = at_s('fb', 0.0)
  def kind3b(a, b_):
    mx_, mz_ = (a[0] + b_[0]) / 2, (a[1] + b_[1]) / 2
    if math.hypot(mx_ - _fx0, mz_ - _fz0) < HW['fb'] + 0.5:
      dx_, dz_ = b_[0] - a[0], b_[1] - a[1]; l_ = math.hypot(dx_, dz_) or 1
      if abs(dx_ / l_ * _ft0[0] + dz_ / l_ * _ft0[1]) < 0.3: return 2
    return None
  W3B = []
  for c_ in [list(r_.coords) for r_ in [water.exterior] + list(water.interiors)]:
    for a, b_ in zip(c_, c_[1:]):
      L_ = math.dist(a, b_); n_ = max(1, math.ceil(L_ / 2.0))
      for i in range(n_):
        p0 = (a[0] + (b_[0] - a[0]) * i / n_, a[1] + (b_[1] - a[1]) * i / n_); p1 = (a[0] + (b_[0] - a[0]) * (i + 1) / n_, a[1] + (b_[1] - a[1]) * (i + 1) / n_)
        m_ = Point((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2)
        if _keepU.contains(m_): continue
        kd = kind3b(p0, p1)
        W3B.append([round(p0[0], 2), round(p0[1], 2), round(p1[0], 2), round(p1[1], 2), kd if kd else (1 if gapU.contains(m_) else 0)])
  W3B = merge(W3B)
  for w in W3B:
    L_ = math.dist(w[:2], w[2:4]) or 1; dx_, dz_ = (w[2] - w[0]) / L_, (w[3] - w[1]) / L_; rx, rz = dz_, -dx_
    mx_, mz_ = (w[0] + w[2]) / 2, (w[1] + w[3]) / 2
    w.append(1 if water.contains(Point(mx_ + rx * 0.25, mz_ + rz * 0.25)) else -1)
  WALL = WALL_keep + W3B
  print('3B walls: kept', len(WALL_keep), '/', len(WALL3A), 'new', len(W3B), {f: sum(1 for w in W3B if w[4] == f) for f in range(5)})
  BOUND = [[round(x, 2), round(z, 2)] for x, z in Polygon(BOUND3A).union(regJ.simplify(0.3)).union(regF.simplify(0.3)).union(unary_union([r['poly'] for r in ROADS3B])).buffer(0).exterior.coords]
  mnx, mnz, mxx, mxz = region.bounds
  skirt = box(mnx - 160, mnz - 160, mxx + 160, mxz + 160).difference(region).difference(mjPoly).buffer(0).simplify(1.0)
  SKIRT = pack(tris_flat(skirt))
  # ---- 牌：琴亭湖（湖口西岸）、凤坂河（河口东岸，朝光明港码头那边）——石牌，同 2D 朱紫坊 ----
  _sm = next(s_ for s_ in [i * 0.5 for i in range(int(jn.length * 2))] if not lakeG.buffer(0.5).contains(Point(*at_s('jn', s_)[0])))
  (_lx, _lz), _lt, _ln = at_s('jn', _sm + 8.0, -(HW['jn'] + 4.0))
  _fe = 1 if (_gm3['x'] - _Ag[0]) * at_s('fb', fb.length - 30)[2][0] + (_gm3['z'] - _Ag[1]) * at_s('fb', fb.length - 30)[2][1] > 0 else -1
  (_sx, _sz), _st, _sn = at_s('fb', fb.length - HW['gm'] - 12.0, _fe * (HW['fb'] + 4.0))
  SIGNS3B = [{'id': 'qth', 'x': round(_lx, 2), 'z': round(_lz, 2), 'f': [round(_lt[0], 4), round(_lt[1], 4)], 'lines': ['琴亭湖', 'Qinting Lake']},
             {'id': 'fbh', 'x': round(_sx, 2), 'z': round(_sz, 2), 'f': [round(_st[0], 4), round(_st[1], 4)], 'lines': ['凤坂河', 'Fengban River']}]
  # ---- 琴亭湖（小美 11-17）：离湖口最远那一侧岸墙改草坡（墙 flag 3：只留不可见碰撞，不画石栏 / 墙面），坡顶岸上一座琴亭（有匾）----
  _M = at_s('jn', _sm)[0]; _C = lakeG.centroid; _ul = math.hypot(_C.x - _M[0], _C.y - _M[1]); _ux, _uz = (_C.x - _M[0]) / _ul, (_C.y - _M[1]) / _ul
  SLOPE3B = []
  for w in W3B:
    if w[4] != 0: continue
    m_ = Point((w[0] + w[2]) / 2, (w[1] + w[3]) / 2)
    if lakeG.exterior.distance(m_) > 0.6 or m_.distance(Point(_M)) < 40: continue
    vx, vz = m_.x - _C.x, m_.y - _C.y; vl = math.hypot(vx, vz) or 1
    if (vx * _ux + vz * _uz) / vl < math.cos(math.radians(70)): continue
    w[4] = 3; SLOPE3B.append(w[:4] + [w[5]])
  _best = None
  for w in sorted(SLOPE3B, key=lambda w: -(((w[0] + w[2]) / 2 - _C.x) * _ux + ((w[1] + w[3]) / 2 - _C.y) * _uz)):
    L_ = math.dist(w[:2], w[2:4]) or 1; dx_, dz_ = (w[2] - w[0]) / L_, (w[3] - w[1]) / L_; nx_, nz_ = -w[4] * dz_, w[4] * dx_   # 朝岸上
    for off in (11.5, 12.5, 10.5):
      cx, cz = (w[0] + w[2]) / 2 + nx_ * off, (w[1] + w[3]) / 2 + nz_ * off
      if land.buffer(-0.5).contains(Point(cx, cz).buffer(4.6)) and not water.buffer(3.0).intersects(Point(cx, cz).buffer(4.6)): _best = (cx, cz, -nx_, -nz_); break
    if _best: break
  assert _best, 'no room for 琴亭'
  TING3B = {'x': round(_best[0], 2), 'z': round(_best[1], 2), 'f': [round(_best[2], 4), round(_best[3], 4)], 'zh': '琴亭', 'en': 'Qinting Pavilion'}
  print('3B lake slope walls', len(SLOPE3B), 'len', round(sum(math.dist(w[:2], w[2:4]) for w in SLOPE3B), 1), 'ting', TING3B)
  _tingP = Point(TING3B['x'], TING3B['z']).buffer(7.0)
  # ---- 房子（晋安河北段 / 凤坂河两岸，另一串随机数，四面贴立面）+ 琴亭湖外一圈楼（湖边步道外，远景，看得见、走不到）----
  R3B = random.Random(321)
  occB = unary_union([water.buffer(7.5)] + [r['poly'].buffer(0.5) for r in ROADS + ROADS3B] + [b['foot'].buffer(3) for b in BR] + [lakeG.buffer(LB + 1.0)]
                     + [Point(s_['x'], s_['z']).buffer(7) for s_ in SIGNS3B] + [_tingP] + [_hpoly(h).buffer(0.6) for h in HOUSES if not h.get('gone')]
                     + [LineString([(K_['x'], K_['z']), (K_['x'], K_['z'] + 28)]).buffer(9) for K_ in KIOSK.values()])
  for k_ in ('jn', 'fb'):
    g_ = CL[k_]; hw_ = HW[k_]; bd_ = BAND[k_]
    for side in (-1, 1):
      s_ = 4.0
      while s_ < g_.length - 4:
        w_ = R3B.uniform(16, 24); d_ = R3B.uniform(10, 13); h_ = R3B.choice([15, 18, 21, 24])
        off = hw_ + bd_ - 1.0 - d_ / 2
        (cx, cz), t, n = at_s(k_, s_ + w_ / 2, side * off); ry = math.atan2(t[0], t[1])
        poly = Polygon([(cx + t[0] * a + n[0] * side * b_, cz + t[1] * a + n[1] * side * b_) for a, b_ in [(-w_ / 2, -d_ / 2), (w_ / 2, -d_ / 2), (w_ / 2, d_ / 2), (-w_ / 2, d_ / 2)]])
        ok_ = region.buffer(-0.5).contains(poly) and not poly.intersects(occB)
        if ok_:
          occB = occB.union(poly.buffer(0.6))
          HOUSES.append({'x': round(cx, 2), 'z': round(cz, 2), 'w': round(w_, 2), 'd': round(d_, 2), 't': [round(t[0], 4), round(t[1], 4)], 'f': [round(-n[0] * side, 4), round(-n[1] * side, 4)], 'river': k_, 'h': h_, 'kind': 'mod', 'ry': round(ry, 4), 'back': True, 'b3': True})
        s_ += w_ + (R3B.uniform(5, 10) if ok_ else 3.0)
  _nHr = len(HOUSES)
  _ring = lakeG.buffer(LB + 8.5, quad_segs=4).exterior; _d = 6.0
  while _d < _ring.length:
    w_ = R3B.uniform(16, 24); d_ = R3B.uniform(10, 13); h_ = R3B.choice([18, 21, 24])
    q0 = _ring.interpolate(_d); q1 = _ring.interpolate(min(_ring.length, _d + w_)); c_ = _ring.interpolate(_d + w_ / 2)
    tx_, tz_ = tdir((q0.x, q0.y), (q1.x, q1.y)) if math.dist((q0.x, q0.y), (q1.x, q1.y)) > 1 else (1.0, 0.0)
    nr = lakeG.exterior.interpolate(lakeG.exterior.project(c_)); fx_, fz_ = tdir((c_.x, c_.y), (nr.x, nr.y))
    if fx_ * -tz_ + fz_ * tx_ < 0: tx_, tz_ = -tx_, -tz_
    cx, cz = c_.x - fx_ * (d_ / 2 - 6.0), c_.y - fz_ * (d_ / 2 - 6.0)
    poly = Polygon([(cx + tx_ * a + fx_ * b_, cz + tz_ * a + fz_ * b_) for a, b_ in [(-w_ / 2, -d_ / 2), (w_ / 2, -d_ / 2), (w_ / 2, d_ / 2), (-w_ / 2, d_ / 2)]])
    ok_ = not poly.intersects(region.buffer(1.0)) and not poly.intersects(occB)
    if ok_:
      occB = occB.union(poly.buffer(1.5))
      HOUSES.append({'x': round(cx, 2), 'z': round(cz, 2), 'w': round(w_, 2), 'd': round(d_, 2), 't': [round(tx_, 4), round(tz_, 4)], 'f': [round(fx_, 4), round(fz_, 4)], 'river': 'lake', 'h': h_, 'kind': 'mod', 'ry': round(math.atan2(tx_, tz_), 4), 'back': True, 'b3': True, 'far': True})
    _d += w_ + (R3B.uniform(6, 12) if ok_ else 4.0)
  print('3B houses', _nHr - _nH0, 'lake backdrop', len(HOUSES) - _nHr)
  # ---- 树：两岸榕树（同 1B / 3A：岸墙后 1.7 m，15–22 m 一棵，主干直立）；湖边一圈柳（kind lake，同 2A 西湖）----
  treeOccB = unary_union([b['foot'].buffer(2.5) for b in BR] + [g.buffer(1.5) for g in GAPS] + [r['poly'] for r in ROADS + ROADS3B] + [p.buffer(1.0) for p in DRY]
                         + [Point(s_['x'], s_['z']).buffer(4.0) for s_ in SIGNS3B] + [_tingP, lakeG.buffer(LB * 0.5)])
  for k_ in ('jn', 'fb'):
    g_ = CL[k_]; hw_ = HW[k_]
    for side in (-1, 1):
      s_ = R3B.uniform(3, 8)
      while s_ < g_.length - 3:
        (x, z), t, n = at_s(k_, s_, side * (hw_ + 1.7)); P_ = Point(x, z)
        if region.contains(P_) and not water.buffer(1.0).contains(P_) and not treeOccB.contains(P_) and all(math.hypot(x - t_[0], z - t_[1]) > 6 for t_ in TREES if t_[5] != 'gone'):
          TREES.append([round(x, 2), round(z, 2), round(-n[0] * side, 3), round(-n[1] * side, 3), round(R3B.uniform(0.85, 1.15), 2), k_, 1])
        s_ += R3B.uniform(15, 22)
  _lr = lakeG.buffer(2.2, quad_segs=4).exterior; _d = R3B.uniform(2, 6)
  while _d < _lr.length:
    q = _lr.interpolate(_d); nr = lakeG.exterior.interpolate(lakeG.exterior.project(q)); fx_, fz_ = tdir((q.x, q.y), (nr.x, nr.y))
    if land.contains(q) and not water.buffer(1.0).contains(q) and not treeOccB.difference(lakeG.buffer(LB * 0.5)).contains(q) and not _tingP.contains(q):
      TREES.append([round(q.x, 2), round(q.y, 2), round(fx_, 3), round(fz_, 3), round(R3B.uniform(0.85, 1.15), 2), 'lake'])
    _d += R3B.uniform(12, 17)
  print('3B trees', len(TREES) - _nT0)
  # ---- 琴亭湖步道路灯 / 长椅（离湖岸 5.2 m，34 m 一盏，同沿河步道）----
  LAMPS3B = []; _r52 = lakeG.buffer(5.2, quad_segs=4).exterior; _r42 = lakeG.buffer(4.2, quad_segs=4).exterior
  for i in range(int(_r52.length // 34)):
    q = _r52.interpolate(17 + i * 34); nr = lakeG.exterior.interpolate(lakeG.exterior.project(q)); fx_, fz_ = tdir((q.x, q.y), (nr.x, nr.y))
    if not land.buffer(-0.6).contains(q) or water.buffer(2.0).difference(lakeG.buffer(0.5)).contains(q) or _tingP.buffer(2.0).contains(q): continue
    bq = _r42.interpolate(_r42.project(q) + 9)
    LAMPS3B.append([round(q.x, 2), round(q.y, 2), round(fx_, 4), round(fz_, 4), round(bq.x, 2), round(bq.y, 2)])
  print('3B lake lamps', len(LAMPS3B))
  ROADS = ROADS + ROADS3B
  _pk = lakeG.buffer(LB + 40).bounds
  B3DATA = {'jnLen': round(jn.length, 2), 'fbLen': round(fb.length, 2), 'bridges': [b['id'] for b in BR3B], 'signs': SIGNS3B, 'lamps': LAMPS3B,
            'lake': {'zh': '琴亭湖', 'en': 'Qinting Lake', 'c': [round(lakeG.centroid.x, 2), round(lakeG.centroid.y, 2)], 'mouthS': round(_sm, 2), 'band': LB, 'ring': [v for x, z in list(lakeG.exterior.coords)[:-1] for v in (round(x, 2), round(z, 2))]},
            'park': [round(v, 1) for v in _pk], 'zone': [[round(v, 1) for v in g.buffer(140).bounds] for g in (jn.union(lakeG), fb)], 'fbMouth': {'gmS': round(_sM, 2), 'moved': FB_MOUTH_MOVE, 'x': round(_Ag[0], 2), 'z': round(_Ag[1], 2)},
            'gone': {'houses': GONE_H, 'trees': GONE_T}, 'slope': SLOPE3B, 'ting': TING3B,
            'grey': {'bridges': [_gm3['id']], 'roads': [r['id'] for r in ROADS if r.get('name') == '前横南路' and r.get('stub')]},
            'note': '3B：晋安河北段 1:4（OSM way 209804035 + 湖口 4 段无名 river way）+ 琴亭湖（way 286203565，1:4 缩）+ 凤坂河 1:4（way 456904974，南口落在光明港中线上）；只走路，不开船线、不加码头 / 出口；桥只放 OSM 有名的路桥'}


# =====================================================================================================
# 4A（PLAN-4 v2 / 小美 11-19 13:50 定稿）：光明港西段（已建 gm 西头 → 六一中路新港闸，1:5，只走路）
#   + 新港闸（只能看、不能过船；浅灰石材同九门闸；南 2 孔、北 1 孔）+ 闸西新港河短水面远景（两岸和房子围住）
#   + 六一中路桥 + 瀛洲河口（两岸驳岸先往里转几米再合拢）。不新开船线、不加出口。
#   1B / 3A / 3B 已验收的部分不动：不改 gm / ja / jn / fb 中线，不改已建码头 / 桥 / 船线 / 闸的坐标；
#   只拆掉 1B 光明港西头那道封口，并把新水面 / 岸地并上去。岸墙只换掉西头封口附近。
# =====================================================================================================
A4 = B3 and os.environ.get('FZR_4A', '1') != '0'
A5 = A4 and os.environ.get('FZR_5', '1') != '0'
if A4:
  water3B, region3B, land3B = water, region, land
  LAND3B, WATER3B, WALL3B, BOUND3B = LAND, WATER, WALL, BOUND
  _nB0 = len(BR); _nH0 = len(HOUSES); _nT0 = len(TREES)
  HW['gw'] = HW['gm']; BAND['gw'] = BAND['gm']; NAME['gw'] = NAME['gm']
  # ---- 中线：已有 rivers_osm_m 光明港里程 1203.4（六一中路交点）→ 1442.2（1B GM0），1:5 scG；
  #   东端和已建 gm 西头严丝合缝、切线连续。s=0 在接缝（东），s=len 在闸（西），t 在闸处指向新港河。----
  _gm0 = CL['gm'].coords[0]; _tg0 = tan('gm', 0.0)
  _lockR = Point(2098.3, -2938.8)          # 六一中路 way 502977905 ∩ 光明港
  _sLockR = RG.project(_lockR)
  _realW = list(substring(RG, GM0, _sLockR).coords)   # 东(GM0) → 西(闸)；substring 要 a < b，若 GM0 > sLock 则对调
  if GM0 > _sLockR:
    _realW = list(substring(RG, _sLockR, GM0).coords)[::-1]
  _gW = [_gm0, (_gm0[0] - _tg0[0] * 14, _gm0[1] - _tg0[1] * 14)] + [c for c in scG(_realW) if math.dist(c, _gm0) > 30]
  # 西端对齐闸位（游戏）
  _lockG = scG([(_lockR.x, _lockR.y)])[0]
  _tW = tdir(_gW[-2], _gW[-1]) if len(_gW) > 1 else (-_tg0[0], -_tg0[1])
  # 让最后一点落在闸位：若末点离闸位远，接到闸位
  if math.dist(_gW[-1], _lockG) > 1.0:
    _gW.append(_lockG)
  gw = LineString(chaikin(list(LineString(_gW).simplify(0.8).coords), 4)).simplify(0.12)
  # 强制东端精确等于 gm 西头
  if math.dist(gw.coords[0], _gm0) > 1e-4:
    gw = LineString([_gm0] + list(gw.coords)[1:])
  CL['gw'] = gw
  print('4A gw len', round(gw.length, 1), 'pts', len(gw.coords), 'minR', minRat(gw)[0], 'start', tuple(round(v, 2) for v in gw.coords[0]), 'end', tuple(round(v, 2) for v in gw.coords[-1]))
  assert math.dist(gw.coords[0], _gm0) < 0.05, ('4A join', gw.coords[0], _gm0)
  _rJ = minRat(LineString([c for c in list(gw.coords)[:8] + [_gm0]]))
  print('4A junction minR', _rJ[0])
  # ---- 六一中路桥（双幅合一，宽同 3A 主干路 30 m）；放在闸东侧，桥西沿离闸墩 ≥ 6 m，正面能看见闸 ----
  GATE_S = round(gw.length - 4.5, 2)
  BRIDGE_S = min(GATE_S - 6.0 - 15.0, gw.length - 8.0)   # 半宽 15；桥在闸东
  if BRIDGE_S < 8:
    BRIDGE_S = max(6.0, GATE_S * 0.45)
  _b = bridge('gw', BRIDGE_S, 30, 'road', '六一中路', note='六一中路双幅合一（4A）；桥在新港闸东侧，正面能看全三孔')
  _b['a4'] = 1
  BR4 = BR[_nB0:]
  for b in BR4:
    x, z, t, n, half, w = b['x'], b['z'], b['t'], b['n'], b['half'], b['w']
    GAPS.append(Polygon([(x + t[0] * a + n[0] * c, z + t[1] * a + n[1] * c) for a, c in [(-w / 2 + 0.05, -half - 0.5), (w / 2 - 0.05, -half - 0.5), (w / 2 - 0.05, half + 0.5), (-w / 2 + 0.05, half + 0.5)]]))
    b['foot'] = Polygon([(x + t[0] * a + n[0] * c, z + t[1] * a + n[1] * c) for a, c in [(-w / 2, -half), (w / 2, -half), (w / 2, half), (-w / 2, half)]])
  ROADS4 = []
  for b in BR4:
    for sg in (-1, 1):
      ROADS4.append({'id': b['id'] + ('e' if sg > 0 else 'w'), 'name': b['name'], 'poly': rect(b['x'], b['z'], b['n'][0] * sg, b['n'][1] * sg, b['hw'] + 2, b['hw'] + BAND['gw'] + 2, -b['w'] / 2, b['w'] / 2), 'dir': [b['n'][0] * sg, b['n'][1] * sg], 'w': b['w'], 'stub': True, 'a4': True})
  for b in BR4: print('4A bridge', b['id'], b['name'], 's', round(b['s'], 1), 'at', (b['x'], b['z']))
  # ---- 新港闸 ----
  (_gx, _gz), _gt, _gn = at_s('gw', GATE_S)
  # n 在闸处约朝北（t 朝西）；bayW 从 -hw（南）到 +hw（北）：南 2 孔窄、北 1 孔宽
  _south_first = _gn[1] >= 0
  GATE4 = {'s': GATE_S, 'x': round(_gx, 2), 'z': round(_gz, 2), 't': [round(_gt[0], 4), round(_gt[1], 4)], 'n': [round(_gn[0], 4), round(_gn[1], 4)],
           'hw': HW['gw'], 'bays': 3, 'bayW': [10, 10, 20] if _south_first else [20, 10, 10],
           'view': [round(v, 2) for v in at_s('gw', min(GATE_S - 5.0, BRIDGE_S + 15 + 3.2), -(_gn[1] / (abs(_gn[1]) or 1)) * (HW['gw'] + 3.2))[0]],   # 六一中路西沿和闸之间的南岸，正面看三孔
           'side': -1 if _gn[1] >= 0 else 1}
  _blk = [(-2.4, -HW['gw'] - 1.2), (2.2, -HW['gw'] - 1.2), (2.2, HW['gw'] + 1.2), (-2.4, HW['gw'] + 1.2)]
  GATE4['block'] = [[round(GATE4['x'] + _gt[0] * a + _gn[0] * b_, 2), round(GATE4['z'] + _gt[1] * a + _gn[1] * b_, 2)] for a, b_ in _blk]
  print('4A gate', GATE4, 'south_first', _south_first)
  # 木牌：观景处旁，写「新港闸 / Xingang Sluice」
  _sign = at_s('gw', min(GATE_S - 5.0, BRIDGE_S + 15 + 3.2) - 1.2, -(_gn[1] / (abs(_gn[1]) or 1)) * (HW['gw'] + 5.4))[0]
  SIGN4 = {'id': 'xg', 'zh': '新港闸', 'en': 'Xingang Sluice', 'x': round(_sign[0], 2), 'z': round(_sign[1], 2),
           'n': [round(-_gt[0], 4), round(-_gt[1], 4)], 'stopOnly': True}   # n 朝向：牌面朝闸（从步道上看闸同时也能读牌）
  # ---- 瀛洲河口：南岸一条短河汇入；两岸先平行再往里转、圆头合拢。真实汇入口靠近闸，若压到闸 / 桥就沿 gw 往东挪。----
  _yzR = (2069.3, -2949.2)
  _yzG0 = scG([_yzR])[0]
  _sY0 = gw.project(Point(*_yzG0))
  # 真实汇入口贴近闸 / 30 m 宽的六一中路，南桥头放不下 22 m 宽的嘴。改到东头接缝南岸，窄而长、几乎垂直离开，两岸驳岸才能读出来，也不切桥头。
  YZ_LEN, YZ_HW = 20.0, 6.5
  _sY = 2.0
  YZ_MOVE = round(_sY - _sY0, 1)
  (_yx, _yz), _yt, _yn = at_s('gw', _sY, -HW['gw'])   # 南岸水线（n 朝北时 -hw 为南）
  _yd = (-_yn[0], -_yn[1])   # 垂直离开南岸，成 T 字汇入口；略偏会被桥头吃掉
  _y0 = (_yx, _yz)
  _y1 = (_yx + _yd[0] * (YZ_LEN - YZ_HW), _yz + _yd[1] * (YZ_LEN - YZ_HW))   # 先走一段再圆头合拢
  _yStem = LineString([_y0, _y1])
  chanY = unary_union([_yStem.buffer(YZ_HW, cap_style='flat', join_style='round', quad_segs=8), Point(_y1).buffer(YZ_HW, quad_segs=8)]).simplify(0.08)
  print('4A 瀛洲河口 s', round(_sY0, 1), '→', round(_sY, 1), 'move', YZ_MOVE, 'dir', tuple(round(v, 3) for v in _yd), 'at', (round(_yx, 1), round(_yz, 1)))
  # A5 在 xgPoly 建完后再接上（中线要避开闸西远景水面）
  # ---- 闸西新港河远景（只看不走）：约 40 m 长、两岸合拢的封闭水面，比光明港高 1.0 m；从裙板上挖掉，避免露出天空缝 ----
  XG_LV, XG_LEN, XG_HW = WY + 1.0, 42.0, 16.0
  _x0 = (_gx + _gt[0] * 3.5, _gz + _gt[1] * 3.5)     # 紧挨闸下游
  _x1 = (_gx + _gt[0] * (3.5 + XG_LEN - XG_HW), _gz + _gt[1] * (3.5 + XG_LEN - XG_HW))
  _xStem = LineString([_x0, _x1])
  xgPoly = unary_union([_xStem.buffer(XG_HW, cap_style='flat', join_style='round', quad_segs=8), Point(_x1).buffer(XG_HW, quad_segs=8)]).buffer(0).simplify(0.08)
  if xgPoly.geom_type != 'Polygon':
    xgPoly = max(xgPoly.geoms, key=lambda g: g.area)
  XG_SHORE = []
  for (x0, z0), (x1, z1) in zip(list(xgPoly.exterior.coords), list(xgPoly.exterior.coords)[1:]):
    if math.hypot(x1 - x0, z1 - z0) < 0.08: continue
    m_ = Point((x0 + x1) / 2, (z0 + z1) / 2)
    # 靠闸的那一面不画堤墙（口门，看见闸背）
    u_ = (m_.x - _gx) * _gt[0] + (m_.y - _gz) * _gt[1]
    if u_ < 5.0: continue
    XG_SHORE.append([round(x0, 2), round(z0, 2), round(x1, 2), round(z1, 2)])
  # 闸两侧岸头石栏（走得到的区域，朝西看闸）
  _rl = Point(_gx, _gz).buffer(HW['gw'] + BAND['gw'] + 3)
  # 下面 region 还没更新，先占位，后面重算 rail
  XG = {'lv': XG_LV, 'water': pack(tris_flat(xgPoly)), 'shore': XG_SHORE, 'rail': [], 'o': [round(_gx, 2), round(_gz, 2)],
        't': [round(_gt[0], 4), round(_gt[1], 4)], 'n': [round(_gn[0], 4), round(_gn[1], 4)]}
  print('4A 新港河 far water area', round(xgPoly.area, 1), 'shore', len(XG_SHORE))
  if A5:
    import a5
    a5.build_yz(globals())
  # ---- 水面 / 可走范围：西段 + 瀛洲河口并上；1B/3A/3B 那块不重新 buffer ----
  chanW = unary_union([gw.buffer(HW['gw'], cap_style='flat', join_style='round', quad_segs=6), Point(_gm0).buffer(HW['gw'], quad_segs=6), chanY]).simplify(0.05)
  _yzBand = BAND['yz'] if A5 else BAND['gw']
  _extraR = [r['poly'] for r in ROADS4] + ([r['poly'] for r in ROADS5] if A5 else [])
  _yzReg = chanY.buffer(_yzBand, quad_segs=6)
  if A5:
    # 瀛洲河岸带不要往北吞掉 4A 新港闸南岸 / 闸西远景（中线在南，25 m 岸带会伸到观景处）
    _clip4 = unary_union([Polygon(GATE4['block']).buffer(8),
                          Point(*GATE4['view']).buffer(8), Point(SIGN4['x'], SIGN4['z']).buffer(6)])
    _yzReg = _yzReg.difference(_clip4.intersection(box(-1e4, -1e4, _y0[0] - 6, 1e4))).buffer(0)
  regW = unary_union([ext(gw).buffer(HW['gw'] + BAND['gw'], cap_style='flat', quad_segs=6), Point(_gm0).buffer(HW['gw'] + BAND['gw'], quad_segs=6),
                      _yzReg] + _extraR).simplify(0.1)
  region = unary_union([region3B, regW]).buffer(0)
  if region.geom_type != 'Polygon': region = max(region.geoms, key=lambda g: g.area)
  region = Polygon(region.exterior)
  _wN = unary_union([water3B, chanW.intersection(region.buffer(-0.05))]).buffer(0)
  _wC = _wN.buffer(6, quad_segs=6).buffer(-6, quad_segs=6)
  water = unary_union([_wN, _wC.difference(_wN).intersection(chanW.buffer(10))]).buffer(0).simplify(0.05)
  water = water.intersection(region.buffer(-0.05)).buffer(0)
  if water.geom_type != 'Polygon': water = max(water.geoms, key=lambda g: g.area)
  water = Polygon(water.exterior, [i for i in water.interiors])
  # 闸西远景水面不进可走水面（只看不走）
  water = water.difference(xgPoly.buffer(0.4)).buffer(0)
  if water.geom_type != 'Polygon': water = max([g for g in getattr(water, 'geoms', [water]) if g.area > 1], key=lambda g: g.area)
  if A5:
    a5.finish_mj(globals())
    water = water.difference(mjPoly5.buffer(0.4)).buffer(0)
    if water.geom_type != 'Polygon': water = max([g for g in getattr(water, 'geoms', [water]) if g.area > 1], key=lambda g: g.area)
  land = region.difference(water).buffer(0)
  for K_ in KIOSK.values(): land = land.difference(box(K_['x'] - 1.9, K_['z'] - 6.4, K_['x'] + 1.9, K_['z'] - 2.6)).buffer(0)
  LAND = {k_: pack(v) for k_, v in tris_by_cell(land).items()}; WATER = {k_: pack(v) for k_, v in tris_by_cell(water).items()}
  print('4A cells kept from 3B: land', _keep_old(LAND, land, land3B, LAND3B), '/', len(LAND), 'water', _keep_old(WATER, water, water3B, WATER3B), '/', len(WATER))
  print('4A water changed area', round(water.symmetric_difference(water3B).area, 1))
  # 闸两侧石栏（可走岸上，朝西）
  XG_RAIL = []
  _rl2 = region.exterior.intersection(Point(_gx, _gz).buffer(HW['gw'] + BAND['gw'] + 4)).difference(water.buffer(0.3))
  for g_ in (_rl2.geoms if hasattr(_rl2, 'geoms') else [_rl2]):
    if g_.geom_type != 'LineString': continue
    c_ = list(g_.simplify(0.2).coords)
    for a, b_ in zip(c_, c_[1:]):
      m_ = ((a[0] + b_[0]) / 2, (a[1] + b_[1]) / 2)
      u_ = (m_[0] - _gx) * _gt[0] + (m_[1] - _gz) * _gt[1]
      if math.dist(a, b_) > 0.3 and -2.0 < u_ < 8.0: XG_RAIL.append([round(a[0], 2), round(a[1], 2), round(b_[0], 2), round(b_[1], 2)])
  XG['rail'] = XG_RAIL
  # ---- 被新河道占到的旧楼 / 树：打 gone（下标不动）----
  _chan4 = unary_union([_yStem.buffer(YZ_HW, cap_style='flat', join_style='round', quad_segs=8), Point(_y1).buffer(YZ_HW, quad_segs=8)]) if A5 else chanY
  _corr = unary_union([water.difference(water3B).buffer(7.5).intersection(gw.buffer(HW['gw'] + 40).union(_chan4.buffer(30)).union(xgPoly.buffer(20))), gw.buffer(HW['gw'] + 9.0, cap_style='flat'), _chan4.buffer(8.0), xgPoly.buffer(6.0), Polygon(GATE4['block']).buffer(4)] + [r['poly'].buffer(0.5) for r in ROADS4])
  def _hpoly4(h): return Polygon([(h['x'] + h['t'][0] * a + h['f'][0] * b_ * -1, h['z'] + h['t'][1] * a + h['f'][1] * b_ * -1) for a, b_ in [(-h['w'] / 2, -h['d'] / 2), (h['w'] / 2, -h['d'] / 2), (h['w'] / 2, h['d'] / 2), (-h['w'] / 2, h['d'] / 2)]])
  GONE4_H = [i for i, h in enumerate(HOUSES) if not h.get('gone') and _hpoly4(h).intersects(_corr)]
  for i in GONE4_H: HOUSES[i]['gone'] = '4A'
  _tcorr = unary_union([water.buffer(1.0).difference(water3B.buffer(1.0)).intersection(gw.buffer(HW['gw'] + 30).union(_chan4.buffer(25)).union(xgPoly.buffer(15))), gw.buffer(HW['gw'] + 3.5, cap_style='flat'), _chan4.buffer(3.0), xgPoly.buffer(3.0)] + [r['poly'] for r in ROADS4] + [b['foot'].buffer(2.5) for b in BR4] + [Polygon(GATE4['block']).buffer(3)])
  GONE4_T = [i for i, t_ in enumerate(TREES) if t_[5] != 'gone' and _tcorr.contains(Point(t_[0], t_[1]))]
  for i in GONE4_T: TREES[i][5] = 'gone'
  print('4A gone houses', [(i, HOUSES[i]['x'], HOUSES[i]['z']) for i in GONE4_H], 'trees', len(GONE4_T))
  for st_ in STEPS: assert not _corr.contains(Point(st_['x'], st_['z'])), ('4A step under the new river', st_['id'])
  for p_ in PIERS: assert Point(p_['x'], p_['z']).distance(chanW.difference(water3B.buffer(1))) > 15 or p_['id'] == 'hk', ('4A pier too close', p_['id'], Point(p_['x'], p_['z']).distance(chanW))
  # ---- 岸墙：保留旧段；西头封口和新岸按 1B 规则补；闸西口门 flag 4（不画暗洞，同九门闸）----
  gapU = unary_union(GAPS)
  _wd = water.symmetric_difference(water3B).buffer(0); _wd = unary_union([g for g in getattr(_wd, 'geoms', [_wd]) if g.area > 0.5])
  WALL_keep = [w for w in WALL3B if LineString([(w[0], w[1]), (w[2], w[3])]).distance(_wd) > 0.5]
  _keepU = unary_union([LineString([(w[0], w[1]), (w[2], w[3])]) for w in WALL_keep] or [Point(0, 0)]).buffer(0.3)
  def kind4(a, b_):
    mx_, mz_ = (a[0] + b_[0]) / 2, (a[1] + b_[1]) / 2
    if math.hypot(mx_ - _gx, mz_ - _gz) < HW['gw'] + 0.8:
      dx_, dz_ = b_[0] - a[0], b_[1] - a[1]; l_ = math.hypot(dx_, dz_) or 1
      if abs(dx_ / l_ * _gt[0] + dz_ / l_ * _gt[1]) < 0.3: return 4   # 口门
    if A5:
      k5 = a5.kind_sluice(globals(), a, b_)
      if k5 is not None: return k5
    return None
  W4 = []
  for c_ in [list(r_.coords) for r_ in [water.exterior] + list(water.interiors)]:
    for a, b_ in zip(c_, c_[1:]):
      L_ = math.dist(a, b_); n_ = max(1, math.ceil(L_ / 2.0))
      for i in range(n_):
        p0 = (a[0] + (b_[0] - a[0]) * i / n_, a[1] + (b_[1] - a[1]) * i / n_); p1 = (a[0] + (b_[0] - a[0]) * (i + 1) / n_, a[1] + (b_[1] - a[1]) * (i + 1) / n_)
        m_ = Point((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2)
        if _keepU.contains(m_): continue
        kd = kind4(p0, p1)
        W4.append([round(p0[0], 2), round(p0[1], 2), round(p1[0], 2), round(p1[1], 2), kd if kd else (1 if gapU.contains(m_) else 0)])
  W4 = merge(W4)
  for w in W4:
    L_ = math.dist(w[:2], w[2:4]) or 1; dx_, dz_ = (w[2] - w[0]) / L_, (w[3] - w[1]) / L_; rx, rz = dz_, -dx_
    mx_, mz_ = (w[0] + w[2]) / 2, (w[1] + w[3]) / 2
    w.append(1 if water.contains(Point(mx_ + rx * 0.25, mz_ + rz * 0.25)) else -1)
  WALL = WALL_keep + W4
  print('4A walls: kept', len(WALL_keep), '/', len(WALL3B), 'new', len(W4), {f: sum(1 for w in W4 if w[4] == f) for f in range(5)})
  BOUND = [[round(x, 2), round(z, 2)] for x, z in Polygon(BOUND3B).union(regW.simplify(0.3)).buffer(0).exterior.coords]
  mnx, mnz, mxx, mxz = region.bounds
  if A5:
    mnx, mnz, mxx, mxz = region.union(mjPoly5).bounds
    skirt = box(mnx - 200, mnz - 200, mxx + 200, mxz + 200).difference(region).difference(mjPoly).difference(xgPoly).difference(mjPoly5).buffer(0).simplify(1.0)
  else:
    skirt = box(mnx - 160, mnz - 160, mxx + 160, mxz + 160).difference(region).difference(mjPoly).difference(xgPoly).buffer(0).simplify(1.0)
  SKIRT = pack(tris_flat(skirt))
  # ---- 瀛洲河名牌（汇入口东岸可走地上，牌面朝光明港；避开六一中路南桥头）----
  _yf = (-_yd[0], -_yd[1])
  _px, _pz = -_yd[1], _yd[0]
  def _yside(sg):
    return (_y0[0] + _yd[0] * 8.0 + sg * _px * (YZ_HW + 3.4), _y0[1] + _yd[1] * 8.0 + sg * _pz * (YZ_HW + 3.4))
  _sa, _sb = _yside(1), _yside(-1)
  # 选离闸 / 桥更远、且在岸上的一侧
  _cands = []
  for q in (_sa, _sb):
    qq = q
    if not land.contains(Point(*qq)):
      # 沿两岸法线往外再挪最多 6 m
      vx, vz = (qq[0] - (_y0[0] + _yd[0] * 8), qq[1] - (_y0[1] + _yd[1] * 8))
      lv = math.hypot(vx, vz) or 1
      for step in (0.8, 1.6, 2.4, 3.2, 4.0, 5.0, 6.0):
        cand = (qq[0] + vx / lv * step, qq[1] + vz / lv * step)
        if land.contains(Point(*cand)):
          qq = cand; break
    _cands.append(qq)
  _ys = max(_cands, key=lambda q: math.dist(q, (_gx, _gz)))
  SIGNS4 = [{'id': 'yzh', 'x': round(_ys[0], 2), 'z': round(_ys[1], 2), 'f': [round(_yf[0], 4), round(_yf[1], 4)], 'lines': ['瀛洲河', 'Yingzhou River']}]
  # ---- 房子 / 榕树（西段两岸 + 瀛洲河口两侧；闸西远景的楼在 fzRiver.js a4Day，白天才画）----
  R4 = random.Random(419)
  occ4 = unary_union([b['foot'].buffer(4) for b in BR] + [g.buffer(1.5) for g in GAPS] + [r['poly'] for r in ROADS] + [r['poly'] for r in ROADS4]
                     + [p.buffer(1.0) for p in DRY] + [Polygon(GATE4['block']).buffer(14), Point(*GATE4['view']).buffer(8),
                        Point(SIGN4['x'], SIGN4['z']).buffer(6), Point(SIGNS4[0]['x'], SIGNS4[0]['z']).buffer(6), xgPoly.buffer(4), chanY.buffer(2)])
  # 西段只有约 48 m 且中间有 30 m 宽的六一中路，房子改小、贴岸带外侧，缝里能放下再放
  s_ = 4.0
  while s_ < gw.length - 3:

    placed = False
    for side in (-1, 1):
      w_ = R4.uniform(9, 13); d_ = R4.uniform(7, 10); h_ = R4.choice([12, 15, 18])
      off = HW['gw'] + 8.0 + d_ / 2
      (cx, cz), t, n = at_s('gw', min(gw.length - 1, s_ + w_ / 2), side * off); ry = math.atan2(t[0], t[1])
      poly = Polygon([(cx + t[0] * a + n[0] * side * b_, cz + t[1] * a + n[1] * side * b_) for a, b_ in [(-w_ / 2, -d_ / 2), (w_ / 2, -d_ / 2), (w_ / 2, d_ / 2), (-w_ / 2, d_ / 2)]])
      ok_ = region.buffer(-0.2).contains(poly) and not poly.intersects(occ4) and not poly.intersects(water.buffer(0.8)) and not poly.intersects(xgPoly.buffer(2)) and not poly.intersects(Polygon(GATE4['block']).buffer(3))

      if ok_:
        occ4 = occ4.union(poly.buffer(0.5))
        HOUSES.append({'x': round(cx, 2), 'z': round(cz, 2), 'w': round(w_, 2), 'd': round(d_, 2), 't': [round(t[0], 4), round(t[1], 4)], 'f': [round(-n[0] * side, 4), round(-n[1] * side, 4)], 'river': 'gw', 'h': h_, 'kind': 'mod', 'ry': round(ry, 4), 'back': True, 'a4': True})
        placed = True
    s_ += (w_ + R4.uniform(3, 6)) if placed else 3.0
  # 瀛洲河口两侧（沿汇入方向，在可走岸上）
  for side in (-1, 1):
    _px, _pz = -_yd[1] * side, _yd[0] * side
    cx, cz = _y0[0] + _yd[0] * 8 + _px * (YZ_HW + 8), _y0[1] + _yd[1] * 8 + _pz * (YZ_HW + 8)
    w_, d_, h_ = 16.0, 11.0, 15
    poly = Polygon([(cx + _yd[0] * a + _px * b_, cz + _yd[1] * a + _pz * b_) for a, b_ in [(-w_ / 2, -d_ / 2), (w_ / 2, -d_ / 2), (w_ / 2, d_ / 2), (-w_ / 2, d_ / 2)]])
    if region.buffer(-0.4).contains(poly) and not poly.intersects(water.buffer(0.8)) and not poly.intersects(occ4):
      HOUSES.append({'x': round(cx, 2), 'z': round(cz, 2), 'w': w_, 'd': d_, 't': [round(_yd[0], 4), round(_yd[1], 4)], 'f': [round(-_px, 4), round(-_pz, 4)], 'river': 'gw', 'h': h_, 'kind': 'mod', 'ry': round(math.atan2(_yd[0], _yd[1]), 4), 'back': True, 'a4': True})
      occ4 = occ4.union(poly.buffer(0.6))
  print('4A houses', len(HOUSES) - _nH0)
  treeOcc4 = unary_union([b['foot'].buffer(2.5) for b in BR] + [g.buffer(1.5) for g in GAPS] + [r['poly'] for r in ROADS + ROADS4] + [p.buffer(1.0) for p in DRY]
                         + [Polygon(GATE4['block']).buffer(4), Point(*GATE4['view']).buffer(5), Point(SIGN4['x'], SIGN4['z']).buffer(4), xgPoly.buffer(2)])
  s_ = 3.0
  while s_ < gw.length - 2:
    for side in (-1, 1):
      (x, z), t, n = at_s('gw', s_, side * (HW['gw'] + 1.7)); P_ = Point(x, z)
      if region.contains(P_) and not water.buffer(0.8).contains(P_) and not treeOcc4.contains(P_) and all(math.hypot(x - t_[0], z - t_[1]) > 5 for t_ in TREES if t_[5] != 'gone'):
        TREES.append([round(x, 2), round(z, 2), round(-n[0] * side, 3), round(-n[1] * side, 3), round(R4.uniform(0.85, 1.15), 2), 'gw', 1])
        treeOcc4 = treeOcc4.union(P_.buffer(4))
    s_ += R4.uniform(8, 13)
  # 瀛洲河口圆头外侧补几棵树，远处不露白地平（5 继续往南开河，不再在圆头外种树）
  if not A5:
    _tip = (_y0[0] + _yd[0] * (YZ_LEN + 3), _y0[1] + _yd[1] * (YZ_LEN + 3))
    _px, _pz = -_yd[1], _yd[0]
    for k, sg, sc in ((0, 0, 1.1), (1, 1, 0.95), (2, -1, 1.05), (3, 0.4, 0.9), (4, -0.5, 1.0)):
      x, z = _tip[0] + _yd[0] * (2 + k * 3.5) + _px * sg * 5.5, _tip[1] + _yd[1] * (2 + k * 3.5) + _pz * sg * 5.5
      P_ = Point(x, z)
      if not water.buffer(0.6).contains(P_) and all(math.hypot(x - t_[0], z - t_[1]) > 4 for t_ in TREES if t_[5] != 'gone'):
        TREES.append([round(x, 2), round(z, 2), round(-_yd[0], 3), round(-_yd[1], 3), sc, 'gw', 1])
  print('4A trees', len(TREES) - _nT0)
  ROADS = ROADS + ROADS4 + (ROADS5 if A5 else [])
  if A5: a5.place_fill(globals())
  # 闸西远景楼的取景数据（a4Day 用，固定序列）
  _far = []
  _ring = xgPoly.buffer(6.0 if A5 else 10.0, quad_segs=6).exterior
  _d = 4.0
  while _d < _ring.length - 4:
    q = _ring.interpolate(_d); nr = xgPoly.exterior.interpolate(xgPoly.exterior.project(q))
    fx_, fz_ = tdir((q.x, q.y), (nr.x, nr.y))   # 朝水面
    u_ = (q.x - _gx) * _gt[0] + (q.y - _gz) * _gt[1]
    # 只围闸西的封闭水面；闸东 / 桥面 / 观景处这一侧不放远景楼，否则正面三孔被挡住
    # 5 的瀛洲河从南边擦过时，岸带可能盖住 10 m 环；改在 6 m 环上取点，只要不落在可走地上就放
    if u_ >= 8.0 and not region.contains(q):
      _far.append([round(q.x, 2), round(q.y, 2), round(fx_, 4), round(fz_, 4)])
    _d += 7.0 if A5 else 9.0
  A4DATA = {'gwLen': round(gw.length, 2), 'x0': round(max(x for x, z in gw.coords) + 2, 1),
            'gate': GATE4, 'xg': XG, 'sign': SIGN4, 'signs': SIGNS4, 'bridges': [b['id'] for b in BR4],
            'yz': {'s': round(_sY, 2), 'moved': YZ_MOVE, 'c': [round(_yx, 2), round(_yz, 2)], 'd': [round(_yd[0], 4), round(_yd[1], 4)], 'hw': YZ_HW, 'len': YZ_LEN},
            'far': _far, 'gone': {'houses': GONE4_H, 'trees': GONE4_T},
            'note': '4A：光明港西段 1:5（已有中线里程 1203–1442 接在 gm 西头，另开 gw 不改已建 s）；六一中路双幅合一；新港闸 3 孔（南 2 北 1）只能看不过船；闸西新港河短水面封闭远景；瀛洲河口驳岸内转合拢'}
  print('4A far houses slots', len(_far), 'xg rail', len(XG_RAIL))

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
if A3: DATA['routes'] = [ROUTE_D]; DATA['a3'] = A3DATA
if B3: DATA['b3'] = B3DATA
if A4: DATA['a4'] = A4DATA
if A5: DATA['a5'] = A5DATA
js = ('// 自动生成：tools/fzriver/gen_e.py（OSM 晋安河 1:4 + 光明港 1:5 → 游戏坐标；x 东、z 北，原点 = 东街口站 / 3）。不要手改。\n'
      'export const FZR_E = ' + json.dumps(DATA, ensure_ascii=False, separators=(',', ':')) + ';\n')
open(OUT, 'w').write(js); print('wrote', OUT, len(js))
