# 福州内河 8A：打开 3B 凤坂河北头封口，连接段入湖，南半湖水面 + 南岸环湖，3号码头，福新东路西幅桥。
# 用法：由 gen_e.py 在 A7C 之后调用 a8a.build_south(globals())。
# 西侧游憩岛 / 茶香路桥 / 摩天轮 / 1·2号码头 / 化工河 均不在 8A。
from __future__ import annotations

import json, math, os
from shapely.geometry import LineString, Polygon, Point, box, MultiPolygon
from shapely.ops import unary_union, substring

HERE = os.path.dirname(os.path.abspath(__file__))
TRACE = os.path.join(HERE, 'ja8a', 'ja_lake_trace.json')

# 8A 裁切（游戏米）：东/南主湖盆 + 入湖渠；西汊（游憩岛、茶香路）与北岸（摩天轮、1号）留给 8B
X_WEST, X_EAST = 922.0, 1145.0
Z_SOUTH, Z_NORTH = -250.0, -20.0
LB = 6.5          # 南岸环湖步道宽（游戏米，1:1）
HOUSE_BAND = 16.0
CANAL_Z_FOOT = -161.0   # 入湖渠中段无名便桥大约位置，以南要收顺
TREE_INSET = 1.1        # 湖岸（非渠）向内收，避免水伸进树冠
LAT0, LON0 = 26.0890606, 119.2945129
K = 4.0
MR = (4484.3, -2856.1)
AG = (1003.94, -711.88)


def P_ll(lat, lon):
  return ((lon - LON0) * 111320 * math.cos(math.radians(LAT0)),
          (lat - LAT0) * 110574)


def real_to_game(x, z):
  return (AG[0] + (x - MR[0]) / K, AG[1] + (z - MR[1]) / K)


def ll_game(lat, lon):
  return real_to_game(*P_ll(lat, lon))


def ring_game(coords):
  pts = [tuple(p[:2]) if not isinstance(p[0], (int, float)) or len(p) == 2 else tuple(p)
         for p in coords]
  # already game_m in the json
  return pts


def as_poly(ring):
  pts = [tuple(p[:2]) for p in ring]
  if math.hypot(pts[0][0] - pts[-1][0], pts[0][1] - pts[-1][1]) > 0.2:
    pts = pts + pts[:1]
  g = Polygon(pts).buffer(0)
  if g.is_empty:
    return None
  if g.geom_type == 'MultiPolygon':
    g = max(g.geoms, key=lambda q: q.area)
  return g


def _tan(line, s):
  s = min(max(s, 0.0), line.length)
  a0 = max(0.0, min(s - 1.0, line.length - 2.0))
  a = line.interpolate(a0); b = line.interpolate(a0 + 2.0)
  L = math.hypot(b.x - a.x, b.y - a.y) or 1.0
  return ((b.x - a.x) / L, (b.y - a.y) / L)


