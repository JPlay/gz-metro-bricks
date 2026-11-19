# 福州内河 5：瀛洲河（汇入口 → 江四水闸 + 闽江远景）。由 gen_e.py 在 4A 汇入口常数就绪后调用。
# 沿河 1:5，河宽 1:1。头 15–20 m：半宽 6.5→9、中线从汇入口切向缓转到偏移后的 OSM。
import json, math, os, random
from shapely.geometry import LineString, Polygon, Point, box
from shapely.ops import unary_union

HOLD, BLEND_END = 16.0, 32.0
WIDTH_END = 18.0
HW0, HW1 = 6.5, 9.0
BAND_YZ = 24.0
# 闽江：对岸约 180 m（大河，不是内河）；沿江 ±400 m；水面比内河略低
MJ_FAR, MJ_HALF, MJ_OUT = 180.0, 400.0, 220.0
MJ_GAP = 12.0   # 堰到闽江近岸的堤距

def _smooth(t):
  t = max(0.0, min(1.0, t))
  return t * t * (3 - 2 * t)

def _tan(ls, s):
  s = min(max(s, 0), ls.length)
  a0 = max(0, min(s - 1, ls.length - 2))
  a, b = ls.interpolate(a0), ls.interpolate(a0 + 2)
  l = math.hypot(b.x - a.x, b.y - a.y) or 1
  return ((b.x - a.x) / l, (b.y - a.y) / l)

def _chaikin(c, n=2):
  for _ in range(n):
    o = [c[0]]
    for a, b in zip(c, c[1:]):
      o += [(a[0] * .75 + b[0] * .25, a[1] * .75 + b[1] * .25), (a[0] * .25 + b[0] * .75, a[1] * .25 + b[1] * .75)]
    o.append(c[-1]); c = o
  return c

def _bez(P0, P1, P2, P3, u):
  u2, mu = u * u, 1 - u
  u3, mu2, mu3 = u2 * u, mu * mu, mu * mu * mu
  return (mu3 * P0[0] + 3 * mu2 * u * P1[0] + 3 * mu * u2 * P2[0] + u3 * P3[0],
          mu3 * P0[1] + 3 * mu2 * u * P1[1] + 3 * mu * u2 * P2[1] + u3 * P3[1])

def _hw(s):
  return HW0 + (HW1 - HW0) * _smooth(s / WIDTH_END) if s < WIDTH_END else HW1

def _dedupe(pts, eps=0.35):
  out = [pts[0]]
  for p in pts[1:]:
    if math.dist(out[-1], p) > eps: out.append(p)
  if math.dist(out[-1], pts[-1]) > 0.05: out.append(pts[-1])
  return out



def _smooth_radius(ls, rmin, lock=0.0, iters=80):
  """Cut sharp corners beyond `lock` until vertex minR >= rmin or iters run out."""
  pts = [list(p) for p in ls.coords]
  def candidates():
    out = []
    a = 0.0
    for i in range(1, len(pts) - 1):
      A = math.dist(pts[i-1], pts[i]); B = math.dist(pts[i], pts[i+1]); C = math.dist(pts[i-1], pts[i+1])
      s = (A + B + C) / 2; ar = max(s * (s - A) * (s - B) * (s - C), 0) ** 0.5
      if ar > 1e-6 and a >= lock:
        out.append((A * B * C / (4 * ar), i, a))
      a += A
    out.sort()
    return out
  for _ in range(iters):
    c = candidates()
    if not c or c[0][0] >= rmin: break
    r, i, s = c[0]
    a, b, d = pts[i-1], pts[i], pts[i+1]
    mid = ((a[0] + d[0]) / 2, (a[1] + d[1]) / 2)
    k = 0.4
    pts[i] = [b[0] + k * (mid[0] - b[0]), b[1] + k * (mid[1] - b[1])]
  return LineString(_dedupe([tuple(p) for p in pts], 0.3))


