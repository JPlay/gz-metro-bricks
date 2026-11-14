# 用法：/workspace/.venv-geo/bin/python tools/fzriver/gen.py（需要 shapely ≥ 2.1）
# 输入 rivers_osm_m.json：OpenStreetMap 河道 / 湖面 / 桥（© OpenStreetMap contributors，ODbL），已换算成米（原点东街口站 26.0890606N 119.2945129E）
# 福州内河 1A：把 OSM 河道（米，原点东街口站）压缩 1:3 → 游戏世界坐标 W（x 东、z 北），
# 生成 js/data/fz-river-data.js（河道中线、水面 / 岸地三角、栏杆、桥、码头、台阶、房子、榕树、船线）。
import json, math, sys, os
import shapely
from shapely.geometry import LineString, Polygon, Point, box, MultiPolygon
from shapely.ops import substring, unary_union
from shapely import affinity
K = 3.0; WY = -3.0
OUT = sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith('--') else os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../js/data/fz-river-data.js')
import os
HERE = os.path.dirname(os.path.abspath(__file__))
d = json.load(open(os.path.join(HERE, 'rivers_osm_m.json')))
R = {k: LineString(v) for k, v in d['rivers'].items()}
def sc(c): return [(x / K, y / K) for x, y in c]
def chaikin(c, n=3):
  for _ in range(n):
    o = [c[0]]
    for a, b in zip(c, c[1:]): o += [(a[0]*.75+b[0]*.25, a[1]*.75+b[1]*.25), (a[0]*.25+b[0]*.75, a[1]*.25+b[1]*.75)]
    o.append(c[-1]); c = o
  return c
def sl(k, a, b, rev=False):
  c = list(substring(R[k], a, b).coords)
  if rev: c = c[::-1]
  return LineString(sc(c)).simplify(0.8)
def real_pt(k, s): p = R[k].interpolate(s); return Point(p.x / K, p.y / K)

# ---------- 中线 ----------
bm0 = sl('白马河', 1620, 3545)
bmA = LineString(chaikin([(-362, 156), (-362, 132), (-364.5, 102)] + list(bm0.coords), 3)).simplify(0.12)   # 1A 已验收的那一段（几何一点不动）
BM_A_LEN = bmA.length
# 2C：白马河下段（乌山路以南 → 江滨西大道 / 闽江口，OSM s 3545–6542），接在 1A 段末端后面；两段分开平滑，1A 段坐标不变（和 2B 接 dx 东段同一做法）
bmS0 = sl('白马河', 3545, 6542)
bmS = LineString(chaikin([bmA.coords[-1]] + list(bmS0.coords)[1:], 3)).simplify(0.12)
bm = LineString(list(bmA.coords) + list(bmS.coords)[1:])
dx0 = sl('东西河', 1555, 2251, rev=True)
j = bm.interpolate(bm.project(Point(dx0.coords[0])))
dxA = LineString(chaikin([(j.x, j.y)] + list(dx0.coords), 3)).simplify(0.12)   # 1A 已验收的那一段（几何一点不动）
# 2B：东段接在 1A 段末端后面，一直做到东端（市民服务中心码头）；两段分开平滑，1A 段坐标不变
dxE0 = sl('东西河', 18, 1555, rev=True)   # 东端最后 17 m 是个往南的小钩（OSM 折线），去掉
dxE = LineString(chaikin([dxA.coords[-1]] + list(dxE0.coords)[1:], 3)).simplify(0.12)
dx = LineString(list(dxA.coords) + list(dxE.coords)[1:])
DX_A_LEN = dxA.length
at0 = sl('安泰河', 0, 1650)
j2 = bm.interpolate(bm.project(Point(at0.coords[0])))
at = LineString(chaikin([(j2.x, j2.y)] + list(at0.coords)[1:], 4)).simplify(0.12)
CL = {'bm': bm, 'dx': dx, 'at': at}
HW = {'bm': 10.0, 'dx': 7.0, 'at': 6.0}
BAND = {'bm': 24.0, 'dx': 20.0, 'at': 17.0}
NAME = {'bm': ['白马河', 'Baima River'], 'dx': ['东西河', 'Dongxi River'], 'at': ['安泰河', "Antai River"]}
def tan(k, s):
  g = CL[k]; s = min(max(s, 0), g.length); a0 = max(0, min(s - 1, g.length - 2)); a = g.interpolate(a0); b = g.interpolate(a0 + 2); l = math.hypot(b.x - a.x, b.y - a.y)
  return ((b.x - a.x) / l, (b.y - a.y) / l)
def at_s(k, s, lat=0.0):
  p = CL[k].interpolate(s); t = tan(k, s); n = (t[1], -t[0])   # n = 右手（顺流右岸）
  return (p.x + n[0] * lat, p.y + n[1] * lat), t, n
def proj(k, P):
  g = CL[k]; s = g.project(P); (x, y), t, n = at_s(k, s); return s, (P.x - x) * n[0] + (P.y - y) * n[1]
def real_s(k, rk, r): return proj(k, real_pt(rk, r))[0]
def minR(g):
  c = list(g.coords); out = 1e9
  for a, b, cc in zip(c, c[1:], c[2:]):
    A = math.dist(a, b); B = math.dist(b, cc); C = math.dist(a, cc); s = (A + B + C) / 2; ar = max(s * (s - A) * (s - B) * (s - C), 0) ** .5
    if ar > 1e-6: out = min(out, A * B * C / (4 * ar))
  return out
def minRat(g):
  c = list(g.coords); out = (1e9, None)
  for a, b, cc in zip(c, c[1:], c[2:]):
    A = math.dist(a, b); B = math.dist(b, cc); C = math.dist(a, cc); s = (A + B + C) / 2; ar = max(s * (s - A) * (s - B) * (s - C), 0) ** .5
    if ar > 1e-6 and A * B * C / (4 * ar) < out[0]: out = (A * B * C / (4 * ar), b, g.project(Point(b)))
  return out
for k, g in CL.items(): print(k, 'minRat', minRat(g))
for k, g in CL.items(): print(k, 'len', round(g.length, 1), 'pts', len(g.coords), 'minR', round(minR(g), 1))

# ---------- 西湖（只要出口一角） ----------
xh = Polygon(sc(d['lakes']['西湖']))
LAKE_BOX = (-446, 136, -312, 222)
lake = xh.intersection(box(*LAKE_BOX)).buffer(0)
if lake.geom_type != 'Polygon': lake = max(lake.geoms, key=lambda g: g.area)
lake = Polygon(lake.exterior).simplify(0.6)
print('lake', round(lake.area), lake.bounds)

# ---------- 水面 ----------
CLA = {**CL, 'bm': bmA}   # 1A / 2B 已验收部分按原白马河（到乌山路以南 s 719）算：水面 / 可走范围 / 房子 / 树逐字节不变，2C 另外并上去
chan = {k: CLA[k].buffer(HW[k], cap_style='flat', join_style='round', quad_segs=6) for k in CL}
def flarePoly(k, s0, s1, w0, w1, n=10):
  L_ = [at_s(k, s0 + (s1 - s0) * i / n, -(w0 + (w1 - w0) * (i / n) ** 1.5))[0] for i in range(n + 1)]
  R_ = [at_s(k, s0 + (s1 - s0) * i / n, (w0 + (w1 - w0) * (i / n) ** 1.5))[0] for i in range(n + 1)]
  return Polygon(L_ + R_[::-1])
flare = flarePoly('dx', 26, 0, HW['dx'], 12.5)
flare2 = flarePoly('bm', 30, 0, HW['bm'], 17)
water = unary_union([*chan.values(), lake, flare, flare2]).buffer(0.01).buffer(-0.01).simplify(0.05)
assert water.geom_type == 'Polygon', water.geom_type
water0A = water   # 1A / 2B 摆房子、种树用的水面（不含 2C）
# 2C：白马河下段水面（接缝处补一个圆，两段切线不一样的小楔形缝填上）；不重新 buffer 整片水面，1A / 2B 的水面顶点不动
chanS = unary_union([bmS.buffer(HW['bm'], cap_style='flat', join_style='round', quad_segs=6), Point(bmA.coords[-1]).buffer(HW['bm'], quad_segs=6)]).simplify(0.05)
water = water.union(chanS)
assert water.geom_type == 'Polygon', water.geom_type

# ---------- 2A：西湖船闸（白马河出湖口直道，bm s 50 → 66；湖 + 闸上游水面 WY+0.5，闸下游 WY）----------
LOCK_S = (50.0, 66.0); DAM_S = (46.0, 70.0); LOCK_HW = 2.1; LOCK_RISE = 0.5
def band_poly(k, s0, s1, w, n=8):
  L_ = [at_s(k, s0 + (s1 - s0) * i / n, -w)[0] for i in range(n + 1)]; R_ = [at_s(k, s0 + (s1 - s0) * i / n, w)[0] for i in range(n + 1)]
  return Polygon(L_ + R_[::-1])
chamber = band_poly('bm', LOCK_S[0], LOCK_S[1], LOCK_HW)
apU = band_poly('bm', DAM_S[0], LOCK_S[0], LOCK_HW); apD = band_poly('bm', LOCK_S[1], DAM_S[1], LOCK_HW)
damR = band_poly('bm', DAM_S[0], DAM_S[1], HW['bm'] + 1.5)
dam = damR.difference(unary_union([chamber, apU, apD]))
water0 = water   # 放房子 / 树：1A / 2B 用 water0A（不含 2C），2C 用 water0（全）；原注：放房子 / 树仍按 1A 的水面（随机序列不变，1A 已验收的街景不动），最后再剔掉压到公园 / 闸坝的
water = water.difference(dam).difference(chamber).buffer(0)
assert water.geom_type == 'MultiPolygon' and len(water.geoms) == 2, water.geom_type
def lock_info():
  (ux, uz), t, n = at_s('bm', LOCK_S[0]); (dx_, dz_), _, _ = at_s('bm', LOCK_S[1]); (mx, mz), _, _ = at_s('bm', (LOCK_S[0] + LOCK_S[1]) / 2)
  return {'river': 'bm', 's': list(LOCK_S), 'dam': list(DAM_S), 'hw': LOCK_HW, 'rise': LOCK_RISE, 'up': [round(ux, 2), round(uz, 2)], 'dn': [round(dx_, 2), round(dz_, 2)],
          'mid': [round(mx, 2), round(mz, 2)], 't': [round(t[0], 4), round(t[1], 4)], 'n': [round(n[0], 4), round(n[1], 4)], 'damHw': HW['bm'] + 1.5,
          'chamber': [v for x, z in list(chamber.exterior.coords)[:-1] for v in (round(x, 2), round(z, 2))]}
LOCK = lock_info(); print('lock', {k: v for k, v in LOCK.items() if k != 'chamber'})