def build_south(g):
  pack, tris_by_cell, tris_flat = g['pack'], g['tris_by_cell'], g['tris_flat']
  _keep_old, ext, merge, chaikin = g['_keep_old'], g['ext'], g['merge'], g['chaikin']
  bridge, rect, at_s = g['bridge'], g['rect'], g['at_s']
  Point_ = g.get('Point') or Point
  water0, region0, land0 = g['water'], g['region'], g['land']
  LAND0, WATER0, WALL0, BOUND0 = g['LAND'], g['WATER'], g['WALL'], g['BOUND']
  HW, BAND, NAME, CL = g['HW'], g['BAND'], g['NAME'], g['CL']
  BR, ROADS, HOUSES, TREES = g['BR'], g['ROADS'], g['HOUSES'], g['TREES']
  GAPS = g['GAPS']
  WY = g['WY']

  raw = json.load(open(TRACE))
  feat = raw['features']
  main = as_poly(raw['main_shore']['game_m'])
  if main is None:
    raise SystemExit('8A: main shore polygon failed')
  # holes that fall in 8A (west-arm holes are outside the clip anyway)
  holes = []
  for h in raw.get('islands_as_holes') or []:
    hp = as_poly(h['game_m'])
    if hp is not None and hp.centroid.x >= X_WEST and hp.centroid.y <= Z_NORTH:
      holes.append(hp)
  if holes:
    main = main.difference(unary_union(holes)).buffer(0)

  clip = box(X_WEST, Z_SOUTH, X_EAST, Z_NORTH)
  lake8 = main.intersection(clip).buffer(0)
  if lake8.is_empty:
    raise SystemExit('8A: clip emptied the lake')
  if lake8.geom_type == 'MultiPolygon':
    lake8 = unary_union([p for p in lake8.geoms if p.area > 20])

  # ---- 入湖渠南段（便桥以南）按中线收成一致宽度 ----
  canal_box = box(970.0, -235.0, 1035.0, -118.0)  # 只到福新东路南沿，不要挖掉入湖口
  canal_part = lake8.intersection(canal_box).buffer(0)
  # 目标宽度：便桥以北已按影像收束的一段
  probe = box(970.0, CANAL_Z_FOOT + 4.0, 1035.0, CANAL_Z_FOOT + 18.0)
  sample = lake8.intersection(probe)
  target_hw = 12.0  # fallback = fb
  if not sample.is_empty:
    # 横向跨度 / 2
    minx, minz, maxx, maxz = sample.bounds
    span = maxx - minx
    if 8.0 < span < 28.0:
      target_hw = span * 0.48
  print('8A canal target hw', round(target_hw, 2))

  # 中线：从接缝到福新东路西幅，沿渠走廊取各 z 切片中心
  seam = feat['fb_north_seam']['game_m']
  fxw = feat['fuxin_west']['game_m']
  cl_pts = []
  z = -228.5
  while z <= -108.0:
    sl = lake8.intersection(box(960.0, z - 1.2, 1040.0, z + 1.2))
    if not sl.is_empty:
      minx, _, maxx, _ = sl.bounds
      cl_pts.append(((minx + maxx) / 2.0, z))
    z += 3.0
  # 保证接上接缝与桥位
  cl_pts = [tuple(seam)] + cl_pts + [tuple(fxw)]
  # 去重、按 z 排
  uniq = []
  for p in sorted(cl_pts, key=lambda q: q[1]):
    if not uniq or math.hypot(p[0] - uniq[-1][0], p[1] - uniq[-1][1]) > 1.0:
      uniq.append(p)
  if len(uniq) < 3:
    raise SystemExit('8A: canal centerline too short')
  cl = LineString(chaikin(uniq, 2)).simplify(0.2)

  # 南段（便桥以南，含接缝）盖一致宽度；北段（便桥到桥）也用同一 hw，使全段一致
  left, right, s = [], [], 0.0
  while s <= cl.length + 1e-6:
    ss = min(s, cl.length)
    p = cl.interpolate(ss); t = _tan(cl, ss); n = (t[1], -t[0])
    left.append((p.x - n[0] * target_hw, p.y - n[1] * target_hw))
    right.append((p.x + n[0] * target_hw, p.y + n[1] * target_hw))
    s += 0.8
  chan = Polygon(left + right[::-1]).buffer(0).simplify(0.08)
  if chan.geom_type != 'Polygon':
    chan = max(chan.geoms, key=lambda q: q.area)

  # 湖面：渠走廊用新渠面替换（去掉锯齿/过宽），其它湖岸向内收避免伸进树冠
  lake_only = lake8.difference(canal_box.buffer(2.0)).buffer(0)
  if not lake_only.is_empty:
    lake_only = lake_only.buffer(-TREE_INSET).buffer(TREE_INSET * 0.15).buffer(0)
    if lake_only.geom_type == 'MultiPolygon':
      lake_only = unary_union([p for p in lake_only.geoms if p.area > 30])
  # 半岛保持陆地：若 inset 把腰切断，用半岛多边形再挖一次
  pen_ll = (raw.get('peninsula') or {}).get('wgs84') or []
  penG = None
  if len(pen_ll) >= 4:
    penG = as_poly([ll_game(lat, lon) for lat, lon in pen_ll])
    if penG is not None:
      penG = penG.buffer(0.4)

  water_new = unary_union([p for p in [chan, lake_only] if p is not None and not p.is_empty]).buffer(0.2).buffer(-0.05)
  # 入湖口：渠北端与南半湖必须连通（路北西渠 + 湖面）
  mouth_north = Point(fxw[0], fxw[1] + 8.0).buffer(target_hw + 6.0)
  water_new = unary_union([water_new, chan, mouth_north]).buffer(0.4).buffer(-0.15)
  if penG is not None:
    water_new = water_new.difference(penG).buffer(0)

  # 接缝：与 3B fb 已建水面严丝合缝。fb 半宽 12 m，用短喇叭过渡到渠宽。
  fb = CL['fb']
  (fx0, fz0), ft0, fn0 = at_s('fb', 0.0)
  # fb t 指向下游（南）；向北是 -t
  nx, nz = -ft0[0], -ft0[1]   # 向北进渠
  hw0, hw1, Ltr = HW['fb'], target_hw, 16.0
  flare_pts_l, flare_pts_r = [], []
  for i in range(9):
    u = i / 8.0
    hw = hw0 * (1 - u) + hw1 * u
    px, pz = fx0 + nx * (u * Ltr), fz0 + nz * (u * Ltr)
    # n 与向北垂直
    rx, rz = -nz, nx
    flare_pts_l.append((px - rx * hw, pz - rz * hw))
    flare_pts_r.append((px + rx * hw, pz + rz * hw))
  flare = Polygon(flare_pts_l + flare_pts_r[::-1]).buffer(0)
  mouth = Point(fx0, fz0).buffer(HW['fb'] + 1.5)
  water_new = unary_union([water_new, flare, mouth, chan]).buffer(0)

  # 再裁到 8A（化工河 / 西汊 / 北岸不进入）
  # 接缝在 clip 南缘附近，确保接缝缓冲区留下
  clip2 = box(X_WEST, Z_SOUTH - 8.0, X_EAST, Z_NORTH)
  water_new = water_new.intersection(clip2).buffer(0)
  if water_new.geom_type == 'MultiPolygon':
    water_new = unary_union([p for p in water_new.geoms if p.area > 15])
  water_new = water_new.simplify(0.12).buffer(0)
  print('8A water_new area', round(water_new.area, 1), 'type', water_new.geom_type, 'parts', (len(water_new.geoms) if water_new.geom_type=='MultiPolygon' else 1))

  # ---- 并上旧水面，打开封口 ----
  water = unary_union([water0, water_new]).buffer(0).simplify(0.08)
  if water.geom_type == 'MultiPolygon':
    water = unary_union([p for p in water.geoms if p.area > 8])
  # 区域：新水面 + 岸带 + 步道；西/北在裁切外收掉，避免走出 8A
  regB = unary_union([
    water_new.buffer(LB + HOUSE_BAND, quad_segs=6),
    chan.buffer(BAND.get('fb', 22.0), cap_style='flat', quad_segs=6),
  ]).buffer(0)
  # 不要把可走范围扩到 8B / 化工河
  regB = regB.intersection(box(X_WEST - 8.0, Z_SOUTH - 10.0, X_EAST + 20.0, Z_NORTH + 8.0)).buffer(0)
  region = unary_union([region0, regB]).buffer(0)
  if region.geom_type == 'MultiPolygon':
    region = max(region.geoms, key=lambda q: q.area)
  water = water.intersection(region.buffer(-0.05)).buffer(0)
  if penG is not None:
    water = water.difference(penG).buffer(0)
  if water.geom_type == 'MultiPolygon':
    water = unary_union([p for p in water.geoms if p.area > 8])
  land = region.difference(water).buffer(0)
  if land.geom_type == 'MultiPolygon':
    land = unary_union([p for p in land.geoms if p.area > 4])
  g['water'], g['land'], g['region'] = water, land, region

  LAND = {k_: pack(v) for k_, v in tris_by_cell(land).items()}
  WATER = {k_: pack(v) for k_, v in tris_by_cell(water).items()}
  print('8A cells kept: land', _keep_old(LAND, land, land0, LAND0), '/', len(LAND),
        'water', _keep_old(WATER, water, water0, WATER0), '/', len(WATER))
  g['LAND'], g['WATER'] = LAND, WATER

  # BOUND
  bnd = Polygon(BOUND0).union(regB.simplify(0.3)).buffer(0)
  if bnd.geom_type == 'MultiPolygon':
    bnd = max(bnd.geoms, key=lambda q: q.area)
  BOUND = [[round(x, 2), round(z, 2)] for x, z in Polygon(bnd.exterior).simplify(0.4).exterior.coords]
  g['BOUND'] = BOUND

  # ---- 岸墙：丢掉旧 flag 2 封口，沿新水面补 ----
  _wd = water.symmetric_difference(water0).buffer(0)
  def _wmid(w):
    return Point((w[0] + w[2]) / 2, (w[1] + w[3]) / 2)
  WALL_keep = []
  for w in WALL0:
    seg = LineString([(w[0], w[1]), (w[2], w[3])])
    # 打开 3B 北头 flag 2 封口
    if len(w) > 4 and w[4] == 2 and math.hypot(_wmid(w).x - fx0, _wmid(w).y - fz0) < HW['fb'] + 8:
      continue
    if (not _wd.is_empty) and seg.distance(_wd) <= 0.5:
      continue
    WALL_keep.append(w)

  W8 = []
  def _add_ring(coords):
    pts = [(float(p[0]), float(p[1])) for p in coords]
    if len(pts) < 2:
      return
    cleaned = [pts[0]]
    for q in pts[1:]:
      if math.hypot(q[0] - cleaned[-1][0], q[1] - cleaned[-1][1]) >= 0.45:
        cleaned.append(q)
    if len(cleaned) < 2:
      return
    if math.hypot(cleaned[-1][0] - cleaned[0][0], cleaned[-1][1] - cleaned[0][1]) < 0.45:
      cleaned[-1] = cleaned[0]
    elif math.hypot(pts[0][0] - pts[-1][0], pts[0][1] - pts[-1][1]) < 1e-6:
      cleaned.append(cleaned[0])
    for a, b in zip(cleaned, cleaned[1:]):
      mx, mz = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
      dx, dz = b[0] - a[0], b[1] - a[1]
      Ls = math.hypot(dx, dz) or 1
      n1x, n1z = dz / Ls, -dx / Ls
      sg = 1 if water.contains(Point(mx + n1x * 0.5, mz + n1z * 0.5)) else -1
      W8.append([round(a[0], 2), round(a[1], 2), round(b[0], 2), round(b[1], 2), 0, sg])

  _wparts = [water] if water.geom_type == 'Polygon' else list(water.geoms)
  for part in _wparts:
    _add_ring(list(part.exterior.coords))
    for hole in part.interiors:
      _add_ring(list(hole.coords))
  W8n = []
  for w in W8:
    seg = LineString([(w[0], w[1]), (w[2], w[3])])
    if not _wd.is_empty and _wd.buffer(1.2).intersects(seg):
      W8n.append(w)
  W8 = merge(W8n) if W8n else []
  print('8A new walls before caps', len(W8))

  # ---- 临时合拢墙：西裁（通西汊）与北裁（通北半湖）----
  caps = []
  def add_cap_on(line_a, line_b, name):
    # 在裁切边上找与水面相交的最长段，放合拢墙
    edge = LineString([line_a, line_b])
    hit = edge.intersection(water.buffer(1.2))
    geoms = []
    if not hit.is_empty:
      if hit.geom_type == 'LineString':
        geoms = [hit]
      elif hit.geom_type == 'MultiLineString':
        geoms = list(hit.geoms)
      elif hit.geom_type in ('GeometryCollection', 'MultiPoint'):
        geoms = [gg for gg in getattr(hit, 'geoms', []) if gg.geom_type == 'LineString']
    if not geoms:
      # 退路：取沿该边 1.5 m 内的水面，用外包框当段
      band = edge.buffer(2.0)
      chunk = water.intersection(band)
      if chunk.is_empty:
        print('8A cap skip (no water)', name)
        return
      minx, minz, maxx, maxz = chunk.bounds
      if abs(line_a[0] - line_b[0]) < abs(line_a[1] - line_b[1]):
        # 竖边
        geoms = [LineString([(line_a[0], minz), (line_a[0], maxz)])]
      else:
        geoms = [LineString([(minx, line_a[1]), (maxx, line_a[1])])]
    if not geoms:
      print('8A cap skip (empty geoms)', name)
      return
    seg = max(geoms, key=lambda q: q.length)
    if seg.length < 2.0:
      print('8A cap skip (short)', name, round(seg.length, 2))
      return
    (x0, z0) = seg.coords[0]; (x1, z1) = seg.coords[-1]
    mx, mz = (x0 + x1) / 2, (z0 + z1) / 2
    tx, tz = x1 - x0, z1 - z0
    L = math.hypot(tx, tz) or 1
    tx, tz = tx / L, tz / L
    nx_, nz_ = tz, -tx
    # 法向朝 8A 水面
    if not water.contains(Point(mx + nx_ * 2, mz + nz_ * 2)):
      nx_, nz_ = -nx_, -nz_
    # 墙略退到 8A 内侧，挡住往 8B 走
    wall_p = (mx - nx_ * 0.7, mz - nz_ * 0.7)
    cap = {
      'name': name,
      'x': round(wall_p[0], 2), 'z': round(wall_p[1], 2),
      'n': [round(nx_, 4), round(nz_, 4)],
      't': [round(tx, 4), round(tz, 4)],
      'thick': 1.4, 'h': 4.4, 'len': round(max(18.0, L + 6.0), 2),
    }
    caps.append(cap)
    halfL = cap['len'] / 2
    W8.append([
      round(wall_p[0] - tx * halfL, 2), round(wall_p[1] - tz * halfL, 2),
      round(wall_p[0] + tx * halfL, 2), round(wall_p[1] + tz * halfL, 2),
      0, 1,
    ])
    print('8A cap', name, cap)

  add_cap_on((X_WEST, Z_SOUTH + 10), (X_WEST, Z_NORTH - 2), 'west')
  add_cap_on((X_WEST + 4, Z_NORTH), (X_EAST - 4, Z_NORTH), 'north')

  WALL = WALL_keep + W8
  g['WALL'] = WALL
  print('8A walls kept', len(WALL_keep), 'new', len(W8), 'total', len(WALL))

  # skirt
  mnx, mnz, mxx, mxz = region.bounds
  skirt = box(mnx - 160, mnz - 160, mxx + 160, mxz + 160).difference(region)
  for extra in ('mjPoly', 'xgPoly'):
    if g.get(extra) is not None:
      skirt = skirt.difference(g[extra])
  skirt = skirt.buffer(0).simplify(1.0)
  g['SKIRT'] = pack(tris_flat(skirt))

  # ---- 福新东路西幅河道桥（8A 只建这一幅）----
  # 渠在此处大致南北，路大致东西
  bx, bz = fxw[0], fxw[1]
  # 用渠中线切向
  s_br = cl.project(Point(bx, bz))
  t_r = _tan(cl, s_br)
  n_r = (t_r[1], -t_r[0])
  # 保证 t 向北（+z）
  if t_r[1] < 0:
    t_r = (-t_r[0], -t_r[1]); n_r = (-n_r[0], -n_r[1])
  w_fx = 18.0   # 渠是 1:4 宽，桥按比例收，避免 34 m 路面盖住两岸变成广场
  half_fx = target_hw + 3.2
  b = {
    'id': 'fx1', 'river': 'fb', 's': -1,
    'x': round(bx, 2), 'z': round(bz, 2),
    't': [round(t_r[0], 4), round(t_r[1], 4)],
    'n': [round(n_r[0], 4), round(n_r[1], 4)],
    'hw': round(target_hw, 2), 'half': round(half_fx, 2), 'w': w_fx,
    'kind': 'road', 'name': '福新东路', 'plate': '福新东路',
    'note': '8A 福新东路西幅敞开河道桥（东幅按暗涵，不建桥）',
    'a8a': 1, 'style': 'fuxin', 'railStyle': 'fuxin',
    'walk': 2.6, 'b3': 0,
  }
  BR.append(b)
  # 桥洞：岸墙留口
  def corners(lat, along):
    return [
      (bx + n_r[0] * lat + t_r[0] * along, bz + n_r[1] * lat + t_r[1] * along),
    ]
  # gap polygon under the deck
  gap = rect(bx, bz, t_r[0], t_r[1], -half_fx - 0.4, half_fx + 0.4, -(w_fx / 2 - 0.2), (w_fx / 2 - 0.2))
  GAPS.append(gap)
  # mark flag=1 on new walls under the bridge
  for w in W8:
    mid = Point((w[0] + w[2]) / 2, (w[1] + w[3]) / 2)
    if gap.buffer(0.6).contains(mid):
      w[4] = 1
  b['foot'] = rect(bx, bz, t_r[0], t_r[1], -half_fx, half_fx, -w_fx / 2, w_fx / 2)
  # 桥头引道（接到福新东路路面）
  for sg in (-1, 1):
    ROADS.append({
      'id': 'fx1' + ('e' if sg > 0 else 'w'),
      'name': '福新东路',
      'poly': rect(bx, bz, n_r[0] * sg, n_r[1] * sg,
                   target_hw + 2.0, target_hw + 22.0,
                   -w_fx / 2, w_fx / 2),
      'dir': [n_r[0] * sg, n_r[1] * sg],
      'w': w_fx, 'stub': True, 'a8a': True,
    })
  print('8A bridge fx1', b['x'], b['z'], 'w', w_fx, 'hw', b['hw'])

  # ---- 福新东路东幅：连续路面（暗涵），无桥栏、两侧不露水口 ----
  fxe = feat['fuxin_east']['game_m']
  # 路向：西幅到东幅
  dx, dz = fxe[0] - bx, fxe[1] - bz
  Lrd = math.hypot(dx, dz) or 1
  rdx, rdz = dx / Lrd, dz / Lrd
  # 东幅附近没有 8A 水面贴近（湖东南岸在路北有陆地）。铺一段连续沥青路。
  east_road = {
    'id': 'fx_east_culvert',
    'name': '福新东路',
    'poly': rect(fxe[0], fxe[1], rdx, rdz, -22.0, 22.0, -9.0, 9.0),
    'dir': [rdx, rdz],
    'w': 18.0,
    'culvert': True,
    'a8a': True,
    'noParapet': True,
    'noWaterOpening': True,
  }
  ROADS.append(east_road)
  # 西幅桥东侧再接一段路，与东幅连成连续路面（不要在两幅之间断开）
  mid = ((bx + fxe[0]) / 2, (bz + fxe[1]) / 2)
  mid_len = Lrd / 2 - half_fx - 2.0
  if mid_len > 8:
    ROADS.append({
      'id': 'fx_road_mid',
      'name': '福新东路',
      'poly': rect(mid[0], mid[1], rdx, rdz, -(Lrd / 2 - half_fx - 1), (Lrd / 2 - 8.0), -9.0, 9.0),
      'dir': [rdx, rdz],
      'w': 18.0,
      'a8a': True,
    })

  # ---- 3号码头弯形栈桥（可走，#A39C8E）----
  pier_ll = feat['pier3_candidate'].get('polygon_wgs84') or []
  pier_game = [ll_game(lat, lon) for lat, lon in pier_ll]
  if len(pier_game) >= 3:
    if math.hypot(pier_game[0][0] - pier_game[-1][0], pier_game[0][1] - pier_game[-1][1]) > 0.2:
      pier_game = pier_game + pier_game[:1]
  pier3c = feat['pier3_candidate']['game_m']
  # 岸侧入口：多边形最东南的点（靠南岸）
  if pier_game:
    entrance = max(pier_game, key=lambda p: (p[0] - p[1]))  # more east, more south (smaller z is south... z more negative)
    # actually south is smaller z; SE = max x and min z
    entrance = max(pier_game, key=lambda p: p[0] - p[1])
  else:
    entrance = (pier3c[0] + 6.0, pier3c[1] - 4.0)
  # 牌朝向：从岸上走向码头（大致朝西北，看向栈桥）
  fx_s, fz_s = pier3c[0] - entrance[0], pier3c[1] - entrance[1]
  Lf = math.hypot(fx_s, fz_s) or 1
  fx_s, fz_s = fx_s / Lf, fz_s / Lf
  # 牌立在入口靠岸一侧，略退离水面
  sign_p = (entrance[0] - fx_s * 1.0 + fz_s * 1.8, entrance[1] - fz_s * 1.0 - fx_s * 1.8)
  pier3 = {
    'c': [round(pier3c[0], 2), round(pier3c[1], 2)],
    'ring': [round(v, 2) for p in pier_game for v in p],
    'entrance': [round(entrance[0], 2), round(entrance[1], 2)],
    'sign': {
      'x': round(sign_p[0], 2), 'z': round(sign_p[1], 2),
      'f': [round(fx_s, 4), round(fz_s, 4)],
      'lines': ['晋安湖3号码头', 'Jin\'an Lake Pier 3'],
    },
  }
  # 栈桥按陆地（已在描岸里），确保水面不盖住
  if len(pier_game) >= 4:
    pier_poly = Polygon(pier_game).buffer(0.15)
    if pier_poly.is_valid and not pier_poly.is_empty:
      water = water.difference(pier_poly).buffer(0)
      land = region.difference(water).buffer(0)
      g['water'], g['land'] = water, land
      # 重打包这两格附近？全面重包更稳（面积不大）
      LAND = {k_: pack(v) for k_, v in tris_by_cell(land).items()}
      WATER = {k_: pack(v) for k_, v in tris_by_cell(water).items()}
      _keep_old(LAND, land, land0, LAND0)
      _keep_old(WATER, water, water0, WATER0)
      g['LAND'], g['WATER'] = LAND, WATER

  # ---- 晋安湖名牌（接缝以北、能看见湖的岸上）----
  # 放在入湖口东岸，面向渠/湖
  lake_sign = {
    'x': round(fxw[0] + 18.0, 2),
    'z': round(fxw[1] + 22.0, 2),
    'f': [-0.55, -0.83],
    'lines': ['晋安湖', 'Jin\'an Lake'],
  }
  # 把牌挪到陆地上
  ls = Point(lake_sign['x'], lake_sign['z'])
  if water.buffer(1.0).contains(ls) or not land.contains(ls):
    # 入湖口东岸：桥东北
    for trial in [
      (fxw[0] + 16, fxw[1] + 18),
      (fxw[0] + 22, fxw[1] + 14),
      (fxw[0] + 12, fxw[1] + 26),
      (1005.0, -95.0),
    ]:
      if land.contains(Point(*trial)) and water.distance(Point(*trial)) > 1.5:
        lake_sign['x'], lake_sign['z'] = round(trial[0], 2), round(trial[1], 2)
        # 朝向最近水面
        # walk toward water
        break

  # ---- 南岸环湖步道环（沿 8A 水面外缘，合拢墙前停）----
  ring_src = water_new if water_new.geom_type == 'Polygon' else max(water_new.geoms, key=lambda q: q.area)
  try:
    ringL = ring_src.buffer(LB * 0.52, quad_segs=6).exterior
  except Exception:
    ringL = ring_src.exterior
  ring_pts = []
  step, d = 3.2, 0.0
  while d < ringL.length - 0.5:
    p = ringL.interpolate(d)
    d += step
    if not region.contains(p):
      continue
    if water.buffer(0.6).contains(p):
      continue
    # 不要绕到合拢墙外侧
    skip = False
    for C in caps:
      along = (p.x - C['x']) * C['t'][0] + (p.y - C['z']) * C['t'][1]
      side = (p.x - C['x']) * C['n'][0] + (p.y - C['z']) * C['n'][1]
      if abs(along) < C['len'] / 2 + 2 and side < -0.3:
        skip = True
        break
    if skip:
      continue
    ring_pts.append([round(p.x, 2), round(p.y, 2)])

  # 远景楼（少而够挡空地，预算要紧）
  far = []
  cLk = ring_src.centroid
  try:
    ringFar = ring_src.buffer(LB + HOUSE_BAND + 3, quad_segs=5).exterior
  except Exception:
    ringFar = None
  if ringFar is not None:
    fl, fll = 0.0, ringFar.length
    while fl < fll - 1:
      p = ringFar.interpolate(fl)
      fl += 14.0
      near_cap = any(math.hypot(p.x - C['x'], p.y - C['z']) < 16 for C in caps)
      if near_cap or not box(X_WEST - 4, Z_SOUTH, X_EAST + 16, Z_NORTH + 6).contains(p):
        continue
      if water.buffer(2.0).contains(p):
        continue
      fx_, fz_ = cLk.x - p.x, cLk.y - p.y
      Lf = math.hypot(fx_, fz_) or 1
      far.append([round(p.x, 2), round(p.y, 2), round(fx_ / Lf, 4), round(fz_ / Lf, 4)])
  print('8A far houses', len(far), 'ring pts', len(ring_pts))

  # 岸灯（细节格子，不加 draw；供夜倒影细、暗、断开）
  lamps = []
  d = 0.0
  if ringL is not None:
    while d < ringL.length - 1:
      p = ringL.interpolate(d)
      d += 16.0
      if water.buffer(1.2).contains(p) or not land.contains(p):
        continue
      # 朝向水面
      # simple: toward centroid
      fx_, fz_ = cLk.x - p.x, cLk.y - p.y
      Lf = math.hypot(fx_, fz_) or 1
      lamps.append([round(p.x, 2), round(p.y, 2), round(fx_ / Lf, 4), round(fz_ / Lf, 4)])
  lamps = lamps[:28]

  # 南岸环湖走点（e2e / 取景）
  loop = []
  for i, p in enumerate(ring_pts):
    if i % 3 == 0:
      loop.append(p)

  # ---- 取景相机（首件：入湖口、3号码头）----
  # 入湖口：渠上、福新东路桥南，向北看桥洞与半岛
  # 西岸、桥南约 14 m，沿渠向北看桥洞与半岛（不要站在路面上）
  # 渠西岸、桥南约 32 m，沿水面向北看福新东路桥洞、入湖与半岛（不要站在路面上）
  cam_inlet = {
    'x': 985.2, 'z': -146.5,
    'look': [998.0, 1.1, -80.0],
    'pitch': 0.10, 'y': 1.6,
  }
  if water.buffer(0.8).contains(Point(cam_inlet['x'], cam_inlet['z'])):
    cam_inlet['x'] = 983.5
    cam_inlet['z'] = -147.5

  cam_pier = {
    'x': round(sign_p[0] - fx_s * 5.5 + fz_s * 1.6, 2),
    'z': round(sign_p[1] - fz_s * 5.5 - fx_s * 1.6, 2),
    'look': [round(sign_p[0] + fx_s * 4.0, 2), 1.3, round(sign_p[1] + fz_s * 4.0, 2)],
    'pitch': 0.02, 'y': 1.55,
  }
  if water.buffer(0.8).contains(Point(cam_pier['x'], cam_pier['z'])):
    cam_pier['x'] = round(sign_p[0] - fx_s * 4.0, 2)
    cam_pier['z'] = round(sign_p[1] - fz_s * 4.0, 2)

  # 消失落在新水面上的旧树（下标 gone，不删）
  GONE_T = []
  for i, t_ in enumerate(TREES):
    if t_[5] == 'gone':
      continue
    if water.buffer(0.6).contains(Point(t_[0], t_[1])) and not water0.buffer(0.6).contains(Point(t_[0], t_[1])):
      TREES[i][5] = 'gone'
      GONE_T.append(i)
  print('8A gone trees in new water', len(GONE_T))

  A8ADATA = {
    'note': '8A：打开 3B 凤坂河北头封口，入湖渠接通南半湖；分流陆按半岛；3号码头可走栈桥+牌；只建福新东路西幅桥，东幅暗涵；西侧游憩岛/茶香路桥/摩天轮属 8B。未放船。',
    'openedSeal': True,
    'canalHw': round(target_hw, 2),
    'lakeBand': LB,
    'clip': [X_WEST, Z_SOUTH, X_EAST, Z_NORTH],
    'caps': caps,
    'capWall': caps[0] if caps else None,
    'far': far,
    'lamps': lamps,
    'loop': loop,
    'lake': {
      'c': [round(cLk.x, 2), round(cLk.y, 2)],
      'ring': [v for p in ring_pts for v in p],
      'band': LB,
      'area': round(water_new.area, 1),
    },
    'bridge': 'fx1',
    'bridges': ['fx1'],
    'eastCulvert': 'fx_east_culvert',
    'pier3': pier3,
    'plates': [
      {'x': lake_sign['x'], 'z': lake_sign['z'], 'f': lake_sign['f'], 'lines': lake_sign['lines']},
      {'x': pier3['sign']['x'], 'z': pier3['sign']['z'], 'f': pier3['sign']['f'], 'lines': pier3['sign']['lines']},
    ],
    'signs': [],
    'cams': {
      'inlet': cam_inlet,
      'pier3': cam_pier,
    },
    'island8b': '西侧游憩岛按 PLAN-8 属 8B（西岸到东二环），8A 不建岛、桥、亭；岛心小塘亦不做。',
    'chaxiang8b': '茶香路桥进 8B，有名双幅路桥，规格同福新东路西幅河道桥；8A 不建。',
    'huahe': '化工路顶左化工河出范围，8A 不铺水。',
  }
  g['A8ADATA'] = A8ADATA
  g['BR'], g['ROADS'], g['GAPS'] = BR, ROADS, GAPS
  print('8A done. water area', round(water.area, 1), 'new', round(water_new.area, 1),
        'caps', len(caps), 'pier3 sign', pier3['sign'])
