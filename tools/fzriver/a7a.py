# 福州内河 7A：洋下河（晋安河接缝 → 无名下游 → 命名西头 → 涧田路涵洞以东合拢）。
# PLAN-洋下河 v2 定稿（11-23 02:19 小美定）。由 gen_e.py 在 6B 之后调用。
# 已建晋安河中线 / 既有桥不得改；汇入口整段平移对齐。
import json, math, os, random, xml.etree.ElementTree as ET
from shapely.geometry import LineString, Polygon, Point, box
from shapely.ops import unary_union
from a6 import (_tan, _smooth, _dedupe, _resample, _smooth_radius, _bez, HW1, BAND_HQ)

CAP = 2.4          # 6B 同款合拢
HOLD = 8.0
HW_YX = 5.0
BAND_YX = 24.0
JA_JN_SHA1 = '6eb7a2870782e8dbc9bd3d1ed20a63b42c4a7061'


def _load_osm_ways(paths):
  nodes, ways = {}, []
  for path in paths:
    if not os.path.exists(path):
      continue
    root = ET.parse(path).getroot()
    def tn(t):
      return t.split('}')[-1]
    for el in root:
      kind = tn(el.tag)
      if kind == 'node':
        nodes[int(el.get('id'))] = (float(el.get('lat')), float(el.get('lon')))
      elif kind == 'way':
        tags, nds = {}, []
        for c in el:
          ck = tn(c.tag)
          if ck == 'tag':
            tags[c.get('k')] = c.get('v')
          elif ck == 'nd':
            nds.append(int(c.get('ref')))
        ways.append((int(el.get('id')), tags, nds))
  return nodes, ways


def _P(lat, lon, lat0=26.0890606, lon0=119.2945129):
  return ((lon - lon0) * 111320 * math.cos(math.radians(lat0)), (lat - lat0) * 110574)


