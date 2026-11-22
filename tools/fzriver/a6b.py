# 福州内河 6B：湖前河西段（北浪路以西 → 官方 s=0，铁路桥南）。
# PLAN-6B v2 定稿（11-20 16:58 小美定）。由 gen_e.py 在 6A 之后调用。
# 范围正好 s=0→1516.22，不接 957264426；s=127 短桥按 OSM 做、不挂路名牌；无名脚桥不做。
import json, math, os, random
from shapely.geometry import LineString, Polygon, Point, box
from shapely.ops import unary_union
from a6 import (_tan, _smooth, _dedupe, _resample, _smooth_radius, _bez, _hw,
                HW0, HW1, BAND_HQ, CAP, HOLD, WIDTH_END)

def build_west(g):
  """打开 6A 西头合拢，沿官方中线向西接到 s=0（铁路桥南），放 6B 的桥和岸。"""
  HERE, scJ, at_s, bridge, rect = g['HERE'], g['scJ'], g['at_s'], g['bridge'], g['rect']
  pack, tris_by_cell, tris_flat, merge = g['pack'], g['tris_by_cell'], g['tris_flat'], g['merge']
  _keep_old, ext, minRat = g['_keep_old'], g['ext'], g['minRat']
  water6, region6, land6 = g['water'], g['region'], g['land']
  WALL6, LAND6, WATER6, BOUND6 = g['WALL'], g['LAND'], g['WATER'], g['BOUND']
  hq0 = g['CL']['hq']
  OFF = g['HQ_OFF']
  end0 = hq0.coords[-1]
  te0 = _tan(hq0, hq0.length)
  old_len = hq0.length

  # 旧西头合拢舌：从 6A 中线末端沿切向收口 10 m
  left_c, right_c = [], []
  for i in range(0, 9):
    u = i / 8.0
    p = (end0[0] + te0[0] * CAP * u, end0[1] + te0[1] * CAP * u)
    h = HW1 * (1.0 - u) * (1.0 - u)
    n = (te0[1], -te0[0])
    left_c.append((p[0] - n[0] * h, p[1] - n[1] * h))
    right_c.append((p[0] + n[0] * h, p[1] + n[1] * h))
  oldCap = Polygon(left_c + right_c[::-1]).buffer(0.4)
  if oldCap.geom_type != 'Polygon':
    oldCap = max(oldCap.geoms, key=lambda q: q.area)

  raw = json.load(open(os.path.join(HERE, 'hq_west_osm_m.json')))
  # 官方西段西→东，真实米；游戏中线是东→西，要反过来接到 6A 末端
  coords_we = [tuple(p) for p in raw['coords']]
  osm_g = [(p[0] + OFF[0], p[1] + OFF[1]) for p in scJ(coords_we)]
  # 东端（s=1516.22）应对准 6A 西头
  join_g = osm_g[-1]
  SHIFT = (end0[0] - join_g[0], end0[1] - join_g[1])
  osm_g = [(p[0] + SHIFT[0], p[1] + SHIFT[1]) for p in osm_g]
  osm_g[-1] = (end0[0], end0[1])
  Losm = LineString(list(reversed(osm_g)))  # 游戏方向：从 6A 合拢走向西头 s=0
  # 只处理西段：不重采样 6A 中线（否则 6A 弯半径会被改掉）。接缝用短贝塞尔沿 6A 末端切向接上。
  west_pts = [(end0[0], end0[1])]
  ss = 1.0
  while ss < Losm.length - 0.05:
    q = Losm.interpolate(ss)
    west_pts.append((q.x, q.y))
    ss += 2.0
  west_pts.append((Losm.coords[-1][0], Losm.coords[-1][1]))
  west0 = LineString(_dedupe(west_pts, 0.35))
  west0 = _resample(west0, 3.0)
  west0 = _smooth_radius(west0, 27.0, lock=10.0, iters=800)
  rW, pW, sW = minRat(west0)
  print('6B west-only minR', round(rW, 2), 'at', tuple(round(v, 2) for v in pW), 's', round(sW, 1), 'len', round(west0.length, 2))
  if rW < 26.0:
    west0 = _smooth_radius(west0, 27.0, lock=6.0, iters=1000)
    rW, pW, sW = minRat(west0)
    print('6B west-only minR pass2', round(rW, 2), 'at', tuple(round(v, 2) for v in pW), 's', round(sW, 1))
  # 贝塞尔：6A 末端沿 te0 出去，接到西段 s≈20
  s_tgt = min(36.0, max(28.0, west0.length * 0.12))
  P0 = end0
  P1 = (end0[0] + te0[0] * 22.0, end0[1] + te0[1] * 22.0)
  P3 = (west0.interpolate(s_tgt).x, west0.interpolate(s_tgt).y)
  T3 = _tan(west0, s_tgt)
  P2 = (P3[0] - T3[0] * 22.0, P3[1] - T3[1] * 22.0)
  blend = [_bez(P0, P1, P2, P3, i / 12.0) for i in range(1, 13)]
  rest, ss = [], s_tgt + 1.2
  while ss < west0.length - 0.05:
    q = west0.interpolate(ss); rest.append((q.x, q.y)); ss += 2.0
  rest.append((west0.coords[-1][0], west0.coords[-1][1]))
  hq = LineString(_dedupe(list(hq0.coords) + blend + rest, 0.3))
  r1, p1, s1 = minRat(hq)
  g['CL']['hq'] = hq
  g['HW']['hq'] = HW1
  g['BAND']['hq'] = BAND_HQ
  print('6B full minR', round(r1, 2), 'at', tuple(round(v, 2) for v in p1), 's', round(s1, 1),
        '6A minR kept', 'yes' if r1 >= 25.9 or s1 >= old_len - 2 else 'CHECK')
  if r1 < 26.0:
    hq = _smooth_radius(hq, 26.5, lock=old_len, iters=900)
    g['CL']['hq'] = hq
    r1, p1, s1 = minRat(hq)
    print('6B full minR after west-lock smooth', round(r1, 2), 'at', tuple(round(v, 2) for v in p1), 's', round(s1, 1))

  print('6B hq len', round(hq.length, 2), '(was', round(old_len, 2), ') west', round(hq.length - old_len, 2),
        'minR', minRat(hq)[0], 'end', tuple(round(v, 2) for v in hq.coords[-1]), 'shift', [round(SHIFT[0], 4), round(SHIFT[1], 4)])

  # 变宽水面：东段公式不变，西段 hw=5，新西头收口
  left, right, s = [], [], 0.0
  while s <= hq.length + 1e-6:
    ss = min(s, hq.length)
    p = hq.interpolate(ss); t = _tan(hq, ss); n = (t[1], -t[0]); h = _hw(ss)
    left.append((p.x - n[0] * h, p.y - n[1] * h))
    right.append((p.x + n[0] * h, p.y + n[1] * h))
    s += 0.8
  te = _tan(hq, hq.length)
  west_end = hq.coords[-1]
  ne = (te[1], -te[0])

  # 官方 s=0 在铁路桥南。水面在桥南封闭，桥下和北面不再铺水。
  # 昌福 / 合福用 OSM 走向，但拉成互相平行的长高架（1:4 原文过短且几乎叠在一起，剪影分不开）。
  WEST_CAP = 2.4
  RAIL_LEN, RAIL_GAP, RAIL_LIP = 100.0, 6.0, 1.2
  _headings = []
  _ids = {}
  for wid, rec in (raw.get('rails') or {}).items():
    pts = [(p[0] / 4.0 + OFF[0] + SHIFT[0], p[1] / 4.0 + OFF[1] + SHIFT[1]) for p in rec['coords']]
    tR = (pts[-1][0] - pts[0][0], pts[-1][1] - pts[0][1])
    Lr = math.hypot(*tR) or 1
    tR = (tR[0] / Lr, tR[1] / Lr)
    if tR[0] * ne[0] + tR[1] * ne[1] < 0:
      tR = (-tR[0], -tR[1])
    _headings.append(tR)
    _ids[rec['name']] = int(wid) if str(wid).isdigit() else wid
  tRail = (sum(h[0] for h in _headings), sum(h[1] for h in _headings)) if _headings else ne
  Lt = math.hypot(*tRail) or 1
  tRail = (tRail[0] / Lt, tRail[1] / Lt)
  if tRail[0] * ne[0] + tRail[1] * ne[1] < 0:
    tRail = (-tRail[0], -tRail[1])
  nRail = (tRail[1], -tRail[0])
  if nRail[0] * te[0] + nRail[1] * te[1] < 0:
    tRail = (-tRail[0], -tRail[1])
    nRail = (tRail[1], -tRail[0])

  def at_end(along, lat=0.0):
    return (west_end[0] + te[0] * along + ne[0] * lat,
            west_end[1] + te[1] * along + ne[1] * lat)

  w_cf, w_hf = 10.0, 11.0
  along_cf = WEST_CAP + RAIL_LIP + w_cf / 2.0
  along_hf = along_cf + w_cf / 2.0 + RAIL_GAP + w_hf / 2.0
  rails = []
  for name, wid, along, w, deckY in (
      ('昌福线', _ids.get('昌福线', 209804022), along_cf, w_cf, 7.2),
      ('合福高速线', _ids.get('合福高速线', 775888932), along_hf, w_hf, 8.8),
  ):
    mid = at_end(along, 0.0)
    rails.append({
      'id': wid, 'name': name,
      'x': round(mid[0], 2), 'z': round(mid[1], 2),
      't': [round(tRail[0], 4), round(tRail[1], 4)],
      'n': [round(nRail[0], 4), round(nRail[1], 4)],
      'len': round(RAIL_LEN, 2), 'deckY': deckY, 'w': w,
      'piers': 9, 'masts': 8, 'along': round(along, 2),
    })
    print('6B rail', name, 'mid', (round(mid[0], 2), round(mid[1], 2)), 'len', RAIL_LEN,
          'along', round(along, 2), 'dist end', round(math.hypot(mid[0] - west_end[0], mid[1] - west_end[1]), 2))

  pad_along0, pad_along1 = WEST_CAP - 0.3, along_hf + w_hf / 2.0 + 42.0
  rail_pad_poly = rect(west_end[0], west_end[1], te[0], te[1], pad_along0, pad_along1, -(RAIL_LEN / 2 + 10), RAIL_LEN / 2 + 10)
  pad_c = at_end((pad_along0 + pad_along1) / 2.0, 0.0)
  railPad = {
    'x': round(pad_c[0], 2), 'z': round(pad_c[1], 2),
    't': [round(tRail[0], 4), round(tRail[1], 4)],
    'w': round(pad_along1 - pad_along0, 2), 'd': round(RAIL_LEN + 20, 2),
  }
  wall_p = at_end(WEST_CAP, 0.0)
  capWall = {
    'x': round(wall_p[0], 2), 'z': round(wall_p[1], 2),
    'n': [round(ne[0], 4), round(ne[1], 4)],
    't': [round(te[0], 4), round(te[1], 4)],
    'thick': 1.4, 'h': 4.4, 'len': 24.0,
  }

  # 钝收口：水面全宽走到合拢墙，不再伸到铁路桥下。
  for i in range(1, 6):
    u = i / 5.0
    p = (west_end[0] + te[0] * WEST_CAP * u, west_end[1] + te[1] * WEST_CAP * u)
    h = HW1
    n = ne
    left.append((p[0] - n[0] * h, p[1] - n[1] * h))
    right.append((p[0] + n[0] * h, p[1] + n[1] * h))
  chanH = Polygon(left + right[::-1]).buffer(0).simplify(0.06)
  if chanH.geom_type != 'Polygon':
    chanH = max(chanH.geoms, key=lambda q: q.area)
  g['chanH'] = chanH

  def game_of_official(official_s):
    # 西段官方链西→东，真实米
    west_ls = LineString(coords_we)
    rp = west_ls.interpolate(min(max(official_s, 0), west_ls.length))
    gp = scJ([(rp.x, rp.y)])[0]
    return (gp[0] + OFF[0] + SHIFT[0], gp[1] + OFF[1] + SHIFT[1])

  # 桥：自西向东（官方 s），游戏中线 s 从东口往西增大
  # style: fufei / jiangcuo(=北浪路) / hujing / dajing / short（无路名牌）
  specs = [
    # official_s, w, name, plate, style, extra
    (raw['bridges']['short_s'], 11, None, None, 'short',
     {'note': 's=127 短桥，按 OSM 形状做，不挂路名牌（名字待核）', 'railStyle': 'pipe', 'parapetH': 0.85}),
    (raw['bridges']['dajing_s'], 12, '大井路', '大井路', 'dajing',
     {'note': '大井路南座主跨，次干短桥', 'railStyle': 'posts', 'parapetH': 1.05}),
    (raw['bridges']['hujing_s'], 10, '湖景路', '湖景路', 'hujing',
     {'note': '湖景路，同家族里最短最矮', 'railStyle': 'slab', 'parapetH': 0.72, 'deckY': 0.0}),
    (raw['bridges']['jiangcuo_s'], 14, '江厝路', '江厝路', 'jiangcuo',
     {'note': '江厝路：复用北浪路几何，不新增 draw', 'reuse': 'beilang'}),
    (raw['bridges']['fufei_s'], 42, '福飞路', '福飞路', 'fufei',
     {'note': '福飞路明桥，比北二环更宽，梁+墩，两侧人行道和路灯',
      'tall': 1, 'deckY': 1.4, 'rampL': 8.0, 'barrier': 1.15, 'walk': 3.5,
      'half': HW1 + 3.2}),
  ]
  nB0 = len(g['BR'])
  for official_s, w, name, plate, style, extra in specs:
    gp = game_of_official(official_s)
    s = hq.project(Point(*gp))
    # 不要落到 6A 段（北浪路及以东）
    s = max(s, old_len + 6.0)
    s = min(s, hq.length - 6.0)
    b = bridge('hq', s, w, 'road', name, plate=plate, note=extra.get('note'))
    b['a6b'] = 1
    b['style'] = style
    if extra.get('reuse'):
      b['reuse'] = extra['reuse']
    if extra.get('railStyle'):
      b['railStyle'] = extra['railStyle']
    if extra.get('parapetH'):
      b['parapetH'] = extra['parapetH']
    if extra.get('tall'):
      b['tall'] = 1
      b['deckY'] = extra['deckY']
      b['rampL'] = extra['rampL']
      b['barrier'] = extra['barrier']
      b['walk'] = extra['walk']
      b['half'] = extra['half']
    BRB = b
    print('6B bridge', b['id'], name or '(unnamed short)', 'style', style,
          's', round(b['s'], 1), 'w', b['w'], 'at', (b['x'], b['z']))
  BRB = g['BR'][nB0:]
  for b in BRB:
    x, z, t, n, half, w = b['x'], b['z'], b['t'], b['n'], b['half'], b['w']
    def corners(au, cv, bb=b):
      return [(bb['x'] + bb['t'][0] * a + bb['n'][0] * c, bb['z'] + bb['t'][1] * a + bb['n'][1] * c)
              for a, c in [(-au, -cv), (au, -cv), (au, cv), (-au, cv)]]
    g['GAPS'].append(Polygon(corners(w / 2 - 0.05, half + 0.5)))
    if b.get('tall') and (b.get('rampL') or 0):
      b['foot'] = Polygon(corners(w / 2 + 6.0, half + b['rampL'] + 4.0))
    else:
      b['foot'] = Polygon(corners(w / 2, half))
    # 福飞路：中央车行道禁走（只留两侧人行道）
    if b.get('style') == 'fufei':
      walk = b.get('walk') or 3.5
      inner = w / 2 - walk
      b['block'] = Polygon(corners(inner, half + (b.get('rampL') or 0)))
  ROADS_B = []
  for b in BRB:
    for sg in (-1, 1):
      start = (b['half'] + b.get('rampL', 0)) if b.get('tall') else (b['hw'] + 2)
      # 福飞路 42 m 宽，两端路要伸出街坊，避免路东露出白地
      reach = 72.0 if b.get('style') == 'fufei' else (b['hw'] + BAND_HQ + 2)
      if reach <= start + 1: continue
      ROADS_B.append({'id': b['id'] + ('e' if sg > 0 else 'w'), 'name': b['name'] or b['id'],
                      'poly': rect(b['x'], b['z'], b['n'][0] * sg, b['n'][1] * sg, start, reach, -b['w'] / 2, b['w'] / 2),
                      'dir': [b['n'][0] * sg, b['n'][1] * sg], 'w': b['w'], 'stub': True, 'a6b': True})
  # 福飞路两侧街坊铺地（沿路两侧各留出建房带；沿河在桥宽以外再铺一块）
  PADS = []
  for b in BRB:
    if b.get('style') != 'fufei':
      continue
    lot, reach = 30.0, 72.0
    for sg in (-1, 1):
      for us in (-1, 1):
        a0, a1 = us * (b['w'] / 2 + 0.4), us * (b['w'] / 2 + lot)
        PADS.append(rect(b['x'], b['z'], b['n'][0] * sg, b['n'][1] * sg, b['half'] + 1.0, reach, min(a0, a1), max(a0, a1)))
        # 沿河、桥宽以外的岸地（镜头东侧那块白地）
        b0, b1 = sg * (HW1 + 2.0), sg * (HW1 + 22.0)
        PADS.append(rect(b['x'], b['z'], b['t'][0] * us, b['t'][1] * us, b['w'] / 2 + 0.5, b['w'] / 2 + 36.0, min(b0, b1), max(b0, b1)))
  PADS.append(rail_pad_poly)
  g['BRB'] = BRB
  g['ROADS'] = g['ROADS'] + ROADS_B
  g['ROADS_B'] = ROADS_B
  g['PADS_B'] = PADS

  # ---- 水面 / 可走范围：去掉旧合拢舌，并上西段，新西头封闭 ----
  regH = unary_union([ext(hq).buffer(HW1 + BAND_HQ, cap_style='flat', quad_segs=6),
                      chanH.buffer(BAND_HQ, quad_segs=6)] + [r['poly'] for r in ROADS_B] + PADS).simplify(0.1)
  region = unary_union([region6, regH]).buffer(0)
  if region.geom_type != 'Polygon': region = max(region.geoms, key=lambda q: q.area)
  region = Polygon(region.exterior)
  water_open = water6.difference(oldCap.buffer(0.2)).buffer(0)
  _wN = unary_union([water_open, chanH.intersection(region.buffer(-0.05))]).buffer(0)
  _wC = _wN.buffer(5, quad_segs=6).buffer(-5, quad_segs=6)
  water = unary_union([_wN, _wC.difference(_wN).intersection(chanH.buffer(8))]).buffer(0).simplify(0.05)
  water = water.intersection(region.buffer(-0.05)).buffer(0)
  # 福飞路桥面沿河 42 m，中线有弯，直线桥面会离开 10 m 水道。
  # 在桥下和桥外侧各留一段直水道，让梁墩站在水里、侧视能看见跨径。
  _bff = next(b for b in BRB if b.get('style') == 'fufei')
  _ffw = rect(_bff['x'], _bff['z'], _bff['t'][0], _bff['t'][1],
              -(_bff['w'] / 2 + 14.0), _bff['w'] / 2 + 14.0, -(HW1 + 0.4), HW1 + 0.4)
  water = unary_union([water, _ffw]).buffer(0)
  if water.geom_type != 'Polygon': water = max(water.geoms, key=lambda q: q.area)
  water = Polygon(water.exterior, [i for i in water.interiors])
  # 再切一次：合拢墙以北（含铁路桥下）不得留水面
  # 只切铁路走廊这一小段，切太大（曾 ±220×240）会碰到东北边的琴亭湖 / 晋安河源头。
  _cut = rect(west_end[0], west_end[1], te[0], te[1],
              WEST_CAP - 0.05, along_hf + w_hf / 2.0 + 50.0,
              -(RAIL_LEN / 2 + 12), RAIL_LEN / 2 + 12)
  water = water.difference(_cut).buffer(0)
  if water.geom_type != 'Polygon':
    water = max(water.geoms, key=lambda q: q.area)
  water = Polygon(water.exterior, [i for i in water.interiors])
  land = region.difference(water).buffer(0)
  for K_ in g['KIOSK'].values():
    land = land.difference(box(K_['x'] - 1.9, K_['z'] - 6.4, K_['x'] + 1.9, K_['z'] - 2.6)).buffer(0)
  # 福飞路中央车行道从可走地抠掉（人只能走人行道过河）
  fufeiBlock = None
  for b in BRB:
    if b.get('block') is not None:
      land = land.difference(b['block'].buffer(0.05)).buffer(0)
      fufeiBlock = [[round(x, 2), round(z, 2)] for x, z in list(b['block'].exterior.coords)[:-1]]
      b.pop('block', None)
  LAND = {k_: pack(v) for k_, v in tris_by_cell(land).items()}
  WATER = {k_: pack(v) for k_, v in tris_by_cell(water).items()}
  print('6B cells kept from 6A: land', _keep_old(LAND, land, land6, LAND6), '/', len(LAND),
        'water', _keep_old(WATER, water, water6, WATER6), '/', len(WATER))
  print('6B water changed area', round(water.symmetric_difference(water6).area, 1))
  g['water'], g['region'], g['land'] = water, region, land
  g['LAND'], g['WATER'] = LAND, WATER

  def _on_bank(s, sg, off0=3.4):
    for off in [off0, off0 + 1.2, off0 + 2.4, off0 + 3.6, off0 + 5.0]:
      (x, z), _, _ = at_s('hq', s, sg * (HW1 + off))
      if region.contains(Point(x, z)) and not water.buffer(0.6).contains(Point(x, z)) and land.contains(Point(x, z)):
        return [round(x, 2), round(z, 2)]
    (x, z), _, _ = at_s('hq', s, sg * (HW1 + off0 + 2.0))
    return [round(x, 2), round(z, 2)]

  # 牌：福飞路附近一块「湖前河」；有名公路桥挂路名牌；s=127 不挂
  SIGNSB, plates = [], []
  bff = next(b for b in BRB if b.get('style') == 'fufei')
  # 湖前河石牌：福飞路东侧岸上（靠 6A 的一侧，沿河看向西）
  sH = max(old_len + 20.0, bff['s'] - 22.0)
  qh = _on_bank(sH, 1, 3.2)
  (px, pz), tdir, nn = at_s('hq', sH, 1 * (HW1 + 3.2))
  SIGNSB.append({'id': 'hqh_w', 'x': qh[0], 'z': qh[1],
                 'f': [round(-nn[0], 4), round(-nn[1], 4)],
                 'lines': ['湖前河', 'Huqian River']})
  # 桥名牌点（stoneSign 用）；s=127 无 plate 已在 bridge() 里
  for b in BRB:
    if not b.get('plate'):
      continue
    # 放在桥头北侧岸边
    sg = 1
    sP = b['s'] - b['w'] / 2 - 2.0
    qp = _on_bank(max(old_len + 4, sP), sg, 3.0)
    plates.append({'id': 'pl_' + b['id'], 'bridge': b['id'], 'name': b['plate'],
                   'x': qp[0], 'z': qp[1],
                   'f': [round(b['t'][0], 4), round(b['t'][1], 4)],
                   'lines': [b['plate'], '']})

  # 福飞路两侧人行道路灯（并进 fzNightLights，坐标写入数据）
  lamps = []
  walk = bff.get('walk') or 3.5
  for su in (-1, 1):
    u = su * (bff['w'] / 2 - walk * 0.45)
    for k_, v in enumerate((-0.72, -0.36, 0.0, 0.36, 0.72)):
      vv = v * bff['half']
      x = bff['x'] + bff['t'][0] * u + bff['n'][0] * vv
      z = bff['z'] + bff['t'][1] * u + bff['n'][1] * vv
      lamps.append({'x': round(x, 2), 'z': round(z, 2),
                    't': bff['t'], 'n': bff['n'], 'side': su})

  # 两岸旧街 + 榕树，只在西段新开的岸上
  HOUSES, TREES = g['HOUSES'], g['TREES']
  def _hpoly0(h):
    return Polygon([(h['x'] + h['t'][0] * a + h['f'][0] * b * -1, h['z'] + h['t'][1] * a + h['f'][1] * b * -1)
                    for a, b in [(-h['w'] / 2, -h['d'] / 2), (h['w'] / 2, -h['d'] / 2), (h['w'] / 2, h['d'] / 2), (-h['w'] / 2, h['d'] / 2)]])
  occ = unary_union(
      [b['foot'].buffer(2.0) for b in g['BR'] if 'foot' in b] + [q.buffer(1.0) for q in g['GAPS']]
      + [r['poly'].buffer(0.4) for r in g['ROADS']]
      + [Point(S['x'], S['z']).buffer(4) for S in SIGNSB]
      + [Point(S['x'], S['z']).buffer(3) for S in plates]
      + [hq0.interpolate(min(s, hq0.length)).buffer(8) for s in (0, old_len)]  # 接缝和东口不挤
      + [_hpoly0(h).buffer(0.4) for h in HOUSES if not h.get('gone')]
  )
  R6 = random.Random(629)
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
           'back': True, 'a6b': True}
    if lod: rec['lod'] = lod
    HOUSES.append(rec)
    return True
  s = old_len + 10.0
  while s < hq.length - 10:
    if any(abs(b['s'] - s) < b['w'] / 2 + 2.4 for b in BRB):
      s += 2; continue
    placed = False
    w_ = R6.uniform(6.6, 10.2); d_ = R6.uniform(6.0, 8.0); h_ = R6.choice([5.4, 6.0, 6.6, 7.2, 6.2, 7.8])
    for side in (-1, 1):
      if _try_house(s, side, 3.8, w_, d_, h_) or _try_house(s, side, 3.8, 6.2, 5.6, h_):
        placed = True
    s += (w_ + R6.uniform(0.4, 1.6)) if placed else 2.0
  nH1 = len(HOUSES)
  s = old_len + 12.0
  while s < hq.length - 12:
    if any(abs(b['s'] - s) < b['w'] / 2 + 2.0 for b in BRB):
      s += 3; continue
    w_ = R6.uniform(8.0, 12.0); d_ = R6.uniform(6.0, 8.0); h_ = R6.choice([6.0, 7.0, 8.0, 9.0, 7.5])
    for side in (-1, 1):
      _try_house(s, side, 13.0, w_, d_, h_, lod='lo') or _try_house(s, side, 13.0, 7.0, 5.8, h_, lod='lo')
    s += w_ + R6.uniform(1.2, 2.8)
  print('6B houses', len(HOUSES) - nH0, 'front', nH1 - nH0, 'back', len(HOUSES) - nH1)

  treeOcc = unary_union([b['foot'].buffer(2.5) for b in g['BR'] if 'foot' in b] + [q.buffer(1.5) for q in g['GAPS']]
                        + [r['poly'] for r in g['ROADS']]
                        + [Point(S['x'], S['z']).buffer(3) for S in SIGNSB + plates])
  nT0 = len(TREES)
  s = old_len + 8.0
  while s < hq.length - 6:
    if any(abs(b['s'] - s) < b['w'] / 2 + 4 for b in BRB):
      s += 3; continue
    for side in (-1, 1):
      (x, z), tdir, nn = at_s('hq', s, side * (HW1 + 1.7))
      P_ = Point(x, z)
      if region.contains(P_) and not water.buffer(0.8).contains(P_) and not treeOcc.contains(P_) and all(math.hypot(x - t[0], z - t[1]) > 4.2 for t in TREES if t[5] != 'gone'):
        TREES.append([round(x, 2), round(z, 2), round(-nn[0] * side, 3), round(-nn[1] * side, 3), round(R6.uniform(0.85, 1.15), 2), 'hq', 1])
        treeOcc = treeOcc.union(P_.buffer(3.2))
    s += R6.uniform(5.2, 7.6)
  print('6B trees', len(TREES) - nT0)

  # 福飞路两端 + 路东：旧街房子和榕树，铺地已并进 region
  bff = next(b for b in BRB if b.get('style') == 'fufei')
  nH2, nT2 = len(HOUSES), len(TREES)
  def _ff_house(cx, cz, tdir, face, w_, d_, h_, lod=None):
    nonlocal occ
    poly = Polygon([(cx + tdir[0] * a + face[0] * b, cz + tdir[1] * a + face[1] * b)
                    for a, b in [(-w_ / 2, -d_ / 2), (w_ / 2, -d_ / 2), (w_ / 2, d_ / 2), (-w_ / 2, d_ / 2)]])
    if (not region.buffer(-0.05).contains(poly) or poly.intersects(occ)
        or poly.intersects(water.buffer(0.8)) or not land.buffer(-0.05).contains(poly)):
      return False
    occ = occ.union(poly.buffer(0.25))
    rec = {'x': round(cx, 2), 'z': round(cz, 2), 'w': round(w_, 2), 'd': round(d_, 2),
           't': [round(tdir[0], 4), round(tdir[1], 4)], 'f': [round(face[0], 4), round(face[1], 4)],
           'river': 'hq', 'h': h_, 'kind': 'old', 'ry': round(math.atan2(tdir[0], tdir[1]), 4),
           'back': True, 'a6b': True, 'fufeiSt': True}
    if lod: rec['lod'] = lod
    HOUSES.append(rec)
    return True
  # 沿路两侧（两端引路）
  for sg in (-1, 1):
    tdir = [bff['n'][0] * sg, bff['n'][1] * sg]
    v = bff['half'] + (bff.get('rampL') or 8) + 5.0
    while v < 68.0:
      placed = False
      w_ = R6.uniform(7.0, 10.4); d_ = R6.uniform(6.2, 8.0); h_ = R6.choice([5.6, 6.2, 6.8, 7.4, 8.0])
      for us in (-1, 1):
        face = [-us * bff['t'][0], -us * bff['t'][1]]
        u = us * (bff['w'] / 2 + 3.4 + d_ / 2)
        cx = bff['x'] + bff['t'][0] * u + bff['n'][0] * sg * v
        cz = bff['z'] + bff['t'][1] * u + bff['n'][1] * sg * v
        if _ff_house(cx, cz, tdir, face, w_, d_, h_) or _ff_house(cx, cz, tdir, face, 6.4, 5.8, h_):
          placed = True
      v += (w_ + R6.uniform(0.5, 1.4)) if placed else 2.4
  # 沿河、桥宽以外的岸上（路东那一块）
  for us in (-1, 1):
    tdir = [bff['t'][0] * us, bff['t'][1] * us]
    u = bff['w'] / 2 + 5.0
    while u < bff['w'] / 2 + 34.0:
      w_ = R6.uniform(6.8, 10.0); d_ = R6.uniform(6.0, 7.6); h_ = R6.choice([5.4, 6.0, 6.6, 7.2])
      for sg in (-1, 1):
        face = [-sg * bff['n'][0], -sg * bff['n'][1]]
        off = HW1 + 3.6 + d_ / 2
        cx = bff['x'] + bff['t'][0] * us * (u + w_ / 2) + bff['n'][0] * sg * off
        cz = bff['z'] + bff['t'][1] * us * (u + w_ / 2) + bff['n'][1] * sg * off
        _ff_house(cx, cz, tdir, face, w_, d_, h_)
      u += w_ + R6.uniform(0.5, 1.6)
  # 沿路人行道外和街坊里的榕树
  for sg in (-1, 1):
    v = bff['half'] + 4.0
    while v < 68.0:
      for us in (-1, 1):
        for du in (bff['w'] / 2 + 1.8, bff['w'] / 2 + 16.0):
          x = bff['x'] + bff['t'][0] * us * du + bff['n'][0] * sg * v
          z = bff['z'] + bff['t'][1] * us * du + bff['n'][1] * sg * v
          P_ = Point(x, z)
          if (region.contains(P_) and land.contains(P_) and not water.buffer(0.8).contains(P_)
              and not treeOcc.contains(P_) and all(math.hypot(x - q[0], z - q[1]) > 4.0 for q in TREES if q[5] != 'gone')):
            nnx, nnz = -us * bff['t'][0], -us * bff['t'][1]
            TREES.append([round(x, 2), round(z, 2), round(nnx, 3), round(nnz, 3), round(R6.uniform(0.85, 1.15), 2), 'hq', 1])
            treeOcc = treeOcc.union(P_.buffer(3.0))
      v += R6.uniform(6.0, 8.5)
  print('6B 福飞路街坊 houses', len(HOUSES) - nH2, 'trees', len(TREES) - nT2, 'total houses', len(HOUSES) - nH0)

  # 被新河道占到的旧楼 / 树（不含 6A / 6B 自己的）
  _corr = unary_union([water.difference(water6).buffer(6.0).intersection(chanH.buffer(22)),
                       LineString([hq.interpolate(min(hq.length, max(old_len, s))).coords[0]
                                   for s in list(frange(old_len, hq.length, 2.0)) + [hq.length]]).buffer(HW1 + 8.0)]
                      + [r['poly'].buffer(0.5) for r in ROADS_B])
  GONEB_H, GONEB_T = [], []
  for i, h in enumerate(HOUSES):
    if h.get('gone') or h.get('a6') or h.get('a6b'): continue
    if _hpoly0(h).intersects(_corr) or water.contains(Point(h['x'], h['z'])):
      HOUSES[i]['gone'] = '6B'; GONEB_H.append(i)
  for i, t in enumerate(TREES):
    if t[5] in ('gone', 'hq'): continue
    if _corr.contains(Point(t[0], t[1])) or water.contains(Point(t[0], t[1])):
      TREES[i][5] = 'gone'; GONEB_T.append(i)
  print('6B gone houses', GONEB_H, 'trees', len(GONEB_T))

  # 岸墙：保留离新水面远的旧段；西头封口 flag 4
  gapU = unary_union(g['GAPS'])
  _wd = water.symmetric_difference(water6).buffer(0)
  geoms = [q for q in getattr(_wd, 'geoms', [_wd]) if q.area > 0.5]
  _wd = unary_union(geoms) if geoms else _wd
  WALL_keep = [w for w in WALL6 if LineString([(w[0], w[1]), (w[2], w[3])]).distance(_wd) > 0.5]
  _keepU = unary_union([LineString([(w[0], w[1]), (w[2], w[3])]) for w in WALL_keep] or [Point(0, 0)]).buffer(0.3)
  endN = hq.coords[-1]
  def kindB(a, b_):
    mx_, mz_ = (a[0] + b_[0]) / 2, (a[1] + b_[1]) / 2
    dx_, dz_ = b_[0] - a[0], b_[1] - a[1]; l_ = math.hypot(dx_, dz_) or 1
    # 西头合拢墙：段几乎横切中线切向
    if math.hypot(mx_ - endN[0], mz_ - endN[1]) < HW1 + 14.0:
      if abs(dx_ / l_ * te[0] + dz_ / l_ * te[1]) < 0.55: return 4
    return None
  WB = []
  for c_ in [list(r_.coords) for r_ in [water.exterior] + list(water.interiors)]:
    for a, b_ in zip(c_, c_[1:]):
      L_ = math.dist(a, b_); nseg = max(1, math.ceil(L_ / 2.0))
      for i in range(nseg):
        p0 = (a[0] + (b_[0] - a[0]) * i / nseg, a[1] + (b_[1] - a[1]) * i / nseg)
        p1 = (a[0] + (b_[0] - a[0]) * (i + 1) / nseg, a[1] + (b_[1] - a[1]) * (i + 1) / nseg)
        m_ = Point((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2)
        if _keepU.contains(m_): continue
        kd = kindB(p0, p1)
        WB.append([round(p0[0], 2), round(p0[1], 2), round(p1[0], 2), round(p1[1], 2), kd if kd else (1 if gapU.contains(m_) else 0)])
  WB = merge(WB)
  for w in WB:
    L_ = math.dist(w[:2], w[2:4]) or 1; dx_, dz_ = (w[2] - w[0]) / L_, (w[3] - w[1]) / L_; rx, rz = dz_, -dx_
    mx_, mz_ = (w[0] + w[2]) / 2, (w[1] + w[3]) / 2
    w.append(1 if water.contains(Point(mx_ + rx * 0.25, mz_ + rz * 0.25)) else -1)
  WALL = WALL_keep + WB
  print('6B walls: kept', len(WALL_keep), '/', len(WALL6), 'new', len(WB), {f: sum(1 for w in WB if w[4] == f) for f in range(5)})
  g['WALL'] = WALL

  BOUND = [[round(x, 2), round(z, 2)] for x, z in Polygon(BOUND6).union(regH.simplify(0.3)).buffer(0).exterior.coords]
  g['BOUND'] = BOUND
  mnx, mnz, mxx, mxz = region.bounds
  skirt = box(mnx - 160, mnz - 160, mxx + 160, mxz + 160).difference(region)
  for extra in ('mjPoly', 'xgPoly'):
    if g.get(extra) is not None:
      skirt = skirt.difference(g[extra])
  skirt = skirt.buffer(0).simplify(1.0)
  g['SKIRT'] = pack(tris_flat(skirt))

  # 打开 6A 旧合拢远景楼（会落进新河道 / 挡住西段）
  if g.get('A6DATA'):
    g['A6DATA']['far'] = []
    g['FAR6'] = []

  # 铁路背景已在水面之前算好（rails / railPad / capWall）。这里只补桥北远景和树。
  # 铁轨碰撞在 JS 里 colRail；可视网格各 1 个 draw。
  far = []
  for along in (along_hf + w_hf / 2 + 10, along_hf + w_hf / 2 + 22, along_hf + w_hf / 2 + 36):
    for off in range(-46, 50, 12):
      q = at_end(along, off)
      if region.contains(Point(*q)) and not water.contains(Point(*q)):
        far.append([round(q[0], 2), round(q[1], 2), round(-te[0], 4), round(-te[1], 4)])
  # 桥北再补一排榕树，挡住空铺地（不插在两道铁路之间，以免挡住合福剪影）
  for along in (along_hf + w_hf / 2 + 7, along_hf + w_hf / 2 + 16, along_hf + w_hf / 2 + 28):
    for off in range(-int(RAIL_LEN / 2) + 8, int(RAIL_LEN / 2) - 6, 9):
      q = at_end(along, off)
      P_ = Point(*q)
      if region.contains(P_) and not water.buffer(0.8).contains(P_) and all(
          math.hypot(q[0] - t[0], q[1] - t[1]) > 4.0 for t in TREES if t[5] != 'gone'):
        TREES.append([round(q[0], 2), round(q[1], 2), round(-te[0], 3), round(-te[1], 3),
                      round(0.95 + (abs(off) % 5) * 0.04, 2), 'hq', 1])
  print('6B far', len(far), 'rail-back trees added, cap', WEST_CAP)

  loops = []
  for b in BRB:
    off = b['half'] + 3 + (b.get('rampL') or 0)
    for sg in (-1, 1):
      loops.append({'bridge': b['id'], 'name': b['name'] or b['id'], 'side': sg, 'style': b.get('style'),
                    'x': round(b['x'] + b['n'][0] * sg * off, 2),
                    'z': round(b['z'] + b['n'][1] * sg * off, 2)})

  # 交图相机
  def cam_at(s, lat, y, look_s, look_lat, pitch, note):
    (x, z), _, _ = at_s('hq', min(max(s, 0), hq.length), lat)
    (lx, lz), _, _ = at_s('hq', min(max(look_s, 0), hq.length), look_lat)
    return {'x': round(x, 2), 'z': round(z, 2), 'y': y,
            'look': [round(lx, 2), 1.2, round(lz, 2)], 'pitch': pitch, 'note': note}

  # 1. 北浪路以西接缝：站在旧合拢处略南的岸上，朝西看打开后的河
  camSeam = cam_at(old_len - 8.0, -(HW1 + 6.5), 2.4, old_len + 28.0, 0.0, 0.10, '北浪路以西接缝，合拢已打开，河继续走')
  # 2. 福飞路 3/4 侧视：再退远一点、抬高，避开岸上房子，看见梁、墩、人行道
  camFufei = cam_at(bff['s'] - 2.0, -(bff['half'] + 22.0), 4.2, bff['s'], 0.0, 0.16, '福飞路明桥侧视：梁墩、人行道、宽于北二环')
  # 3. 南岸再退后：河缘上空朝北看两座铁路桥全长。河停在桥南，合拢墙封住。
  # cam_at 会把 s 夹到中线长度内，这里要退到合拢以南约 88 m，手动给坐标。
  _cam_along = (WEST_CAP + RAIL_LIP) - 88.0
  _cam_lat = -(HW1 - 0.4)
  _cxy = at_end(_cam_along, _cam_lat)
  _lxy = at_end((along_cf + along_hf) / 2.0, 0.0)
  camRail = {'x': round(_cxy[0], 2), 'z': round(_cxy[1], 2), 'y': 9.2,
             'look': [round(_lxy[0], 2), 8.0, round(_lxy[1], 2)], 'pitch': 0.06,
             'note': '南岸退后：河停在铁路桥南，昌福/合福全长剪影'}
  # 4. 湖景 / 大井 / 江厝 同机位并排：抬到屋面上空往下看，避免西岸房背挡住河
  b_hj = next(b for b in BRB if b.get('style') == 'hujing')
  b_dj = next(b for b in BRB if b.get('style') == 'dajing')
  b_jc = next(b for b in BRB if b.get('style') == 'jiangcuo')
  # 大井路北、河面上 15 m 朝南沿河看：近处大井、再湖景、再江厝，远处福飞路更宽。
  camTriple = cam_at(b_dj['s'] + 22.0, 3.0, 15.0, b_jc['s'] - 18.0, 0.0, 0.14,
                     '湖景路 / 大井路 / 江厝路同机位并排，跨度栏杆高低可分，都比福飞路窄')
  camTriple['look'][1] = 1.4

  bbox = list(unary_union([chanH.buffer(BAND_HQ + 40)] + list(g.get('PADS_B') or [])).bounds)
  A6BDATA = {
    'hqLen': round(hq.length, 2), 'oldLen': round(old_len, 2), 'westLen': round(hq.length - old_len, 2),
    'hw1': HW1, 'cap': WEST_CAP, 'off': [round(OFF[0], 4), round(OFF[1], 4)],
    'shift': [round(SHIFT[0], 4), round(SHIFT[1], 4)],
    'official': {'start': 0.0, 'end': 1516.22, 'real': 1516.22, 'game': round((hq.length - old_len), 2)},
    'bridges': [b['id'] for b in BRB],
    'byStyle': {st: next(b['id'] for b in BRB if b.get('style') == st)
                for st in ('fufei', 'jiangcuo', 'hujing', 'dajing', 'short')},
    'signs': SIGNSB, 'plates': plates, 'lamps': lamps,
    'rails': rails, 'far': far, 'railPad': railPad, 'capWall': capWall,
    'gone': {'houses': GONEB_H, 'trees': GONEB_T},
    'loop': loops,
    'cams': {'seam': camSeam, 'fufei': camFufei, 'rail': camRail, 'triple': camTriple},
    'zone': [round(v, 1) for v in bbox],
    'note': '6B：湖前河西段 1:4，s=0→1516.22，不接 957264426；福飞路明桥宽 42；江厝路复用北浪路；s=127 短桥无路名牌；无名脚桥不做；铁路背景各 1 draw',
  }
  g['A6BDATA'] = A6BDATA
  g['FAR6B'] = far
  print('6B zone', A6BDATA['zone'], 'rails', len(rails), 'far', len(far), 'loops', len(loops),
        'lamps', len(lamps))


def frange(a, b, d):
  x = a
  out = []
  while x < b - 1e-9:
    out.append(x); x += d
  return out