# ---------- 码头 / 出口亭 / 台阶 ----------
def pier_on(k, s, side, name, en, nid):
  hw = HW[k]; (cx, cz), t, n = at_s(k, s)
  sd = side; nn = (n[0] * sd, n[1] * sd)
  # 沿 t：台阶 [s-9, s-3]（从岸顶往下），浮码头 [s-3, s+9]；横向：贴墙 hw-0.3 → 往河心 2.4
  return {'id': nid, 'zh': name, 'en': en, 'river': k, 's': round(s, 2), 'side': sd, 'hw': hw}
PIERS = []
# 西湖码头：湖东南岸（西湖公园正门东侧，示意）
shore = lake.exterior
def lake_pier():
  P = Point(-341, 151); s = shore.project(P); a = shore.interpolate(s - 6); b = shore.interpolate(s + 6); c = shore.interpolate(s)
  t = ((b.x - a.x) / 12, (b.y - a.y) / 12); l = math.hypot(*t); t = (t[0] / l, t[1] / l); n = (t[1], -t[0])
  if t[0] > 0: t = (-t[0], -t[1])   # 浮码头往西南（朝出湖口）伸
  n = (t[1], -t[0])
  if lake.contains(Point(c.x + n[0] * 3, c.y + n[1] * 3)): n = (-n[0], -n[1])   # n 指向岸上
  return {'id': 'xihu', 'zh': '西湖码头', 'en': 'West Lake Pier', 'river': 'lake', 'x': round(c.x, 2), 'z': round(c.y, 2), 't': [round(t[0], 4), round(t[1], 4)], 'n': [round(n[0], 4), round(n[1], 4)]}
xihu = lake_pier()
def bank_pier(k, real, rk, side_hint, nid, zh, en, ds=0):
  P = Point(real[0] / K, real[1] / K); s, lat = proj(k, P); s += ds
  sd = side_hint or (1 if lat > 0 else -1)
  (bx, bz), t, n = at_s(k, s, sd * HW[k])
  nn = (n[0] * sd, n[1] * sd)   # 指向岸上
  # t 统一成“台阶在前（-t），浮码头在后（+t）”
  return {'id': nid, 'zh': zh, 'en': en, 'river': k, 's': round(s, 2), 'side': sd, 'x': round(bx, 2), 'z': round(bz, 2), 't': [round(t[0], 4), round(t[1], 4)], 'n': [round(nn[0], 4), round(nn[1], 4)]}
xsg = bank_pier('bm', (-1029, -236), '白马河', 0, 'xsg', '西水关码头', 'Xishuiguan Pier')
lmh = bank_pier('dx', (-247, -1594), '东西河', 0, 'lmh', '黎明湖码头', 'Liming Lake Pier')
# 2B：市民服务中心码头 —— 东西河东端北岸（水部站在河北面，走过去不用过桥；小美 2B ③）
_sp = R['东西河'].interpolate(95); _s, _ = proj('dx', Point(_sp.x / K, _sp.y / K)); _, _, _n = at_s('dx', _s)
smc = bank_pier('dx', (_sp.x, _sp.y), '东西河', 1 if _n[1] > 0 else -1, 'smc', '市民服务中心码头', 'Civic Center Pier')   # 北岸
PIERS = [xihu, xsg, lmh, smc]
for p in PIERS: print('pier', p['id'], p.get('river'), p.get('s'), p.get('side'), p['x'], p['z'])

def pier_geo(p):
  """台阶（岸顶 0 → 浮码头 WY+0.45）+ 浮码头（2.4 宽 × 12 长）的多边形；船位"""
  x, z = p['x'], p['z']; t = p['t']; n = p['n']   # n 指向岸上，-n 指向水里
  def P(a, b): return (x + t[0] * a - n[0] * b, z + t[1] * a - n[1] * b)   # a 沿岸，b 往水里
  stair = Polygon([P(-10, 0.0), P(-3.6, 0.0), P(-3.6, 1.5), P(-10, 1.5)])
  pont = Polygon([P(-3.6, 0.0), P(8.4, 0.0), P(8.4, 2.7), P(-3.6, 2.7)])
  berth = P(2.4, 2.7 + 0.4 + 1.2)
  return stair, pont, berth
GAPS = []      # 栏杆缺口（多边形）
DRY = []       # 水面里能站的地方（台阶、浮码头）
for p in PIERS:
  st, po, be = pier_geo(p); p['berth'] = [round(be[0], 2), round(be[1], 2)]
  DRY += [st, po]
  x, z = p['x'], p['z']; t = p['t']; n = p['n']
  GAPS.append(Polygon([(x + t[0] * a + n[0] * b, z + t[1] * a + n[1] * b) for a, b in [(-10.2, -1), (-8.3, -1), (-8.3, 1), (-10.2, 1)]]))
  # 牌子：台阶口岸上 1.8 m
  p['sign'] = [round(x + t[0] * -11.6 + n[0] * 1.6, 2), round(z + t[1] * -11.6 + n[1] * 1.6, 2)]

# 下水的石阶（水埠头）：贴着岸墙往下，下到离水面 0.25 的小平台，侧面敞开
STEPS = []
def step_at(k, s, side, sid):
  (bx, bz), t, n = at_s(k, s, side * HW[k]); nn = (n[0] * side, n[1] * side)
  def P(a, b): return (bx + t[0] * a - nn[0] * b, bz + t[1] * a - nn[1] * b)
  STEPS.append({'id': sid, 'river': k, 's': round(s, 2), 'x': round(bx, 2), 'z': round(bz, 2), 't': [round(t[0], 4), round(t[1], 4)], 'n': [round(nn[0], 4), round(nn[1], 4)]})
  DRY.append(Polygon([P(-4.2, 0), P(4.2, 0), P(4.2, 1.4), P(-4.2, 1.4)]))
  GAPS.append(Polygon([(bx + t[0] * a + nn[0] * b, bz + t[1] * a + nn[1] * b) for a, b in [(-4.6, -1), (-1.8, -1), (-1.8, 1), (-4.6, 1)]]))

# ---------- 桥 ----------
BR = []
def bridge(k, s, w, kind, name=None, plate=None, ext=2.2, note=None):
  (cx, cz), t, n = at_s(k, s)
  b = {'id': f'{k}{len([x for x in BR if x["river"] == k]) + 1}', 'river': k, 's': round(s, 2), 'x': round(cx, 2), 'z': round(cz, 2), 't': [round(t[0], 4), round(t[1], 4)], 'n': [round(n[0], 4), round(n[1], 4)],
       'hw': HW[k], 'half': HW[k] + ext, 'w': w, 'kind': kind, 'name': name, 'plate': plate}
  if note: b['note'] = note
  BR.append(b); return b
rs = lambda r: real_s('bm', '白马河', r)
bridge('bm', rs(1666), 3.2, 'foot', note='西湖出口步行桥（OSM 无名 footway）')
bridge('bm', rs(1796), 16, 'road', '西洪路')
bridge('bm', rs(2023), 30, 'road', '杨桥路', note='杨桥中路 + 杨桥西路两幅合一（真实约 41 m 宽，按 30 m）')
bridge('bm', rs(2243), 7, 'flat', '勺园里')
bridge('bm', rs(2416), 6.5, 'arch', '桂芳桥', '桂芳桥', note='位置按 OSM s2416 无名桥估计（待核）')
bridge('bm', rs(2526), 7, 'flat')
bridge('bm', rs(2694), 5, 'flat')
bridge('bm', rs(2760), 6, 'flat')
bridge('bm', rs(2974), 20, 'road', '道山西路')
bridge('bm', rs(3031), 9, 'flat', '柳河路')
bridge('bm', rs(3424) - 14, 22, 'road', '乌山路', note='往北挪 14 m，让开东西河口')
ra = lambda r: real_s('at', '安泰河', r)
bridge('at', ra(48), 14, 'road', '白马北路')
bridge('at', ra(260), 4, 'hump', '观音桥', '观音桥')
bridge('at', ra(560), 4, 'hump', '馆驿桥', '馆驿桥')
bridge('at', ra(760), 4.5, 'hump', '金斗桥', '金斗桥')
bridge('at', ra(805), 4.2, 'covered', '二桥亭桥', '二桥亭桥')
bridge('at', ra(895), 6, 'flat', '光禄坊')
bridge('at', 324.0, 12, 'road', '通湖路', note='真实位置在拐角上，游戏里挪到拐角东边（压缩后拐角太急）')
bridge('at', ra(1256), 8, 'hump', '澳门桥', '澳门桥')
bridge('at', ra(1592), 18, 'road', '八一七北路', '安泰桥', note='八一七北路上的安泰桥（路桥，桥头挂古名）')
bridge('dx', real_s('dx', '东西河', 1584), 14, 'road', '加洋路')
# 2B：东西河东段五座路桥（OSM 路名；桥名牌只写路名，1A 样式 —— 小美 2B ②）。宽度按 OSM 路级估（primary 28 / secondary 20 / tertiary 10–12 / residential 8）
rd = lambda r: real_s('dx', '东西河', r)
UNDER = {}
for r_, w_, nm, und in [(205, 28, '五一中路', True), (427, 10, '海底支路', False), (696, 12, '广达路', False), (1040, 20, '八一七中路', True), (1210, 8, '乌山支路', False)]:
  b_ = bridge('dx', rd(r_), w_, 'road', nm, nm, note=f'OSM 东西河 s{r_}（离东端真实 {r_} m）' + ('，桥下步道（北岸）' if und else ''))
  if und: UNDER[b_['id']] = b_
# 2C：白马河下段的桥（小美 2C ④）。OSM 有坐标的才做；浦西 / 三迪 / 宁化 / 双洲 / 上海西纳凉点桥 OSM 没坐标，这一批空着。
#   路桥名牌 = 路名（1A 样式）；s 5000 那座不认作白马古桥 → 普通单拱平桥（sarch：桥面平、单孔拱洞），不挂牌；s 5253 无名 tertiary 路桥不挂牌；
#   彬德桥（市级文物，OSM 无）：步行石桥（二墩三孔、两端石阶），位置按文献在同德桥与江滨西大道之间估；江滨西大道往上游挪，让出下穿阶顶 + 彬德水闸 + 闸边观景处
BM_END = CL['bm'].length
UNDER_C = {}
for r_, w_, kind_, nm, pl, und, note_ in [(3734, 20, 'road', '斗池路', '斗池路', False, None), (4210, 12, 'road', '交通西路', '交通西路', False, None),
                                        (4539, 24, 'road', '工业路', '工业路', True, '桥下步道（西岸，上海西码头往南）'),
                                        (5000, 8, 'sarch', None, None, False, 'OSM 无名 residential；不认作白马古桥（小美 2C ④），普通单拱平桥、不挂牌'),
                                        (5253, 10, 'road', None, None, False, 'OSM 无名 tertiary；名牌空着'), (6201, 12, 'road', '同德路', '同德路', False, None)]:
  b_ = bridge('bm', rs(r_), w_, kind_, nm, pl, note=f'OSM 白马河 s{r_}' + ('，' + note_ if note_ else ''))
  b_['c2'] = 1
  if und: UNDER_C[b_['id']] = b_