def build_yz(g):
  """在 4A 汇入口 _y0/_yd 已定、stub chanY 已建之后调用。替换 chanY 为全河，登记 CL/桥/路/闸/闽江矩形。"""
  HERE = g['HERE']; scG = g['scG']; at_s = g['at_s']; bridge = g['bridge']; rect = g['rect']
  Y0 = g['_y0']; D0 = g['_yd']
  raw = json.load(open(os.path.join(HERE, 'yz_osm_m.json')))
  coords = []
  for w in raw['ways']:
    if w['id'] in (834951432, 834951431): break   # 涵洞及以南不走进河
    pts = [tuple(p) for p in w['coords']]
    coords.extend(pts if not coords else pts[1:])
  g0 = scG([coords[0]])[0]
  OFF = (Y0[0] - g0[0], Y0[1] - g0[1])
  osm_g = [(p[0] + OFF[0], p[1] + OFF[1]) for p in scG(coords)]
  osm_g[0] = (Y0[0], Y0[1])
  Losm = LineString(_chaikin(osm_g, 2)).simplify(1.0)
  # 头 8 m 严格沿汇入口切向（04 镜头里嘴的开口跟 4A 一样），8–18 m 贝塞尔接到偏移 OSM
  # 头 16 m 严格沿汇入口切向（04 镜头 14 m 处仍是同一条茎）；16–48 m 贝塞尔接到偏移 OSM，并把西弯往南推开，避免切掉 4A 新港闸南岸观景 / 六一中路南桥头。
  hold = [(Y0[0] + D0[0] * s, Y0[1] + D0[1] * s) for s in (0.0, 2.0, 4.0, 6.0, 8.0, 10.0, 12.0, 14.0, HOLD)]
  P0 = hold[-1]
  s_tgt = min(48.0, Losm.length)
  P3 = (Losm.interpolate(s_tgt).x, Losm.interpolate(s_tgt).y)
  T3 = _tan(Losm, s_tgt)
  C = 12.0
  P1 = (P0[0] + D0[0] * C, P0[1] + D0[1] * C)
  P2 = (P3[0] - T3[0] * C, P3[1] - T3[1] * C)
  blend = [_bez(P0, P1, P2, P3, i / 20) for i in range(1, 21)]
  s_join = Losm.project(Point(*P3))
  rest, ss = [], s_join + 1.6
  while ss < Losm.length:
    q = Losm.interpolate(ss); rest.append((q.x, q.y)); ss += 2.0
  rest.append((Losm.coords[-1][0], Losm.coords[-1][1]))
  raw_pts = _dedupe(hold + blend + rest)
  # 4A 南岸保护区：中线（及随后 hw=9 的水面）不得侵入观景处 / 木牌 / 闸块 / 六一中路南桥头
  pads = [Point(*g['GATE4']['view']).buffer(18), Point(g['SIGN4']['x'], g['SIGN4']['z']).buffer(16),
          Polygon(g['GATE4']['block']).buffer(6), g['xgPoly'].buffer(12)]
  for b in g.get('BR4') or []:
    for sg in (-1, 1):
      pads.append(Point(b['x'] + b['n'][0] * sg * (b['half'] + 3), b['z'] + b['n'][1] * sg * (b['half'] + 3)).buffer(14))
  protect = unary_union(pads)
  pushed = []
  acc = 0.0
  for i, p in enumerate(raw_pts):
    if i: acc += math.dist(raw_pts[i-1], p)
    if acc <= HOLD + 0.5:
      pushed.append(p); continue
    q = list(p)
    for _ in range(40):
      if protect.distance(Point(*q)) >= 1.0 and not protect.contains(Point(*q)): break
      q[0] += D0[0] * 0.6; q[1] += D0[1] * 0.6   # 沿汇入口方向往南推
    pushed.append(tuple(q))
  yz = LineString(_dedupe(pushed))
  yz = _smooth_radius(yz, 16.0, lock=HOLD - 2)  # keep first 14 m of D0; smooth the join
  g['HW']['yz'] = HW1
  g['BAND']['yz'] = BAND_YZ
  g['NAME']['yz'] = ['瀛洲河', 'Yingzhou River']
  g['CL']['yz'] = yz

  # 变宽水面：头 18 m 半宽 6.5→9，两端平头（汇入口并进光明港；南端停在闸）
  left, right, s = [], [], 0.0
  while s <= yz.length + 1e-6:
    ss = min(s, yz.length)
    p = yz.interpolate(ss); t = _tan(yz, ss); n = (t[1], -t[0]); h = _hw(ss)
    left.append((p.x - n[0] * h, p.y - n[1] * h))
    right.append((p.x + n[0] * h, p.y + n[1] * h))
    s += 1.0
  chanY = Polygon(left + right[::-1]).buffer(0).simplify(0.06)
  if chanY.geom_type != 'Polygon':
    chanY = max(chanY.geoms, key=lambda q: q.area)
  g['chanY'] = chanY
  g['YZ_OFF'] = [round(OFF[0], 4), round(OFF[1], 4)]
  print('5 yz len', round(yz.length, 2), 'pts', len(yz.coords), 'minR', g['minRat'](yz)[0],
        'start', tuple(round(v, 2) for v in yz.coords[0]), 'end', tuple(round(v, 2) for v in yz.coords[-1]),
        'off', g['YZ_OFF'])

  # 三座桥：真实中线里程投影到游戏中线（桥宽 1:1）。老药洲↔瀛洲桥因 1:5 压缩间距紧，不套 20 m 桥距淘汰。
  real_line = LineString(coords)
  def game_of(real_s):
    rp = real_line.interpolate(min(max(real_s, 0), real_line.length))
    gp = scG([(rp.x, rp.y)])[0]
    return (gp[0] + OFF[0], gp[1] + OFF[1])

  specs = [
    (671.7, 12, 'road', '老药洲街', 'tertiary 843810660；1:5 后与瀛洲桥间距紧，保留三座命名桥'),
    (787.5, 16, 'foot', '瀛洲桥', '榕城古街步行桥 843810663，2014 改建；宽略收至 16 m 以免和老药洲街搭上'),
    ((976.8 + 989.2) / 2, 28, 'road', '台江路', '双幅主干 1058500764 / 1056137918 合一'),
  ]
  nB0 = len(g['BR'])
  for real_s, w, kind, name, note in specs:
    gp = game_of(real_s)
    s = yz.project(Point(*gp))
    b = bridge('yz', s, w, kind, name, plate=('瀛洲桥' if name == '瀛洲桥' else None), note=note)
    b['a5'] = 1
  BR5 = g['BR'][nB0:]
  for b in BR5:
    x, z, t, n, half, w = b['x'], b['z'], b['t'], b['n'], b['half'], b['w']
    g['GAPS'].append(Polygon([(x + t[0] * a + n[0] * c, z + t[1] * a + n[1] * c) for a, c in [(-w / 2 + 0.05, -half - 0.5), (w / 2 - 0.05, -half - 0.5), (w / 2 - 0.05, half + 0.5), (-w / 2 + 0.05, half + 0.5)]]))
    b['foot'] = Polygon([(x + t[0] * a + n[0] * c, z + t[1] * a + n[1] * c) for a, c in [(-w / 2, -half), (w / 2, -half), (w / 2, half), (-w / 2, half)]])
  ROADS5 = []
  for b in BR5:
    for sg in (-1, 1):
      ROADS5.append({'id': b['id'] + ('e' if sg > 0 else 'w'), 'name': b['name'],
                     'poly': rect(b['x'], b['z'], b['n'][0] * sg, b['n'][1] * sg, b['hw'] + 2, b['hw'] + BAND_YZ + 2, -b['w'] / 2, b['w'] / 2),
                     'dir': [b['n'][0] * sg, b['n'][1] * sg], 'w': b['w'], 'stub': True, 'a5': True})
  for b in BR5:
    print('5 bridge', b['id'], b['name'], 's', round(b['s'], 1), 'w', b['w'], 'at', (b['x'], b['z']))
  g['BR5'] = BR5
  g['ROADS5'] = ROADS5

  # 江四水闸：中线南端。t 朝闽江（南），n 约朝西。
  GATE_S = round(yz.length - 1.5, 2)
  (gx, gz), gt, gn = at_s('yz', GATE_S)
  # 观景处：上游北岸（-t），偏西（泵房一侧），正面能看见两孔堰 + 侧泵房 + 闽江
  view = at_s('yz', max(4.0, GATE_S - 10.0), gn[0] * 0 + HW1 + 3.4)  # default +n
  # 选离水更远、在未来岸带里的一侧：+n / -n 都试，取 |lat| 更大且在 chanY 外的
  cands = []
  for sg in (-1, 1):
    p = at_s('yz', max(4.0, GATE_S - 10.0), sg * (HW1 + 3.6))[0]
    cands.append((sg, p, chanY.distance(Point(*p))))
  sgV, viewP, _ = max(cands, key=lambda q: q[2])
  # 泵房放在观景处对岸，正面能同时看到堰和房子
  sgH = -sgV
  GATE5 = {
    's': GATE_S, 'x': round(gx, 2), 'z': round(gz, 2),
    't': [round(gt[0], 4), round(gt[1], 4)], 'n': [round(gn[0], 4), round(gn[1], 4)],
    'hw': HW1, 'bays': 2, 'bayW': [6.2, 6.2],
    'view': [round(viewP[0], 2), round(viewP[1], 2)],
    'side': sgV, 'houseSide': sgH,
    'house': None,  # filled below
  }
  # 碰撞体：矮堰跨河，人上不去、过不了
  _blk = [(-1.6, -HW1 - 1.4), (3.2, -HW1 - 1.4), (3.2, HW1 + 1.4), (-1.6, HW1 + 1.4)]
  GATE5['block'] = [[round(gx + gt[0] * a + gn[0] * b, 2), round(gz + gt[1] * a + gn[1] * b, 2)] for a, b in _blk]
  # 侧泵房中心：堰西/东岸，略偏上游，浅灰小房子
  hx = gx + gt[0] * -2.4 + gn[0] * sgH * (HW1 + 4.6)
  hz = gz + gt[1] * -2.4 + gn[1] * sgH * (HW1 + 4.6)
  GATE5['house'] = {'x': round(hx, 2), 'z': round(hz, 2), 'w': 8.0, 'd': 5.6, 'h': 5.2,
                    't': [round(gt[0], 4), round(gt[1], 4)], 'n': [round(gn[0] * sgH, 4), round(gn[1] * sgH, 4)]}
  g['GATE5'] = GATE5
  print('5 gate', GATE5['x'], GATE5['z'], 't', GATE5['t'], 'houseSide', sgH, 'view', GATE5['view'])

  # 闽江矩形（未扣 region；finish_mj 里再差）
  mx = gx + gt[0] * MJ_GAP; mz = gz + gt[1] * MJ_GAP
  g['MJ5_O'] = (mx, mz); g['MJ5_T'] = gt; g['MJ5_N'] = gn
  def Lc(a, b):
    return (mx + gt[0] * a + gn[0] * b, mz + gt[1] * a + gn[1] * b)
  g['mjRect5'] = Polygon([Lc(0, -MJ_HALF), Lc(0, MJ_HALF), Lc(MJ_OUT, MJ_HALF), Lc(MJ_OUT, -MJ_HALF)])
  g['Lc5'] = Lc


