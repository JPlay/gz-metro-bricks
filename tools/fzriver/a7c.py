# 福州内河 7C：从涧田湖东口沿洋下河东段走到命名东头合拢（合拢墙 + 远景，同 6B）。
# PLAN-洋下河 v2 §6（小美定）。由 gen_e.py 在 a7b.build_lake 之后调用。
# 干净拆掉 7B 湖东北出水口合拢；7A/7B 中线前缀、ja/jn、7B 环湖一律不改。
import json, math, os, random
from shapely.geometry import LineString, Polygon, Point, box
from shapely.ops import unary_union
from a6 import (_tan, _dedupe, _resample, _smooth_radius, _bez)
from a7a import _chaikin_safe, CAP, HW_YX, BAND_YX, JA_JN_SHA1

HOLD = 8.0


def build_east(g):
  """7B 之后：打开湖东北合拢，把 yx 经湖面接到东口，再沿东段收到命名东头。"""
  HERE, scJ, at_s, bridge, rect = g['HERE'], g['scJ'], g['at_s'], g['bridge'], g['rect']
  pack, tris_by_cell, tris_flat, merge = g['pack'], g['tris_by_cell'], g['tris_flat'], g['merge']
  _keep_old, ext, minRat = g['_keep_old'], g['ext'], g['minRat']
  water0, region0, land0 = g['water'], g['region'], g['land']
  WALL0, LAND0, WATER0, BOUND0 = g['WALL'], g['LAND'], g['WATER'], g['BOUND']
  A7 = g['A7ADATA']
  A7B = g['A7BDATA']
  OFF = g['YX_OFF']
  yx7b = g['CL']['yx']
  len7b = yx7b.length
  pref = list(yx7b.coords)
  jn, ja = g['CL']['jn'], g['CL']['ja']
  lakeG = g.get('lakeY')
  if lakeG is None and A7B.get('lake') and A7B['lake'].get('ring'):
    ring = A7B['lake']['ring']
    lakeG = Polygon([(ring[i], ring[i + 1]) for i in range(0, len(ring), 2)])
  cL = lakeG.centroid if lakeG is not None else None

  raw = json.load(open(os.path.join(HERE, 'yxh_7c_osm_m.json')))
  coords = [tuple(p) for p in raw['river_coords']]
  osm_g = [(p[0] + OFF[0], p[1] + OFF[1]) for p in scJ(coords)]
  eog = tuple(A7B['outlet'])
  d0 = math.hypot(osm_g[0][0] - eog[0], osm_g[0][1] - eog[1])
  print('7C join d0', round(d0, 3), 'yx7b', round(len7b, 2), 'outlet', tuple(round(v, 2) for v in eog))
  osm_g[0] = eog
  Losm = LineString(_chaikin_safe(osm_g)).simplify(0.6)

  # 湖面短弧：从 7B 河尾（西口）走到东口，只作里程，不是必须走的路。
  # 必须在锁点处 C1 接上（沿 7B 切向先持平再宽弯），否则 minR 会掉到几米。
  p0 = pref[-1]
  T0 = _tan(yx7b, len7b)
  te0 = (raw['start_dir'][0], raw['start_dir'][1])
  Lt0 = math.hypot(*te0) or 1
  te0 = (te0[0] / Lt0, te0[1] / Lt0)
  # 沿 7B 切向先走 24 m（足够让锁点处的夹角为 180°），再以 R=28 圆弧转向东口。
  hold = [(p0[0] + T0[0] * s, p0[1] + T0[1] * s) for s in [i * 2.0 for i in range(1, 13)]]  # 2..24
  P0 = hold[-1]
  Pin = (eog[0] - te0[0] * 14.0, eog[1] - te0[1] * 14.0)
  # 圆弧：从 T0 转到朝向 Pin
  def _arc(P, T, Q, R=28.0, step=2.0):
    vx, vz = Q[0] - P[0], Q[1] - P[1]
    cross = T[0] * vz - T[1] * vx
    sgn = 1.0 if cross >= 0 else -1.0
    cx, cz = P[0] - sgn * T[1] * R, P[1] + sgn * T[0] * R
    a0 = math.atan2(P[1] - cz, P[0] - cx)
    # 终点：半径上最接近 Q 且转角与 sgn 同向的点（转角不超过 120°）
    aQ = math.atan2(Q[1] - cz, Q[0] - cx)
    da = (aQ - a0 + math.pi * 3) % (2 * math.pi) - math.pi  # [-pi,pi]
    if sgn > 0 and da < 0: da += 2 * math.pi
    if sgn < 0 and da > 0: da -= 2 * math.pi
    da = max(-math.pi * 2 / 3, min(math.pi * 2 / 3, da))
    n = max(4, int(abs(da) * R / step))
    pts = []
    for i in range(1, n + 1):
      a = a0 + da * i / n
      pts.append((cx + math.cos(a) * R, cz + math.sin(a) * R))
    return pts
  arc = _arc(P0, T0, Pin, 28.0, 2.0)
  Pend = arc[-1] if arc else P0
  # Pend 再到 Pin：短贝塞尔，切向沿圆弧终点
  if arc and len(arc) >= 2:
    Te = (arc[-1][0] - arc[-2][0], arc[-1][1] - arc[-2][1])
    Le = math.hypot(*Te) or 1
    Te = (Te[0] / Le, Te[1] / Le)
  else:
    Te = T0
  C = 12.0
  P1e = (Pend[0] + Te[0] * C, Pend[1] + Te[1] * C)
  P2e = (Pin[0] - te0[0] * C, Pin[1] - te0[1] * C)
  blend_e = [_bez(Pend, P1e, P2e, Pin, i / 10.0) for i in range(1, 11)]
  lake_path = _dedupe([p0] + hold + arc + blend_e + [Pin, eog], 0.4)

  s_tgt = min(36.0, max(18.0, Losm.length * 0.05))
  P3 = (Losm.interpolate(s_tgt).x, Losm.interpolate(s_tgt).y)
  T3 = _tan(Losm, s_tgt)
  C = 12.0
  P1 = (eog[0] + te0[0] * C, eog[1] + te0[1] * C)
  P2 = (P3[0] - T3[0] * C, P3[1] - T3[1] * C)
  blend = [_bez(eog, P1, P2, P3, i / 12.0) for i in range(1, 13)]
  rest, ss = [], s_tgt + 1.2
  while ss < Losm.length - 0.05:
    q = Losm.interpolate(ss); rest.append((q.x, q.y)); ss += 2.0
  rest.append((Losm.coords[-1][0], Losm.coords[-1][1]))
  # 不要对 7B 前缀做 resample（会在锁点处走样、切向对不齐）。只重采样延伸段。
  ext = LineString(_dedupe([pref[-1]] + lake_path[1:] + blend + rest, 0.3))
  ext = _resample(ext, 2.0)
  yx = LineString(_dedupe(pref + list(ext.coords)[1:], 0.3))
  # 只轻轻修延伸段；锁点附近 20 m 内的密持平点不要被拉弯
  yx = _smooth_radius(yx, 26.0, lock=len7b + 20.0, iters=500)
  r0, pmin, smin = minRat(yx)
  print('7C yx minR', round(r0, 2), 'at', tuple(round(v, 2) for v in pmin), 's', round(smin, 1),
        'len', round(yx.length, 2), 'end', tuple(round(v, 2) for v in yx.coords[-1]))
  if r0 < 25.9:
    # 只再修更远的弯，仍然躲开锁点
    yx = _smooth_radius(yx, 26.5, lock=len7b + 20.0, iters=800)
    r0, pmin, smin = minRat(yx)
    print('7C yx minR pass2', round(r0, 2), 's', round(smin, 1))

  max_pref = 0.0
  for i, p in enumerate(pref):
    if i == 0:
      continue
    s = min(yx.project(Point(*p)), len7b)
    q = yx.interpolate(s)
    max_pref = max(max_pref, math.hypot(q.x - p[0], q.y - p[1]))
  print('7C prefix drift max', round(max_pref, 3), 'len7b', round(len7b, 2))
  if max_pref > 0.35:
    raise SystemExit(f'7C moved 7B yx prefix by {max_pref:.3f} m')
  assert g['CL']['jn'].coords[:] == jn.coords[:]
  assert g['CL']['ja'].coords[:] == ja.coords[:]
  assert A7.get('jaJnSha1') == JA_JN_SHA1
  assert A7B.get('jaJnSha1') == JA_JN_SHA1

  g['CL']['yx'] = yx
  g['HW']['yx'] = HW_YX
  g['BAND']['yx'] = BAND_YX

  def at_yx(s, lat=0.0):
    s = min(max(s, 0), yx.length)
    p = yx.interpolate(s); t = _tan(yx, s); n = (t[1], -t[0])
    return (p.x + n[0] * lat, p.y + n[1] * lat), t, n

  s_east0 = yx.project(Point(*eog))
  print('7C s_east0', round(s_east0, 2), 'lake-cross', round(s_east0 - len7b, 2),
        'east game', round(yx.length - s_east0, 2))

  def game_of_official(official_s):
    rp = LineString(coords).interpolate(min(max(official_s, 0), LineString(coords).length))
    gp = scJ([(rp.x, rp.y)])[0]
    return (gp[0] + OFF[0], gp[1] + OFF[1])

  # ---- 打开 7B 湖东北合拢 ----
  old_cap = A7B.get('capWall') or {}
  A7B['yxLen7b'] = A7B['yxLen']
  A7B['capWall'] = None
  A7B['far'] = [q for q in (A7B.get('far') or []) if math.hypot(q[0] - eog[0], q[1] - eog[1]) > 22]
  A7B['openedTo7c'] = True
  A7B['note'] = (A7B.get('note') or '') + '；7C 已拆湖东北合拢，yx 延伸至命名东头。'

  # ---- 东段水面：从东口起（含一小段伸进湖，盖掉旧合拢）到命名东头 ----
  left, right, s = [], [], max(0.0, s_east0 - 6.0)
  while s <= yx.length + 1e-6:
    ss = min(s, yx.length)
    p = yx.interpolate(ss); t = _tan(yx, ss); n = (t[1], -t[0])
    left.append((p.x - n[0] * HW_YX, p.y - n[1] * HW_YX))
    right.append((p.x + n[0] * HW_YX, p.y + n[1] * HW_YX))
    s += 0.8
  chanC = Polygon(left + right[::-1]).buffer(0).simplify(0.06)
  if chanC.geom_type != 'Polygon':
    chanC = max(chanC.geoms, key=lambda q: q.area)
  mouth = Point(*eog).buffer(HW_YX + 6.0)
  chanC = unary_union([chanC, mouth]).buffer(0.25).buffer(-0.12)
  if chanC.geom_type == 'MultiPolygon':
    chanC = unary_union([p for p in chanC.geoms if p.area > 8])
  g['chanC'] = chanC

  # ---- 东头合拢（命名东头），像 6B ----
  endp = (yx.coords[-1][0], yx.coords[-1][1])
  te = _tan(yx, yx.length)
  ne = (te[1], -te[0])
  wall_p = (endp[0] + te[0] * CAP, endp[1] + te[1] * CAP)
  capWall = {
    'x': round(wall_p[0], 2), 'z': round(wall_p[1], 2),
    'n': [round(ne[0], 4), round(ne[1], 4)],
    't': [round(te[0], 4), round(te[1], 4)],
    'thick': 1.4, 'h': 4.4, 'len': 28.0,
  }
  capP = (endp[0] + te[0] * (CAP + 10), endp[1] + te[1] * (CAP + 10))
  far = []
  for off in range(-48, 52, 12):
    q = (capP[0] + ne[0] * off, capP[1] + ne[1] * off)
    far.append([round(q[0], 2), round(q[1], 2), round(-te[0], 4), round(-te[1], 4)])

  cap_cut = Polygon([
    (wall_p[0] + te[0] * 0.15 + ne[0] * 90, wall_p[1] + te[1] * 0.15 + ne[1] * 90),
    (wall_p[0] + te[0] * 90 + ne[0] * 90, wall_p[1] + te[1] * 90 + ne[1] * 90),
    (wall_p[0] + te[0] * 90 - ne[0] * 90, wall_p[1] + te[1] * 90 - ne[1] * 90),
    (wall_p[0] + te[0] * 0.15 - ne[0] * 90, wall_p[1] + te[1] * 0.15 - ne[1] * 90),
  ])
  # 打开 7B 出水口裁切：东段走廊并进 region
  east_line = LineString([yx.interpolate(ss) for ss in
                          [min(yx.length, max(s_east0 - 8, 0) + i * 3)
                           for i in range(int((yx.length - (s_east0 - 8)) / 3) + 2)]])
  regC = east_line.buffer(HW_YX + BAND_YX, cap_style='flat', quad_segs=6).simplify(0.1)
  region = unary_union([region0, regC, Point(*eog).buffer(18)]).buffer(0).difference(cap_cut).buffer(0)
  if region.geom_type == 'MultiPolygon':
    region = max(region.geoms, key=lambda q: q.area)
  region = Polygon(region.exterior)

  inter = chanC.intersection(region.buffer(-0.05))
  water = unary_union([water0, inter]).buffer(0)
  water = water.intersection(region.buffer(-0.05)).buffer(0).simplify(0.05)
  if water.geom_type == 'MultiPolygon':
    water = unary_union([p for p in water.geoms if p.area > 8])
  if cL is not None and not (water.contains(cL) or water.distance(cL) < 1.0):
    raise SystemExit(f'7C dropped 7B lake from water (dist={water.distance(cL):.2f})')
  land = region.difference(water).buffer(0)
  if land.geom_type == 'MultiPolygon':
    land = unary_union([p for p in land.geoms if p.area > 4])
  g['water'], g['land'], g['region'] = water, land, region

  LAND = {k_: pack(v) for k_, v in tris_by_cell(land).items()}
  WATER = {k_: pack(v) for k_, v in tris_by_cell(water).items()}
  print('7C cells kept from 7B: land', _keep_old(LAND, land, land0, LAND0), '/', len(LAND),
        'water', _keep_old(WATER, water, water0, WATER0), '/', len(WATER))
  g['LAND'], g['WATER'] = LAND, WATER
  bnd = Polygon(BOUND0).union(regC.simplify(0.3)).union(Point(*eog).buffer(18)).difference(cap_cut).buffer(0)
  if bnd.geom_type == 'MultiPolygon':
    bnd = max(bnd.geoms, key=lambda q: q.area)
  BOUND = [[round(x, 2), round(z, 2)] for x, z in Polygon(bnd.exterior).simplify(0.3).exterior.coords]
  g['BOUND'] = BOUND

  # ---- 岸墙：丢掉 7B 出水口合拢附近的墙，沿新水面补，东头再写合拢墙 ----
  _wd = water.symmetric_difference(water0).buffer(0)
  def _wmid(w):
    return Point((w[0] + w[2]) / 2, (w[1] + w[3]) / 2)
  cap_pt = Point(old_cap['x'], old_cap['z']) if old_cap else Point(*eog)
  WALL_keep = []
  for w in WALL0:
    seg = LineString([(w[0], w[1]), (w[2], w[3])])
    if cap_pt.distance(seg) < 14.0:
      continue
    if (not _wd.is_empty) and seg.distance(_wd) <= 0.5 and cap_pt.distance(seg) < 28.0:
      continue
    WALL_keep.append(w)

  W7 = []
  def _add_ring(coords, flag=0):
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
      W7.append([round(a[0], 2), round(a[1], 2), round(b[0], 2), round(b[1], 2), 0, sg])

  _wparts = [water] if water.geom_type == 'Polygon' else list(water.geoms)
  for part in _wparts:
    _add_ring(list(part.exterior.coords))
    for hole in part.interiors:
      _add_ring(list(hole.coords))
  W7n = []
  for w in W7:
    midp = _wmid(w)
    if (not _wd.is_empty and _wd.buffer(1.2).intersects(LineString([(w[0], w[1]), (w[2], w[3])]))):
      W7n.append(w)
  W7 = merge(W7n) if W7n else []
  def _stitch(W, tol=0.45):
    n = 0
    coords_w = []
    for w in W:
      coords_w.append([w[0], w[1]])
      coords_w.append([w[2], w[3]])
    N = len(coords_w)
    parent = list(range(N))
    def find(a):
      while parent[a] != a:
        parent[a] = parent[parent[a]]
        a = parent[a]
      return a
    def union(a, b):
      ra, rb = find(a), find(b)
      if ra != rb:
        parent[rb] = ra
    for a in range(N):
      for b in range(a + 1, N):
        if a // 2 == b // 2:
          continue
        if math.hypot(coords_w[a][0] - coords_w[b][0], coords_w[a][1] - coords_w[b][1]) < tol:
          union(a, b)
    clusters = {}
    for a in range(N):
      clusters.setdefault(find(a), []).append(a)
    for mems in clusters.values():
      if len(mems) < 2:
        continue
      sx = round(sum(coords_w[k][0] for k in mems) / len(mems), 2)
      sz = round(sum(coords_w[k][1] for k in mems) / len(mems), 2)
      for k in mems:
        i, e = k // 2, k % 2
        ox, oz = (W[i][0], W[i][1]) if e == 0 else (W[i][2], W[i][3])
        if abs(ox - sx) > 1e-6 or abs(oz - sz) > 1e-6:
          n += 1
        if e == 0:
          W[i][0], W[i][1] = sx, sz
        else:
          W[i][2], W[i][3] = sx, sz
    return n
  nstitch = _stitch(W7)
  print('7C wall stitch endpoints', nstitch)
  halfL = capWall['len'] / 2
  W7.append([
    round(wall_p[0] - ne[0] * halfL, 2), round(wall_p[1] - ne[1] * halfL, 2),
    round(wall_p[0] + ne[0] * halfL, 2), round(wall_p[1] + ne[1] * halfL, 2),
    0, 1,
  ])
  WALL = WALL_keep + W7
  g['WALL'] = WALL
  print('7C walls: kept', len(WALL_keep), '/', len(WALL0), 'new', len(W7), 'total', len(WALL))

  mnx, mnz, mxx, mxz = region.bounds
  skirt = box(mnx - 160, mnz - 160, mxx + 160, mxz + 160).difference(region)
  for extra in ('mjPoly', 'xgPoly'):
    if g.get(extra) is not None:
      skirt = skirt.difference(g[extra])
  skirt = skirt.buffer(0).simplify(1.0)
  g['SKIRT'] = pack(tris_flat(skirt))

  # ---- 桥：涧山巷（有名、最短最矮、分幅）+ 三座无名短桥（不挂牌，跨度不同）----
  # trunk_link 946061376 距中线 12.7 m，不作可走跨河桥，只在东头远景里做匝道板。
  recs = list(raw['bridges'])
  jian = [b for b in recs if b.get('name') == '涧山巷']
  anons = [b for b in recs if not b.get('name')]
  anons.sort(key=lambda b: b['official_s'])
  BRC = []
  # 涧山巷：两幅，一块牌，最矮
  for i, rec in enumerate(sorted(jian, key=lambda b: b['official_s'])):
    gp = game_of_official(rec['official_s'])
    s = yx.project(Point(*gp))
    s = max(s, s_east0 + 4.0)
    s = min(s, yx.length - 8.0)
    w = max(8.5, min(12.0, rec['span'] * 0.55 + 3.0))  # 比西园路更短更窄
    b = bridge('yx', s, w, 'road', '涧山巷', plate=('涧山巷' if i == 0 else None),
               ext=2.0, note='涧山巷，东段第一座有名巷桥，最短最矮，分幅')
    b['a7c'] = 1
    b['style'] = 'jianshan'
    b['railStyle'] = 'jianshan'
    b['walk'] = 1.9
    b['deckY'] = 0.92   # 明显低于 7B 西园/玄南岭
    b['osm'] = rec['id']
    BRC.append(b)
    print('7C bridge', b['id'], '涧山巷', 's', round(b['s'], 1), 'w', round(b['w'], 1),
          'official', rec['official_s'], 'span', rec['span'])

  # 三座无名：38 / 9 / 17 m，禁止同一模子
  anon_specs = [
    {'style': 'anon38', 'railStyle': 'anon38', 'walk': 2.4, 'deckY': 1.18,
     'wfn': lambda sp: max(13.0, min(18.0, sp * 0.42 + 3.0)),
     'note': '东段无名 unclassified 长跨（约 38 m），不挂牌'},
    {'style': 'anon9', 'railStyle': 'anon9', 'walk': 1.7, 'deckY': 0.86,
     'wfn': lambda sp: max(6.5, min(9.5, sp * 0.55 + 2.0)),
     'note': '东段无名 unclassified 极短跨（约 9 m），不挂牌'},
    {'style': 'anon17', 'railStyle': 'anon17', 'walk': 2.1, 'deckY': 1.05,
     'wfn': lambda sp: max(10.0, min(13.5, sp * 0.55 + 3.0)),
     'note': '东段无名 unclassified 中跨（约 17 m），不挂牌'},
  ]
  for rec, spec in zip(anons, anon_specs):
    gp = game_of_official(rec['official_s'])
    s = yx.project(Point(*gp))
    s = max(s, s_east0 + 4.0)
    s = min(s, yx.length - 8.0)
    w = spec['wfn'](rec['span'])
    b = bridge('yx', s, w, 'road', None, plate=None, ext=2.2, note=spec['note'])
    b['a7c'] = 1
    b['style'] = spec['style']
    b['railStyle'] = spec['railStyle']
    b['walk'] = spec['walk']
    b['deckY'] = spec['deckY']
    b['osm'] = rec['id']
    BRC.append(b)
    print('7C bridge', b['id'], '(unnamed)', spec['style'], 's', round(b['s'], 1),
          'w', round(b['w'], 1), 'official', rec['official_s'], 'span', rec['span'])

  for b in BRC:
    def corners(au, cv, bb=b):
      return [(bb['x'] + bb['t'][0] * a + bb['n'][0] * c, bb['z'] + bb['t'][1] * a + bb['n'][1] * c)
              for a, c in [(-au, -cv), (au, -cv), (au, cv), (-au, cv)]]
    g['GAPS'].append(Polygon(corners(b['w'] / 2 - 0.05, b['half'] + 0.5)))
    b['foot'] = Polygon(corners(b['w'] / 2, b['half']))

  ROADS_C = []
  for b in BRC:
    for sg in (-1, 1):
      start = b['hw'] + 2
      reach = b['hw'] + BAND_YX + 2
      if reach <= start + 1:
        continue
      ROADS_C.append({'id': b['id'] + ('e' if sg > 0 else 'w'), 'name': b['name'] or b['id'],
                      'poly': rect(b['x'], b['z'], b['n'][0] * sg, b['n'][1] * sg, start, reach, -b['w'] / 2, b['w'] / 2),
                      'dir': [b['n'][0] * sg, b['n'][1] * sg], 'w': b['w'], 'stub': True, 'a7c': True})
  g['ROADS'] = g['ROADS'] + ROADS_C
  plates = []
  for b in BRC:
    if not b.get('plate'):
      continue
    px = b['x'] + b['n'][0] * (b['half'] + 1.8)
    pz = b['z'] + b['n'][1] * (b['half'] + 1.8)
    fx, fz = -b['n'][0], -b['n'][1]
    plates.append({'x': round(px, 2), 'z': round(pz, 2), 'f': [round(fx, 4), round(fz, 4)],
                   'lines': ['涧山巷', 'Jianshan Alley']})

  # 东头匝道板（trunk_link 946061376）：不可走，只挡天空 / 区分尺度
  ramp = {
    'x': round(wall_p[0] + te[0] * 6.0, 2),
    'z': round(wall_p[1] + te[1] * 6.0, 2),
    't': [round(ne[0], 4), round(ne[1], 4)],
    'f': [round(-te[0], 4), round(-te[1], 4)],
    'len': 36.0, 'w': 8.5, 'y': 3.6, 'thick': 0.7,
    'osm': 946061376,
  }

  # ---- 两岸低面数沿河房子 + 树 ----
  def _hpoly0(h):
    return Polygon(
      [(h['x'] + h['t'][0] * a + h['f'][0] * b * -1, h['z'] + h['t'][1] * a + h['f'][1] * b * -1)
       for a, b in [(-h['w'] / 2, -h['d'] / 2), (h['w'] / 2, -h['d'] / 2), (h['w'] / 2, h['d'] / 2), (-h['w'] / 2, h['d'] / 2)]])

  occ_geoms = [r['poly'].buffer(0.4) for r in ROADS_C] + [b['foot'].buffer(1.0) for b in BRC]
  occ_geoms.append(Point(*eog).buffer(14))
  occ_geoms.append(Point(*endp).buffer(16))
  HOUSES, TREES = g['HOUSES'], g['TREES']
  occ = unary_union(occ_geoms + [_hpoly0(h).buffer(0.4) for h in HOUSES if not h.get('gone')] or [Point(0, 0)])
  R7 = random.Random(731)
  nH0 = len(HOUSES)

  def _try_house(s, side, off_extra, w_, d_, h_, lod=None):
    nonlocal occ
    off = HW_YX + off_extra + d_ / 2
    (cx, cz), tdir, nn = at_yx(min(yx.length - 2, max(s_east0 + 4, s + w_ / 2)), side * off)
    poly = Polygon([(cx + tdir[0] * a + nn[0] * side * b, cz + tdir[1] * a + nn[1] * side * b)
                    for a, b in [(-w_ / 2, -d_ / 2), (w_ / 2, -d_ / 2), (w_ / 2, d_ / 2), (-w_ / 2, d_ / 2)]])
    if not region.buffer(-0.05).contains(poly) or poly.intersects(occ) or poly.intersects(water.buffer(0.8)):
      return False
    if s < s_east0 + 2 or s > yx.length - 10:
      return False
    occ = occ.union(poly.buffer(0.25))
    rec = {'x': round(cx, 2), 'z': round(cz, 2), 'w': round(w_, 2), 'd': round(d_, 2),
           't': [round(tdir[0], 4), round(tdir[1], 4)], 'f': [round(-nn[0] * side, 4), round(-nn[1] * side, 4)],
           'river': 'yx', 'h': h_, 'kind': 'old', 'ry': round(math.atan2(tdir[0], tdir[1]), 4),
           'back': True, 'a7c': True}
    if lod:
      rec['lod'] = lod
    HOUSES.append(rec)
    return True

  s = s_east0 + 12
  while s < yx.length - 14:
    for side in (-1, 1):
      if R7.random() < 0.18:
        continue
      w_ = R7.uniform(6.5, 9.5); d_ = R7.uniform(5.5, 8.0); h_ = R7.uniform(6.5, 10.5)
      _try_house(s, side, R7.uniform(2.2, 5.5), w_, d_, h_, lod=2 if R7.random() < 0.35 else None)
    s += R7.uniform(11, 16)
  print('7C houses', len(HOUSES) - nH0)

  nT0 = len(TREES)
  s = s_east0 + 8
  while s < yx.length - 8:
    for side in (-1, 1):
      if R7.random() < 0.35:
        continue
      off = HW_YX + R7.uniform(1.6, 3.4)
      (cx, cz), tdir, nn = at_yx(s, side * off)
      if (not region.contains(Point(cx, cz))) or water.buffer(0.8).contains(Point(cx, cz)):
        continue
      if math.hypot(cx - eog[0], cz - eog[1]) < 10 or math.hypot(cx - endp[0], cz - endp[1]) < 12:
        continue
      TREES.append([round(cx, 2), round(cz, 2), round(R7.uniform(0.7, 1.15), 2),
                    round(R7.uniform(4.2, 6.8), 2), 'yx', None])
    s += R7.uniform(7, 11)
  # 合拢墙前一排树，挡住墙外天空缝，但不挡步道
  ncapT = 0
  for off in range(-20, 22, 5):
    q = (wall_p[0] - te[0] * 4.5 + ne[0] * off, wall_p[1] - te[1] * 4.5 + ne[1] * off)
    if region.contains(Point(*q)) and not water.buffer(1.0).contains(Point(*q)):
      # 合拢机位附近不要树干（capBank 稍后才定，先避开墙前中线 8 m）
      if abs(off) < 8:
        continue
      TREES.append([round(q[0], 2), round(q[1], 2), 0.95, 6.2, 'yx', None])
      ncapT += 1
  print('7C cap trees', ncapT)
  print('7C trees', len(TREES) - nT0)

  # gone：合拢外 / 新水面里的旧房子树
  GONE_H, GONE_T = [], []
  for i, h in enumerate(HOUSES):
    if h.get('gone') or h.get('a7c'):
      continue
    if cap_cut.contains(Point(h['x'], h['z'])) or water.buffer(-0.2).contains(Point(h['x'], h['z'])):
      h['gone'] = True
      GONE_H.append(i)
  for i, t in enumerate(TREES):
    if t[5] == 'gone':
      continue
    if cap_cut.contains(Point(t[0], t[1])) or water.buffer(-0.2).contains(Point(t[0], t[1])):
      t[5] = 'gone'
      GONE_T.append(i)
  print('7C gone houses', len(GONE_H), 'trees', len(GONE_T))
  g['HOUSES'], g['TREES'] = HOUSES, TREES

  # ---- 岸灯（朝水，倒影在 runtime 里按 4A 规矩铺）----
  lamps = []
  ls = s_east0 + 6
  while ls < yx.length - 8:
    for side in (-1, 1):
      (p, tdir, nn) = at_yx(ls, side * (HW_YX + 2.2))
      fx, fz = -nn[0] * side, -nn[1] * side  # 朝河
      if region.contains(Point(*p)) and not water.buffer(0.6).contains(Point(*p)):
        lamps.append([round(p[0], 2), round(p[1], 2), round(fx, 3), round(fz, 3)])
    ls += 13.0
  print('7C lamps', len(lamps))

  capBank = [round(wall_p[0] - te[0] * 3.6, 2), round(wall_p[1] - te[1] * 3.6, 2)]
  if (not region.contains(Point(*capBank))) or water.buffer(0.5).contains(Point(*capBank)):
    for sgn in (1, -1, 2, -2, 3, -3):
      q = (wall_p[0] - te[0] * 3.6 + ne[0] * 2.8 * sgn,
           wall_p[1] - te[1] * 3.6 + ne[1] * 2.8 * sgn)
      if region.contains(Point(*q)) and not water.buffer(0.5).contains(Point(*q)):
        capBank = [round(q[0], 2), round(q[1], 2)]
        break
  capPast = [round(wall_p[0] + te[0] * 14.0, 2), round(wall_p[1] + te[1] * 14.0, 2)]

  def cam_at(x, z, look, y=1.55, pitch=0.08, note=''):
    return {'x': round(x, 2), 'y': y, 'z': round(z, 2),
            'look': [round(look[0], 2), 1.2, round(look[1], 2)], 'pitch': pitch, 'note': note}

  cams = {}
  # 东口：站在湖岸看出水口，沿河向东
  (mx, mz), _, _ = at_yx(s_east0 - 6, 0)
  # 站在岸上（北/左侧）
  (mx, mz), _, _n = at_yx(max(s_east0 + 2, s_east0), -(HW_YX + 4.5))
  look_m = (eog[0] + te0[0] * 18, eog[1] + te0[1] * 18)
  cams['mouth'] = cam_at(mx, mz, look_m, note='涧田湖东口看出水，沿东段')
  for b in BRC:
    if b.get('style') == 'jianshan' and b.get('plate'):
      cams['jianshan'] = cam_at(b['x'] + b['n'][0] * (b['half'] + 6), b['z'] + b['n'][1] * (b['half'] + 6),
                                (b['x'], b['z']), note='涧山巷')
    elif b.get('style') == 'anon38':
      cams['anon38'] = cam_at(b['x'] + b['n'][0] * (b['half'] + 7), b['z'] + b['n'][1] * (b['half'] + 7),
                              (b['x'], b['z']), note='无名 38 m 跨')
    elif b.get('style') == 'anon9':
      cams['anon9'] = cam_at(b['x'] + b['n'][0] * (b['half'] + 6), b['z'] + b['n'][1] * (b['half'] + 6),
                             (b['x'], b['z']), note='无名 9 m 跨')
    elif b.get('style') == 'anon17':
      cams['anon17'] = cam_at(b['x'] + b['n'][0] * (b['half'] + 6), b['z'] + b['n'][1] * (b['half'] + 6),
                              (b['x'], b['z']), note='无名 17 m 跨')
  (sx, sz), _, _ = at_yx((s_east0 + yx.length) / 2, -(HW_YX + 5))
  midp = yx.interpolate((s_east0 + yx.length) / 2)
  cams['south'] = cam_at(sx, sz, (midp.x, midp.y), note='东段南岸街景')
  cams['cap'] = cam_at(capBank[0] - te[0] * 4.0 + ne[0] * 1.2, capBank[1] - te[1] * 4.0 + ne[1] * 1.2,
                       (wall_p[0], wall_p[1]), note='命名东头合拢')

  def _hpoly_chk(h):
    return _hpoly0(h)
  for _nm, _cam in cams.items():
    cp = Point(_cam['x'], _cam['z'])
    for h in HOUSES:
      if h.get('gone') or h.get('kind') != 'old':
        continue
      if _hpoly_chk(h).buffer(0.6).contains(cp):
        print('WARN cam inside house', _nm, (_cam['x'], _cam['z']))
    # 前景 8 m 内不要有树干
    for t in TREES:
      if t[5] == 'gone':
        continue
      if math.hypot(t[0] - _cam['x'], t[1] - _cam['z']) < 3.2:
        print('WARN cam near trunk', _nm, (_cam['x'], _cam['z']), t[:2])
    print('7C cam clear', _nm, (_cam['x'], _cam['z']))
  # 机位 4 m 内的树干挪走（规则：前景无树干）
  nDrop = 0
  for t in TREES:
    if t[5] == 'gone':
      continue
    for _cam in cams.values():
      if math.hypot(t[0] - _cam['x'], t[1] - _cam['z']) < 4.0:
        t[5] = 'gone'
        nDrop += 1
        break
  if nDrop:
    print('7C dropped trees near cams', nDrop)

  bbox = list(unary_union([chanC.buffer(BAND_YX + 20), Point(*eog).buffer(20)]).bounds)
  z0 = A7B.get('zone') or A7.get('zone') or bbox
  zone7c = [round(v, 1) for v in bbox]
  # 扩 7A/7B zone，让白天水纹覆盖东段（夜关掉，夜 ≤ 昼）
  A7['zone'] = [round(min(z0[0], bbox[0]), 1), round(min(z0[1], bbox[1]), 1),
                round(max(z0[2], bbox[2]), 1), round(max(z0[3], bbox[3]), 1)]
  A7B['zone'] = A7['zone']

  A7CDATA = {
    'yxLen7a': A7B.get('yxLen7a') or A7.get('yxLen7a') or A7.get('yxLen'),
    'yxLen7b': round(len7b, 2),
    'yxLen': round(yx.length, 2),
    'sEast0': round(s_east0, 2),
    'official': {'start': raw['s0'], 'end': raw['s1'], 'real': raw['river_length'],
                 'game': round(yx.length - s_east0, 2)},
    'hw': HW_YX, 'cap': CAP,
    'off': list(OFF),
    'bridges': [b['id'] for b in BRC],
    'plates': plates,
    'byStyle': {st: [b['id'] for b in BRC if b.get('style') == st]
                for st in ('jianshan', 'anon38', 'anon9', 'anon17')},
    'far': far, 'capWall': capWall, 'outlet': [round(eog[0], 2), round(eog[1], 2)],
    'tip': [round(endp[0], 2), round(endp[1], 2)],
    'ramp': ramp,
    'lamps': lamps,
    'capBank': capBank, 'capPast': capPast,
    'cams': cams,
    'zone': zone7c,
    'gone': {'houses': GONE_H, 'trees': GONE_T},
    'jaJnSha1': JA_JN_SHA1,
    'note': '7C：洋下河东段自涧田湖东口延伸至命名东头合拢；涧山巷有名短巷桥；无名桥不挂牌；东头匝道只作远景，不开站不开船',
  }
  g['A7CDATA'] = A7CDATA
  print('7C zone', A7CDATA['zone'], 'yxLen', A7CDATA['yxLen'], 'added', A7CDATA['official']['game'],
        'bridges', A7CDATA['bridges'], 'houses', len(HOUSES) - nH0, 'lamps', len(lamps))