JBX_S = round(BM_END - 28.0, 2); BD_S = round(JBX_S - 28.0, 2); SLUICE_S = round(BM_END - 4.5, 2)
_b = bridge('bm', BD_S, 2.7, 'bingde', '彬德桥', '彬德桥', ext=3.2, note='市级文物，OSM 无；文献：同德桥以南、江滨西大道 / 彬德水闸以北（距闸不到 100 m），游戏里按压缩后位置估；步行石桥，二墩三孔，两端石阶'); _b['c2'] = 1
_b = bridge('bm', JBX_S, 24, 'road', '江滨西大道', '江滨西大道', note=f'OSM 白马河 s6528（游戏 s{rs(6528):.0f}）往上游挪 {rs(6528) - JBX_S:.0f} m，让出下穿阶顶 + 彬德水闸 + 闸边观景处；桥下步道（西岸）= 闽水园下穿通道'); _b['c2'] = 1
UNDER_C[_b['id']] = _b
# 桥下步道（小美 2B ②：五一中路、八一七中路）：北岸贴着岸墙在河道里做 1.6 m 宽石板步道，
#   上游一侧石阶下到 WY+0.5（-2.5），从桥底平走过去（桥板底 -0.4，净高 2.1 m），下游一侧石阶上来；外沿栏杆，两个阶顶岸墙栏杆开口
UNDERS = []
UGAPS = []   # 桥下步道阶顶的栏杆缺口（单独记：岸墙按 2 m 切段时，缺口比一段还窄会被漏掉）
UW = 1.6; UY = WY + 0.5; URUN = 5.0
for bid, b_ in UNDER.items():
  sd = 1 if b_['n'][1] > 0 else -1   # 北岸 = +z
  (wx, wz), t, n = at_s('dx', b_['s'], sd * HW['dx']); nn = (n[0] * sd, n[1] * sd)   # nn 指向岸上
  hw_ = b_['w'] / 2 + 1.5
  def P(a, c, wx=wx, wz=wz, t=t, nn=nn): return (wx + t[0] * a - nn[0] * c, wz + t[1] * a - nn[1] * c)
  # 阶顶靠岸一侧：河道拐弯处岸线往里退，阶顶和岸地之间会空出一条水缝（小美 2B ③：八一七中路东头）→ 量出缝有多深，补一块齐岸的花岗岩填块（带碰撞，算 DRY）
  fill = []
  for e in (-1, 1):
    a0, a1 = sorted((e * (hw_ + URUN - 2.3), e * (hw_ + URUN + 0.16))); deep = 0.0
    for i in range(12):
      a = a0 + (a1 - a0) * i / 11; c = 0.0
      while c > -4.0 and water.contains(Point(*P(a, c - 0.05))): c -= 0.1
      deep = max(deep, -c)
    fill.append(round(deep + 0.5, 2) if deep > 0.05 else 0)
    if fill[-1]: DRY.append(Polygon([P(a0, -fill[-1]), P(a1, -fill[-1]), P(a1, 0.02), P(a0, 0.02)]))
  UNDERS.append({'id': 'u' + bid, 'bridge': bid, 'name': b_['name'], 'river': 'dx', 's': b_['s'], 'side': sd, 'x': round(wx, 2), 'z': round(wz, 2), 't': [round(t[0], 4), round(t[1], 4)], 'n': [round(nn[0], 4), round(nn[1], 4)],
                 'flat': round(hw_, 2), 'run': URUN, 'w': UW, 'y': UY, 'fill': fill})
  print('under', bid, b_['name'], 'fill', fill)
  DRY.append(Polygon([P(-hw_ - URUN, 0), P(hw_ + URUN, 0), P(hw_ + URUN, UW), P(-hw_ - URUN, UW)]))
  for e, fl in zip((-1, 1), fill): UGAPS.append(Polygon([P(e * (hw_ + URUN - 0.2), -1 - fl), P(e * (hw_ + URUN - 1.9), -1 - fl), P(e * (hw_ + URUN - 1.9), 1), P(e * (hw_ + URUN - 0.2), 1)]))
BR.sort(key=lambda b: (b['river'], b['s']))
for b in BR: print('bridge', b['id'], b['river'], b['s'], b['kind'], b['name'], b['w'])
# 桥面在岸上的落脚：栏杆缺口
for b in BR:
  x, z, t, n, half, w = b['x'], b['z'], b['t'], b['n'], b['half'], b['w']
  GAPS.append(Polygon([(x + t[0] * a + n[0] * c, z + t[1] * a + n[1] * c) for a, c in [(-w / 2 + 0.05, -half - 0.5), (w / 2 - 0.05, -half - 0.5), (w / 2 - 0.05, half + 0.5), (-w / 2 + 0.05, half + 0.5)]]))
  b['foot'] = Polygon([(x + t[0] * a + n[0] * c, z + t[1] * a + n[1] * c) for a, c in [(-w / 2, -half), (w / 2, -half), (w / 2, half), (-w / 2, half)]])

# 台阶（避开桥）
step_at('bm', 268, 1, 'bm_e')
step_at('at', ra(330), -1, 'at_n')
step_at('dx', 70, -1, 'dx_n')
for s_ in STEPS: print('step', s_)

# ---------- 2C：桥下步道（工业路 / 江滨西大道，西岸）、上海西码头、西水关 C线泊位、彬德水闸 + 闽江远景 ----------
UNDERS_C = []
def under_at(k, b_, sd):
  # 同 2B 桥下步道（上面 UNDER 循环）：贴岸墙在河道里 1.6 m 石板步道，两头石阶，阶顶靠岸的水缝补花岗岩填块；阶顶岸墙栏杆按 UGAPS（重叠 ≥ 40%）开口
  (wx, wz), t, n = at_s(k, b_['s'], sd * HW[k]); nn = (n[0] * sd, n[1] * sd)
  hw_ = b_['w'] / 2 + 1.5
  def P(a, c): return (wx + t[0] * a - nn[0] * c, wz + t[1] * a - nn[1] * c)
  fill = []
  for e in (-1, 1):
    a0, a1 = sorted((e * (hw_ + URUN - 2.3), e * (hw_ + URUN + 0.16))); deep = 0.0
    for i in range(12):
      a = a0 + (a1 - a0) * i / 11; c = 0.0
      while c > -4.0 and water.contains(Point(*P(a, c - 0.05))): c -= 0.1
      deep = max(deep, -c)
    fill.append(round(deep + 0.5, 2) if deep > 0.05 else 0)
    if fill[-1]: DRY.append(Polygon([P(a0, -fill[-1]), P(a1, -fill[-1]), P(a1, 0.02), P(a0, 0.02)]))
  U = {'id': 'u' + b_['id'], 'bridge': b_['id'], 'name': b_['name'], 'river': k, 's': b_['s'], 'side': sd, 'x': round(wx, 2), 'z': round(wz, 2), 't': [round(t[0], 4), round(t[1], 4)], 'n': [round(nn[0], 4), round(nn[1], 4)],
       'flat': round(hw_, 2), 'run': URUN, 'w': UW, 'y': UY, 'fill': fill}
  UNDERS_C.append(U); print('under 2C', b_['id'], b_['name'], 'side', sd, 'fill', fill)
  DRY.append(Polygon([P(-hw_ - URUN, 0), P(hw_ + URUN, 0), P(hw_ + URUN, UW), P(-hw_ - URUN, UW)]))
  # 2C：缺口取整个阶顶宽（a f+r−2.3 … f+r+0.1，比 2B 的 1.7 m 宽）—— 2 m 段按 ≥ 40% 重叠开口后，阶顶净开口都 ≥ 1.2 m（2B 的 1.7 m 缺口在 2C 弯岸上只剩 1.0 m）
  for e, fl in zip((-1, 1), fill): UGAPS.append(Polygon([P(e * (hw_ + URUN + 0.1), -1 - fl), P(e * (hw_ + URUN - 2.3), -1 - fl), P(e * (hw_ + URUN - 2.3), 1), P(e * (hw_ + URUN + 0.1), 1)]))
  return U
WEST = 1   # 白马河顺流（往南）右手 = 西岸
for bid, b_ in UNDER_C.items(): under_at('bm', b_, WEST)
GY = [b for b in BR if b['name'] == '工业路'][0]; JBX = [b for b in BR if b['name'] == '江滨西大道'][0]
def pier_s(k, s, sd, nid, zh, en):
  (bx, bz), t, n = at_s(k, s, sd * HW[k]); nn = (n[0] * sd, n[1] * sd)
  return {'id': nid, 'zh': zh, 'en': en, 'river': k, 's': round(s, 2), 'side': sd, 'x': round(bx, 2), 'z': round(bz, 2), 't': [round(t[0], 4), round(t[1], 4)], 'n': [round(nn[0], 4), round(nn[1], 4)]}
# 上海西码头（小美 2C ②⑤）：西岸、工业路桥上游（浮码头尾离桥下步道阶脚 ≥ 3 m，船不进工业路桥洞）；C线终点，船在这里掉头
SHW_S = round(GY['s'] - 30.0, 2)
shw = pier_s('bm', SHW_S, WEST, 'shw', '上海西码头', 'Shanghai West Pier')
shw['xfer'] = {'zh': '换乘地铁宁化站，请从 A 口出站。', 'en': 'For Metro Ninghua Station, please use Exit A.'}
st_, po_, be_ = pier_geo(shw); shw['berth'] = [round(be_[0], 2), round(be_[1], 2)]; DRY += [st_, po_]
GAPS.append(Polygon([(shw['x'] + shw['t'][0] * a + shw['n'][0] * b, shw['z'] + shw['t'][1] * a + shw['n'][1] * b) for a, b in [(-10.2, -1), (-8.3, -1), (-8.3, 1), (-10.2, 1)]]))
shw['sign'] = [round(shw['x'] + shw['t'][0] * -11.6 + shw['n'][0] * 1.6, 2), round(shw['z'] + shw['t'][1] * -11.6 + shw['n'][1] * 1.6, 2)]
_ust = GY['s'] - (GY['w'] / 2 + 1.5 + URUN)
assert SHW_S + 8.4 + 3.0 <= _ust, ('shw pontoon vs 工业路 under stair', SHW_S + 8.4, _ust)
# 西水关 C线泊位（小美 2C ①）：和 A 线共用台阶、木牌；A 线浮码头尾往下游接一段浮动栈道（贴岸，绕开 1A 的水埠头石阶 bm_e），到 C线泊位。
#   A 线船靠岸 4.3 m（船边离岸 3.1），出 / 进西水关时贴岸走到下游 s+18 才离岸 → C线泊位只能放到勺园里桥前、A 线已离岸的地方，C线船靠岸 3.0 m（下面逐米断言两条船不碰）
def bandP(s0, s1, b0, b1, sd, n_=24):
  L_ = [at_s('bm', s0 + (s1 - s0) * i / n_, sd * (HW['bm'] - b0))[0] for i in range(n_ + 1)]
  R_ = [at_s('bm', s0 + (s1 - s0) * i / n_, sd * (HW['bm'] - b1))[0] for i in range(n_ + 1)]
  return Polygon(L_ + R_[::-1])