def finish_mj(g):
  """region 更新之后：扣掉可走范围、打包水面 / 堤岸 / 对岸取景点。"""
  region, pack, tris_flat, WY = g['region'], g['pack'], g['tris_flat'], g['WY']
  mx, mz = g['MJ5_O']; gt, gn = g['MJ5_T'], g['MJ5_N']
  Lc = g['Lc5']
  mj = g['mjRect5'].difference(region).buffer(0)
  if mj.is_empty:
    mj = g['mjRect5'].buffer(0)
  if mj.geom_type != 'Polygon':
    mj = max(mj.geoms, key=lambda q: q.area)
  g['mjPoly5'] = mj
  GX, GZ = g['GATE5']['x'], g['GATE5']['z']
  SHORE, RAIL = [], []
  for (x0, z0), (x1, z1) in zip(list(mj.exterior.coords), list(mj.exterior.coords)[1:]):
    if math.hypot(x1 - x0, z1 - z0) < 0.12: continue
    mid = Point((x0 + x1) / 2, (z0 + z1) / 2)
    u = (mid.x - mx) * gt[0] + (mid.y - mz) * gt[1]
    v = (mid.x - mx) * gn[0] + (mid.y - mz) * gn[1]
    # 靠闸那一段近岸不画堤墙（口门，看见堰背和泵房）
    if u < 6.0 and abs(v) < g['GATE5']['hw'] + 8: continue
    SHORE.append([round(x0, 2), round(z0, 2), round(x1, 2), round(z1, 2)])
    # 近岸可走侧（u 小、在 region 边上）留石栏
    if 0.5 < u < 14 and abs(v) > g['GATE5']['hw'] + 2:
      if region.buffer(0.6).contains(mid):
        RAIL.append([round(x0, 2), round(z0, 2), round(x1, 2), round(z1, 2)])
  far = []
  b = -MJ_HALF + 16
  while b < MJ_HALF - 16:
    q = Lc(MJ_FAR, b)
    far.append([round(q[0], 2), round(q[1], 2), round(-gt[0], 4), round(-gt[1], 4)])
    b += 16.0
  MJ = {'lv': WY - 0.6, 'water': pack(tris_flat(mj)), 'shore': SHORE, 'rail': RAIL,
        'o': [round(mx, 2), round(mz, 2)], 't': [round(gt[0], 4), round(gt[1], 4)], 'n': [round(gn[0], 4), round(gn[1], 4)],
        'far': [MJ_FAR, -MJ_HALF, MJ_HALF]}
  g['MJ5'] = MJ
  print('5 闽江 area', round(mj.area, 1), 'shore', len(SHORE), 'rail', len(RAIL), 'far slots', len(far), 'lv', MJ['lv'])
  g['FAR5'] = far


