# 福州内河 6A：湖前河东段（茶园水闸 → 北二环 → 北浪路，西头合拢）。
# 由 gen_e.py 在 4A 整段就绪后调用。沿河 1:4（接晋安河），水面半宽 13→5。
import json, math, os, random
from shapely.geometry import LineString, Polygon, Point, box
from shapely.ops import unary_union

HOLD, WIDTH_END, CAP = 12.0, 16.0, 10.0
HW0, HW1 = 13.0, 5.0
BAND_HQ = 24.0
JN_S = 466.2   # 湖前东口落在已建 jn 上


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


def _resample(ls, ds=3.0):
  out, s = [], 0.0
  while s < ls.length - 1e-6:
    q = ls.interpolate(s); out.append((q.x, q.y)); s += ds
  out.append((ls.coords[-1][0], ls.coords[-1][1]))
  return LineString(_dedupe(out, 0.5))

def _smooth_radius(ls, rmin, lock=0.0, iters=400):
  pts = [list(p) for p in ls.coords]
  def candidates():
    out = []
    a = 0.0
    for i in range(1, len(pts) - 1):
      A = math.dist(pts[i - 1], pts[i]); B = math.dist(pts[i], pts[i + 1]); C = math.dist(pts[i - 1], pts[i + 1])
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
    a, b, d = pts[i - 1], pts[i], pts[i + 1]
    mid = ((a[0] + d[0]) / 2, (a[1] + d[1]) / 2)
    k = 0.55
    pts[i] = [b[0] + k * (mid[0] - b[0]), b[1] + k * (mid[1] - b[1])]
  return LineString(_dedupe([tuple(p) for p in pts], 0.3))