def hullAt(k, s, lat, L_=4.0, W_=1.2):
  (x, z), t, n = at_s(k, s, lat); return Polygon([(x + t[0] * u + n[0] * v, z + t[1] * u + n[1] * v) for u, v in [(-L_, -W_), (L_, -W_), (L_, W_), (-L_, W_)]])
_sdx = xsg['side']; _stepP = [d_ for d_, st_ in zip(DRY[-len(STEPS):], STEPS) if st_['id'] == 'bm_e'][0]
_bm4 = [b for b in BR if b['name'] == '勺园里'][0]
XSGC_S = None
for _i in range(0, 160):
  sc_ = _bm4['s'] - 4.0 - _i * 0.1; hc = hullAt('bm', sc_, _sdx * (HW['bm'] - 3.0))
  if hc.buffer(0.6).intersects(_bm4['foot']) or hc.buffer(0.3).intersects(_stepP): continue
  XSGC_S = round(sc_, 2); break
assert XSGC_S, 'no room for C berth at xsg'
xsgc = pier_s('bm', XSGC_S, _sdx, 'xsgc', '西水关码头', 'Xishuiguan Pier')
xsgc['shared'] = 'xsg'; xsgc['sign'] = list(xsg['sign'])
(_bx, _bz), _, _ = at_s('bm', XSGC_S, _sdx * (HW['bm'] - 3.0)); xsgc['berth'] = [round(_bx, 2), round(_bz, 2)]
_hullC = hullAt('bm', XSGC_S, _sdx * (HW['bm'] - 3.0))
_deck = bandP(xsg['s'] + 7.3, XSGC_S + 1.2, 0.0, 2.5, _sdx, 40).difference(_hullC.buffer(0.35)).difference(_stepP.buffer(0.12)).buffer(0)
if _deck.geom_type != 'Polygon': _deck = max(_deck.geoms, key=lambda g: g.area)
_deck = _deck.simplify(0.02)
DRY.append(_deck)
xsgc['deckRing'] = [v for x, z in list(_deck.exterior.coords)[:-1] for v in (round(x, 2), round(z, 2))]
# 栈道外沿栏杆（离岸 2.7 m 那条边；靠 C线船一侧是上船口，不拦）
_out = LineString([at_s('bm', xsg['s'] + 8.6 + (XSGC_S - 4.8 - xsg['s'] - 8.6) * i / 30, _sdx * (HW['bm'] - 2.44))[0] for i in range(31)])
xsgc['rail'] = [[round(x, 2), round(z, 2)] for x, z in _out.simplify(0.05).coords]
print('xsgc', XSGC_S, 'ds', round(XSGC_S - xsg['s'], 2), 'deck area', round(_deck.area, 1))
PIERS_C = [xsgc, shw]
for p in PIERS_C: print('pier 2C', p['id'], p['s'], p['side'], p['x'], p['z'], 'berth', p['berth'])
# 彬德水闸（口门）+ 闽江远景（小美 2C ③：口门不设下船点；从江滨西大道下穿走到闸边看）
(_mx, _mz), _mt, _mn = at_s('bm', BM_END)
(_sx, _sz), _st, _sn = at_s('bm', SLUICE_S)
SLUICE = {'s': SLUICE_S, 'x': round(_sx, 2), 'z': round(_sz, 2), 't': [round(_st[0], 4), round(_st[1], 4)], 'n': [round(_sn[0], 4), round(_sn[1], 4)], 'hw': HW['bm'], 'bays': 3,
          'house': [round(v, 2) for v in at_s('bm', SLUICE_S - 1.0, WEST * (HW['bm'] + 6.5))[0]], 'view': [round(v, 2) for v in at_s('bm', SLUICE_S - 0.5, WEST * (HW['bm'] + 2.2))[0]]}
_cap = [at_s('bm', BM_END, -HW['bm'])[0], at_s('bm', BM_END, HW['bm'])[0]]
MJ_ZB = round(min(_cap[0][1], _cap[1][1]) - 3.0, 2)   # 闽江北岸（游戏里按东西向一条直线；只看不走）
MJ_LV = WY - 0.6
_outlet = Polygon([_cap[0], _cap[1], (_cap[1][0], MJ_ZB - 1), (_cap[0][0], MJ_ZB - 1)]).convex_hull
mjPoly = unary_union([box(_mx - 430, MJ_ZB - 230, _mx + 430, MJ_ZB), _outlet]).difference(water.buffer(-0.02)).buffer(0)
print('minjiang', round(mjPoly.area), mjPoly.bounds, 'zb', MJ_ZB)

# ---------- 出口亭 + 路 ----------
KIOSK = {}
ROADS = []
def rect(cx, cz, ux, uz, a0, a1, b0, b1):
  vx, vz = uz, -ux
  return Polygon([(cx + ux * a + vx * b, cz + uz * a + vz * b) for a, b in [(a0, b0), (a1, b0), (a1, b1), (a0, b1)]])
# 西门 C：杨桥路桥东头往东 → 路南人行道上（亭子朝北，出来就是杨桥路）
yq = [b for b in BR if b['name'] == '杨桥路'][0]
side_e = 1 if yq['n'][0] > 0 else -1   # 东岸方向
ex_, ez_ = yq['n'][0] * side_e, yq['n'][1] * side_e
road_len = 46
ROADS.append({'id': 'yql', 'name': '杨桥路', 'poly': rect(yq['x'], yq['z'], ex_, ez_, HW['bm'] + 2, HW['bm'] + BAND['bm'] + road_len, -yq['w'] / 2, yq['w'] / 2), 'dir': [ex_, ez_], 'w': yq['w']})
# 亭子：桥头往东 30 m、路南侧（-z 一侧）人行道外
kx = yq['x'] + ex_ * (HW['bm'] + 30); kz = yq['z'] + ez_ * (HW['bm'] + 30) - (yq['w'] / 2 + 5.0)
KIOSK['fzxm'] = {'code': 'fzxm', 'n': 'C', 'x': round(kx, 2), 'z': round(kz, 2)}
ROADS.append({'id': 'kxm', 'poly': box(kx - 5, kz - 8, kx + 5, kz + 6), 'plaza': True})   # 北边一直接到杨桥路南沿（亭口朝 +z）
# 西洋 A：黎明湖码头同一侧岸上，码头往东 18 m，离水边 14 m
p = lmh; kx = p['x'] + p['t'][0] * 18 + p['n'][0] * 13; kz = p['z'] + p['t'][1] * 18 + p['n'][1] * 13
KIOSK['fzxiy'] = {'code': 'fzxiy', 'n': 'A', 'x': round(kx, 2), 'z': round(kz, 2), 'pier': 'lmh'}
ROADS.append({'id': 'kxiy', 'poly': box(kx - 5, kz - 8, kx + 5, kz + 3), 'plaza': True})
# 2A：西门 B → 西湖公园（并进内河场景；牌楼在出口亭正北 14 m，和老街区一样出来面朝北看牌楼）
XHB = {'x': -322.0, 'z': 96.0}
KIOSK['fzxm_B'] = {'code': 'fzxm', 'key': 'fzxm_B', 'n': 'B', 'x': XHB['x'], 'z': XHB['z'], 'park': True}
XHPARK = box(-346, XHB['z'] - 10, -296, 172)
ROADS.append({'id': 'xhpark', 'poly': XHPARK, 'plaza': True, 'park': True})
GAPS.append(box(-322.6, 155.0, -313.4, 163.5))   # 观湖亭木栈桥落岸处：岸墙留口（栈桥两边自己有栏杆；口两侧各 ~1.5 m 无栏杆，湖边可下水）
# 2B：水部 C → 市民服务中心码头（小美 2B ⑤：步道 ≤120 m，沿路榕树 + 石栏，不加地面指引，亭子上只放真实出口牌）
#   真实：水部站在东西河东端北面 318 m（1:3 ≈ 106 m）。亭子朝北（出站口统一朝 +z），出来向西 7 m 上花岗岩步道，一路往南到河岸步道，码头台阶就在岸边
SBW_X = round(smc['x'] - smc['t'][0] * 13.0, 2); SBW_W = 4.0; SBW_V = 2.2   # 步道中心线 x、石板宽、两边绿化带宽（榕树）
(_cx, _cz), _, _n = at_s('dx', proj('dx', Point(SBW_X, smc['z']))[0]); SBW_Z0 = round(_cz + abs(HW['dx'] + BAND['dx'] - 2.0) * (1 if _n[1] * smc['side'] > 0 else -1), 2)
SBW_LEN = 82.0
SBW_Z1 = SBW_Z0 + SBW_LEN   # 北端（亭子广场北沿）
kx = SBW_X + SBW_W / 2 + SBW_V + 5; kz = SBW_Z1 - 6
KIOSK['fzsb'] = {'code': 'fzsb', 'n': 'C', 'x': round(kx, 2), 'z': round(kz, 2), 'pier': 'smc'}
ROADS.append({'id': 'ksb', 'poly': box(kx - 5, kz - 8, kx + 5, kz + 6), 'plaza': True, 'b2': True})
ROADS.append({'id': 'sbw', 'name': '水部步道', 'poly': box(SBW_X - SBW_W / 2 - SBW_V, SBW_Z0 - 2, SBW_X + SBW_W / 2 + SBW_V, SBW_Z1), 'dir': [0, 1], 'w': SBW_W + 2 * SBW_V, 'walk': True, 'b2': True,
              'rails': [[SBW_X - SBW_W / 2 - 0.1, SBW_Z0 + 0.5, SBW_X - SBW_W / 2 - 0.1, SBW_Z1 - 0.3], [SBW_X + SBW_W / 2 + 0.1, SBW_Z0 + 0.5, SBW_X + SBW_W / 2 + 0.1, kz - 8.6]]})