def kind_sluice(g, a, b):
  """江四口门岸墙 flag 4（不画暗洞），同九门 / 新港。"""
  G = g['GATE5']
  mx, mz = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
  if math.hypot(mx - G['x'], mz - G['z']) >= G['hw'] + 1.0: return None
  dx, dz = b[0] - a[0], b[1] - a[1]
  L = math.hypot(dx, dz) or 1
  # 段方向几乎沿着 n（横切河流）= 口门
  if abs(dx / L * G['t'][0] + dz / L * G['t'][1]) < 0.3: return 4
  return None


def place_fill(g):
  """4A 房子 / 树放完之后：沿瀛洲河补房和榕树、闸牌，导出 A5DATA。跳过汇入口 20 m（4A 已放）和闸前。"""
  at_s, region, water = g['at_s'], g['region'], g['water']
  yz, HOUSES, TREES = g['CL']['yz'], g['HOUSES'], g['TREES']
  BR, BR5, ROADS, ROADS5 = g['BR'], g['BR5'], g['ROADS'], g['ROADS5']
  GAPS, DRY, GATE5 = g['GAPS'], g['DRY'], g['GATE5']
  chanY, xgPoly = g['chanY'], g['xgPoly']
  R5 = random.Random(519)
  # 木牌 / 石牌错开（4A 教训：不要叠在同一点），长椅离开两块牌的正面和英文
  sx, sz = GATE5['view']
  t, n = GATE5['t'], GATE5['n']
  sd = GATE5['side']
  # 木牌：观景处上游、略靠岸，牌面朝闸
  SIGN5 = {'id': 'js', 'zh': '江四水闸', 'en': 'Jiangsi Sluice',
           'x': round(sx + t[0] * -2.4 + n[0] * sd * 2.0, 2),
           'z': round(sz + t[1] * -2.4 + n[1] * sd * 2.0, 2),
           'n': [round(-t[0], 4), round(-t[1], 4)], 'stopOnly': True}
  # 石牌：观景处下游、与木牌错开，牌面同样朝闸（两面都有字）
  SIGNS5 = [{'id': 'jsh',
             'x': round(sx + t[0] * 3.8 + n[0] * sd * 2.2, 2),
             'z': round(sz + t[1] * 3.8 + n[1] * sd * 2.2, 2),
             'f': [round(t[0], 4), round(t[1], 4)], 'lines': ['江四水闸', 'Jiangsi Sluice']}]
  # 长椅：更上游、沿步道，在两块牌背后一侧，距两牌 ≥ 3.5 m，不挡石牌英文
  BENCH5 = [round(sx + t[0] * -6.2 + n[0] * sd * 0.6, 2),
            round(sz + t[1] * -6.2 + n[1] * sd * 0.6, 2)]
  # 占位
  def _hpoly0(h):
    return Polygon([(h['x'] + h['t'][0] * a + h['f'][0] * b * -1, h['z'] + h['t'][1] * a + h['f'][1] * b * -1)
                    for a, b in [(-h['w'] / 2, -h['d'] / 2), (h['w'] / 2, -h['d'] / 2), (h['w'] / 2, h['d'] / 2), (-h['w'] / 2, h['d'] / 2)]])
  occ = unary_union([b['foot'].buffer(2.0) for b in BR5] + [q.buffer(1.0) for q in GAPS] + [r['poly'].buffer(0.4) for r in ROADS5]
                    + [p.buffer(1.0) for p in DRY] + [Polygon(GATE5['block']).buffer(10),
                       Point(*GATE5['view']).buffer(8), Point(SIGN5['x'], SIGN5['z']).buffer(6),
                       Point(SIGNS5[0]['x'], SIGNS5[0]['z']).buffer(5), Point(BENCH5[0], BENCH5[1]).buffer(3),
                       Point(GATE5['house']['x'], GATE5['house']['z']).buffer(8),
                       g.get('xgPoly', Point(0, 0)).buffer(2), chanY.buffer(1.0)]
                    + [_hpoly0(h).buffer(0.4) for h in HOUSES if not h.get('gone')])
  nH0 = len(HOUSES)
  def _try_house(s, side, off_extra, w_, d_, h_, lod=None):
    nonlocal occ
    off = HW1 + off_extra + d_ / 2
    (cx, cz), tdir, nn = at_s('yz', min(yz.length - 2, s + w_ / 2), side * off)
    poly = Polygon([(cx + tdir[0] * a + nn[0] * side * b, cz + tdir[1] * a + nn[1] * side * b)
                    for a, b in [(-w_ / 2, -d_ / 2), (w_ / 2, -d_ / 2), (w_ / 2, d_ / 2), (-w_ / 2, d_ / 2)]])
    if not region.buffer(-0.05).contains(poly) or poly.intersects(occ) or poly.intersects(water.buffer(0.8)):
      return False
    occ = occ.union(poly.buffer(0.25))
    rec = {'x': round(cx, 2), 'z': round(cz, 2), 'w': round(w_, 2), 'd': round(d_, 2),
           't': [round(tdir[0], 4), round(tdir[1], 4)], 'f': [round(-nn[0] * side, 4), round(-nn[1] * side, 4)],
           'river': 'yz', 'h': h_, 'kind': 'old', 'ry': round(math.atan2(tdir[0], tdir[1]), 4),
           'back': True, 'a5': True}
    if lod: rec['lod'] = lod
    HOUSES.append(rec)
    return True
  # 前排：沿两岸老街连排（密度接近台江 / 榕城古街），紧挨步道内侧
  s = 16.0
  while s < yz.length - 12:
    if any(abs(b['s'] - s) < b['w'] / 2 + 2.4 for b in BR5):
      s += 2; continue
    placed = False
    w_ = R5.uniform(6.6, 10.2); d_ = R5.uniform(6.0, 8.0); h_ = R5.choice([5.4, 6.0, 6.6, 7.2, 6.2, 7.8])
    for side in (-1, 1):
      if _try_house(s, side, 3.8, w_, d_, h_) or _try_house(s, side, 3.8, 6.2, 5.6, h_):
        placed = True
    s += (w_ + R5.uniform(0.4, 1.6)) if placed else 2.0
  nH1 = len(HOUSES)
  # 后排：低面数，填原先发白的空地；仍落在加宽后的岸带里
  s = 18.0
  while s < yz.length - 14:
    if any(abs(b['s'] - s) < b['w'] / 2 + 2.0 for b in BR5):
      s += 3; continue
    w_ = R5.uniform(8.0, 12.0); d_ = R5.uniform(6.0, 8.0); h_ = R5.choice([6.0, 7.0, 8.0, 9.0, 7.5])
    for side in (-1, 1):
      if not (_try_house(s, side, 13.0, w_, d_, h_, lod='lo') or _try_house(s, side, 13.0, 7.0, 5.8, h_, lod='lo')):
        pass
    s += w_ + R5.uniform(1.2, 2.8)
  print('5 houses', len(HOUSES) - nH0, 'front', nH1 - nH0, 'back', len(HOUSES) - nH1)

  treeOcc = unary_union([b['foot'].buffer(2.5) for b in BR] + [q.buffer(1.5) for q in GAPS] + [r['poly'] for r in ROADS + ROADS5]
                        + [p.buffer(1.0) for p in DRY] + [Polygon(GATE5['block']).buffer(5), Point(*GATE5['view']).buffer(5),
                           Point(SIGN5['x'], SIGN5['z']).buffer(4),
                           Point(SIGNS5[0]['x'], SIGNS5[0]['z']).buffer(4),
                           Point(BENCH5[0], BENCH5[1]).buffer(3)])
  nT0 = len(TREES)
  s = 16.0
  while s < yz.length - 10:
    if any(abs(b['s'] - s) < b['w'] / 2 + 4 for b in BR5):
      s += 3; continue
    for side in (-1, 1):
      (x, z), tdir, nn = at_s('yz', s, side * (HW1 + 1.7))
      P_ = Point(x, z)
      if region.contains(P_) and not water.buffer(0.8).contains(P_) and not treeOcc.contains(P_) and all(math.hypot(x - t[0], z - t[1]) > 4.2 for t in TREES if t[5] != 'gone'):
        TREES.append([round(x, 2), round(z, 2), round(-nn[0] * side, 3), round(-nn[1] * side, 3), round(R5.uniform(0.85, 1.15), 2), 'yz', 1])
        treeOcc = treeOcc.union(P_.buffer(3.2))
    s += R5.uniform(5.2, 7.6)
  print('5 trees', len(TREES) - nT0)

  # 被新河道占到的旧楼 / 树（4A gone 不扩大；这里打 '5'）
  _corr = unary_union([water.buffer(6.0).intersection(chanY.buffer(20)), chanY.buffer(8.0),
                       Polygon(GATE5['block']).buffer(4), g['mjPoly5'].buffer(4)] + [r['poly'].buffer(0.5) for r in ROADS5])
  def _hpoly(h):
    return Polygon([(h['x'] + h['t'][0] * a + h['f'][0] * b * -1, h['z'] + h['t'][1] * a + h['f'][1] * b * -1)
                    for a, b in [(-h['w'] / 2, -h['d'] / 2), (h['w'] / 2, -h['d'] / 2), (h['w'] / 2, h['d'] / 2), (-h['w'] / 2, h['d'] / 2)]])
  GONE5_H = [i for i, h in enumerate(HOUSES) if not h.get('gone') and not h.get('a5') and _hpoly(h).intersects(_corr)]
  for i in GONE5_H: HOUSES[i]['gone'] = '5'
  _tcorr = unary_union([chanY.buffer(2.5), Polygon(GATE5['block']).buffer(3), g['mjPoly5'].buffer(2)] + [r['poly'] for r in ROADS5] + [b['foot'].buffer(2) for b in BR5])
  # 只标记汇入口 25 m 以外被占的旧树（嘴附近是 4A 的范围）
  y0 = g['_y0']
  GONE5_T = [i for i, t in enumerate(TREES) if t[5] not in ('gone',) and not (len(t) > 5 and t[5] == 'yz')
             and _tcorr.contains(Point(t[0], t[1])) and math.hypot(t[0] - y0[0], t[1] - y0[1]) > 25]
  for i in GONE5_T: TREES[i][5] = 'gone'
  print('5 gone houses', GONE5_H, 'trees', len(GONE5_T))

  # 可走圈的检查点（e2e / 单测）
  loops = []
  for b in BR5:
    for sg in (-1, 1):
      loops.append({'bridge': b['id'], 'name': b['name'], 'side': sg,
                    'x': round(b['x'] + b['n'][0] * sg * (b['half'] + 3), 2),
                    'z': round(b['z'] + b['n'][1] * sg * (b['half'] + 3), 2)})

  # 瀛洲桥两端各两根路灯（桥面四角，灯臂朝桥面内侧）
  yz2 = next(b for b in BR5 if b['name'] == '瀛洲桥')
  LAMPS5 = []
  for sv in (-1, 1):
    for su in (-1, 1):
      u, v = su * (yz2['w'] / 2 - 0.45), sv * (yz2['half'] - 0.4)
      x = yz2['x'] + yz2['t'][0] * u + yz2['n'][0] * v
      z = yz2['z'] + yz2['t'][1] * u + yz2['n'][1] * v
      LAMPS5.append([round(x, 2), round(z, 2), round(-yz2['t'][0] * su, 4), round(-yz2['t'][1] * su, 4)])

  bbox = list(chanY.buffer(BAND_YZ + 40).bounds)  # minx,miny,maxx,maxy — lod 用
  A5DATA = {
    'yzLen': round(yz.length, 2), 'hw0': HW0, 'hw1': HW1, 'blend': WIDTH_END, 'pathBlend': BLEND_END, 'hold': HOLD,
    'off': g['YZ_OFF'],
    'gate': GATE5, 'mj': g['MJ5'], 'sign': SIGN5, 'signs': SIGNS5, 'bench': BENCH5,
    'lamps': LAMPS5,
    'bridges': [b['id'] for b in BR5],
    'far': g['FAR5'],
    'gone': {'houses': GONE5_H, 'trees': GONE5_T},
    'loop': loops,
    'zone': [round(v, 1) for v in bbox],
    'note': '5：瀛洲河 1:5，汇入口 15–20 m 缓宽缓转；两岸可走；老药洲街 / 瀛洲桥 / 台江路双向过河成圈；江四水闸（侧泵房+矮两孔堰）只看不过；闽江宽水面+对岸天际线',
  }
  g['A5DATA'] = A5DATA
  g['SIGN5'] = SIGN5
  g['ROADS5'] = ROADS5