def build_hq(g):
  """4A 水面 / 岸墙就绪之后：接上湖前河东段，改水面与岸墙，放桥 / 闸 / 旧街。"""
  HERE, scJ, at_s, bridge, rect = g['HERE'], g['scJ'], g['at_s'], g['bridge'], g['rect']
  pack, tris_by_cell, tris_flat, merge = g['pack'], g['tris_by_cell'], g['tris_flat'], g['merge']
  _keep_old, ext = g['_keep_old'], g['ext']
  water4, region4, land4 = g['water'], g['region'], g['land']
  WALL4, LAND4, WATER4, BOUND4 = g['WALL'], g['LAND'], g['WATER'], g['BOUND']

  (Y0x, Y0z), jt, jn_n = at_s('jn', JN_S)
  Y0 = (Y0x, Y0z)
  # jn 的 n 朝西岸（湖前从西汇入），汇入口切向沿 +n 往湖前
  D0 = (jn_n[0], jn_n[1])

  raw = json.load(open(os.path.join(HERE, 'hq_osm_m.json')))
  coords = []
  for w in raw['ways']:
    pts = [tuple(p) for p in w['coords']]
    coords.extend(pts if not coords else pts[1:])
  # 官方链西→东；游戏中线东口 s=0，所以反过来
  coords_we = list(coords)
  coords = list(reversed(coords))
  g0 = scJ([coords[0]])[0]
  OFF = (Y0[0] - g0[0], Y0[1] - g0[1])
  osm_g = [(p[0] + OFF[0], p[1] + OFF[1]) for p in scJ(coords)]
  osm_g[0] = (Y0[0], Y0[1])
  Losm = LineString(_chaikin(osm_g, 2)).simplify(0.8)

  hold = [(Y0[0] + D0[0] * s, Y0[1] + D0[1] * s) for s in (0.0, 2.0, 4.0, 6.0, 8.0, 10.0, HOLD)]
  P0 = hold[-1]
  s_tgt = min(80.0, Losm.length)
  P3 = (Losm.interpolate(s_tgt).x, Losm.interpolate(s_tgt).y)
  T3 = _tan(Losm, s_tgt)
  C = 28.0
  P1 = (P0[0] + D0[0] * C, P0[1] + D0[1] * C)
  P2 = (P3[0] - T3[0] * C, P3[1] - T3[1] * C)
  blend = [_bez(P0, P1, P2, P3, i / 16) for i in range(1, 17)]
  s_join = Losm.project(Point(*P3))
  rest, ss = [], s_join + 1.6
  while ss < Losm.length:
    q = Losm.interpolate(ss); rest.append((q.x, q.y)); ss += 2.0
  rest.append((Losm.coords[-1][0], Losm.coords[-1][1]))
  hq = LineString(_dedupe(hold + blend + rest))
  # 先按 3 m 重采样再限弯：密顶点上三点半径会虚报过小，越拉越尖
  hq = _resample(hq, 3.0)
  hq = _smooth_radius(hq, 26.0, lock=HOLD - 2, iters=400)

  g['HW']['hq'] = HW1
  g['BAND']['hq'] = BAND_HQ
  g['NAME']['hq'] = ['湖前河', 'Huqian River']
  g['CL']['hq'] = hq

  # 变宽水面 + 西头收口（驳岸向内转再合上）
  left, right, s = [], [], 0.0
  while s <= hq.length + 1e-6:
    ss = min(s, hq.length)
    p = hq.interpolate(ss); t = _tan(hq, ss); n = (t[1], -t[0]); h = _hw(ss)
    left.append((p.x - n[0] * h, p.y - n[1] * h))
    right.append((p.x + n[0] * h, p.y + n[1] * h))
    s += 0.8
  te = _tan(hq, hq.length)
  for i in range(1, 9):
    u = i / 8.0
    p = (hq.coords[-1][0] + te[0] * CAP * u, hq.coords[-1][1] + te[1] * CAP * u)
    h = HW1 * (1.0 - u) * (1.0 - u)
    n = (te[1], -te[0])
    left.append((p[0] - n[0] * h, p[1] - n[1] * h))
    right.append((p[0] + n[0] * h, p[1] + n[1] * h))
  chanH = Polygon(left + right[::-1]).buffer(0).simplify(0.06)
  if chanH.geom_type != 'Polygon':
    chanH = max(chanH.geoms, key=lambda q: q.area)
  g['chanH'] = chanH
  g['HQ_OFF'] = [round(OFF[0], 4), round(OFF[1], 4)]
  print('6A hq len', round(hq.length, 2), 'pts', len(hq.coords), 'minR', g['minRat'](hq)[0],
        'start', tuple(round(v, 2) for v in hq.coords[0]), 'end', tuple(round(v, 2) for v in hq.coords[-1]),
        'off', g['HQ_OFF'])

  real_line = LineString(coords)  # 东→西（与游戏中线同向）的真实米链
  # coords 已是东→西。对应真实里程：mouth_s 往西递减。
  mouth_s = raw['mouth_s']
  def game_of_official(official_s):
    # official 西→东；从东口往西的距离 = mouth_s - official_s
    west_of_mouth = mouth_s - official_s
    # real_line 东→西，s=0 在东口
    rp = real_line.interpolate(min(max(west_of_mouth, 0), real_line.length))
    gp = scJ([(rp.x, rp.y)])[0]
    return (gp[0] + OFF[0], gp[1] + OFF[1])

  specs = [
    (raw['beierhuan_s_mid'], 30, 'road', '北二环', True, 'trunk 双幅 240126057 / 606200187 合一；比北浪路更宽更高'),
    (raw['beilang_s'], 14, 'road', '北浪路', False, 'tertiary 694151571；较矮较窄'),
  ]
  nB0 = len(g['BR'])
  for official_s, w, kind, name, tall, note in specs:
    gp = game_of_official(official_s)
    s = hq.project(Point(*gp))
    # 北二环不要落进汇入口变宽段
    if name == '北二环':
      s = max(s, WIDTH_END + 8.0)
    if name == '北浪路':
      s = min(max(s, WIDTH_END + 40.0), hq.length - 4.0)
    b = bridge('hq', s, w, kind, name, plate=(name if name == '北二环' else None), note=note)
    b['a6'] = 1
    if tall:
      b['tall'] = 1
      b['barrier'] = 2.2
      b['deckY'] = 3.2
      b['rampL'] = 14.0
      b['half'] = HW1 + 4.0   # 岸上留出桥下步道净宽；梁底在 deckY-1.3
  BR6 = g['BR'][nB0:]
  for b in BR6:
    x, z, t, n, half, w = b['x'], b['z'], b['t'], b['n'], b['half'], b['w']
    g['GAPS'].append(Polygon([(x + t[0] * a + n[0] * c, z + t[1] * a + n[1] * c) for a, c in [(-w / 2 + 0.05, -half - 0.5), (w / 2 - 0.05, -half - 0.5), (w / 2 - 0.05, half + 0.5), (-w / 2 + 0.05, half + 0.5)]]))
    b['foot'] = Polygon([(x + t[0] * a + n[0] * c, z + t[1] * a + n[1] * c) for a, c in [(-w / 2, -half), (w / 2, -half), (w / 2, half), (-w / 2, half)]])
  ROADS6 = []
  for b in BR6:
    for sg in (-1, 1):
      start = (b['half'] + b.get('rampL', 0)) if b.get('tall') else (b['hw'] + 2)
      reach = b['hw'] + BAND_HQ + 2
      if reach <= start + 1: continue
      ROADS6.append({'id': b['id'] + ('e' if sg > 0 else 'w'), 'name': b['name'],
                     'poly': rect(b['x'], b['z'], b['n'][0] * sg, b['n'][1] * sg, start, reach, -b['w'] / 2, b['w'] / 2),
                     'dir': [b['n'][0] * sg, b['n'][1] * sg], 'w': b['w'], 'stub': True, 'a6': True})
  for b in BR6:
    print('6A bridge', b['id'], b['name'], 's', round(b['s'], 1), 'w', b['w'], 'tall', b.get('tall'), 'deckY', b.get('deckY'), 'half', b['half'], 'at', (b['x'], b['z']))
  g['BR6'] = BR6
  g['ROADS'] = g['ROADS'] + ROADS6
  g['ROADS6'] = ROADS6

  # 茶园水闸：汇入口里侧（过完半宽过渡），单孔矮堰 + 岸边筒顶泵房，只看不过
  GATE_S = round(max(WIDTH_END + 14.0, 32.0), 2)
  (gx, gz), gt, gn = at_s('hq', GATE_S)
  cands = []
  for sg in (-1, 1):
    p = at_s('hq', GATE_S - 8.0, sg * (HW1 + 3.6))[0]
    cands.append((sg, p, chanH.distance(Point(*p))))
  sgV, viewP, _ = max(cands, key=lambda q: q[2])
  sgH = -sgV
  GATE6 = {
    's': GATE_S, 'x': round(gx, 2), 'z': round(gz, 2),
    't': [round(gt[0], 4), round(gt[1], 4)], 'n': [round(gn[0], 4), round(gn[1], 4)],
    'hw': HW1, 'bays': 1, 'bayW': [9.2],
    'view': [round(viewP[0], 2), round(viewP[1], 2)],
    'side': sgV, 'houseSide': sgH,
    'style': 'cy',  # 茶园：单孔 + 筒顶泵房，有别于九门 / 新港 / 江四
  }
  _blk = [(-1.8, -HW1 - 1.4), (2.6, -HW1 - 1.4), (2.6, HW1 + 1.4), (-1.8, HW1 + 1.4)]
  GATE6['block'] = [[round(gx + gt[0] * a + gn[0] * b, 2), round(gz + gt[1] * a + gn[1] * b, 2)] for a, b in _blk]
  hx = gx + gt[0] * -1.2 + gn[0] * sgH * (HW1 + 4.2)
  hz = gz + gt[1] * -1.2 + gn[1] * sgH * (HW1 + 4.2)
  GATE6['house'] = {'x': round(hx, 2), 'z': round(hz, 2), 'w': 6.4, 'd': 5.2, 'h': 4.4,
                    't': [round(gt[0], 4), round(gt[1], 4)], 'n': [round(gn[0] * sgH, 4), round(gn[1] * sgH, 4)],
                    'roof': 'barrel'}
  GATE6['look'] = [round(gx + gn[0] * sgH * 3.2, 2), round(gz + gn[1] * sgH * 3.2, 2)]
  g['GATE6'] = GATE6
  print('6A gate 茶园水闸', GATE6['x'], GATE6['z'], 't', GATE6['t'], 'houseSide', sgH, 'view', GATE6['view'])

  # ---- 水面 / 可走范围并上 4A；西头封闭 ----
  chanH_use = chanH
  regH = unary_union([ext(hq).buffer(HW1 + BAND_HQ, cap_style='flat', quad_segs=6),
                      chanH.buffer(BAND_HQ, quad_segs=6)] + [r['poly'] for r in ROADS6]).simplify(0.1)
  region = unary_union([region4, regH]).buffer(0)
  if region.geom_type != 'Polygon': region = max(region.geoms, key=lambda q: q.area)
  region = Polygon(region.exterior)
  _wN = unary_union([water4, chanH_use.intersection(region.buffer(-0.05))]).buffer(0)
  _wC = _wN.buffer(5, quad_segs=6).buffer(-5, quad_segs=6)
  water = unary_union([_wN, _wC.difference(_wN).intersection(chanH_use.buffer(8))]).buffer(0).simplify(0.05)
  water = water.intersection(region.buffer(-0.05)).buffer(0)
  if water.geom_type != 'Polygon': water = max(water.geoms, key=lambda q: q.area)
  water = Polygon(water.exterior, [i for i in water.interiors])
  land = region.difference(water).buffer(0)
  for K_ in g['KIOSK'].values():
    land = land.difference(box(K_['x'] - 1.9, K_['z'] - 6.4, K_['x'] + 1.9, K_['z'] - 2.6)).buffer(0)
  # 闸块从可走地里抠掉（人上不去堰）
  land = land.difference(Polygon(GATE6['block']).buffer(0.2)).buffer(0)
  LAND = {k_: pack(v) for k_, v in tris_by_cell(land).items()}
  WATER = {k_: pack(v) for k_, v in tris_by_cell(water).items()}
  print('6A cells kept from 4A: land', _keep_old(LAND, land, land4, LAND4), '/', len(LAND),
        'water', _keep_old(WATER, water, water4, WATER4), '/', len(WATER))
  print('6A water changed area', round(water.symmetric_difference(water4).area, 1))
  g['water'], g['region'], g['land'] = water, region, land
  g['LAND'], g['WATER'] = LAND, WATER

  # 观景处 / 牌 / 椅必须落在岸上（汇入口并上晋安河水面后，原先算的点可能还在水里）
  def _on_bank(s, sg, off0=3.4):
    for off in [off0, off0 + 1.2, off0 + 2.4, off0 + 3.6, off0 + 5.0]:
      (x, z), _, _ = at_s('hq', s, sg * (HW1 + off))
      if region.contains(Point(x, z)) and not water.buffer(0.6).contains(Point(x, z)) and land.contains(Point(x, z)):
        return [round(x, 2), round(z, 2)]
    (x, z), _, _ = at_s('hq', s, sg * (HW1 + off0 + 2.0))
    return [round(x, 2), round(z, 2)]
  viewP = _on_bank(max(8.0, GATE_S - 16.0), sgV, 7.5)
  GATE6['view'] = viewP
  print('6A gate view snapped', viewP, 'land', land.contains(Point(*viewP)), 'water', water.contains(Point(*viewP)))

  # 牌 / 椅（木牌与石牌错开，长椅不挡字）
  sx, sz = GATE6['view']
  t, n = GATE6['t'], GATE6['n']
  sd = GATE6['side']
  SIGN6 = {'id': 'cy', 'zh': '茶园水闸', 'en': 'Chayuan Sluice',
           'x': round(sx + t[0] * -2.2 + n[0] * sd * 1.8, 2),
           'z': round(sz + t[1] * -2.2 + n[1] * sd * 1.8, 2),
           'n': [round(-t[0], 4), round(-t[1], 4)], 'stopOnly': True}
  SIGNS6 = [{'id': 'cyh',
             'x': round(sx + t[0] * 3.6 + n[0] * sd * 2.0, 2),
             'z': round(sz + t[1] * 3.6 + n[1] * sd * 2.0, 2),
             'f': [round(t[0], 4), round(t[1], 4)], 'lines': ['茶园水闸', 'Chayuan Sluice']},
            {'id': 'hqh',
             'x': round(at_s('hq', 48.0, sd * (HW1 + 3.2))[0][0], 2),
             'z': round(at_s('hq', 48.0, sd * (HW1 + 3.2))[0][1], 2),
             'f': [round(-n[0] * sd, 4), round(-n[1] * sd, 4)], 'lines': ['湖前河', 'Huqian River']}]
  BENCH6 = [round(sx + t[0] * -6.0 + n[0] * sd * 0.5, 2),
            round(sz + t[1] * -6.0 + n[1] * sd * 0.5, 2)]
  if (not land.contains(Point(*BENCH6))) or water.buffer(0.4).contains(Point(*BENCH6)):
    BENCH6 = _on_bank(max(8.0, GATE_S - 14.0), sgV, 2.2)
  # 木牌 / 石牌若落水，挪到岸上
  if not land.contains(Point(SIGN6['x'], SIGN6['z'])) or water.buffer(0.4).contains(Point(SIGN6['x'], SIGN6['z'])):
    q = _on_bank(max(8.0, GATE_S - 10.0), sgV, 3.0)
    SIGN6['x'], SIGN6['z'] = q
  if not land.contains(Point(SIGNS6[0]['x'], SIGNS6[0]['z'])) or water.buffer(0.4).contains(Point(SIGNS6[0]['x'], SIGNS6[0]['z'])):
    q = _on_bank(max(8.0, GATE_S - 4.0), sgV, 3.2)
    SIGNS6[0]['x'], SIGNS6[0]['z'] = q

  # 两岸旧街（白墙黛瓦）+ 榕树，铺在 PAVEC 岸地上
  HOUSES, TREES = g['HOUSES'], g['TREES']
  def _hpoly0(h):
    return Polygon([(h['x'] + h['t'][0] * a + h['f'][0] * b * -1, h['z'] + h['t'][1] * a + h['f'][1] * b * -1)
                    for a, b in [(-h['w'] / 2, -h['d'] / 2), (h['w'] / 2, -h['d'] / 2), (h['w'] / 2, h['d'] / 2), (-h['w'] / 2, h['d'] / 2)]])
  occ = unary_union([b['foot'].buffer(2.0) for b in BR6] + [q.buffer(1.0) for q in g['GAPS']] + [r['poly'].buffer(0.4) for r in ROADS6]
                    + [Polygon(GATE6['block']).buffer(10), Point(*GATE6['view']).buffer(8),
                       Point(SIGN6['x'], SIGN6['z']).buffer(6), Point(SIGNS6[0]['x'], SIGNS6[0]['z']).buffer(5),
                       Point(SIGNS6[1]['x'], SIGNS6[1]['z']).buffer(4), Point(BENCH6[0], BENCH6[1]).buffer(3),
                       Point(GATE6['house']['x'], GATE6['house']['z']).buffer(8),
                       hq.interpolate(0).buffer(16)]  # 汇入口前 16 m 不放房，留给驳岸内转
                    + [_hpoly0(h).buffer(0.4) for h in HOUSES if not h.get('gone')])
  R6 = random.Random(619)
  nH0 = len(HOUSES)
  def _try_house(s, side, off_extra, w_, d_, h_, lod=None):
    nonlocal occ
    off = HW1 + off_extra + d_ / 2
    (cx, cz), tdir, nn = at_s('hq', min(hq.length - 2, s + w_ / 2), side * off)
    poly = Polygon([(cx + tdir[0] * a + nn[0] * side * b, cz + tdir[1] * a + nn[1] * side * b)
                    for a, b in [(-w_ / 2, -d_ / 2), (w_ / 2, -d_ / 2), (w_ / 2, d_ / 2), (-w_ / 2, d_ / 2)]])
    if not region.buffer(-0.05).contains(poly) or poly.intersects(occ) or poly.intersects(water.buffer(0.8)):
      return False
    occ = occ.union(poly.buffer(0.25))
    rec = {'x': round(cx, 2), 'z': round(cz, 2), 'w': round(w_, 2), 'd': round(d_, 2),
           't': [round(tdir[0], 4), round(tdir[1], 4)], 'f': [round(-nn[0] * side, 4), round(-nn[1] * side, 4)],
           'river': 'hq', 'h': h_, 'kind': 'old', 'ry': round(math.atan2(tdir[0], tdir[1]), 4),
           'back': True, 'a6': True}
    if lod: rec['lod'] = lod
    HOUSES.append(rec)
    return True
  s = 28.0
  while s < hq.length - 8:
    if any(abs(b['s'] - s) < b['w'] / 2 + 2.4 for b in BR6):
      s += 2; continue
    placed = False
    w_ = R6.uniform(6.6, 10.2); d_ = R6.uniform(6.0, 8.0); h_ = R6.choice([5.4, 6.0, 6.6, 7.2, 6.2, 7.8])
    for side in (-1, 1):
      if _try_house(s, side, 3.8, w_, d_, h_) or _try_house(s, side, 3.8, 6.2, 5.6, h_):
        placed = True
    s += (w_ + R6.uniform(0.4, 1.6)) if placed else 2.0
  nH1 = len(HOUSES)
  s = 30.0
  while s < hq.length - 10:
    if any(abs(b['s'] - s) < b['w'] / 2 + 2.0 for b in BR6):
      s += 3; continue
    w_ = R6.uniform(8.0, 12.0); d_ = R6.uniform(6.0, 8.0); h_ = R6.choice([6.0, 7.0, 8.0, 9.0, 7.5])
    for side in (-1, 1):
      _try_house(s, side, 13.0, w_, d_, h_, lod='lo') or _try_house(s, side, 13.0, 7.0, 5.8, h_, lod='lo')
    s += w_ + R6.uniform(1.2, 2.8)
  print('6A houses', len(HOUSES) - nH0, 'front', nH1 - nH0, 'back', len(HOUSES) - nH1)

  treeOcc = unary_union([b['foot'].buffer(2.5) for b in g['BR'] if 'foot' in b] + [q.buffer(1.5) for q in g['GAPS']]
                        + [r['poly'] for r in g['ROADS']] + [Polygon(GATE6['block']).buffer(5),
                           Point(*GATE6['view']).buffer(5), Point(SIGN6['x'], SIGN6['z']).buffer(4),
                           Point(SIGNS6[0]['x'], SIGNS6[0]['z']).buffer(4), Point(BENCH6[0], BENCH6[1]).buffer(3)])
  nT0 = len(TREES)
  s = 24.0
  while s < hq.length - 6:
    if any(abs(b['s'] - s) < b['w'] / 2 + 4 for b in BR6):
      s += 3; continue
    for side in (-1, 1):
      (x, z), tdir, nn = at_s('hq', s, side * (HW1 + 1.7))
      P_ = Point(x, z)
      if region.contains(P_) and not water.buffer(0.8).contains(P_) and not treeOcc.contains(P_) and all(math.hypot(x - t[0], z - t[1]) > 4.2 for t in TREES if t[5] != 'gone'):
        TREES.append([round(x, 2), round(z, 2), round(-nn[0] * side, 3), round(-nn[1] * side, 3), round(R6.uniform(0.85, 1.15), 2), 'hq', 1])
        treeOcc = treeOcc.union(P_.buffer(3.2))
    s += R6.uniform(5.2, 7.6)
  print('6A trees', len(TREES) - nT0)

  # 被新河道占到的旧楼 / 树
  hq_tail = LineString([hq.interpolate(min(hq.length, max(14.0, s))).coords[0] for s in
                        [i * 2.0 for i in range(8, int(hq.length / 2) + 1)] + [hq.length]])
  _corr = unary_union([water.difference(water4).buffer(6.0).intersection(chanH.buffer(22)),
                       hq_tail.buffer(HW1 + 8.0), Polygon(GATE6['block']).buffer(4)] + [r['poly'].buffer(0.5) for r in ROADS6])
  GONE6_H = [i for i, h in enumerate(HOUSES) if not h.get('gone') and not h.get('a6') and _hpoly0(h).intersects(_corr)]
  for i in GONE6_H: HOUSES[i]['gone'] = '6A'
  _tcorr = unary_union([hq_tail.buffer(2.5), Polygon(GATE6['block']).buffer(3)] + [r['poly'] for r in ROADS6] + [b['foot'].buffer(2) for b in BR6])
  GONE6_T = [i for i, t in enumerate(TREES) if t[5] not in ('gone', 'hq') and _tcorr.contains(Point(t[0], t[1]))
             and math.hypot(t[0] - Y0[0], t[1] - Y0[1]) > 20]
  for i in GONE6_T: TREES[i][5] = 'gone'
  for i, h in enumerate(HOUSES):
    if h.get('gone') or h.get('a6'): continue
    if water.contains(Point(h['x'], h['z'])):
      HOUSES[i]['gone'] = '6A'
      GONE6_H.append(i)
  for i, t in enumerate(TREES):
    if t[5] in ('gone', 'hq'): continue
    if water.contains(Point(t[0], t[1])):
      TREES[i][5] = 'gone'
      GONE6_T.append(i)
  GONE6_H = sorted(set(GONE6_H)); GONE6_T = sorted(set(GONE6_T))
  print('6A gone houses', GONE6_H, 'trees', len(GONE6_T))

  # 岸墙：保留离新水面远的旧段；汇入口 flag 4；西头封口普通墙
  gapU = unary_union(g['GAPS'])
  _wd = water.symmetric_difference(water4).buffer(0)
  geoms = [q for q in getattr(_wd, 'geoms', [_wd]) if q.area > 0.5]
  _wd = unary_union(geoms) if geoms else _wd
  WALL_keep = [w for w in WALL4 if LineString([(w[0], w[1]), (w[2], w[3])]).distance(_wd) > 0.5]
  _keepU = unary_union([LineString([(w[0], w[1]), (w[2], w[3])]) for w in WALL_keep] or [Point(0, 0)]).buffer(0.3)
  def kind6(a, b_):
    mx_, mz_ = (a[0] + b_[0]) / 2, (a[1] + b_[1]) / 2
    dx_, dz_ = b_[0] - a[0], b_[1] - a[1]; l_ = math.hypot(dx_, dz_) or 1
    # 晋安河西岸口门：段几乎沿晋安河切向（横切湖前），靠近汇入口
    if math.hypot(mx_ - Y0[0], mz_ - Y0[1]) < HW0 + 4.0:
      if abs(dx_ / l_ * D0[0] + dz_ / l_ * D0[1]) < 0.35: return 4
    if math.hypot(mx_ - gx, mz_ - gz) < HW1 + 0.8:
      if abs(dx_ / l_ * gt[0] + dz_ / l_ * gt[1]) < 0.3: return 4
    return None
  W6 = []
  for c_ in [list(r_.coords) for r_ in [water.exterior] + list(water.interiors)]:
    for a, b_ in zip(c_, c_[1:]):
      L_ = math.dist(a, b_); nseg = max(1, math.ceil(L_ / 2.0))
      for i in range(nseg):
        p0 = (a[0] + (b_[0] - a[0]) * i / nseg, a[1] + (b_[1] - a[1]) * i / nseg)
        p1 = (a[0] + (b_[0] - a[0]) * (i + 1) / nseg, a[1] + (b_[1] - a[1]) * (i + 1) / nseg)
        m_ = Point((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2)
        if _keepU.contains(m_): continue
        kd = kind6(p0, p1)
        W6.append([round(p0[0], 2), round(p0[1], 2), round(p1[0], 2), round(p1[1], 2), kd if kd else (1 if gapU.contains(m_) else 0)])
  W6 = merge(W6)
  for w in W6:
    L_ = math.dist(w[:2], w[2:4]) or 1; dx_, dz_ = (w[2] - w[0]) / L_, (w[3] - w[1]) / L_; rx, rz = dz_, -dx_
    mx_, mz_ = (w[0] + w[2]) / 2, (w[1] + w[3]) / 2
    w.append(1 if water.contains(Point(mx_ + rx * 0.25, mz_ + rz * 0.25)) else -1)
  WALL = WALL_keep + W6
  print('6A walls: kept', len(WALL_keep), '/', len(WALL4), 'new', len(W6), {f: sum(1 for w in W6 if w[4] == f) for f in range(5)})
  g['WALL'] = WALL

  BOUND = [[round(x, 2), round(z, 2)] for x, z in Polygon(BOUND4).union(regH.simplify(0.3)).buffer(0).exterior.coords]
  g['BOUND'] = BOUND
  mnx, mnz, mxx, mxz = region.bounds
  skirt = box(mnx - 160, mnz - 160, mxx + 160, mxz + 160).difference(region)
  for extra in ('mjPoly', 'xgPoly'):
    if g.get(extra) is not None:
      skirt = skirt.difference(g[extra])
  skirt = skirt.buffer(0).simplify(1.0)
  g['SKIRT'] = pack(tris_flat(skirt))

  # 西头合拢后的远景槽（只看，挡住天空缝）
  te = _tan(hq, hq.length)
  ne = (te[1], -te[0])
  end = hq.coords[-1]
  capP = (end[0] + te[0] * (CAP + 8), end[1] + te[1] * (CAP + 8))
  far = []
  for i, off in enumerate(range(-40, 44, 12)):
    q = (capP[0] + ne[0] * off, capP[1] + ne[1] * off)
    if not region.contains(Point(*q)):
      far.append([round(q[0], 2), round(q[1], 2), round(-te[0], 4), round(-te[1], 4)])
  g['FAR6'] = far

  # 北二环桥下步道灯带定位（两岸，沿中线，在桥影下）
  b2 = next(b for b in BR6 if b['name'] == '北二环')
  under = []
  dY = b2.get('deckY', 3.2)
  for sg in (-1, 1):
    # 站在桥影下的河岸步道（沿 t 走进 30 m 桥宽，沿 n 在 hw+2.2，梁下不是桥面）
    u = -(b2['w'] / 2) + 3.5
    v = sg * (HW1 + 2.2)
    under.append({'bridge': b2['id'], 'side': sg,
                  'x': round(b2['x'] + b2['t'][0] * u + b2['n'][0] * v, 2),
                  'z': round(b2['z'] + b2['t'][1] * u + b2['n'][1] * v, 2),
                  't': b2['t'], 'n': b2['n'], 'w': b2['w'],
                  'deckY': dY, 'soffit': round(dY - 1.3, 2)})

  loops = []
  for b in BR6:
    off = b['half'] + 3 + (b.get('rampL') or 0)
    for sg in (-1, 1):
      loops.append({'bridge': b['id'], 'name': b['name'], 'side': sg,
                    'x': round(b['x'] + b['n'][0] * sg * off, 2),
                    'z': round(b['z'] + b['n'][1] * sg * off, 2)})

  # 同机位：站在晋安河东岸（-n，对西岸汇入口），朝西看东口
  (ex, ez), et, en = at_s('jn', JN_S, -(g['HW']['jn'] + 2.8))
  look = (Y0[0] + D0[0] * 18, Y0[1] + D0[1] * 18)
  camMouth = {'x': round(ex, 2), 'z': round(ez, 2), 'y': 1.6,
              'look': [round(look[0], 2), 1.2, round(look[1], 2)],
              'note': '晋安河东岸同机位，朝西看湖前东口；3B 基线用 origin/main 96f7417 再拍一张'}

  bbox = list(chanH.buffer(BAND_HQ + 40).bounds)
  A6DATA = {
    'hqLen': round(hq.length, 2), 'hw0': HW0, 'hw1': HW1, 'blend': WIDTH_END, 'hold': HOLD, 'cap': CAP,
    'off': g['HQ_OFF'], 'jnS': JN_S,
    'gate': GATE6, 'sign': SIGN6, 'signs': SIGNS6, 'bench': BENCH6,
    'bridges': [b['id'] for b in BR6],
    'tall': [b['id'] for b in BR6 if b.get('tall')],
    'under': under,
    'far': far,
    'gone': {'houses': GONE6_H, 'trees': GONE6_T},
    'loop': loops,
    'camMouth': camMouth,
    'zone': [round(v, 1) for v in bbox],
    'note': '6A：湖前河东段 1:4，茶园水闸（单孔+筒顶泵房）只看不过；北二环宽 30 高栏、北浪路宽 14；西头在北浪路西合拢；两岸旧街',
  }
  g['A6DATA'] = A6DATA
  g['SIGN6'] = SIGN6
  print('6A zone', A6DATA['zone'], 'far', len(far), 'loops', len(loops))