# 南后街南口（澳门桥北头）：一小段街 + 三坊七巷牌坊
am = [b for b in BR if b['name'] == '澳门桥'][0]
sd = 1 if am['n'][1] > 0 else -1; nx_, nz_ = am['n'][0] * sd, am['n'][1] * sd
ROADS.append({'id': 'nhj', 'name': '南后街', 'poly': rect(am['x'], am['z'], nx_, nz_, HW['at'] + 2, HW['at'] + BAND['at'] + 26, -4.5, 4.5), 'dir': [nx_, nz_], 'w': 9})
SFQX = {'x': round(am['x'] + nx_ * (HW['at'] + BAND['at'] + 14), 2), 'z': round(am['z'] + nz_ * (HW['at'] + BAND['at'] + 14), 2), 'dir': [round(nx_, 4), round(nz_, 4)]}
print('kiosks', KIOSK, 'sfqx', SFQX)
# 路桥两头：一小段路通到边界（看起来路接着往外走）
for b in BR:
  if b['kind'] != 'road' or b['name'] == '杨桥路': continue
  for sg in (-1, 1):
    ROADS.append({'id': b['id'] + ('e' if sg > 0 else 'w'), 'name': b['name'], 'poly': rect(b['x'], b['z'], b['n'][0] * sg, b['n'][1] * sg, b['hw'] + 2, b['hw'] + BAND[b['river']] + 2, -b['w'] / 2, b['w'] / 2), 'dir': [b['n'][0] * sg, b['n'][1] * sg], 'w': b['w'], 'stub': True, 'b2': b['id'] in UNDER or b['s'] > DX_A_LEN and b['river'] == 'dx'})
    if b.get('c2'): ROADS[-1]['c2'] = True
# 2C：宁化 A → 上海西码头（小美 2C ⑤：西岸、不过桥；步道照 2B：花岗岩石板 + 两边榕树绿化带 + 石栏，不画地面指引，亭子上只放出口牌）
#   真实：宁化站在工业路 / 宁化路口，站心到白马河中线 146 m（1:3 ≈ 49 m），A 口在路口东侧。游戏里：工业路北侧一条步道往东到西岸滨河步道，再往北到码头台阶
NH_LAT0, NH_LAT1, NH_C = HW['bm'] + 1.0, 50.0, GY['w'] / 2 + 1.0 + 4.2   # 步道横向（离河中线）起止、离工业路桥中线（往上游 = 北）
_u = (GY['n'][0] * WEST, GY['n'][1] * WEST); _v = (_u[1], -_u[0])   # u = 往西（离河），v = 往上游（北）
assert _v[0] * GY['t'][0] + _v[1] * GY['t'][1] < 0
NHW_POLY = rect(GY['x'], GY['z'], _u[0], _u[1], NH_LAT0, NH_LAT1, NH_C - 4.2, NH_C + 4.2)
def _gp(a, b): return (GY['x'] + _u[0] * a + _v[0] * b, GY['z'] + _u[1] * a + _v[1] * b)
_nr = [[*_gp(NH_LAT0 + 1.6, NH_C + sv * 2.1), *_gp(NH_LAT1 - 3.0, NH_C + sv * 2.1)] for sv in (-1, 1)]
ROADS.append({'id': 'nhw', 'name': '宁化步道', 'poly': NHW_POLY, 'dir': [round(_u[0], 4), round(_u[1], 4)], 'w': 8.4, 'walk': True, 'c2': True, 'rails': [[round(v, 2) for v in r] for r in _nr]})
nkx, nkz = _gp(NH_LAT1 + 3.2, NH_C)
KIOSK['fznh'] = {'code': 'fznh', 'n': 'A', 'x': round(nkx, 2), 'z': round(nkz, 2), 'pier': 'shw'}
ROADS.append({'id': 'knh', 'poly': box(nkx - 5, nkz - 8, nkx + 5, nkz + 6), 'plaza': True, 'c2': True})
_nst = (shw['x'] - shw['t'][0] * 9.5 + shw['n'][0] * 0.6, shw['z'] - shw['t'][1] * 9.5 + shw['n'][1] * 0.6)   # 码头台阶顶
_nend = _gp(NH_LAT0 + 1.0, NH_C)
NH_WALK = round(math.dist((nkx, nkz + 1.5), _gp(NH_LAT1, NH_C)) + (NH_LAT1 - NH_LAT0 - 1.0) + math.dist(_nend, _nst), 1)
print('nh walk', {'kiosk': KIOSK['fznh'], 'stairTop': _nst, 'walk_m': NH_WALK})
assert NH_WALK <= 120, NH_WALK

# ---------- 可走范围 / 岸地 ----------
reg = [CL[k].buffer(HW[k] + BAND[k], cap_style='flat', quad_segs=6) for k in CL]
reg.append(lake.buffer(18, quad_segs=4).intersection(box(LAKE_BOX[0], 100, LAKE_BOX[2] + 18, LAKE_BOX[3])))
reg += [r['poly'] for r in ROADS if not r.get('c2')]
reg[0] = bmA.buffer(HW['bm'] + BAND['bm'], cap_style='flat', quad_segs=6)   # 1A / 2B 的可走范围按原白马河；2C 下面另外并上去
region = unary_union(reg).intersection(box(-446, -700, 560, LAKE_BOX[3])).buffer(0.01).buffer(-0.01).simplify(0.1)
# 1A 的可走范围（东西河只到 1A 段末端）：1A 段房子 / 树按它摆，随机序列和 1A 一模一样（已验收街景不动）
_regA = [CLA[k].buffer(HW[k] + BAND[k], cap_style='flat', quad_segs=6) if k != 'dx' else dxA.buffer(HW[k] + BAND[k], cap_style='flat', quad_segs=6) for k in CL]
_regA.append(lake.buffer(18, quad_segs=4).intersection(box(LAKE_BOX[0], 100, LAKE_BOX[2] + 18, LAKE_BOX[3])))
_regA += [r['poly'] for r in ROADS if not r.get('b2') and not r.get('c2')]
regionA = unary_union(_regA).intersection(box(-446, -700, 200, LAKE_BOX[3])).buffer(0.01).buffer(-0.01).simplify(0.1)
if regionA.geom_type != 'Polygon': regionA = max(regionA.geoms, key=lambda g: g.area)
regionA = Polygon(regionA.exterior)
if region.geom_type != 'Polygon': region = max(region.geoms, key=lambda g: g.area)
region = Polygon(region.exterior)
regionB = region   # 1A + 2A + 2B 的可走范围（2B 房子 / 树按它摆）
# 2C：白马河下段的岸地带 + 2C 的路 / 步道 / 广场，并到原可走范围上（不重新简化原来那块）
reg2C = unary_union([bmS.buffer(HW['bm'] + BAND['bm'], cap_style='flat', quad_segs=6), Point(bmA.coords[-1]).buffer(HW['bm'] + BAND['bm'], quad_segs=6)] + [r['poly'] for r in ROADS if r.get('c2')]).simplify(0.1)
region = region.union(reg2C)
if region.geom_type != 'Polygon': region = max(region.geoms, key=lambda g: g.area)
region = Polygon(region.exterior)
land = region.difference(water).difference(chamber).buffer(0)
# 出口亭里往下的踏步：地面挖掉（和 XmStreet 一样，走进去就回站）
for K_ in KIOSK.values(): land = land.difference(box(K_['x'] - 1.9, K_['z'] - 6.4, K_['x'] + 1.9, K_['z'] - 2.6)).buffer(0)
print('region', round(region.area), 'land', round(land.area), land.geom_type)

def tri(poly):
  out = []
  for t in shapely.constrained_delaunay_triangles(poly).geoms:
    c = list(t.exterior.coords)[:3]
    if Polygon(c).area > 1e-4: out.append(c)
  return out
def ccw_up(c):
  # Babylon 左手系、顶面朝上：从上往下看 (x 东, z 北) 要顺时针？统一在 JS 里按法线修正，这里只保证一致：叉积 > 0
  (ax, az), (bx, bz), (cx, cz) = c
  cr = (bx - ax) * (cz - az) - (bz - az) * (cx - ax)
  return c if cr > 0 else [c[0], c[2], c[1]]
CELL = 60
def cell_of(x, z): return f'{math.floor(x / CELL)},{math.floor(z / CELL)}'
def tris_by_cell(poly):
  # 先按格子切开再三角化（每格一个网格 → 碰撞只测附近）
  out = {}
  minx, minz, maxx, maxz = poly.bounds
  for i in range(math.floor(minx / CELL), math.floor(maxx / CELL) + 1):
    for jz in range(math.floor(minz / CELL), math.floor(maxz / CELL) + 1):
      part = poly.intersection(box(i * CELL, jz * CELL, (i + 1) * CELL, (jz + 1) * CELL))
      if part.is_empty: continue
      geoms = [part] if part.geom_type == 'Polygon' else [g for g in getattr(part, 'geoms', []) if g.geom_type == 'Polygon']
      L = []
      for g in geoms:
        if g.area < 0.05: continue
        for c in tri(g): L.append(ccw_up(c))
      if L: out[f'{i},{jz}'] = L
  return out
def pack(tris):
  # 顶点去重 → [xs.., zs..] 与索引
  V = {}; P = []; I = []
  for c in tris:
    for x, z in c:
      key = (round(x, 2), round(z, 2))
      if key not in V: V[key] = len(P); P.append(key)
      I.append(V[key])
  return {'p': [v for xz in P for v in xz], 'i': I}
LAND = {k: pack(v) for k, v in tris_by_cell(land).items()}
# 2C：2C 没碰到的格子沿用 1A/2B 的三角网（并集重排了顶点 → 三角剖分会换，几何没变也会出差分）。几何一样（对称差 < 0.01 m²）就用旧的
waterB = water0A.difference(dam).difference(chamber).buffer(0)
landB = regionB.difference(waterB).difference(chamber).buffer(0)
for K_ in KIOSK.values():
  if K_['code'] != 'fznh': landB = landB.difference(box(K_['x'] - 1.9, K_['z'] - 6.4, K_['x'] + 1.9, K_['z'] - 2.6)).buffer(0)
def _keep_old(new_, polyN, polyO):
  old_ = {k: pack(v) for k, v in tris_by_cell(polyO).items()}; n_ = 0
  for k in list(new_):
    if k not in old_: continue
    i, jz = map(int, k.split(',')); cb = box(i * CELL, jz * CELL, (i + 1) * CELL, (jz + 1) * CELL)
    if polyN.intersection(cb).symmetric_difference(polyO.intersection(cb)).area < 0.01: new_[k] = old_[k]; n_ += 1
  return n_
print('2C cells kept from 1A/2B: land', _keep_old(LAND, land, landB), '/', len(LAND))
xsgc['deck'] = pack([ccw_up(c) for c in tri(_deck)])   # 2C 西水关栈道 + C线浮码头面（三角网）
WATER = {k: pack(v) for k, v in tris_by_cell(water).items()}
print('2C cells kept from 1A/2B: water', _keep_old(WATER, water, waterB), '/', len(WATER))
# 可走范围外的一圈地面（只看不走，无碰撞）：免得走到边上看见天；西湖剩下的湖面画成水
xhFar = xh.buffer(0).simplify(2.5).difference(region).buffer(-0.05)
skirt = box(-760, -1720, 720, 560).difference(region).difference(xhFar).difference(mjPoly.difference(region)).buffer(0)   # 2C：往南铺到闽江对岸（闽江水面另画，下面再挖掉）
def tris_flat(poly):
  out = []
  for g in (poly.geoms if hasattr(poly, 'geoms') else [poly]):
    if g.geom_type == 'Polygon' and g.area > 0.5: out += [ccw_up(c) for c in tri(g)]
  return out