def build_yx(g):
  """6B 之后：接上 7A 洋下河西段（含无名下游），不改 ja/jn 中线。"""
  HERE, scJ, at_s, bridge, rect = g['HERE'], g['scJ'], g['at_s'], g['bridge'], g['rect']
  pack, tris_by_cell, tris_flat, merge = g['pack'], g['tris_by_cell'], g['tris_flat'], g['merge']
  _keep_old, ext, minRat = g['_keep_old'], g['ext'], g['minRat']
  water0, region0, land0 = g['water'], g['region'], g['land']
  WALL0, LAND0, WATER0, BOUND0 = g['WALL'], g['LAND'], g['WATER'], g['BOUND']

  raw = json.load(open(os.path.join(HERE, 'yxh_7a_osm_m.json')))
  coords = [tuple(p) for p in raw['coords']]
  confluence = coords[0]
  g0 = scJ([confluence])[0]

  # 把汇入口贴到已建 jn（若更近则 ja）上最近的一点，整段平移，不扭已建中线
  jn, ja = g['CL']['jn'], g['CL']['ja']
  s_jn = jn.project(Point(*g0)); d_jn = jn.interpolate(s_jn).distance(Point(*g0))
  s_ja = ja.project(Point(*g0)); d_ja = ja.interpolate(s_ja).distance(Point(*g0))
  if d_jn <= d_ja:
    host, host_s, d_host = 'jn', s_jn, d_jn
  else:
    host, host_s, d_host = 'ja', s_ja, d_ja
  (Y0x, Y0z), jt, jn_n = at_s(host, host_s)
  Y0 = (Y0x, Y0z)
  OFF = (Y0[0] - g0[0], Y0[1] - g0[1])
  osm_g = [(p[0] + OFF[0], p[1] + OFF[1]) for p in scJ(coords)]
  osm_g[0] = (Y0[0], Y0[1])
  print('7A host', host, 's', round(host_s, 2), 'd0', round(d_host, 3),
        'Y0', tuple(round(v, 2) for v in Y0), 'off', [round(OFF[0], 4), round(OFF[1], 4)])

  Losm = LineString(_chaikin_safe(osm_g)).simplify(0.6)
  # 短持平再沿 OSM 切向接上，避免扭 jn
  T0 = _tan(Losm, min(12.0, Losm.length * 0.04))
  # 离开方向：朝向 OSM 下游（东北），若与 jn 切向夹角过小则沿 OSM
  hold = [(Y0[0] + T0[0] * s, Y0[1] + T0[1] * s) for s in (0.0, 2.0, 4.0, 6.0, HOLD)]
  P0 = hold[-1]
  s_tgt = min(36.0, max(24.0, Losm.length * 0.06))
  P3 = (Losm.interpolate(s_tgt).x, Losm.interpolate(s_tgt).y)
  T3 = _tan(Losm, s_tgt)
  C = 16.0
  P1 = (P0[0] + T0[0] * C, P0[1] + T0[1] * C)
  P2 = (P3[0] - T3[0] * C, P3[1] - T3[1] * C)
  blend = [_bez(P0, P1, P2, P3, i / 12.0) for i in range(1, 13)]
  rest, ss = [], s_tgt + 1.2
  while ss < Losm.length - 0.05:
    q = Losm.interpolate(ss); rest.append((q.x, q.y)); ss += 2.0
  rest.append((Losm.coords[-1][0], Losm.coords[-1][1]))
  yx = LineString(_dedupe(hold + blend + rest, 0.3))
  yx = _resample(yx, 3.0)
  yx = _smooth_radius(yx, 26.0, lock=HOLD + 4.0, iters=600)
  r0, p0, s0 = minRat(yx)
  print('7A yx minR', round(r0, 2), 'at', tuple(round(v, 2) for v in p0), 's', round(s0, 1),
        'len', round(yx.length, 2), 'start', tuple(round(v, 2) for v in yx.coords[0]),
        'end', tuple(round(v, 2) for v in yx.coords[-1]))
  if r0 < 25.9:
    yx = _smooth_radius(yx, 26.5, lock=max(HOLD, 8.0), iters=900)
    r0, p0, s0 = minRat(yx)
    print('7A yx minR pass2', round(r0, 2), 's', round(s0, 1))

  # 钉死：不得改已建中线
  assert g['CL']['jn'].coords[:] == jn.coords[:]
  assert g['CL']['ja'].coords[:] == ja.coords[:]

  g['HW']['yx'] = HW_YX
  g['BAND']['yx'] = BAND_YX
  g['NAME']['yx'] = ['洋下河', 'Yangxia River']
  g['CL']['yx'] = yx
  g['YX_OFF'] = [round(OFF[0], 4), round(OFF[1], 4)]
  g['YX_HOST'] = {'river': host, 's': round(host_s, 2), 'd': round(d_host, 3)}

  def at_yx(s, lat=0.0):
    s = min(max(s, 0), yx.length)
    p = yx.interpolate(s); t = _tan(yx, s); n = (t[1], -t[0])
    return (p.x + n[0] * lat, p.y + n[1] * lat), t, n

  def game_of_official(official_s):
    real = LineString(coords)
    rp = real.interpolate(min(max(official_s, 0), real.length))
    gp = scJ([(rp.x, rp.y)])[0]
    return (gp[0] + OFF[0], gp[1] + OFF[1])

  # 水面 + 东头合拢
  left, right, s = [], [], 0.0
  while s <= yx.length + 1e-6:
    ss = min(s, yx.length)
    p = yx.interpolate(ss); t = _tan(yx, ss); n = (t[1], -t[0])
    left.append((p.x - n[0] * HW_YX, p.y - n[1] * HW_YX))
    right.append((p.x + n[0] * HW_YX, p.y + n[1] * HW_YX))
    s += 0.8
  te = _tan(yx, yx.length)
  ne = (te[1], -te[0])
  west_end = yx.coords[-1]  # 7A 东头
  for i in range(1, 6):
    u = i / 5.0
    p = (west_end[0] + te[0] * CAP * u, west_end[1] + te[1] * CAP * u)
    left.append((p[0] - ne[0] * HW_YX, p[1] - ne[1] * HW_YX))
    right.append((p[0] + ne[0] * HW_YX, p[1] + ne[1] * HW_YX))
  chanY = Polygon(left + right[::-1]).buffer(0).simplify(0.06)
  if chanY.geom_type != 'Polygon':
    chanY = max(chanY.geoms, key=lambda q: q.area)
  g['chanY'] = chanY

  wall_p = (west_end[0] + te[0] * CAP, west_end[1] + te[1] * CAP)
  capWall = {
    'x': round(wall_p[0], 2), 'z': round(wall_p[1], 2),
    'n': [round(ne[0], 4), round(ne[1], 4)],
    't': [round(te[0], 4), round(te[1], 4)],
    'thick': 1.4, 'h': 4.4, 'len': 24.0,
  }
  capP = (west_end[0] + te[0] * (CAP + 8), west_end[1] + te[1] * (CAP + 8))
  far = []
  for off in range(-40, 44, 12):
    q = (capP[0] + ne[0] * off, capP[1] + ne[1] * off)
    far.append([round(q[0], 2), round(q[1], 2), round(-te[0], 4), round(-te[1], 4)])

  # ---- 跨河：涵洞 + 机场高速（及匝道）----
  xmls = [os.path.join(HERE, 'osm_map_yxh.xml'), os.path.join(HERE, 'osm_map_7a_down.xml')]
  nodes, osm_ways = _load_osm_ways(xmls)
  def way_pts_game(nds):
    pts = []
    for nid in nds:
      if nid not in nodes:
        continue
      lat, lon = nodes[nid]
      x, z = _P(lat, lon)
      gp = scJ([(x, z)])[0]
      pts.append((gp[0] + OFF[0], gp[1] + OFF[1]))
    return pts

  def min_d_line(p, ls):
    return Point(p[0], p[1]).distance(ls)

  culvert_ways = [w for w in raw['ways'] if w.get('tunnel') == 'culvert']
  culverts = []
  ROADS7 = []
  BR7 = []

  for cw in culvert_ways:
    mid_s = 0.5 * (cw['s0'] + cw['s1'])
    gp = game_of_official(mid_s)
    s = yx.project(Point(*gp))
    (cx, cz), t, n = at_yx(s)
    # 找最近的公路
    best = None
    for hid, tags, nds in osm_ways:
      hw = tags.get('highway')
      if not hw or hw in ('footway', 'path', 'steps', 'pedestrian'):
        continue
      pts = way_pts_game(nds)
      if len(pts) < 2:
        continue
      ls = LineString(pts)
      d = Point(cx, cz).distance(ls)
      if d < 22:
        # tangent of road near closest point
        pr = ls.project(Point(cx, cz))
        a0 = max(0, min(pr - 2, ls.length - 4))
        a, b = ls.interpolate(a0), ls.interpolate(min(ls.length, a0 + 4))
        rl = math.hypot(b.x - a.x, b.y - a.y) or 1
        rt = ((b.x - a.x) / rl, (b.y - a.y) / rl)
        rec = (d, hid, tags, rt, ls.length)
        if best is None or d < best[0]:
          best = rec
    road_name = None
    road_hw = 'unclassified'
    lanes = 2
    rt = t
    if best:
      road_name = best[2].get('name')
      road_hw = best[2].get('highway') or road_hw
      if best[2].get('lanes'):
        try:
          lanes = int(best[2]['lanes'])
        except ValueError:
          lanes = 2
      rt = best[3]
    # 路走向应跨河：与中线 t 夹角大
    if abs(rt[0] * t[0] + rt[1] * t[1]) > 0.85:
      # 几乎平行，改用河的 n 作为路的 t（跨河）
      rt = n
    rl = math.hypot(*rt) or 1
    rt = (rt[0] / rl, rt[1] / rl)
    rn = (rt[1], -rt[0])
    # 宽度
    w = max(8.0, min(18.0, 3.5 * lanes + 4.0))
    # cover = 沿河被路堤盖住的长度（游戏米）；along = 沿路跨河方向（路面 + 两岸斜坡）
    cover = max(8.0, (cw['s1'] - cw['s0']) / 4.0)
    rampL = 6.0
    along = 2.0 * (HW_YX + 3.5)   # 跨河方向的路堤宽度
    if s < 20:
      cover = min(cover, 8.0)
      along = min(along, 12.0)
      rampL = 5.0
    rec = {
      'id': 'yx_c' + str(len(culverts) + 1),
      'way': cw['id'],
      's': round(s, 2),
      's0': cw['s0'], 's1': cw['s1'],
      'x': round(cx, 2), 'z': round(cz, 2),
      't': [round(rt[0], 4), round(rt[1], 4)],   # 沿路（跨河）
      'n': [round(rn[0], 4), round(rn[1], 4)],
      'riverT': [round(t[0], 4), round(t[1], 4)],
      'w': round(w, 2),
      'along': round(along, 2),
      'cover': round(cover, 2),
      'half': round(HW_YX + 3.0, 2),
      'deckY': 1.2, 'rampL': rampL, 'walk': 2.5,
      'roadName': road_name, 'highway': road_hw,
      'named': False,  # 7A 无名/路名都不在涵洞上挂牌
    }
    culverts.append(rec)
    # 路面（含两侧人行道）作为可走 ROADS
    poly = rect(cx, cz, rt[0], rt[1], -rec['along'] / 2 - rec['rampL'], rec['along'] / 2 + rec['rampL'], -w / 2, w / 2)
    ROADS7.append({'id': rec['id'] + 'rd', 'name': road_name, 'poly': poly,
                   'dir': [rt[0], rt[1]], 'w': w, 'culvert': True, 'a7a': True})
    print('7A culvert', rec['id'], 'way', cw['id'], 's', rec['s'], 'road', road_name or 'unnamed', road_hw, 'w', w)

  # 机场高速主桥 + 匝道（两层，不合一块）
  express_main = None
  express_ramps = []
  tip_s = raw['named_west_tip_s'] + 133.2  # 命名西头后再约 133 m 真实
  gp_ex = game_of_official(tip_s)
  sx = yx.project(Point(*gp_ex))
  (ex, ez), et, en = at_yx(sx)
  for hid, tags, nds in osm_ways:
    if tags.get('name') == '福州机场高速' and tags.get('highway') == 'motorway':
      pts = way_pts_game(nds)
      if len(pts) < 2:
        continue
      ls = LineString(pts)
      d = Point(ex, ez).distance(ls)
      pr = ls.project(Point(ex, ez))
      a0 = max(0, min(pr - 8, ls.length - 16))
      a, b = ls.interpolate(a0), ls.interpolate(min(ls.length, a0 + 16))
      rl = math.hypot(b.x - a.x, b.y - a.y) or 1
      rt = ((b.x - a.x) / rl, (b.y - a.y) / rl)
      # 跨河
      if abs(rt[0] * et[0] + rt[1] * et[1]) > 0.85:
        rt = en
      rn = (rt[1], -rt[0])
      lanes = 3
      try:
        lanes = int(tags.get('lanes') or 3)
      except ValueError:
        pass
      w = max(16.0, 3.75 * lanes + 5.0)
      express_main = {
        'id': 'yx_ex', 'name': '福州机场高速',
        'way': hid, 's': round(sx, 2),
        'x': round(ex, 2), 'z': round(ez, 2),
        't': [round(rt[0], 4), round(rt[1], 4)],
        'n': [round(rn[0], 4), round(rn[1], 4)],
        'w': round(w, 2), 'len': 90.0, 'deckY': 6.8, 'thick': 1.2,
        'lanes': lanes, 'piers': 6, 'layer': 'main',
      }
      print('7A express main', 's', express_main['s'], 'w', w, 'dOSM', round(d, 2))
      break
  if express_main is None:
    # fallback：用河的 n 作跨河方向
    rt, rn = en, et
    express_main = {
      'id': 'yx_ex', 'name': '福州机场高速',
      'way': None, 's': round(sx, 2),
      'x': round(ex, 2), 'z': round(ez, 2),
      't': [round(rt[0], 4), round(rt[1], 4)],
      'n': [round(rn[0], 4), round(rn[1], 4)],
      'w': 18.0, 'len': 90.0, 'deckY': 6.8, 'thick': 1.2,
      'lanes': 3, 'piers': 6, 'layer': 'main',
    }
    print('7A express main fallback at s', express_main['s'])

  # 匝道：motorway_link，去重；只留真正贴河或贴主桥的，最多 4 条（主桥和匝道两层，不合一块）
  seen_ways, cand = set(), []
  for hid, tags, nds in osm_ways:
    if tags.get('highway') != 'motorway_link' or tags.get('bridge') != 'yes':
      continue
    if hid in seen_ways:
      continue
    pts = way_pts_game(nds)
    if len(pts) < 2:
      continue
    ls = LineString(pts)
    d_main = Point(ex, ez).distance(ls)
    d_yx = ls.distance(yx)
    if d_yx > 28 and d_main > 36:
      continue
    seen_ways.add(hid)
    pr = ls.project(Point(ex, ez))
    a0 = max(0, min(pr - 6, ls.length - 12))
    a, b = ls.interpolate(a0), ls.interpolate(min(ls.length, a0 + 12))
    rl = math.hypot(b.x - a.x, b.y - a.y) or 1
    rt = ((b.x - a.x) / rl, (b.y - a.y) / rl)
    q = ls.interpolate(pr)
    rn = (rt[1], -rt[0])
    rlen = min(56.0, max(24.0, min(ls.length, 56.0)))
    cand.append((d_yx, {
      'id': 'yx_exr',
      'way': hid, 'x': round(q.x, 2), 'z': round(q.y, 2),
      't': [round(rt[0], 4), round(rt[1], 4)],
      'n': [round(rn[0], 4), round(rn[1], 4)],
      'w': 8.0, 'len': round(rlen, 1), 'deckY': 5.4, 'thick': 1.0,
      'layer': 'ramp',
    }))
  cand.sort(key=lambda q: q[0])
  kept = []
  for d_yx, rec in cand:
    if d_yx > 22:
      continue
    rec['len'] = min(rec['len'], 40.0)
    kept.append(rec)
    if len(kept) >= 2:
      break
  for i, rec in enumerate(kept, 1):
    rec['id'] = 'yx_exr' + str(i)
    express_ramps.append(rec)
  print('7A express ramps', len(express_ramps), 'of', len(cand), 'kept near main')

  # 高速不进 BR 当可过路桥（只走桥下）。记录在 a7a 里。
  under = []
  def _soffit_row(b, tag):
    sof = round(b['deckY'] - b['thick'], 2)
    half = b.get('len', 40) / 2 - 4
    step = 14.0
    u = -half
    while u <= half + 0.01:
      under.append({'bridge': b['id'], 'layer': tag, 'u': round(u, 1),
                    'x': round(b['x'] + b['t'][0] * u, 2),
                    'z': round(b['z'] + b['t'][1] * u, 2),
                    't': b['t'], 'n': b['n'], 'w': b['w'],
                    'deckY': b['deckY'], 'soffit': sof})
      u += step
  if express_main:
    _soffit_row(express_main, 'main')
  for Rmp in express_ramps:
    _soffit_row(Rmp, 'ramp')

  # 命名西头路牌（全河唯一一块洋下河牌）
  # 岸上再退到 HW+5.8，好让交图机位站在岸道正对牌面约 4 m，不必下到河里隔墙看牌顶。
  tip_real = raw['named_west_tip_s']
  gp_tip = game_of_official(tip_real)
  tip_s_g = yx.project(Point(*gp_tip))
  _sign_lat = HW_YX + 5.8
  (tx, tz), tt, tn = at_yx(tip_s_g, _sign_lat)
  # 牌子朝向河
  sign = {
    'id': 'yxh_w',
    'x': round(tx, 2), 'z': round(tz, 2),
    'f': [round(-tn[0], 4), round(-tn[1], 4)],
    'lines': ['洋下河', 'Yangxia River'],
  }
  # 若落水则对岸再试（该侧 offset 为 -n，朝河的 f 为 +n）
  if chanY.buffer(0.5).contains(Point(sign['x'], sign['z'])):
    (tx, tz), tt, tn = at_yx(tip_s_g, -_sign_lat)
    sign['x'], sign['z'] = round(tx, 2), round(tz, 2)
    sign['f'] = [round(tn[0], 4), round(tn[1], 4)]

  # 可走范围
  regY = unary_union([ext(yx).buffer(HW_YX + BAND_YX, cap_style='flat', quad_segs=6),
                      chanY.buffer(BAND_YX, quad_segs=6)] + [r['poly'] for r in ROADS7]).simplify(0.1)
  region = unary_union([region0, regY]).buffer(0)
  if region.geom_type != 'Polygon':
    region = max(region.geoms, key=lambda q: q.area)
  region = Polygon(region.exterior)
  _wN = unary_union([water0, chanY.intersection(region.buffer(-0.05))]).buffer(0)
  water = _wN.intersection(region.buffer(-0.05)).buffer(0).simplify(0.05)
  if water.geom_type != 'Polygon':
    water = max(water.geoms, key=lambda q: q.area)
  water = Polygon(water.exterior, [i for i in water.interiors])
  land = region.difference(water).buffer(0)
  if land.geom_type == 'MultiPolygon':
    land = unary_union([p for p in land.geoms if p.area > 4])
  g['water'], g['land'], g['region'] = water, land, region

  CELL = g['CELL']
  LAND = {k_: pack(v) for k_, v in tris_by_cell(land).items()}
  WATER = {k_: pack(v) for k_, v in tris_by_cell(water).items()}
  print('7A cells kept from 6B: land', _keep_old(LAND, land, land0, LAND0), '/', len(LAND),
        'water', _keep_old(WATER, water, water0, WATER0), '/', len(WATER))
  g['LAND'], g['WATER'] = LAND, WATER

  # 涵洞是跨河公路：岸墙必须按桥洞留口（flag=1）。否则 flag=0 实墙（再加导航 0.38 m 外扩）会切断斑马线和沿岸步道。
  for c in culverts:
    # e2e 人行道坡底在 along/2+rampL+2.5：口要盖到坡底，否则 flag=0 墙顶在引坡脚，夏莲/涧田沿路爬不上。
    ext_t = c['along'] / 2 + c['rampL'] + 3.3
    ext_n = c['w'] / 2 + 0.4
    g['GAPS'].append(rect(c['x'], c['z'], c['t'][0], c['t'][1], -ext_t, ext_t, -ext_n, ext_n))

  # 岸墙
  _wd = water.symmetric_difference(water0).buffer(0)
  geoms = [q for q in getattr(_wd, 'geoms', [_wd]) if q.area > 0.5]
  _wd = unary_union(geoms) if geoms else _wd
  # 桥洞 / 口门等特殊 flag 必须保留：6B 江厝路 gap 是 flag=1（无碰撞）。靠近新水面差集时丢掉再按 flag=0 补回，会在桥头砌实墙。
  WALL_keep = [w for w in WALL0 if LineString([(w[0], w[1]), (w[2], w[3])]).distance(_wd) > 0.5
               or (len(w) > 4 and w[4] in (1, 2, 3, 4, 5))]
  _keepU = unary_union([LineString([(w[0], w[1]), (w[2], w[3])]) for w in WALL_keep] or [Point(0, 0)]).buffer(0.3)
  W7 = []
  gapU = unary_union(g.get('GAPS') or [Point(0, 0)])
  for c_ in [list(r_.coords) for r_ in [water.exterior] + list(water.interiors)]:
    for a, b_ in zip(c_, c_[1:]):
      L_ = math.dist(a, b_); nseg = max(1, math.ceil(L_ / 2.0))
      for i in range(nseg):
        p0 = (a[0] + (b_[0] - a[0]) * i / nseg, a[1] + (b_[1] - a[1]) * i / nseg)
        p1 = (a[0] + (b_[0] - a[0]) * (i + 1) / nseg, a[1] + (b_[1] - a[1]) * (i + 1) / nseg)
        m_ = Point((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2)
        if _keepU.contains(m_):
          continue
        # 汇入口沿晋安河切向的口门
        kd = 0
        if math.hypot((p0[0] + p1[0]) / 2 - Y0[0], (p0[1] + p1[1]) / 2 - Y0[1]) < 18:
          dx_, dz_ = p1[0] - p0[0], p1[1] - p0[1]
          l_ = math.hypot(dx_, dz_) or 1
          if abs(dx_ / l_ * jt[0] + dz_ / l_ * jt[1]) < 0.35:
            kd = 4
        if not kd and gapU.contains(m_):
          kd = 1   # 与 6B 相同：桥洞不挂岸墙碰撞
        W7.append([round(p0[0], 2), round(p0[1], 2), round(p1[0], 2), round(p1[1], 2), kd])
  W7 = merge(W7)
  for w in W7:
    L_ = math.dist(w[:2], w[2:4]) or 1
    dx_, dz_ = (w[2] - w[0]) / L_, (w[3] - w[1]) / L_
    rx, rz = dz_, -dx_
    mx_, mz_ = (w[0] + w[2]) / 2, (w[1] + w[3]) / 2
    w.append(1 if water.contains(Point(mx_ + rx * 0.25, mz_ + rz * 0.25)) else -1)
  WALL = WALL_keep + W7
  g['WALL'] = WALL
  print('7A walls: kept', len(WALL_keep), '/', len(WALL0), 'new', len(W7),
        {f: sum(1 for w in W7 if w[4] == f) for f in range(5)})

  BOUND = [[round(x, 2), round(z, 2)] for x, z in Polygon(BOUND0).union(regY.simplify(0.3)).buffer(0).exterior.coords]
  g['BOUND'] = BOUND
  mnx, mnz, mxx, mxz = region.bounds
  skirt = box(mnx - 160, mnz - 160, mxx + 160, mxz + 160).difference(region)
  for extra in ('mjPoly', 'xgPoly'):
    if g.get(extra) is not None:
      skirt = skirt.difference(g[extra])
  skirt = skirt.buffer(0).simplify(1.0)
  g['SKIRT'] = pack(tris_flat(skirt))

  # 占用：涵洞路面 + 高速桥墩范围 + 牌
  occ_geoms = [r['poly'].buffer(0.4) for r in ROADS7] + [Point(sign['x'], sign['z']).buffer(5),
                                                         Point(*Y0).buffer(16),
                                                         Point(*west_end).buffer(10)]
  if express_main:
    E = express_main
    occ_geoms.append(rect(E['x'], E['z'], E['t'][0], E['t'][1], -E['w'] / 2, E['w'] / 2, -8, 8).buffer(1.0))
  HOUSES, TREES = g['HOUSES'], g['TREES']

  def _hpoly0(h):
    return Polygon([(h['x'] + h['t'][0] * a + h['f'][0] * b * -1, h['z'] + h['t'][1] * a + h['f'][1] * b * -1)
                    for a, b in [(-h['w'] / 2, -h['d'] / 2), (h['w'] / 2, -h['d'] / 2), (h['w'] / 2, h['d'] / 2), (-h['w'] / 2, h['d'] / 2)]])

  occ = unary_union(occ_geoms + [_hpoly0(h).buffer(0.4) for h in HOUSES if not h.get('gone')])
  R7 = random.Random(719)
  nH0 = len(HOUSES)

  def _try_house(s, side, off_extra, w_, d_, h_, lod=None):
    nonlocal occ
    off = HW_YX + off_extra + d_ / 2
    (cx, cz), tdir, nn = at_yx(min(yx.length - 2, s + w_ / 2), side * off)
    poly = Polygon([(cx + tdir[0] * a + nn[0] * side * b, cz + tdir[1] * a + nn[1] * side * b)
                    for a, b in [(-w_ / 2, -d_ / 2), (w_ / 2, -d_ / 2), (w_ / 2, d_ / 2), (-w_ / 2, d_ / 2)]])
    if not region.buffer(-0.05).contains(poly) or poly.intersects(occ) or poly.intersects(water.buffer(0.8)):
      return False
    occ = occ.union(poly.buffer(0.25))
    rec = {'x': round(cx, 2), 'z': round(cz, 2), 'w': round(w_, 2), 'd': round(d_, 2),
           't': [round(tdir[0], 4), round(tdir[1], 4)], 'f': [round(-nn[0] * side, 4), round(-nn[1] * side, 4)],
           'river': 'yx', 'h': h_, 'kind': 'old', 'ry': round(math.atan2(tdir[0], tdir[1]), 4),
           'back': True, 'a7a': True}
    if lod:
      rec['lod'] = lod
    HOUSES.append(rec)
    return True

  s = 28.0
  while s < yx.length - 8:
    if any(abs(c['s'] - s) < c['along'] / 2 + 3 for c in culverts) or (express_main and abs(express_main['s'] - s) < 16):
      s += 2
      continue
    placed = False
    w_ = R7.uniform(6.6, 10.2); d_ = R7.uniform(6.0, 8.0); h_ = R7.choice([5.4, 6.0, 6.6, 7.2, 6.2, 7.8])
    for side in (-1, 1):
      if _try_house(s, side, 3.8, w_, d_, h_) or _try_house(s, side, 3.8, 6.2, 5.6, h_):
        placed = True
    s += (w_ + R7.uniform(1.0, 2.4)) if placed else 2.4
  nH1 = len(HOUSES)
  s = 32.0
  while s < yx.length - 10:
    if any(abs(c['s'] - s) < c['along'] / 2 + 2 for c in culverts):
      s += 3
      continue
    w_ = R7.uniform(8.0, 12.0); d_ = R7.uniform(6.0, 8.0); h_ = R7.choice([6.0, 7.0, 8.0, 9.0, 7.5])
    for side in (-1, 1):
      _try_house(s, side, 13.0, w_, d_, h_, lod='lo') or _try_house(s, side, 13.0, 7.0, 5.8, h_, lod='lo')
    s += w_ + R7.uniform(2.0, 3.6)
  print('7A houses', len(HOUSES) - nH0, 'front', nH1 - nH0, 'back', len(HOUSES) - nH1)

  treeOcc = unary_union(occ_geoms)
  nT0 = len(TREES)
  s = 30.0
  while s < yx.length - 6:
    if any(abs(c['s'] - s) < c['along'] / 2 + 6 for c in culverts) or (express_main and abs(express_main['s'] - s) < 18):
      s += 3
      continue
    for side in (-1, 1):
      (x, z), tdir, nn = at_yx(s, side * (HW_YX + 3.8))
      P_ = Point(x, z)
      if region.contains(P_) and not water.buffer(0.8).contains(P_) and not treeOcc.contains(P_) and all(math.hypot(x - t[0], z - t[1]) > 4.2 for t in TREES if t[5] != 'gone'):
        TREES.append([round(x, 2), round(z, 2), round(-nn[0] * side, 3), round(-nn[1] * side, 3), round(R7.uniform(0.85, 1.15), 2), 'yx', 1])
        treeOcc = treeOcc.union(P_.buffer(3.2))
    s += R7.uniform(6.4, 8.8)
  print('7A trees', len(TREES) - nT0)

  # 被新河道 / 涵洞路面真正压到的旧楼 / 树才撤；已建晋安河岸上的楼，除非压进新水面或 7A 路面，一律保留
  _newW = water.difference(water0).buffer(0)
  _roadU = unary_union([r['poly'] for r in ROADS7] or [Point(0, 0)])
  GONE_H, GONE_T = [], []
  for i, h in enumerate(HOUSES):
    if h.get('gone') or h.get('a7a') or h.get('a6') or h.get('a6b'):
      continue
    poly = _hpoly0(h)
    aw = poly.intersection(_newW).area if not _newW.is_empty else 0.0
    ar = poly.intersection(_roadU).area
    if aw > 4.0 or ar > 6.0:
      HOUSES[i]['gone'] = '7A'; GONE_H.append(i)
  for i, t in enumerate(TREES):
    if t[5] in ('gone', 'yx', 'hq'):
      continue
    P_ = Point(t[0], t[1])
    if (not _newW.is_empty and _newW.buffer(1.2).contains(P_)) or _roadU.buffer(0.4).contains(P_):
      TREES[i][5] = 'gone'; GONE_T.append(i)
  print('7A gone houses', GONE_H, 'trees', len(GONE_T))

  g['HOUSES'], g['TREES'] = HOUSES, TREES
  g['ROADS'] = g['ROADS'] + ROADS7

  # 机位（自审：不进房子、前景无树干、汇入口前后同机位能看出开口）
  # (a) 站在已建晋安河西岸、汇入口以北约 28 m，朝东看 7A 开口（两岸开河后此点仍是岸）
  (ex0, ez0), et0, en0 = at_s(host, max(0.0, host_s - 28.0), (g['HW'][host] + 4.2))
  look0 = (Y0[0] + T0[0] * 22, Y0[1] + T0[1] * 22)
  camSeam = {'x': round(ex0, 2), 'z': round(ez0, 2), 'y': 1.8,
             'look': [round(look0[0], 2), 1.2, round(look0[1], 2)],
             'pitch': 0.08,
             'note': '已建晋安河西岸同机位，朝汇入口看 7A 开口'}
  # (b) 机场高速桥下：站在主桥南沿外侧河道中线，朝北看进梁底（要看见梁底灯带，不要只看见一条黑边）
  camEx = camExSide = None
  if express_main:
    E = express_main
    (ux, uz), et, en = at_yx(max(0.0, E['s'] - 10.0), 0.0)
    camEx = {'x': round(ux, 2), 'z': round(uz, 2), 'y': 1.55,
             'look': [round(E['x'], 2), 5.3, round(E['z'], 2)],
             'pitch': 0.14,
             'note': '机场高速桥下'}
    # 再退远、略抬高：躲开近处房子墙，看匝道（低 5.4）在前、主桥（高 6.8）在后两层
    sx = E['x'] + E['t'][0] * 40 + E['n'][0] * 22
    sz = E['z'] + E['t'][1] * 40 + E['n'][1] * 22
    camExSide = {'x': round(sx, 2), 'z': round(sz, 2), 'y': 8.8,
                 'look': [round((E['x'] + 641.18) / 2, 2), 6.2, round((E['z'] + 755.64) / 2, 2)],
                 'pitch': 0.12,
                 'note': '机场高速主桥与匝道两层'}
  # (c) 涧田路涵洞口：站在南洞口外河道中线（朝汇入口、远离合拢墙），正对洞口
  c_j = max(culverts, key=lambda c: c['s']) if culverts else None
  camCul = None
  if c_j:
    rT = c_j['riverT']
    cover = c_j.get('cover') or c_j['along']
    back = 16.0
    cx = c_j['x'] - rT[0] * (cover / 2 + back)
    cz = c_j['z'] - rT[1] * (cover / 2 + back)
    lx = c_j['x'] - rT[0] * (cover / 2 - 0.6)
    lz = c_j['z'] - rT[1] * (cover / 2 - 0.6)
    camCul = {'x': round(cx, 2), 'z': round(cz, 2), 'y': 1.55,
              'look': [round(lx, 2), 1.0, round(lz, 2)],
              'pitch': 0.06,
              'note': '涧田路涵洞口'}
  # (d) 命名西头牌：站在岸道上、牌子朝河正面约 4.2 m，脚在铺装上。眼 = 脚 + EYE(1.38)。
  fx, fz = sign['f']
  _cd = 3.6
  camTip = {'x': round(sign['x'] + fx * _cd, 2),
            'z': round(sign['z'] + fz * _cd, 2),
            'y': 0.55,
            'look': [sign['x'], 0.75, sign['z']],
            'pitch': 0.14,
            'note': '命名西头「洋下河」牌'}

  # 交图机位周围不留树干 / 不把楼贴在镜头前
  cams_xz = [(camSeam['x'], camSeam['z'])]
  if camEx: cams_xz.append((camEx['x'], camEx['z']))
  if camExSide: cams_xz.append((camExSide['x'], camExSide['z']))
  if camCul: cams_xz.append((camCul['x'], camCul['z']))
  cams_xz.append((camTip['x'], camTip['z']))
  for i, tr in enumerate(TREES):
    if tr[5] in ('gone',): continue
    if any(math.hypot(tr[0] - cx, tr[1] - cz) < 9.0 for cx, cz in cams_xz):
      TREES[i][5] = 'gone'
    elif math.hypot(tr[0] - sign['x'], tr[1] - sign['z']) < 8.0:
      TREES[i][5] = 'gone'
  print('7A trees after cam keep-out', sum(1 for tr in TREES if tr[5] == 'yx'))
  def _hpoly_chk(h):
    cx, cz, w_, d_, tx, tz, fx, fz = h['x'], h['z'], h['w'], h['d'], h['t'][0], h['t'][1], h['f'][0], h['f'][1]
    return Polygon([(cx + tx * a + (-fx) * b, cz + tz * a + (-fz) * b)
                    for a, b in [(-w_ / 2, -d_ / 2), (w_ / 2, -d_ / 2), (w_ / 2, d_ / 2), (-w_ / 2, d_ / 2)]])
  for _nm, _cam in [('seam', camSeam), ('express', camEx), ('expressSide', camExSide), ('culvert', camCul), ('tip', camTip)]:
    if not _cam: continue
    Pcam = Point(_cam['x'], _cam['z'])
    hit = [h for h in HOUSES if not h.get('gone') and _hpoly_chk(h).contains(Pcam)]
    if hit:
      print('WARN cam inside house', _nm, (_cam['x'], _cam['z']), [(h['x'], h['z'], h.get('river')) for h in hit])
    else:
      print('7A cam clear', _nm, (_cam['x'], _cam['z']))
  bbox = list(chanY.buffer(BAND_YX + 40).bounds)
  A7ADATA = {
    'yxLen': round(yx.length, 2),
    'official': {'start': 0.0, 'end': raw['length'], 'real': raw['length'], 'game': round(yx.length, 2),
                 'namedWestTip': raw['named_west_tip_s'],
                 'culvert': [raw['culvert_s0'], raw['culvert_s1']]},
    'hw': HW_YX, 'cap': CAP, 'off': g['YX_OFF'], 'host': g['YX_HOST'],
    'sign': sign, 'signs': [sign],
    'culverts': culverts,
    'express': {'main': express_main, 'ramps': express_ramps, 'under': under},
    'far': far, 'capWall': capWall,
    'gone': {'houses': GONE_H, 'trees': GONE_T},
    'cams': {'seam': camSeam, 'express': camEx, 'expressSide': camExSide, 'culvert': camCul, 'tip': camTip},
    'zone': [round(v, 1) for v in bbox],
    'jaJnSha1': JA_JN_SHA1,
    'note': '7A：无名下游+命名西头+涧田路涵洞以东合拢；hw=5；牌只在命名西头；涵洞路堤可走人行道；机场高速只走桥下、主桥与匝道两层',
  }
  g['A7ADATA'] = A7ADATA
  print('7A zone', A7ADATA['zone'], 'culverts', len(culverts), 'ramps', len(express_ramps),
        'yxLen', A7ADATA['yxLen'], 'tip s_game', round(tip_s_g, 2))


def _chaikin_safe(c, n=2):
  c = list(c)
  for _ in range(n):
    o = [c[0]]
    for a, b in zip(c, c[1:]):
      o += [(a[0] * .75 + b[0] * .25, a[1] * .75 + b[1] * .25),
            (a[0] * .25 + b[0] * .75, a[1] * .25 + b[1] * .75)]
    o.append(c[-1]); c = o
  return c
