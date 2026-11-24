# 福州内河 7B：从 7A 合拢（涧田路涵洞以东）向东，沿西段主河做到涧田湖，环湖可走一圈。
# PLAN-洋下河 v2 §2 / §6（小美定）。由 gen_e.py 在 a7a.build_yx 之后调用。
# 干净拆掉 7A 东头合拢；7A 中线前缀、涵洞、高速、西头牌、ja/jn 一律不改。
import json, math, os, random
from shapely.geometry import LineString, Polygon, Point, box
from shapely.ops import unary_union
from a6 import (_tan, _dedupe, _resample, _smooth_radius)
from a7a import _chaikin_safe, CAP, HW_YX, BAND_YX, JA_JN_SHA1, _P

LB = 9.0          # 环湖步道宽（游戏米）
HOUSE_BAND = 22.0  # 环湖步道外的民房带（加宽以便第二圈房子和远景楼落在 region 里，不要露出空铺地）
HOLD = 8.0


def build_lake(g):
  """7A 之后：延伸 yx 到涧田湖，张开湖面，环湖可走，东头改到湖东北出水口合拢。"""
  HERE, scJ, at_s, bridge, rect = g['HERE'], g['scJ'], g['at_s'], g['bridge'], g['rect']
  pack, tris_by_cell, tris_flat, merge = g['pack'], g['tris_by_cell'], g['tris_flat'], g['merge']
  _keep_old, ext, minRat = g['_keep_old'], g['ext'], g['minRat']
  water0, region0, land0 = g['water'], g['region'], g['land']
  WALL0, LAND0, WATER0, BOUND0 = g['WALL'], g['LAND'], g['WATER'], g['BOUND']
  A7 = g['A7ADATA']
  OFF = g['YX_OFF']
  yx7a = g['CL']['yx']
  len7a = yx7a.length
  pref = list(yx7a.coords)
  jn, ja = g['CL']['jn'], g['CL']['ja']

  raw = json.load(open(os.path.join(HERE, 'yxh_7b_osm_m.json')))
  coords = [tuple(p) for p in raw['river_coords']]
  osm_g = [(p[0] + OFF[0], p[1] + OFF[1]) for p in scJ(coords)]
  # 第一点应对准 7A 东头
  p0 = pref[-1]
  d0 = math.hypot(osm_g[0][0] - p0[0], osm_g[0][1] - p0[1])
  print('7B join d0', round(d0, 3), 'yx7a', round(len7a, 2), 'end', tuple(round(v, 2) for v in p0))
  osm_g[0] = p0
  Losm = LineString(_chaikin_safe(osm_g)).simplify(0.6)

  T0 = _tan(yx7a, len7a)
  hold = [(p0[0] + T0[0] * s, p0[1] + T0[1] * s) for s in (2.0, 4.0, 6.0, HOLD)]
  P0 = hold[-1]
  s_tgt = min(40.0, max(20.0, Losm.length * 0.04))
  # Losm 从 7A 东头算起，跳过 hold
  P3 = (Losm.interpolate(s_tgt).x, Losm.interpolate(s_tgt).y)
  T3 = _tan(Losm, s_tgt)
  C = 14.0
  P1 = (P0[0] + T0[0] * C, P0[1] + T0[1] * C)
  P2 = (P3[0] - T3[0] * C, P3[1] - T3[1] * C)
  from a6 import _bez
  blend = [_bez(P0, P1, P2, P3, i / 12.0) for i in range(1, 13)]
  rest, ss = [], s_tgt + 1.2
  while ss < Losm.length - 0.05:
    q = Losm.interpolate(ss); rest.append((q.x, q.y)); ss += 2.0
  rest.append((Losm.coords[-1][0], Losm.coords[-1][1]))
  yx = LineString(_dedupe(pref + hold + blend + rest, 0.3))
  yx = _resample(yx, 3.0)
  yx = _smooth_radius(yx, 26.0, lock=len7a, iters=700)
  r0, pmin, smin = minRat(yx)
  print('7B yx minR', round(r0, 2), 'at', tuple(round(v, 2) for v in pmin), 's', round(smin, 1),
        'len', round(yx.length, 2), 'end', tuple(round(v, 2) for v in yx.coords[-1]))
  if r0 < 25.9:
    yx = _smooth_radius(yx, 26.5, lock=len7a, iters=900)
    r0, pmin, smin = minRat(yx)
    print('7B yx minR pass2', round(r0, 2), 's', round(smin, 1))

  # 7A 前缀不得扭；已建 ja/jn 不得改
  max_pref = 0.0
  for i, p in enumerate(pref):
    if i == 0:
      continue
    # 沿锁段投影偏差
    s = min(yx.project(Point(*p)), len7a)
    q = yx.interpolate(s)
    max_pref = max(max_pref, math.hypot(q.x - p[0], q.y - p[1]))
  print('7B prefix drift max', round(max_pref, 3), 'len7a', round(len7a, 2))
  if max_pref > 0.35:
    raise SystemExit(f'7B moved 7A yx prefix by {max_pref:.3f} m')
  assert g['CL']['jn'].coords[:] == jn.coords[:]
  assert g['CL']['ja'].coords[:] == ja.coords[:]
  assert A7.get('jaJnSha1') == JA_JN_SHA1

  g['CL']['yx'] = yx
  g['HW']['yx'] = HW_YX
  g['BAND']['yx'] = BAND_YX

  def at_yx(s, lat=0.0):
    s = min(max(s, 0), yx.length)
    p = yx.interpolate(s); t = _tan(yx, s); n = (t[1], -t[0])
    return (p.x + n[0] * lat, p.y + n[1] * lat), t, n

  def game_of_official(official_s):
    # official_s 是整条官方链（含 7A）的真实米
    if official_s <= raw['s0']:
      # 不应在 7B 里用 7A 段
      rp = LineString(coords).interpolate(0)
    else:
      rp = LineString(coords).interpolate(min(official_s - raw['s0'], LineString(coords).length))
    gp = scJ([(rp.x, rp.y)])[0]
    return (gp[0] + OFF[0], gp[1] + OFF[1])

  # ---- 湖面（官方环，同 OFF）----
  lake_g = [(p[0] + OFF[0], p[1] + OFF[1]) for p in scJ([tuple(p) for p in raw['lake']])]
  if math.hypot(lake_g[0][0] - lake_g[-1][0], lake_g[0][1] - lake_g[-1][1]) > 0.5:
    lake_g = lake_g + lake_g[:1]
  lakeG = Polygon(lake_g).buffer(0).simplify(0.3)
  if lakeG.geom_type != 'Polygon':
    lakeG = max(lakeG.geoms, key=lambda q: q.area)
  lakeG = Polygon(lakeG.exterior)
  g['lakeY'] = lakeG
  print('7B lake area', round(lakeG.area, 1), 'perim', round(lakeG.exterior.length, 1),
        'c', (round(lakeG.centroid.x, 2), round(lakeG.centroid.y, 2)))

  # ---- 新河道水面：从 7A 东头锁点起（含一段重叠，盖掉旧合拢尖）到湖口，并上湖面 ----
  left, right, s = [], [], max(0.0, len7a - 4.0)
  while s <= yx.length + 1e-6:
    ss = min(s, yx.length)
    p = yx.interpolate(ss); t = _tan(yx, ss); n = (t[1], -t[0])
    left.append((p.x - n[0] * HW_YX, p.y - n[1] * HW_YX))
    right.append((p.x + n[0] * HW_YX, p.y + n[1] * HW_YX))
    s += 0.8
  chanB = Polygon(left + right[::-1]).buffer(0).simplify(0.06)
  if chanB.geom_type != 'Polygon':
    chanB = max(chanB.geoms, key=lambda q: q.area)
  # 湖口与河道并上：河尾若差几米没贴上湖岸，用河口圆把它们连起来；不要 max() 把湖丢掉
  mouth = Point(yx.coords[-1]).buffer(HW_YX + 6.0)
  print('7B mouth-to-lake', round(lakeG.distance(Point(yx.coords[-1])), 2),
        'end', tuple(round(v, 2) for v in yx.coords[-1]))
  chanB = unary_union([chanB, lakeG, mouth]).buffer(0.25).buffer(-0.12)
  if chanB.geom_type == 'MultiPolygon':
    chanB = unary_union([p for p in chanB.geoms if p.area > 8])
  g['chanB'] = chanB

  # ---- 东头合拢：湖东北 7C 出水口，像 6B ----
  eo = scJ([tuple(raw['east_outlet'])])[0]
  eog = (eo[0] + OFF[0], eo[1] + OFF[1])
  od = raw['east_out_dir']
  # od 已是官方平面方向，游戏 scJ 是均匀 1:4，方向不变
  te = (od[0], od[1])
  Lte = math.hypot(*te) or 1
  te = (te[0] / Lte, te[1] / Lte)
  ne = (te[1], -te[0])
  wall_p = (eog[0] + te[0] * CAP, eog[1] + te[1] * CAP)
  capWall = {
    'x': round(wall_p[0], 2), 'z': round(wall_p[1], 2),
    'n': [round(ne[0], 4), round(ne[1], 4)],
    't': [round(te[0], 4), round(te[1], 4)],
    'thick': 1.4, 'h': 4.4, 'len': 28.0,
  }
  capP = (eog[0] + te[0] * (CAP + 10), eog[1] + te[1] * (CAP + 10))
  far = []
  for off in range(-48, 52, 12):
    q = (capP[0] + ne[0] * off, capP[1] + ne[1] * off)
    far.append([round(q[0], 2), round(q[1], 2), round(-te[0], 4), round(-te[1], 4)])
  # 环湖一圈远景楼，挡住空铺地和天际线（合拢 / 7C 口除外）
  cFar = lakeG.centroid
  ringFar = lakeG.buffer(LB + HOUSE_BAND + 4, quad_segs=6).exterior
  fl, fll = 0.0, ringFar.length
  while fl < fll - 1:
    p = ringFar.interpolate(fl)
    fl += 10.5
    if math.hypot(p.x - eog[0], p.y - eog[1]) < 22:
      continue
    fx, fz = p.x - cFar.x, p.y - cFar.y
    Lf = math.hypot(fx, fz) or 1
    far.append([round(p.x, 2), round(p.y, 2), round(-fx / Lf, 4), round(-fz / Lf, 4)])

  # 拆 7A 合拢墙 / 远景（开河）
  old_cap = A7.get('capWall') or {}
  A7['yxLen7a'] = A7['yxLen']
  A7['capWall'] = None
  A7['far'] = []
  A7['cap'] = 0
  A7['openedTo7b'] = True
  A7['note'] = (A7.get('note') or '') + '；7B 已拆东头合拢，yx 延伸至涧田湖。'

  # ---- 水面 / 区域 / 岸地 ----
  # 区域：新河道带宽 + 环湖步道 + 环湖民房带；7C 侧在合拢墙外裁掉，避免绕墙走出东头
  cap_cut = Polygon([
    (wall_p[0] + te[0] * 0.15 + ne[0] * 90, wall_p[1] + te[1] * 0.15 + ne[1] * 90),
    (wall_p[0] + te[0] * 90 + ne[0] * 90, wall_p[1] + te[1] * 90 + ne[1] * 90),
    (wall_p[0] + te[0] * 90 - ne[0] * 90, wall_p[1] + te[1] * 90 - ne[1] * 90),
    (wall_p[0] + te[0] * 0.15 - ne[0] * 90, wall_p[1] + te[1] * 0.15 - ne[1] * 90),
  ])
  regB = unary_union([
    LineString(list(yx.coords)[max(0, int(len7a / 3) - 2):]).buffer(HW_YX + BAND_YX, cap_style='flat', quad_segs=6),
    lakeG.buffer(LB + HOUSE_BAND, quad_segs=6),
  ]).simplify(0.1)
  region = unary_union([region0, regB]).buffer(0).difference(cap_cut).buffer(0)
  if region.geom_type == 'MultiPolygon':
    region = max(region.geoms, key=lambda q: q.area)
  region = Polygon(region.exterior)
  # 盖掉旧合拢尖：新水面并进。河湖若暂时不相交，必须保留湖面，绝不能只留最大面把湖丢掉。
  cLk = lakeG.centroid
  print('7B dbg lakeG', lakeG.geom_type, 'area', round(lakeG.area,1), 'c', (round(cLk.x,2), round(cLk.y,2)),
        'chanB.contains', chanB.contains(cLk), 'chanB.dist', round(chanB.distance(cLk),2),
        'chanB.type', chanB.geom_type,
        'region.contains', region.contains(cLk), 'reg.dist', round(region.distance(cLk),2),
        'region.type', region.geom_type)
  inter = chanB.intersection(region.buffer(-0.05))
  print('7B dbg inter type', inter.geom_type, 'area', round(inter.area,1), 'dist c', round(inter.distance(cLk),2))
  water = unary_union([water0, inter]).buffer(0)
  print('7B dbg water+0 type', water.geom_type, 'area', round(water.area,1), 'dist c', round(water.distance(cLk),2))
  water = water.intersection(region.buffer(-0.05)).buffer(0).simplify(0.05)
  print('7B dbg water clip type', water.geom_type, 'area', round(water.area,1), 'dist c', round(water.distance(cLk),2))
  if water.geom_type == 'MultiPolygon':
    areas=sorted((round(p.area,1) for p in water.geoms), reverse=True)[:6]
    print('7B dbg water parts', len(water.geoms), 'areas', areas)
    water = unary_union([p for p in water.geoms if p.area > 8])
  if not (water.contains(cLk) or water.distance(cLk) < 1.0):
    raise SystemExit(f'7B lake missing from water (dist={water.distance(cLk):.2f})')
  land = region.difference(water).buffer(0)
  if land.geom_type == 'MultiPolygon':
    land = unary_union([p for p in land.geoms if p.area > 4])
  g['water'], g['land'], g['region'] = water, land, region

  LAND = {k_: pack(v) for k_, v in tris_by_cell(land).items()}
  WATER = {k_: pack(v) for k_, v in tris_by_cell(water).items()}
  print('7B cells kept from 7A: land', _keep_old(LAND, land, land0, LAND0), '/', len(LAND),
        'water', _keep_old(WATER, water, water0, WATER0), '/', len(WATER))
  g['LAND'], g['WATER'] = LAND, WATER
  bnd = Polygon(BOUND0).union(regB.simplify(0.3)).difference(cap_cut).buffer(0)
  if bnd.geom_type == 'MultiPolygon':
    bnd = max(bnd.geoms, key=lambda q: q.area)
  BOUND = [[round(x, 2), round(z, 2)] for x, z in Polygon(bnd.exterior).simplify(0.3).exterior.coords]
  g['BOUND'] = BOUND

  # ---- 岸墙：丢掉旧合拢附近的 7A 新墙，沿新水面补 ----
  _wd = water.symmetric_difference(water0).buffer(0)
  def _wmid(w):
    return Point((w[0] + w[2]) / 2, (w[1] + w[3]) / 2)
  cap_pt = Point(old_cap['x'], old_cap['z']) if old_cap else Point(p0[0], p0[1])
  WALL_keep = []
  for w in WALL0:
    seg = LineString([(w[0], w[1]), (w[2], w[3])])
    if cap_pt.distance(seg) < 10.0:
      continue
    if seg.distance(_wd) <= 0.5 and cap_pt.distance(seg) < 24.0:
      continue
    WALL_keep.append(w)

  W7 = []
  def _add_ring(coords, flag=0):
    for a, b in zip(coords, coords[1:]):
      if math.hypot(b[0] - a[0], b[1] - a[1]) < 0.4:
        continue
      mx, mz = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
      dx, dz = b[0] - a[0], b[1] - a[1]
      Ls = math.hypot(dx, dz) or 1
      # w[5] 必须是 ±1（朝水）。为 0 时压顶条石骑在水线上，入湖口像砖墩伸进湖里。
      n1x, n1z = dz / Ls, -dx / Ls
      sg = 1 if water.contains(Point(mx + n1x * 0.5, mz + n1z * 0.5)) else -1
      W7.append([round(a[0], 2), round(a[1], 2), round(b[0], 2), round(b[1], 2), 0, sg])

  _wparts = [water] if water.geom_type == 'Polygon' else list(water.geoms)
  for part in _wparts:
    _add_ring(list(part.exterior.coords))
    for hole in part.interiors:
      _add_ring(list(hole.coords))
  # 只留落在新水面边缘附近的墙，避免把整圈旧湖/旧河再描一遍
  W7n = []
  for w in W7:
    mid = _wmid(w)
    if (not _wd.is_empty and _wd.buffer(1.2).intersects(LineString([(w[0], w[1]), (w[2], w[3])]))) or lakeG.exterior.distance(mid) < 1.2:
      W7n.append(w)
  W7 = merge(W7n) if W7n else []
  # 东头合拢墙写入岸墙，供 2D nav / 碰撞与 6B 一样拦住 7C
  halfL = capWall['len'] / 2
  W7.append([
    round(wall_p[0] - ne[0] * halfL, 2), round(wall_p[1] - ne[1] * halfL, 2),
    round(wall_p[0] + ne[0] * halfL, 2), round(wall_p[1] + ne[1] * halfL, 2),
    0, 1,
  ])
  # flag：沿湖步道侧是可走岸，墙是普通岸墙（flag 0 有碰撞）
  WALL = WALL_keep + W7
  g['WALL'] = WALL
  print('7B walls: kept', len(WALL_keep), '/', len(WALL0), 'new', len(W7), 'total', len(WALL))

  mnx, mnz, mxx, mxz = region.bounds
  skirt = box(mnx - 160, mnz - 160, mxx + 160, mxz + 160).difference(region)
  for extra in ('mjPoly', 'xgPoly'):
    if g.get(extra) is not None:
      skirt = skirt.difference(g[extra])
  skirt = skirt.buffer(0).simplify(1.0)
  g['SKIRT'] = pack(tris_flat(skirt))

  # ---- 桥：玄南岭路 / 西园路（分幅）/ s=1475 无名短桥（不挂牌）----
  nB0 = len(g['BR'])
  specs = []
  # 按 official_s 分组
  groups = [
    ('xuan', '玄南岭路', '玄南岭路', 'xuan',
     {'note': '玄南岭路，西段主河 primary，两幅分向', 'walk': 2.4, 'railStyle': 'xuan'}),
    ('xiyuan', '西园路', '西园路', 'xiyuan',
     {'note': '西园路 secondary 分幅，两幅不要并成一块板', 'walk': 2.6, 'railStyle': 'xiyuan'}),
    ('anon', None, None, 'anon',
     {'note': '接在涧田路主线上的无名 primary 短桥，不挂牌', 'walk': 2.2, 'railStyle': 'anon'}),
  ]
  # map json bridges into groups
  by_name = {'玄南岭路': [], '西园路': [], None: []}
  for b in raw['bridges']:
    by_name[b['name']].append(b)
  BRB = []
  for key, name, plate, style, extra in groups:
    for i, rec in enumerate(by_name[name]):
      gp = game_of_official(rec['official_s'])
      s = yx.project(Point(*gp))
      s = max(s, len7a + 8.0)
      s = min(s, yx.length - 8.0)
      # 分幅宽取跨度（约 17–24 m），略收成可走路面
      w = max(11.0, min(16.0, rec['span'] * 0.65 + 4.0))
      use_plate = plate if i == 0 else None   # 每座路只挂一块牌
      b = bridge('yx', s, w, 'road', name, plate=use_plate, ext=2.4, note=extra['note'])
      b['a7b'] = 1
      b['style'] = style
      b['railStyle'] = extra['railStyle']
      b['walk'] = extra['walk']
      b['deckY'] = 1.15 if style != 'xiyuan' else 1.22
      b['osm'] = rec['id']
      BRB.append(b)
      print('7B bridge', b['id'], name or '(unnamed)', 'style', style,
            's', round(b['s'], 1), 'w', round(b['w'], 1), 'official', rec['official_s'])

  for b in BRB:
    x, z, t, n, half, w = b['x'], b['z'], b['t'], b['n'], b['half'], b['w']
    def corners(au, cv, bb=b):
      return [(bb['x'] + bb['t'][0] * a + bb['n'][0] * c, bb['z'] + bb['t'][1] * a + bb['n'][1] * c)
              for a, c in [(-au, -cv), (au, -cv), (au, cv), (-au, cv)]]
    g['GAPS'].append(Polygon(corners(w / 2 - 0.05, half + 0.5)))
    b['foot'] = Polygon(corners(w / 2, half))

  ROADS_B = []
  for b in BRB:
    for sg in (-1, 1):
      start = b['hw'] + 2
      reach = b['hw'] + BAND_YX + 2
      if reach <= start + 1:
        continue
      ROADS_B.append({'id': b['id'] + ('e' if sg > 0 else 'w'), 'name': b['name'] or b['id'],
                      'poly': rect(b['x'], b['z'], b['n'][0] * sg, b['n'][1] * sg, start, reach, -b['w'] / 2, b['w'] / 2),
                      'dir': [b['n'][0] * sg, b['n'][1] * sg], 'w': b['w'], 'stub': True, 'a7b': True})
  g['ROADS'] = g['ROADS'] + ROADS_B
  plates = []
  PINYIN = {'玄南岭路': 'Xuannanling Rd', '西园路': 'Xiyuan Rd'}
  for b in BRB:
    if not b.get('plate'):
      continue
    px = b['x'] + b['n'][0] * (b['half'] + 1.8)
    pz = b['z'] + b['n'][1] * (b['half'] + 1.8)
    fx, fz = -b['n'][0], -b['n'][1]
    lines = [b['plate'], PINYIN.get(b['plate'], '')]
    plates.append({'x': round(px, 2), 'z': round(pz, 2), 'f': [round(fx, 4), round(fz, 4)], 'lines': lines})

  # ---- 简单广场（新闻：东、西、北休闲广场，不复刻不存在的图纸）----
  plazas = []
  cL = lakeG.centroid
  ringL = lakeG.buffer(LB * 0.55, quad_segs=6).exterior
  # 西：近入湖口；北 / 东：沿环均分且避开出水口
  mouth = Point(*yx.coords[-1])
  outletP = Point(*eog)
  cands = []
  slen = ringL.length
  for s in [i * slen / 16 for i in range(16)]:
    p = ringL.interpolate(s)
    # 要在岸上
    if lakeG.contains(p) or water.buffer(-0.4).contains(p):
      continue
    cands.append((p.x, p.y, s))
  # pick west = closest to mouth, north = max z, east = max x, skip near outlet
  def far_from_outlet(p):
    return math.hypot(p[0] - eog[0], p[1] - eog[1]) > 18
  west = min([p for p in cands if far_from_outlet(p)], key=lambda p: math.hypot(p[0] - mouth.x, p[1] - mouth.y))
  north = max([p for p in cands if far_from_outlet(p) and p[1] > cL.y], key=lambda p: p[1], default=None)
  east = max([p for p in cands if far_from_outlet(p) and p[0] > cL.x], key=lambda p: p[0], default=None)
  for tag, p in (('west', west), ('north', north), ('east', east)):
    if not p:
      continue
    # 朝向湖心
    fx, fz = cL.x - p[0], cL.y - p[1]
    L = math.hypot(fx, fz) or 1
    fx, fz = fx / L, fz / L
    plazas.append({'id': tag, 'x': round(p[0], 2), 'z': round(p[1], 2),
                   'f': [round(fx, 4), round(fz, 4)], 'w': 9.0, 'd': 7.0})

  # ---- 房子 + 树 ----
  def _hpoly0(h):
    return Polygon([(h['x'] + h['t'][0] * a + h['f'][0] * b * -1, h['z'] + h['t'][1] * a + h['f'][1] * b * -1)
                    for a, b in [(-h['w'] / 2, -h['d'] / 2), (h['w'] / 2, -h['d'] / 2), (h['w'] / 2, h['d'] / 2), (-h['w'] / 2, d_ / 2)]]) if False else Polygon(
      [(h['x'] + h['t'][0] * a + h['f'][0] * b * -1, h['z'] + h['t'][1] * a + h['f'][1] * b * -1)
       for a, b in [(-h['w'] / 2, -h['d'] / 2), (h['w'] / 2, -h['d'] / 2), (h['w'] / 2, h['d'] / 2), (-h['w'] / 2, h['d'] / 2)]])

  occ_geoms = [r['poly'].buffer(0.4) for r in ROADS_B] + [b['foot'].buffer(1.0) for b in BRB]
  occ_geoms.append(Point(*eog).buffer(16))
  occ_geoms.append(Point(*yx.coords[-1]).buffer(8))
  for pl in plazas:
    occ_geoms.append(Point(pl['x'], pl['z']).buffer(6))
  HOUSES, TREES = g['HOUSES'], g['TREES']
  occ = unary_union(occ_geoms + [_hpoly0(h).buffer(0.4) for h in HOUSES if not h.get('gone')] or [Point(0, 0)])
  R7 = random.Random(724)
  nH0 = len(HOUSES)

  def _try_house(s, side, off_extra, w_, d_, h_, lod=None):
    nonlocal occ
    off = HW_YX + off_extra + d_ / 2
    (cx, cz), tdir, nn = at_yx(min(yx.length - 2, max(len7a + 4, s + w_ / 2)), side * off)
    poly = Polygon([(cx + tdir[0] * a + nn[0] * side * b, cz + tdir[1] * a + nn[1] * side * b)
                    for a, b in [(-w_ / 2, -d_ / 2), (w_ / 2, -d_ / 2), (w_ / 2, d_ / 2), (-w_ / 2, d_ / 2)]])
    if not region.buffer(-0.05).contains(poly) or poly.intersects(occ) or poly.intersects(water.buffer(0.8)):
      return False
    if s < len7a + 2:
      return False
    occ = occ.union(poly.buffer(0.25))
    rec = {'x': round(cx, 2), 'z': round(cz, 2), 'w': round(w_, 2), 'd': round(d_, 2),
           't': [round(tdir[0], 4), round(tdir[1], 4)], 'f': [round(-nn[0] * side, 4), round(-nn[1] * side, 4)],
           'river': 'yx', 'h': h_, 'kind': 'old', 'ry': round(math.atan2(tdir[0], tdir[1]), 4),
           'back': True, 'a7b': True}
    if lod:
      rec['lod'] = lod
    HOUSES.append(rec)
    return True

  s = len7a + 14
  while s < yx.length - 12:
    for side in (-1, 1):
      if R7.random() < 0.22:
        continue
      w_ = R7.uniform(6.5, 9.5); d_ = R7.uniform(5.5, 8.0); h_ = R7.uniform(6.5, 10.5)
      _try_house(s, side, R7.uniform(2.2, 5.5), w_, d_, h_, lod=2 if R7.random() < 0.35 else None)
    s += R7.uniform(11, 16)

  # 环湖一圈外侧房子（步道外的民房带，看得见，不挡环湖步道）
  ringH = lakeG.buffer(LB + 1.8, quad_segs=6).exterior
  hs, sh = 0.0, ringH.length
  nH1 = len(HOUSES)
  while hs < sh - 1:
    p = ringH.interpolate(hs)
    q = ringH.interpolate((hs + 2) % sh)
    tdir = (q.x - p.x, q.y - p.y)
    L = math.hypot(*tdir) or 1
    tdir = (tdir[0] / L, tdir[1] / L)
    fx, fz = p.x - cL.x, p.y - cL.y
    Lf = math.hypot(fx, fz) or 1
    fx, fz = fx / Lf, fz / Lf
    w_, d_, h_ = R7.uniform(7.2, 9.2), R7.uniform(5.8, 7.4), R7.uniform(7, 11)
    cx, cz = p.x + fx * (d_ / 2 + 0.6), p.y + fz * (d_ / 2 + 0.6)
    poly = Polygon([(cx + tdir[0] * a + fx * b, cz + tdir[1] * a + fz * b)
                    for a, b in [(-w_ / 2, -d_ / 2), (w_ / 2, -d_ / 2), (w_ / 2, d_ / 2), (-w_ / 2, d_ / 2)]])
    hs += R7.uniform(8, 11)
    if not region.buffer(-0.05).contains(poly) or poly.intersects(occ) or poly.intersects(water.buffer(1.0)):
      continue
    if math.hypot(cx - eog[0], cz - eog[1]) < 18:
      continue
    occ = occ.union(poly.buffer(0.25))
    HOUSES.append({'x': round(cx, 2), 'z': round(cz, 2), 'w': round(w_, 2), 'd': round(d_, 2),
                   't': [round(tdir[0], 4), round(tdir[1], 4)], 'f': [round(-fx, 4), round(-fz, 4)],
                   'river': 'yx', 'h': h_, 'kind': 'old', 'ry': round(math.atan2(tdir[0], tdir[1]), 4),
                   'back': True, 'a7b': True, 'lod': 2})
  # 再向外一圈，把北岸 / 广场外的空铺地填上
  ringH2 = lakeG.buffer(LB + 8.5, quad_segs=6).exterior
  hs2, sh2 = 4.0, ringH2.length
  while hs2 < sh2 - 1:
    p = ringH2.interpolate(hs2)
    q = ringH2.interpolate((hs2 + 2) % sh2)
    tdir = (q.x - p.x, q.y - p.y)
    L = math.hypot(*tdir) or 1
    tdir = (tdir[0] / L, tdir[1] / L)
    fx, fz = p.x - cL.x, p.y - cL.y
    Lf = math.hypot(fx, fz) or 1
    fx, fz = fx / Lf, fz / Lf
    w_, d_, h_ = R7.uniform(7.0, 9.0), R7.uniform(5.6, 7.2), R7.uniform(8, 12)
    cx, cz = p.x + fx * (d_ / 2 + 0.5), p.y + fz * (d_ / 2 + 0.5)
    poly = Polygon([(cx + tdir[0] * a + fx * b, cz + tdir[1] * a + fz * b)
                    for a, b in [(-w_ / 2, -d_ / 2), (w_ / 2, -d_ / 2), (w_ / 2, d_ / 2), (-w_ / 2, d_ / 2)]])
    hs2 += R7.uniform(9, 13)
    if not region.buffer(-0.05).contains(poly) or poly.intersects(occ) or poly.intersects(water.buffer(1.0)):
      continue
    if math.hypot(cx - eog[0], cz - eog[1]) < 20:
      continue
    occ = occ.union(poly.buffer(0.25))
    HOUSES.append({'x': round(cx, 2), 'z': round(cz, 2), 'w': round(w_, 2), 'd': round(d_, 2),
                   't': [round(tdir[0], 4), round(tdir[1], 4)], 'f': [round(-fx, 4), round(-fz, 4)],
                   'river': 'yx', 'h': h_, 'kind': 'old', 'ry': round(math.atan2(tdir[0], tdir[1]), 4),
                   'back': True, 'a7b': True, 'lod': 2})
  print('7B houses', len(HOUSES) - nH0, 'river', nH1 - nH0, 'lake-ring', len(HOUSES) - nH1)

  nT0 = len(TREES)
  # 新河岸树
  s = len7a + 8
  while s < yx.length - 4:
    for side in (-1, 1):
      off = HW_YX + 3.2
      (x, z), tdir, nn = at_yx(s, side * off)
      P_ = Point(x, z)
      if region.contains(P_) and not water.buffer(0.8).contains(P_) and all(math.hypot(x - t[0], z - t[1]) > 4.2 for t in TREES if t[5] != 'gone'):
        TREES.append([round(x, 2), round(z, 2), round(-nn[0] * side, 3), round(-nn[1] * side, 3),
                      round(R7.uniform(0.85, 1.15), 2), 'yx', 1])
    s += 7.5
  # 环湖树：铺在步道外沿（不挡环湖走线，不进前景树干那么近）
  ringT = lakeG.buffer(LB + 1.1, quad_segs=6).exterior
  ts, tl = 0.0, ringT.length
  while ts < tl - 1:
    p = ringT.interpolate(ts)
    fx, fz = p.x - cL.x, p.y - cL.y
    L = math.hypot(fx, fz) or 1
    fx, fz = fx / L, fz / L
    x, z = p.x, p.y
    P_ = Point(x, z)
    ts += 5.4
    if not region.contains(P_) or water.buffer(0.8).contains(P_):
      continue
    if math.hypot(x - eog[0], z - eog[1]) < 12:
      continue
    if any(math.hypot(x - t[0], z - t[1]) < 4.2 for t in TREES if t[5] != 'gone'):
      continue
    TREES.append([round(x, 2), round(z, 2), round(fx, 3), round(fz, 3),
                  round(R7.uniform(0.8, 1.15), 2), 'yx', 1])
  # 合拢墙前一排树（靠湖一侧，像 6B）；合拢处 region 较窄，多试几个退距
  ncapT = 0
  for off in range(-10, 12, 5):
    placed = False
    for back in (3.0, 4.4, 6.0, 7.5):
      q = (wall_p[0] - te[0] * back + ne[0] * off, wall_p[1] - te[1] * back + ne[1] * off)
      P_ = Point(*q)
      if water.buffer(0.6).contains(P_):
        continue
      if not (region.contains(P_) or (hasattr(g.get('land'), 'contains') and g['land'].contains(P_))):
        # land may not be assigned yet in some paths; region is the walkable envelope
        if not region.buffer(1.0).contains(P_):
          continue
      if any(math.hypot(q[0] - t[0], q[1] - t[1]) < 3.4 for t in TREES if t[5] != 'gone'):
        continue
      TREES.append([round(q[0], 2), round(q[1], 2), round(-te[0], 3), round(-te[1], 3),
                    round(0.95 + (abs(off) % 4) * 0.04, 2), 'yx', 1])
      ncapT += 1
      placed = True
      break
  print('7B cap trees', ncapT)
  print('7B trees', len(TREES) - nT0)

  # 新水面 / 路面压到的旧楼树撤掉（不含 7A/6B 标记的，除非压进新水面）
  _newW = water.difference(water0).buffer(0)
  _roadU = unary_union([r['poly'] for r in ROADS_B] or [Point(0, 0)])
  GONE_H, GONE_T = [], []
  for i, h in enumerate(HOUSES):
    if h.get('gone') or h.get('a6') or h.get('a6b'):
      continue
    poly = _hpoly0(h)
    aw = poly.intersection(_newW).area if not _newW.is_empty else 0.0
    ar = poly.intersection(_roadU).area
    if aw > 4.0 or ar > 6.0:
      HOUSES[i]['gone'] = '7B'; GONE_H.append(i)
  for i, t in enumerate(TREES):
    if t[5] in ('gone',):
      continue
    P_ = Point(t[0], t[1])
    if (not _newW.is_empty and _newW.buffer(1.2).contains(P_)) or _roadU.buffer(0.4).contains(P_):
      TREES[i][5] = 'gone'; GONE_T.append(i)
  print('7B gone houses', len(GONE_H), 'trees', len(GONE_T))

  # ---- 机位：环湖多点 + 有名桥 + 入湖口，不进房、前景无树干 ----
  def cam_at(x, z, look, y=1.6, pitch=0.08, note=''):
    return {'x': round(x, 2), 'z': round(z, 2), 'y': y,
            'look': [round(look[0], 2), look[1] if len(look) > 2 else 1.0, round(look[2] if len(look) > 2 else look[1], 2)] if len(look) == 3
            else [round(look[0], 2), 1.0, round(look[1], 2)],
            'pitch': pitch, 'note': note}

  # 入湖口：站在西南岸，朝湖
  mouth = yx.coords[-1]
  (mx, mz), mt, mn = at_yx(yx.length - 4, HW_YX + 3.8)
  camMouth = cam_at(mx, mz, (cL.x, 1.0, cL.y), y=1.7, pitch=0.06, note='西段主河入湖口，朝湖面')
  # 环湖：西 / 北 / 东广场外 4 m 朝湖心；再加南岸一点
  cams = {'mouth': camMouth}
  for pl in plazas:
    fx, fz = pl['f']
    cams['plaza_' + pl['id']] = cam_at(pl['x'] - fx * 3.2, pl['z'] - fz * 3.2,
                                       (cL.x, 0.8, cL.y), y=1.55, pitch=0.05,
                                       note=f"涧田湖{pl['id']}广场朝湖")
  # 南岸（入湖口对侧偏南）
  south = min([(p.x, p.y) for p in [lakeG.buffer(LB * 0.4).exterior.interpolate(i * lakeG.exterior.length / 12) for i in range(12)]],
              key=lambda p: p[1])
  cams['south'] = cam_at(south[0], south[1], (cL.x, 0.8, cL.y), y=1.55, pitch=0.05, note='涧田湖南岸朝湖')
  # 有名桥侧拍（不进房）
  for b in BRB:
    if b.get('style') == 'xuan' and b.get('plate'):
      sx = b['x'] + b['t'][0] * 18 + b['n'][0] * 16
      sz = b['z'] + b['t'][1] * 18 + b['n'][1] * 16
      cams['xuan'] = cam_at(sx, sz, (b['x'], 1.2, b['z']), y=1.6, pitch=0.08, note='玄南岭路')
    if b.get('style') == 'xiyuan' and b.get('plate'):
      sx = b['x'] + b['t'][0] * 20 + b['n'][0] * 18
      sz = b['z'] + b['t'][1] * 20 + b['n'][1] * 18
      cams['xiyuan'] = cam_at(sx, sz, (b['x'], 1.2, b['z']), y=1.6, pitch=0.08, note='西园路分幅')
    if b.get('style') == 'anon' and 'anon' not in cams:
      sx = b['x'] + b['t'][0] * 16 + b['n'][0] * 14
      sz = b['z'] + b['t'][1] * 16 + b['n'][1] * 14
      cams['anon'] = cam_at(sx, sz, (b['x'], 1.2, b['z']), y=1.6, pitch=0.08, note='无名 primary 短桥（无牌）')
  # 合拢墙外看口
  cams['cap'] = cam_at(eog[0] - te[0] * 16 + ne[0] * 2, eog[1] - te[1] * 16 + ne[1] * 2,
                       (wall_p[0], 2.0, wall_p[1]), y=1.7, pitch=0.08, note='涧田湖东头合拢墙')

  cams_xz = [(c['x'], c['z']) for c in cams.values()]
  for i, tr in enumerate(TREES):
    if tr[5] in ('gone',):
      continue
    if any(math.hypot(tr[0] - cx, tr[1] - cz) < 8.5 for cx, cz in cams_xz):
      TREES[i][5] = 'gone'
      continue
    # 西园路等第一人称机位：视线锥里 2–20 m、横向 3.4 m 内的树干会挡画面。合拢墙前那排树要入画，不算。
    if math.hypot(tr[0] - wall_p[0], tr[1] - wall_p[1]) < 10:
      continue
    for nm, c in cams.items():
      if nm not in ('xuan', 'xiyuan', 'anon', 'mouth'):
        continue
      lx = c['look'][0] - c['x']; lz = c['look'][2] - c['z']
      Ln = math.hypot(lx, lz) or 1
      lx, lz = lx / Ln, lz / Ln
      dx, dz = tr[0] - c['x'], tr[1] - c['z']
      along = dx * lx + dz * lz
      side = dx * lz - dz * lx
      if 1.5 <= along <= 20.0 and abs(side) <= 3.4:
        TREES[i][5] = 'gone'
        break

  def _hpoly_chk(h):
    cx, cz, w_, d_, tx, tz, fx, fz = h['x'], h['z'], h['w'], h['d'], h['t'][0], h['t'][1], h['f'][0], h['f'][1]
    return Polygon([(cx + tx * a + (-fx) * b, cz + tz * a + (-fz) * b)
                    for a, b in [(-w_ / 2, -d_ / 2), (w_ / 2, -d_ / 2), (w_ / 2, d_ / 2), (-w_ / 2, d_ / 2)]])
  for _nm, _cam in cams.items():
    Pcam = Point(_cam['x'], _cam['z'])
    hit = [h for h in HOUSES if not h.get('gone') and _hpoly_chk(h).contains(Pcam)]
    if hit:
      print('WARN cam inside house', _nm, (_cam['x'], _cam['z']))
      # 推到最近的岸上
      for h in hit:
        h['gone'] = '7Bcam'
    else:
      print('7B cam clear', _nm, (_cam['x'], _cam['z']))

  # 环湖灯位（并进细节格子，不新加 draw）
  lamps = []
  ringLamp = lakeG.buffer(LB + 0.8, quad_segs=6).exterior
  ls, ll = 0.0, ringLamp.length
  while ls < ll - 1:
    p = ringLamp.interpolate(ls)
    q = ringLamp.interpolate((ls + 2) % ll)
    tdir = (q.x - p.x, q.y - p.y)
    L = math.hypot(*tdir) or 1
    lamps.append([round(p.x, 2), round(p.y, 2), round(tdir[0] / L, 3), round(tdir[1] / L, 3)])
    ls += 22.0

  # 环湖步道采样（e2e / nav 双向走线，避开出水口合拢）
  loop = []
  ringLoop = lakeG.buffer(max(2.4, LB * 0.45), quad_segs=6).exterior
  nL = 16
  for i in range(nL):
    p = ringLoop.interpolate(i * ringLoop.length / nL)
    if math.hypot(p.x - eog[0], p.y - eog[1]) < 6:
      continue
    if (not region.contains(p)) or water.buffer(0.6).contains(p):
      continue
    loop.append([round(p.x, 2), round(p.y, 2)])
  capBank = [round(wall_p[0] - te[0] * 3.6, 2), round(wall_p[1] - te[1] * 3.6, 2)]
  if (not region.contains(Point(*capBank))) or water.buffer(0.5).contains(Point(*capBank)):
    for sgn in (1, -1, 2, -2, 3, -3):
      q = (wall_p[0] - te[0] * 3.6 + ne[0] * 2.8 * sgn,
           wall_p[1] - te[1] * 3.6 + ne[1] * 2.8 * sgn)
      if region.contains(Point(*q)) and not water.buffer(0.5).contains(Point(*q)):
        capBank = [round(q[0], 2), round(q[1], 2)]
        break
  capPast = [round(wall_p[0] + te[0] * 14.0, 2), round(wall_p[1] + te[1] * 14.0, 2)]

  g['HOUSES'], g['TREES'] = HOUSES, TREES
  bbox = list(unary_union([chanB.buffer(BAND_YX + 20), lakeG.buffer(LB + 40)]).bounds)
  # 扩 7A zone，让 g7day 覆盖 7B（夜关掉白天水纹，夜 ≤ 昼）
  z0 = A7.get('zone') or bbox
  A7['zone'] = [round(min(z0[0], bbox[0]), 1), round(min(z0[1], bbox[1]), 1),
                round(max(z0[2], bbox[2]), 1), round(max(z0[3], bbox[3]), 1)]

  A7BDATA = {
    'yxLen7a': round(len7a, 2),
    'yxLen': round(yx.length, 2),
    'official': {'start': raw['s0'], 'end': raw['s1'], 'real': raw['river_length'],
                 'game': round(yx.length - len7a, 2),
                 'lakePerim': raw['lake_perim'], 'lakeArea': raw['lake_area']},
    'hw': HW_YX, 'lakeBand': LB, 'cap': CAP,
    'off': list(OFF),
    'lake': {'zh': '涧田湖', 'en': 'Jiantian Lake',
             'c': [round(cL.x, 2), round(cL.y, 2)],
             'ring': [v for x, z in list(lakeG.exterior.coords)[:-1] for v in (round(x, 2), round(z, 2))],
             'band': LB},
    'plazas': plazas,
    'bridges': [b['id'] for b in BRB],
    'plates': plates,
    'byStyle': {st: [b['id'] for b in BRB if b.get('style') == st] for st in ('xuan', 'xiyuan', 'anon')},
    'far': far, 'capWall': capWall, 'outlet': [round(eog[0], 2), round(eog[1], 2)],
    'lamps': lamps,
    'loop': loop, 'capBank': capBank, 'capPast': capPast,
    'cams': cams,
    'zone': [round(v, 1) for v in bbox],
    'gone': {'houses': GONE_H, 'trees': GONE_T},
    'jaJnSha1': JA_JN_SHA1,
    'note': '7B：西段主河自 7A 合拢延伸至涧田湖，环湖可走；s=1475 无名短桥不挂牌；东头在湖东北出水口合拢；未做涧田湖水闸',
  }
  g['A7BDATA'] = A7BDATA
  print('7B zone', A7BDATA['zone'], 'yxLen', A7BDATA['yxLen'], 'added', A7BDATA['official']['game'],
        'bridges', A7BDATA['bridges'], 'plazas', [p['id'] for p in plazas])