SKIRT = pack(tris_flat(skirt)); LAKEFAR = pack(tris_flat(xh.buffer(0).simplify(2.5).buffer(1.5).difference(region.buffer(-2.0)).simplify(0.3)))   # 画的时候比可走湖面低一点、往里多铺 2 m：接缝处不漏天
# 远处湖面的岸（地面 0 → 水面 WY 的竖墙）；和可走范围里湖面相接的那几段不画
LAKESHORE = []
for g in (xhFar.geoms if hasattr(xhFar, 'geoms') else [xhFar]):
  for ring in [g.exterior, *g.interiors]:
    cs = list(ring.coords)
    for (x0, z0), (x1, z1) in zip(cs, cs[1:]):
      L = math.hypot(x1 - x0, z1 - z0)
      if L < 0.05: continue
      mx, mz = (x0 + x1) / 2, (z0 + z1) / 2; nx, nz = -(z1 - z0) / L, (x1 - x0) / L
      a, b = Point(mx + nx * 0.6, mz + nz * 0.6), Point(mx - nx * 0.6, mz - nz * 0.6)
      if water.contains(a) or water.contains(b) or region.buffer(-0.01).contains(a) or region.buffer(-0.01).contains(b): continue
      LAKESHORE.append([round(x0, 2), round(z0, 2), round(x1, 2), round(z1, 2)])
print('lakeshore segs', len(LAKESHORE))
print('skirt tris', len(SKIRT['i']) // 3, 'lakeFar tris', len(LAKEFAR['i']) // 3)
print('land cells', len(LAND), 'tris', sum(len(v['i']) // 3 for v in LAND.values()), 'water cells', len(WATER), 'tris', sum(len(v['i']) // 3 for v in WATER.values()))

# ---------- 岸墙 + 栏杆 ----------
ends = []
for k in CL:
  g = CL[k]
  for s in (g.length,) if k != 'bm' else (g.length,):
    (x, z), t, n = at_s(k, s); ends.append((k, x, z, t))
gapU = unary_union(GAPS)
ugapU = unary_union(UGAPS)
def seg_kind(a, b):
  mx, mz = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
  if abs(mx - LAKE_BOX[0]) < 0.3 or abs(mz - LAKE_BOX[3]) < 0.3 or abs(mx - LAKE_BOX[2]) < 0.3 and mz > 140: return 'clip'
  for k, x, z, t in ends:
    if math.hypot(mx - x, mz - z) < HW[k] + 0.5:
      dx_, dz_ = b[0] - a[0], b[1] - a[1]; l = math.hypot(dx_, dz_) or 1
      if abs(dx_ / l * t[0] + dz_ / l * t[1]) < 0.3: return 'cap'
  return 'bank'
WALL = []   # [x0,z0,x1,z1,flag]  flag: 0 = 栏杆+碰撞, 1 = 缺口（只有岸墙）, 2 = 河道尽头（暗门洞）, 3 = 湖边界
rings = [r for g in water.geoms for r in [g.exterior, *g.interiors]]
# 2C：水面并了 2C 下段以后环的起点会换 → 下面“相邻同类小段合并”的断点跟着换，1A / 2B 的岸墙段会变。每个环转到和 1A / 2B 水面环同一个起点
_oldStarts = [tuple(r.coords[0]) for g in water0A.difference(dam).difference(chamber).buffer(0).geoms for r in [g.exterior, *g.interiors]]
def _rot(ring):
  c = list(ring.coords)[:-1]
  for st in _oldStarts:
    for i, q in enumerate(c):
      if abs(q[0] - st[0]) < 1e-9 and abs(q[1] - st[1]) < 1e-9: c2_ = c[i:] + c[:i]; return LineString(c2_ + [c2_[0]])
  return ring
rings = [_rot(r) for r in rings]
GATE_LINES = [LineString([at_s('bm', s_, -LOCK_HW - 0.05)[0], at_s('bm', s_, LOCK_HW + 0.05)[0]]) for s_ in LOCK_S]
for ring in rings:
  c = list(ring.coords)
  for a, b in zip(c, c[1:]):
    kd = seg_kind(a, b); L = math.dist(a, b)
    if any(gl.buffer(0.08).contains(LineString([a, b])) for gl in GATE_LINES): WALL.append([round(a[0], 2), round(a[1], 2), round(b[0], 2), round(b[1], 2), 3]); continue
    if kd != 'bank':
      WALL.append([round(a[0], 2), round(a[1], 2), round(b[0], 2), round(b[1], 2), (4 if math.hypot((a[0] + b[0]) / 2 - _mx, (a[1] + b[1]) / 2 - _mz) < HW['bm'] + 0.5 else 2) if kd == 'cap' else 3]); continue   # 4 = 2C 口门（彬德水闸外接闽江，不画暗门洞）
    n = max(1, math.ceil(L / 2.0))
    for i in range(n):
      p0 = (a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n); p1 = (a[0] + (b[0] - a[0]) * (i + 1) / n, a[1] + (b[1] - a[1]) * (i + 1) / n)
      m = Point((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2)
      seg = LineString([p0, p1]); ug = seg.intersection(ugapU).length >= 0.4 * seg.length   # 八一七中路东头：缺口 1.7 m 落在两段中间、两段中点都不在缺口里 → 阶顶被栏杆封死（e2e r4 bleg1 nopath）
      WALL.append([round(p0[0], 2), round(p0[1], 2), round(p1[0], 2), round(p1[1], 2), 1 if (gapU.contains(m) or ug) else 0])
# 合并相邻同类、几乎共线的小段（碰撞体少一些）
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
for sd in (-1, 1):   # 闸室两侧墙（栏杆 + 碰撞），法线朝闸室
  a = at_s('bm', LOCK_S[0], sd * LOCK_HW)[0]; b = at_s('bm', LOCK_S[1], sd * LOCK_HW)[0]
  L_ = math.dist(a, b); rx, rz = (b[1] - a[1]) / L_, -(b[0] - a[0]) / L_; mx, mz = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
  WALL.append([round(a[0], 2), round(a[1], 2), round(b[0], 2), round(b[1], 2), 0, 1 if chamber.contains(Point(mx + rx * 0.25, mz + rz * 0.25)) else -1])
print('wall segs', len(WALL), {f: sum(1 for w in WALL if w[4] == f) for f in range(4)})
# 边界（可走范围外圈）：看不见的高墙
_bnd = Polygon(regionB.exterior).simplify(0.3).union(reg2C.simplify(0.3))   # 2C：先各自简化再并（整块一起简化会挪 1A/2B 的边界点）
if _bnd.geom_type != 'Polygon': _bnd = max(_bnd.geoms, key=lambda g: g.area)
BOUND = [[round(x, 2), round(z, 2)] for x, z in Polygon(_bnd.exterior).exterior.coords]

# ---------- 房子 / 榕树 ----------
import random
random.seed(7)
HOUSES = []; TREES = []
CL['bm'] = bmA   # 1A / 2B 摆房子、种树：白马河按原长（随机序列、位置逐个不变）；2C 段后面换回全长另摆
occupied = [water0A.buffer(7.5)] + [r['poly'].buffer(0.5) for r in ROADS if not r.get('park')] + [b['foot'].buffer(3) for b in BR]
occ = unary_union(occupied)
taken = []
_regAb = regionA.buffer(-0.5); _regB = regionB.buffer(-0.5); RG = {'r': _regAb}
def try_house(poly, h, kind, ry, info):
  global occ
  if not RG['r'].contains(poly): return False
  if poly.intersects(occ): return False
  occ = occ.union(poly.buffer(0.6)); HOUSES.append({**info, 'h': h, 'kind': kind, 'ry': round(ry, 4)}); return True
def house_run(k, side, s, s_end, rnd):
  g = CL[k]; hw = HW[k]; band = BAND[k]
  if True:
    while s < s_end:
      random = rnd
      if k == 'at': w = random.uniform(8, 12); d_ = random.uniform(7, 9); h = random.choice([5.5, 6.2, 7.0]); kind = 'mh'   # 白墙黛瓦民居
      else: w = random.uniform(13, 20); d_ = random.uniform(10, 13); h = random.choice([12, 15, 18, 21, 24]); kind = 'mod'
      off = hw + band - 1.0 - d_ / 2
      (cx, cz), t, n = at_s(k, s + w / 2, side * off)
      ry = math.atan2(t[0], t[1])
      poly = affinity.rotate(box(cx - w / 2, cz - d_ / 2, cx + w / 2, cz + d_ / 2), -math.degrees(ry), origin=(cx, cz))
      # 房子的 w 沿 t：box 的 x 方向转到 t 上
      poly = Polygon([(cx + t[0] * a + n[0] * side * b, cz + t[1] * a + n[1] * side * b) for a, b in [(-w / 2, -d_ / 2), (w / 2, -d_ / 2), (w / 2, d_ / 2), (-w / 2, d_ / 2)]])
      fx, fz = -n[0] * side, -n[1] * side   # 正面朝河
      ok = try_house(poly, h, kind, ry, {'x': round(cx, 2), 'z': round(cz, 2), 'w': round(w, 2), 'd': round(d_, 2), 't': [round(t[0], 4), round(t[1], 4)], 'f': [round(fx, 4), round(fz, 4)], 'river': k})
      s += w + (random.uniform(1.5, 3.0) if ok else 3.0)
  return s
RNG_B = random.Random(2026); EXT_H = []
for k in CL:
  for side in (-1, 1):
    if k == 'dx':
      RG['r'] = _regAb; s_ = house_run(k, side, 4.0, DX_A_LEN - 4, random)   # 1A 段：和 1A 同一串随机数
      EXT_H.append((side, s_))
    else: RG['r'] = _regAb; house_run(k, side, 4.0, CL[k].length - 4, random)
RG['r'] = _regB
for side, s_ in EXT_H: house_run('dx', side, max(s_, DX_A_LEN + 2), CL['dx'].length - 4, RNG_B)   # 2B 东段：另一串随机数
# 南后街两侧民居
for sg in (-1, 1):
  for i in range(3):
    a = HW['at'] + 6 + 2 + i * 10.5
    cx = am['x'] + nx_ * (a + 5) + (-nz_) * sg * 9.5; cz = am['z'] + nz_ * (a + 5) + nx_ * sg * 9.5
    t_ = (nx_, nz_); f_ = (nz_ * sg, -nx_ * sg)
    poly = Polygon([(cx + t_[0] * aa + f_[0] * bb, cz + t_[1] * aa + f_[1] * bb) for aa, bb in [(-5, -4), (5, -4), (5, 4), (-5, 4)]])
    if region.buffer(-0.3).contains(poly) and not poly.intersects(water.buffer(5)):
      HOUSES.append({'x': round(cx, 2), 'z': round(cz, 2), 'w': 10, 'd': 8, 't': [round(t_[0], 4), round(t_[1], 4)], 'f': [round(f_[0], 4), round(f_[1], 4)], 'river': 'at', 'h': 6.2, 'kind': 'mh', 'ry': 0})
print('houses', len(HOUSES))
# 榕树：岸边 1.6 m，树冠探向水面
treeOcc = unary_union([b['foot'].buffer(2.5) for b in BR] + [g.buffer(1.5) for g in GAPS + UGAPS] + [r['poly'] for r in ROADS if not r.get('plaza')] + [box(K_['x'] - 6, K_['z'] - 8, K_['x'] + 6, K_['z'] + 4) for K_ in KIOSK.values()])
def tree_run(k, side, s, s_end, rnd, reg_, wat=None):
  hw = HW[k]; wb = (wat if wat is not None else water0A).buffer(1.0)
  while s < s_end:
    (x, z), t, n = at_s(k, s, side * (hw + 1.7))
    P = Point(x, z)
    if reg_.contains(P) and not wb.contains(P) and not treeOcc.contains(P):
      TREES.append([round(x, 2), round(z, 2), round(-n[0] * side, 3), round(-n[1] * side, 3), round(rnd.uniform(0.85, 1.15), 2), k])
    s += rnd.uniform(13, 19) if k != 'at' else rnd.uniform(15, 22)
  return s
EXT_T = []
for k in CL:
  for side in (-1, 1):
    s0_ = random.uniform(3, 8)
    if k == 'dx': EXT_T.append((side, tree_run(k, side, s0_, DX_A_LEN - 3, random, regionA)))
    else: tree_run(k, side, s0_, CL[k].length - 3, random, regionA)
_nA_pre = len(TREES)
for side, s_ in EXT_T: tree_run('dx', side, max(s_, DX_A_LEN + 1), CL['dx'].length - 3, RNG_B, regionB)
_nA = len(TREES)
for t_ in TREES[_nA_pre:]: t_.append(1)   # 2B 东段新种的树：直立（小美 2B ④）
# 2C：白马河下段两岸的房子 / 榕树（另一串随机数；直立树）。1A / 2B 里压到 2C 新水面 / 新路的（只可能在乌山路以南接缝处）剔掉
CL['bm'] = bm
_c2occ = unary_union([chanS.buffer(7.5)] + [r['poly'].buffer(0.5) for r in ROADS if r.get('c2') and not r.get('park')] + [b['foot'].buffer(3) for b in BR if b.get('c2')])
_nh0 = len(HOUSES); HOUSES = [h for h in HOUSES if not Polygon([(h['x'] + h['t'][0] * a + h['f'][0] * b, h['z'] + h['t'][1] * a + h['f'][1] * b) for a, b in [(-h['w'] / 2, -h['d'] / 2), (h['w'] / 2, -h['d'] / 2), (h['w'] / 2, h['d'] / 2), (-h['w'] / 2, h['d'] / 2)]]).intersects(_c2occ)]
_c2tocc = unary_union([chanS.buffer(1.0)] + [r['poly'] for r in ROADS if r.get('c2') and not r.get('plaza')] + [b['foot'].buffer(2.5) for b in BR if b.get('c2')])
_nt0 = len(TREES); TREES = [t_ for t_ in TREES if not _c2tocc.contains(Point(t_[0], t_[1]))]
print('2C junction: removed 1A/2B houses', _nh0 - len(HOUSES), 'trees', _nt0 - len(TREES))
occ = occ.union(_c2occ)
treeOcc = treeOcc.union(unary_union([g.buffer(1.5) for g in UGAPS] + [box(K_['x'] - 6, K_['z'] - 8, K_['x'] + 6, K_['z'] + 4) for K_ in KIOSK.values()] + [Point(*p_['sign']).buffer(3.5) for p_ in PIERS_C] + [Point(*SLUICE['house']).buffer(5.5), Point(*SLUICE['view']).buffer(3.0)]))
RNG_C = random.Random(2027); RG['r'] = region.buffer(-0.5)
_nH2 = len(HOUSES)
for side in (-1, 1): house_run('bm', side, BM_A_LEN + 2, BM_END - 4, RNG_C)
_nT2 = len(TREES)
for side in (-1, 1): tree_run('bm', side, BM_A_LEN + RNG_C.uniform(1, 6), BM_END - 3, RNG_C, region, water0)
for t_ in TREES[_nT2:]: t_.append(1)
# 宁化步道两边一排榕树（树冠朝步道）
for sv in (-1, 1):
  a_ = NH_LAT0 + 4.0
  while a_ < NH_LAT1 - 3.0:
    x_, z_ = _gp(a_, NH_C + sv * 3.4); TREES.append([round(x_, 2), round(z_, 2), round(-_v[0] * sv, 3), round(-_v[1] * sv, 3), round(RNG_C.uniform(0.9, 1.1), 2), 'nhw', 1]); a_ += 11.5
print('2C houses', len(HOUSES) - _nH2, 'trees', len(TREES) - _nT2)
# 湖边柳 / 榕
c = list(lake.exterior.coords); acc = 0
for a, b in zip(c, c[1:]):
  L = math.dist(a, b); acc += L
  if acc > 16:
    acc = 0; mx, mz = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2; tx, tz = (b[0] - a[0]) / L, (b[1] - a[1]) / L; nx, nz = tz, -tx
    if lake.contains(Point(mx + nx, mz + nz)): nx, nz = -nx, -nz
    x, z = mx + nx * 2, mz + nz * 2
    if regionB.contains(Point(x, z)) and not water0A.buffer(1.0).contains(Point(x, z)) and not treeOcc.contains(Point(x, z)) and x > LAKE_BOX[0] + 2 and z < LAKE_BOX[3] - 2:
      TREES.append([round(x, 2), round(z, 2), round(-nx, 3), round(-nz, 3), 1.0, 'lake'])
PARKCUT = unary_union([XHPARK.buffer(1.0), damR.buffer(3.0)])
def _hpoly(h):
  t, f = h['t'], h['f']; return Polygon([(h['x'] + t[0] * a + f[0] * b, h['z'] + t[1] * a + f[1] * b) for a, b in [(-h['w'] / 2, -h['d'] / 2), (h['w'] / 2, -h['d'] / 2), (h['w'] / 2, h['d'] / 2), (-h['w'] / 2, h['d'] / 2)]])
HOUSES = [h for h in HOUSES if not _hpoly(h).intersects(PARKCUT)]
TREES = [t for t in TREES if not PARKCUT.contains(Point(t[0], t[1]))]
# 2B：水部步道两边一排榕树（树冠朝步道）；东侧到亭子广场为止
for sx in (-1, 1):
  z_ = SBW_Z0 + 6
  while z_ < (SBW_Z1 - 4 if sx < 0 else kz - 11):
    TREES.append([round(SBW_X + sx * (SBW_W / 2 + SBW_V / 2 + 0.3), 2), round(z_, 2), -sx, 0, round(RNG_B.uniform(0.9, 1.1), 2), 'sbw', 1]); z_ += 11.5
print('trees', len(TREES), 'houses after park cut', len(HOUSES))
# 2B 水部步道两边：可走范围外原来只有一层浅色 skirt（亭子往外看一片白地，小美 2B ②）→ 这块 skirt 改成草地；背朝步道 / 亭子的房子背面、侧面也贴立面（原来是没贴图的白方块）
SBW_PARK = [round(SBW_X - 70, 1), round(SBW_Z0 - 30, 1), round(SBW_X + 70, 1), round(SBW_Z1 + 45, 1)]
_pk = box(*SBW_PARK)
for h in HOUSES:
  bx_, bz_ = h['x'] - h['f'][0] * h['d'] / 2, h['z'] - h['f'][1] * h['d'] / 2
  if _pk.contains(Point(bx_, bz_)) and h['f'][1] * (SBW_Z1 - h['z']) < 0: h['back'] = 1
print('sbw park', SBW_PARK, 'houses back-faced', sum(1 for h in HOUSES if h.get('back')))
# 码头牌子周围 1.5 m 不种树（小美 2B ①：市民服务中心码头木牌被斜树干穿过）。只剔 2B 新树（1A 已验收的不动）；直立树主干 1.0 s 粗、气根 r≤3.7 → 树根点离牌子 ≥ 1.5 + 2.0
def _signclear(t_):
  if len(t_) < 7: return True
  return all(math.dist((t_[0], t_[1]), tuple(p_['sign'])) >= 3.5 for p_ in PIERS + PIERS_C)
_nb = len(TREES); TREES = [t_ for t_ in TREES if _signclear(t_)]
print('sign-clear removed', _nb - len(TREES))
for p_ in PIERS:
  for t_ in TREES:
    if len(t_) < 7 and math.dist((t_[0], t_[1]), tuple(p_['sign'])) < 3.5: print('  1A tree near sign', p_['id'], t_)
_kx, _kz = KIOSK['fzsb']['x'], KIOSK['fzsb']['z']; _st = (smc['x'] - smc['t'][0] * 9.5 + smc['n'][0] * 0.6, smc['z'] - smc['t'][1] * 9.5 + smc['n'][1] * 0.6)
SBW_WALK = round(math.dist((_kx, _kz + 1.5), (SBW_X, _kz + 3.0)) + (_kz + 3.0 - SBW_Z0) + math.dist((SBW_X, SBW_Z0), _st), 1)
print('sbw', {'x': SBW_X, 'z0': SBW_Z0, 'z1': SBW_Z1, 'kiosk': KIOSK['fzsb'], 'stairTop': _st, 'walk_m': SBW_WALK})
assert SBW_WALK <= 120, SBW_WALK

# ---------- 船线 A ----------
def path_for(k, s0, s1, latfn, step=1.0):
  out = []; n = max(2, int(abs(s1 - s0) / step))
  for i in range(n + 1):
    s = s0 + (s1 - s0) * i / n; (x, z), t, nn = at_s(k, s, latfn(s)); out.append((x, z))
  return out
def ss(e0, e1, x):
  u = min(1, max(0, (x - e0) / (e1 - e0))); return u * u * (3 - 2 * u)
BOFF = HW['bm'] - 4.3
def lat_bm(s):
  sp = xsg['s']; w = ss(sp - 45, sp - 15, s) * (1 - ss(sp + 18, sp + 48, s))
  return xsg['side'] * BOFF * w
DOFF = HW['dx'] - 4.3
def lat_dx(s):
  # 黎明湖码头靠边停 → 2B 回河心 → 市民服务中心码头靠北岸停
  sp = lmh['s']; se = smc['s']
  return lmh['side'] * DOFF * ss(sp - 45, sp - 14, s) * (1 - ss(sp + 18, sp + 48, s)) + smc['side'] * DOFF * ss(se - 45, se - 14, s)
sj = bm.project(Point(dx.coords[0]))
def hermite(p0, t0, p1, t1, n=24):
  L = math.dist(p0, p1) * 0.7; out = []
  for i in range(1, n):
    u = i / n; h00 = 2*u**3 - 3*u**2 + 1; h10 = u**3 - 2*u**2 + u; h01 = -2*u**3 + 3*u**2; h11 = u**3 - u**2
    out.append((h00*p0[0] + h10*L*t0[0] + h01*p1[0] + h11*L*t1[0], h00*p0[1] + h10*L*t0[1] + h01*p1[1] + h11*L*t1[1]))
  return out
def tdir(a, b): l = math.dist(a, b); return ((b[0] - a[0]) / l, (b[1] - a[1]) / l)
bx, bz = xihu['berth']; t = xihu['t']
lakeLeg = [(bx - t[0] * 6, bz - t[1] * 6), (bx, bz), (bx + t[0] * 12, bz + t[1] * 10.5)]
bmLeg = path_for('bm', 42, sj - 13, lat_bm)
dxLeg = path_for('dx', 34, smc['s'] + 6, lat_dx)
pts = lakeLeg + hermite(lakeLeg[-1], tdir(lakeLeg[-2], lakeLeg[-1]), bmLeg[0], tdir(bmLeg[0], bmLeg[1]), 30) + bmLeg
pts += hermite(bmLeg[-1], tdir(bmLeg[-2], bmLeg[-1]), dxLeg[0], tdir(dxLeg[0], dxLeg[1]), 30) + dxLeg
route = pts
rl = LineString(chaikin(route, 2)).simplify(0.03)
# 1 m 重采样
L = rl.length; RP = []
for i in range(int(L) + 1): q = rl.interpolate(i); RP.append([round(q.x, 2), round(q.y, 2)])
STOPS = []
for p in PIERS:
  s = rl.project(Point(*p['berth'])); q = rl.interpolate(s)
  STOPS.append({'id': p['id'], 's': round(s, 2), 'd': round(math.dist((q.x, q.y), p['berth']), 2)})
# 船身（8 x 2.4）四角 + 中点都要在水里（码头边除外：浮码头本身是 dry）
dryU = unary_union(DRY)
navi = water.union(chamber).buffer(0.01).difference(dryU.buffer(0.08))
naviS = navi.buffer(-0.3)
bad = []
for i in range(2, len(RP) - 2):
  a, b = RP[i - 2], RP[i + 2]; tx, tz = tdir(a, b); nx, nz = tz, -tx; x, z = RP[i]
  for u, v in [(-4, -1.2), (4, -1.2), (4, 1.2), (-4, 1.2), (0, 1.2), (0, -1.2)]:
    q = Point(x + tx * u + nx * v, z + tz * u + nz * v)
    nearB = min(math.dist((x, z), p['berth']) for p in PIERS) < 14.5
    if not (navi.buffer(-0.1) if nearB else navi.buffer(-0.3)).contains(q): bad.append((i, round(q.x, 1), round(q.y, 1)))
print('hull outside water at', len(bad), bad[:12])
# 2B：A 线延到市民服务中心后单程要压在 8 min 内 → 沿用 B 线已过的限速规则（过桥 / 进出码头 3.5），东西河东段（黎明湖 → 市民服务中心之间）开阔处 5.5
_sl = [st['s'] for st in STOPS if st['id'] == 'lmh'][0]; _se = [st['s'] for st in STOPS if st['id'] == 'smc'][0]
A_ZONES = {'cruise': 3.5, 'fast': [round(_sl + 45, 1), round(_se - 45, 1)], 'vFast': 5.5, 'vBridge': 3.5, 'vPier': 3.5, 'pierZone': 45}
print('A zones', A_ZONES)
print('route len', round(L, 1), 'stops', STOPS, 'minR', minRat(LineString(RP)))

# ---------- 2C：C线（西水关 C线泊位 ⇄ 上海西码头；同一艘船模、红篷；双头船，终点不掉头转身）----------
def lat_c(s):
  sc, sh = xsgc['s'], shw['s'] + 2.4
  return xsgc['side'] * (HW['bm'] - 3.0) * (1 - ss(sc + 3, sc + 45, s)) + shw['side'] * (HW['bm'] - 4.3) * ss(sh - 47, sh - 17, s)
cLeg = path_for('bm', xsgc['s'] - 6, shw['s'] + 2.4 + 6, lat_c)
rlC = LineString(chaikin(cLeg, 2)).simplify(0.03)
LC = rlC.length; RPC = []
for i in range(int(LC) + 1): q = rlC.interpolate(i); RPC.append([round(q.x, 2), round(q.y, 2)])
STOPS_C = []
for p in PIERS_C:
  s_ = LineString(RPC).project(Point(*p['berth'])); q = LineString(RPC).interpolate(s_)
  STOPS_C.append({'id': p['id'], 's': round(s_, 2), 'd': round(math.dist((q.x, q.y), p['berth']), 2)})
assert all(st['d'] < 0.05 for st in STOPS_C), STOPS_C
def hull_poly(R_, i, L_=4.0, W_=1.2):
  a, b = R_[max(0, i - 2)], R_[min(len(R_) - 1, i + 2)]; tx, tz = tdir(a, b); nx, nz = tz, -tx; x, z = R_[i]
  return Polygon([(x + tx * u + nx * v, z + tz * u + nz * v) for u, v in [(-L_, -W_), (L_, -W_), (L_, W_), (-L_, W_)]])
badC = []
for i in range(int(STOPS_C[0]['s']), int(STOPS_C[-1]['s']) + 1):
  hp = hull_poly(RPC, i); nearB = min(math.dist(RPC[i], p['berth']) for p in PIERS_C) < 14.5
  if not (navi.buffer(-0.1) if nearB else navi.buffer(-0.3)).contains(hp): badC.append((i, RPC[i]))
print('C hull outside water at', len(badC), badC[:8])
# A 线船经过 / 停靠西水关时不碰停在 C线泊位的船（反过来 C线不经过 A 线泊位）
_cdock = hull_poly(RPC, int(round(STOPS_C[0]['s'])))
_hitA = [i for i in range(2, len(RP) - 2) if hull_poly(RP, i).buffer(0.1).intersects(_cdock)]
assert not _hitA, ('A route hull hits docked C boat at xsgc', _hitA[:5])
_adock = hull_poly(RP, int(round([st['s'] for st in STOPS if st['id'] == 'xsg'][0])))
assert not any(hull_poly(RPC, i).buffer(0.1).intersects(_adock) for i in range(0, len(RPC) - 2)), 'C route hits docked A boat at xsg'
ROUTE_C = {'id': 'C', 'canopy': 'red', 'color': '#2F7D4A', 'p': [v for xz in RPC for v in xz], 'stops': STOPS_C}
print('route C len', round(LC, 1), 'stops', STOPS_C, 'minR', minRat(LineString(RPC)))
# 闽江远景：水面（低于内河 0.6 m，只看）、岸墙、口门两侧观景栏杆、三县洲大桥（OSM way 456013808 过江一段，1:3）
mjPoly = mjPoly.difference(region).buffer(0)
if mjPoly.geom_type != 'Polygon': mjPoly = max(mjPoly.geoms, key=lambda g: g.area)
MJ_SHORE = []
for (x0, z0), (x1, z1) in zip(list(mjPoly.exterior.coords), list(mjPoly.exterior.coords)[1:]):
  if math.hypot(x1 - x0, z1 - z0) < 0.05: continue
  m_ = Point((x0 + x1) / 2, (z0 + z1) / 2)
  if water.buffer(0.3).contains(m_): continue
  MJ_SHORE.append([round(x0, 2), round(z0, 2), round(x1, 2), round(z1, 2)])
_rl = region.exterior.intersection(Point(_mx, _mz).buffer(48)).difference(water.buffer(0.3))
MJ_RAIL = []
for g in (_rl.geoms if hasattr(_rl, 'geoms') else [_rl]):
  if g.geom_type != 'LineString': continue
  c_ = list(g.simplify(0.2).coords)
  for a, b in zip(c_, c_[1:]):
    if math.dist(a, b) > 0.3: MJ_RAIL.append([round(a[0], 2), round(a[1], 2), round(b[0], 2), round(b[1], 2)])
SXZ = [[148.5, -1651.1], [141.5, -1596.1], [135.6, -1550.3], [119.2, -1444.0]]
MJ = {'lv': MJ_LV, 'zb': MJ_ZB, 'water': pack(tris_flat(mjPoly)), 'shore': MJ_SHORE, 'rail': MJ_RAIL, 'sxz': SXZ, 'far': [round(_mx - 430, 1), round(MJ_ZB - 230, 1), round(_mx + 430, 1)]}
print('minjiang tris', len(MJ['water']['i']) // 3, 'shore', len(MJ_SHORE), 'rail', len(MJ_RAIL))

# ---------- 输出 ----------
def r2(v): return round(v, 2)
DATA = {
  'K': K, 'WY': WY,
  'rivers': {k: {'zh': NAME[k][0], 'en': NAME[k][1], 'hw': HW[k], 'band': BAND[k], 'p': [v for x, z in CL[k].coords for v in (r2(x), r2(z))]} for k in CL},
  'lake': [v for x, z in lake.exterior.coords for v in (r2(x), r2(z))], 'lakeBox': LAKE_BOX,
  'land': LAND, 'water': WATER, 'cell': CELL, 'skirt': SKIRT, 'sbwPark': SBW_PARK, 'lakeFar': LAKEFAR, 'lakeShore': LAKESHORE,
  'wall': WALL, 'bound': BOUND,
  'bridges': [{k_: v for k_, v in b.items() if k_ != 'foot'} for b in BR],
  'piers': PIERS, 'steps': STEPS, 'unders': UNDERS, 'dry': [[v for x, z in list(p.exterior.coords)[:-1] for v in (r2(x), r2(z))] for p in DRY],
  'kiosks': KIOSK, 'roads': [{**{k_: v for k_, v in r.items() if k_ != 'poly'}, 'poly': [v for x, z in list(r['poly'].exterior.coords)[:-1] for v in (r2(x), r2(z))]} for r in ROADS],
  'sfqx': SFQX, 'sbwWalk': SBW_WALK, 'houses': HOUSES, 'trees': TREES,
  'lock': LOCK,
  'route': {'id': 'A', 'zones': A_ZONES, 'p': [v for xz in RP for v in xz], 'stops': STOPS},
  # 2C（只加不改）：C线、2C 码头 / 桥下步道、彬德水闸 + 闽江远景
  'routes': [ROUTE_C], 'undersC': UNDERS_C,
  'c2': {'bmALen': round(BM_A_LEN, 2), 'z0': -600, 'sluice': SLUICE, 'mj': MJ, 'nhWalk': NH_WALK},
}
DATA['piers'] = PIERS + PIERS_C
js = ('// 自动生成：tools/fzriver/gen.py（OSM 河道 → 1:3 压缩的游戏坐标；x 东、z 北，原点 = 东街口站 / 3）。不要手改。\n'
      'export const FZR = ' + json.dumps(DATA, ensure_ascii=False, separators=(',', ':')) + ';\n')
open(OUT, 'w').write(js); print('wrote', OUT, len(js))
