# 福州内河 7C：从涧田湖东口沿洋下河东段走到命名东头合拢（合拢墙 + 远景，同 6B）。
# PLAN-洋下河 v2 §6（小美定）。由 gen_e.py 在 a7b.build_lake 之后调用。
# 干净拆掉 7B 湖东北出水口合拢；7A/7B 中线前缀、ja/jn、7B 环湖一律不改。
import json, math, os, random
from shapely.geometry import LineString, Polygon, Point, box
from shapely.ops import unary_union
from a6 import (_tan, _dedupe, _resample, _smooth_radius, _bez)
from a7a import _chaikin_safe, CAP, HW_YX, BAND_YX, JA_JN_SHA1

HOLD = 8.0
# 湖面交叉只作里程。西口到东口 te0 线侧向约 53 m，湖面长轴宽度也差不多，
# 在湖内用短 S 弯做不到 minR≥25，所以用 R=28 的 RSR（先右再右，贴湖西/南绕行，再沿 te0 进东口）。
# 水面不沿这段中线拉伸，只从 s_east0 起用小胶囊接上东段。
LAKE_R = 28.0
LAKE_HOLD = 10.0
LAKE_APPR = 32.0


def _arc_pts(C, a0, dtheta, rad, step=1.5):
  n = max(2, int(abs(dtheta) * rad / step))
  return [(C[0] + math.cos(a0 + dtheta * i / n) * rad,
           C[1] + math.sin(a0 + dtheta * i / n) * rad) for i in range(1, n + 1)]


def _minr_window(ls, s0, s1, ds=6.0, step=0.5):
  """6 m 窗口最小曲率半径（游戏单位）。"""
  worst, at, pt = 1e9, s0, None
  s = max(0.0, s0)
  end = min(ls.length, s1)
  while s <= end - ds:
    a = ls.interpolate(s)
    ta, tb = _tan(ls, s), _tan(ls, s + ds)
    d = math.atan2(tb[1], tb[0]) - math.atan2(ta[1], ta[0])
    d -= 2 * math.pi * round(d / (2 * math.pi))
    r = ds / max(1e-9, abs(d))
    if r < worst:
      worst, at, pt = r, s, (a.x, a.y)
    s += step
  return worst, pt, at


def _lake_crossing(p0, T0, eog, te0, R=LAKE_R, hold=LAKE_HOLD, appr=LAKE_APPR):
  """西口锁点 C1 接到东口 te0 长接近段：RSR，半径 R，持平 hold，接近 appr。"""
  def add(A, B, s=1.0):
    return (A[0] + s * B[0], A[1] + s * B[1])
  def nrm(v):
    L = math.hypot(*v) or 1
    return (v[0] / L, v[1] / L)
  def left(T):
    return (-T[1], T[0])
  def ang_at(C, P):
    return math.atan2(P[1] - C[1], P[0] - C[0])
  def cw_delta(a0, a1):
    d = (a1 - a0 + math.pi * 3) % (2 * math.pi) - math.pi
    if d > 0:
      d -= 2 * math.pi
    return d

  Ph = add(p0, T0, hold)
  Ap = add(eog, te0, -appr)
  Cs = add(Ph, left(T0), -R)
  Ce = add(Ap, left(te0), -R)
  H = nrm((Ce[0] - Cs[0], Ce[1] - Cs[1]))
  Pts = add(Cs, left(H), R)
  Pte = add(Ce, left(H), R)
  a0s = ang_at(Cs, Ph)
  d1 = cw_delta(a0s, ang_at(Cs, Pts))
  a0e = ang_at(Ce, Pte)
  d2 = cw_delta(a0e, ang_at(Ce, Ap))

  pts = [p0]
  n_h = max(1, int(hold / 2))
  for i in range(1, n_h + 1):
    pts.append(add(p0, T0, hold * i / n_h))
  pts += _arc_pts(Cs, a0s, d1, R)
  if math.hypot(pts[-1][0] - Pts[0], pts[-1][1] - Pts[1]) > 0.2:
    pts.append(Pts)
  slen = math.hypot(Pte[0] - Pts[0], Pte[1] - Pts[1])
  n_s = max(1, int(slen / 2))
  for i in range(1, n_s + 1):
    t = i / n_s
    pts.append((Pts[0] + t * (Pte[0] - Pts[0]), Pts[1] + t * (Pte[1] - Pts[1])))
  pts += _arc_pts(Ce, a0e, d2, R)
  if math.hypot(pts[-1][0] - Ap[0], pts[-1][1] - Ap[1]) > 0.2:
    pts.append(Ap)
  n_a = max(1, int(appr / 2))
  for i in range(1, n_a + 1):
    pts.append(add(Ap, te0, appr * i / n_a))
  return _dedupe(pts, 0.4)



def _fillet_radius(ls, rmin=26.5, lock=0.0, step=1.5):
  """把 lock 之后、航向变化会使 6 m 窗口半径小于 rmin 的折角换成圆弧。"""
  pts = [tuple(q) for q in ls.coords]
  acc = [0.0]
  for i in range(1, len(pts)):
    acc.append(acc[-1] + math.dist(pts[i - 1], pts[i]))
  turn_lim = 6.0 / rmin
  out = [pts[0]]
  for i in range(1, len(pts) - 1):
    a, b, c = pts[i - 1], pts[i], pts[i + 1]
    va = (a[0] - b[0], a[1] - b[1])
    vc = (c[0] - b[0], c[1] - b[1])
    La, Lc = math.hypot(*va) or 1.0, math.hypot(*vc) or 1.0
    ua, uc = (va[0] / La, va[1] / La), (vc[0] / Lc, vc[1] / Lc)
    dot = max(-1.0, min(1.0, ua[0] * uc[0] + ua[1] * uc[1]))
    turn = math.pi - math.acos(dot)
    if acc[i] < lock or turn <= turn_lim or La < 0.8 or Lc < 0.8:
      if math.dist(out[-1], b) > 0.25:
        out.append(b)
      continue
    T = rmin * math.tan(turn / 2.0)
    T = min(T, La * 0.45, Lc * 0.45)
    if T < 0.5:
      if math.dist(out[-1], b) > 0.25:
        out.append(b)
      continue
    R = T / math.tan(turn / 2.0)
    T_in = (-ua[0], -ua[1])
    T_out = uc
    cross = T_in[0] * T_out[1] - T_in[1] * T_out[0]
    sgn = 1.0 if cross >= 0 else -1.0
    P1 = (b[0] + ua[0] * T, b[1] + ua[1] * T)
    P2 = (b[0] + uc[0] * T, b[1] + uc[1] * T)
    left_in = (-T_in[1], T_in[0])
    Ctr = (P1[0] + sgn * R * left_in[0], P1[1] + sgn * R * left_in[1])
    a0 = math.atan2(P1[1] - Ctr[1], P1[0] - Ctr[0])
    a1 = math.atan2(P2[1] - Ctr[1], P2[0] - Ctr[0])
    da = (a1 - a0 + math.pi * 3) % (2 * math.pi) - math.pi
    if sgn > 0 and da < 0: da += 2 * math.pi
    if sgn < 0 and da > 0: da -= 2 * math.pi
    if math.dist(out[-1], P1) > 0.35:
      out.append(P1)
    n = max(2, int(abs(da) * R / step))
    for k in range(1, n + 1):
      ang = a0 + da * k / n
      out.append((Ctr[0] + math.cos(ang) * R, Ctr[1] + math.sin(ang) * R))
  out.append(pts[-1])
  return LineString(_dedupe(out, 0.3))


def _widen_east(ls, lock, rmin=28.0, simp=8.0, keep0=12.0):
  """东段 OSM 折角在 6 m 窗口下紧于 25 m：先简化再按 rmin 倒圆，前 keep0 m 原样以保住东口 C1。"""
  pts = [tuple(q) for q in ls.coords]
  acc, k = 0.0, 0
  for i in range(1, len(pts)):
    acc += math.dist(pts[i - 1], pts[i])
    if acc >= lock:
      k = i
      break
  if k <= 0 or k >= len(pts) - 2:
    return ls
  head, tail = pts[:k + 1], pts[k:]
  tline = LineString(tail)
  pre = [tail[0]]
  acc, idx = 0.0, 0
  for i in range(1, len(tail)):
    acc += math.dist(tail[i - 1], tail[i])
    if acc < keep0:
      pre.append(tail[i])
      idx = i
    else:
      break
  mid_start = list(tline.interpolate(min(keep0, tline.length)).coords)[0]
  if keep0 > 0 and math.dist(pre[-1], mid_start) > 0.2:
    pre.append(mid_start)
  mid = ([mid_start] if keep0 > 0 else list(tail[:1])) + list(tail[idx + 1:])
  ms = LineString(mid).simplify(simp, preserve_topology=False)
  ms = _fillet_radius(ms, rmin, lock=0.0, step=1.5)
  ts = _resample(LineString(_dedupe((pre[:-1] if keep0 else []) + list(ms.coords), 0.3)), 2.0)
  return LineString(_dedupe(head[:-1] + list(ts.coords), 0.3))


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
  # 持平 10 m 锁住 T0，再 R=28 RSR 接到 te0 长接近段（32 m）进东口。
  lake_path = _lake_crossing(p0, T0, eog, te0)

  s_tgt = min(48.0, max(28.0, Losm.length * 0.06))
  P3 = (Losm.interpolate(s_tgt).x, Losm.interpolate(s_tgt).y)
  T3 = _tan(Losm, s_tgt)
  C = 24.0
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
  # 湖面 RSR 已经是精确 R=28，不要再 _smooth_radius 锁点后 20 m（会把圆弧拉尖）。
  # 若东段 OSM 接头不够圆，只修 s_east0 之后。
  s_east0_guess = yx.project(Point(*eog))
  r_new, p_new, s_new = _minr_window(yx, len7b, yx.length)
  print('7C yx minR new', round(r_new, 2), 'at', tuple(round(v, 2) for v in (p_new or (0, 0))),
        's', round(s_new, 1), 'len', round(yx.length, 2), 'end', tuple(round(v, 2) for v in yx.coords[-1]))
  if r_new < 25.9:
    yx = _widen_east(yx, lock=max(s_east0_guess + 8.0, len7b + 20.0), rmin=28.0, simp=8.0, keep0=12.0)
    r_new, p_new, s_new = _minr_window(yx, len7b, yx.length)
    print('7C yx minR after widen-east', round(r_new, 2), 'at', tuple(round(v, 2) for v in (p_new or (0, 0))),
          's', round(s_new, 1), 'len', round(yx.length, 2))
  r0, pmin, smin = r_new, p_new, s_new

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
  left, right, s = [], [], max(0.0, s_east0 - 2.0)
  while s <= yx.length + 1e-6:
    ss = min(s, yx.length)
    p = yx.interpolate(ss); t = _tan(yx, ss); n = (t[1], -t[0])
    left.append((p.x - n[0] * HW_YX, p.y - n[1] * HW_YX))
    right.append((p.x + n[0] * HW_YX, p.y + n[1] * HW_YX))
    s += 0.8
  chanC = Polygon(left + right[::-1]).buffer(0).simplify(0.06)
  if chanC.geom_type != 'Polygon':
    chanC = max(chanC.geoms, key=lambda q: q.area)
  # 小胶囊沿 te0 伸进湖 3 m，盖掉旧合拢缝；不要用 HW_YX+6 圆盘（会淹东北岸与 loop pt5）。
  mouth = LineString([
    (eog[0] - te0[0] * 3.0, eog[1] - te0[1] * 3.0),
    (eog[0] + te0[0] * 2.0, eog[1] + te0[1] * 2.0),
  ]).buffer(HW_YX + 0.6, cap_style='flat')
  chanC = unary_union([chanC, mouth]).buffer(0.12).buffer(-0.06)
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

  gaps7c = []
  for b in BRC:
    def corners(au, cv, bb=b):
      return [(bb['x'] + bb['t'][0] * a + bb['n'][0] * c, bb['z'] + bb['t'][1] * a + bb['n'][1] * c)
              for a, c in [(-au, -cv), (au, -cv), (au, cv), (-au, cv)]]
    # 缺口要比 deck half 再伸出到岸边步道（hw+2.8），否则岸墙卡在桥头，两岸不通。
    gap = Polygon(corners(b['w'] / 2 - 0.05, max(b['half'] + 1.6, HW_YX + 3.2)))
    g['GAPS'].append(gap)
    gaps7c.append(gap)
    b['foot'] = Polygon(corners(b['w'] / 2, b['half']))
  # 只挖 7C 东段桥下，不要用全局 GAPS（会误拆 7A/7B 岸墙）。
  gapU = unary_union(gaps7c) if gaps7c else Point(0, 0)
  if not gapU.is_empty:
    punched = []
    n_gap = 0
    for w in g['WALL']:
      seg = LineString([(w[0], w[1]), (w[2], w[3])])
      if gapU.buffer(0.15).intersects(seg):
        n_gap += 1
        continue
      punched.append(w)
    g['WALL'] = punched
    print('7C walls punched under 7C bridge gaps', n_gap, 'remaining', len(punched))

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

  def _on_land(q, pad=0.5):
    P = Point(q[0], q[1])
    return region.contains(P) and not water.buffer(pad).contains(P)

  def _nudge_land(q, prefer=(0, 0)):
    if _on_land(q):
      return [round(q[0], 2), round(q[1], 2)]
    for rad in (1, 2, 3, 4, 5, 6, 8, 10, 12):
      for k in range(16):
        a = k * math.pi / 8
        cand = (q[0] + prefer[0] * rad * 0.55 + rad * math.cos(a) * 0.85,
                q[1] + prefer[1] * rad * 0.55 + rad * math.sin(a) * 0.85)
        if _on_land(cand):
          return [round(cand[0], 2), round(cand[1], 2)]
    return [round(q[0], 2), round(q[1], 2)]

  # 湖东北岸（出水口北侧步道）：7B 旧 capBank 距出水口约 3 m，开出口后落在河道里，要挪到岸上。
  left_te = (-te0[1], te0[0])
  lakeMouthBank = _nudge_land(
    (eog[0] - te0[0] * 4.0 + left_te[0] * 8.2, eog[1] - te0[1] * 4.0 + left_te[1] * 8.2),
    left_te)
  A7B['capBank'] = lakeMouthBank
  A7B['lakeMouthBank'] = lakeMouthBank
  new_loop = []
  for pt in (A7B.get('loop') or []):
    if water.buffer(0.4).contains(Point(pt[0], pt[1])):
      vx, vz = pt[0] - eog[0], pt[1] - eog[1]
      # 靠北岸的点（pt5）沿 left_te 推到步道上，不要沿河道中线挪。
      side = left_te if (vx * left_te[0] + vz * left_te[1]) >= 0 else (-left_te[0], -left_te[1])
      new_loop.append(_nudge_land(pt, side))
    else:
      new_loop.append(list(pt))
  A7B['loop'] = new_loop
  mouthOpen = None
  for side, ds in ((-1, 8), (1, 8), (-1, 12), (1, 12), (-1, 6), (1, 6), (-1, 16), (1, 16)):
    (qx, qz), _, _ = at_yx(s_east0 + ds, side * (HW_YX + 2.8))
    if _on_land((qx, qz)):
      mouthOpen = [round(qx, 2), round(qz, 2)]
      break
  if mouthOpen is None:
    (qx, qz), _, _ = at_yx(s_east0 + 8, -(HW_YX + 2.8))
    mouthOpen = _nudge_land((qx, qz), left_te)
  A7B['mouthOpen'] = mouthOpen
  print('7C lakeMouthBank', lakeMouthBank, 'mouthOpen', mouthOpen,
        'loop-in-water', sum(1 for pt in new_loop if not _on_land(pt, 0.4)))

  def cam_at(x, z, look, y=1.55, pitch=0.08, note=''):
    return {'x': round(x, 2), 'y': y, 'z': round(z, 2),
            'look': [round(look[0], 2), 1.2, round(look[1], 2)], 'pitch': pitch, 'note': note}

  def _cam_ok(x, z):
    cp = Point(x, z)
    if (not region.contains(cp)) or water.buffer(0.6).contains(cp):
      return False
    for h in HOUSES:
      if h.get('gone'):
        continue
      if _hpoly0(h).distance(cp) < 2.6:
        return False
    for tr in TREES:
      if tr[5] == 'gone':
        continue
      if math.hypot(tr[0] - x, tr[1] - z) < 3.5:
        return False
    return True

  def _clear_front(x, z, look, near=3.6, far=8.0):
    """前景不要牌/灯杆/树干/房墙：沿视线 3.6–8 m 的柱状物会顶满画面。"""
    lx, lz = look[0] - x, look[1] - z
    L = math.hypot(lx, lz) or 1
    ux, uz = lx / L, lz / L
    def in_cone(px, pz, rad):
      dx, dz = px - x, pz - z
      along = dx * ux + dz * uz
      if along < 0.2 or along > far:
        return False
      lat = abs(dx * uz - dz * ux)
      return math.hypot(dx, dz) < rad and lat < 2.4
    for P in plates:
      if math.hypot(P['x'] - x, P['z'] - z) < 7.5 or in_cone(P['x'], P['z'], 8.0):
        return False
    for lam in lamps:
      if in_cone(lam[0], lam[1], 4.2) or math.hypot(lam[0] - x, lam[1] - z) < 3.2:
        return False
    for tr in TREES:
      if tr[5] == 'gone':
        continue
      if in_cone(tr[0], tr[1], 4.0):
        return False
    for h in HOUSES:
      if h.get('gone'):
        continue
      # 用房屋轮廓而不是中心：7.5 m 外的中心仍可能把墙顶在眼前
      if _hpoly0(h).distance(Point(x, z)) < 6.0 or in_cone(h['x'], h['z'], 8.0):
        # 只拦视线前方的墙，侧向沿街的房子可以入画
        dx, dz = h['x'] - x, h['z'] - z
        along = dx * ux + dz * uz
        if along > 0.4 and _hpoly0(h).distance(Point(x, z)) < 10.0:
          # 轮廓本身伸进视线锥也拒
          if _hpoly0(h).intersects(LineString([(x, z), (x + ux * 14.0, z + uz * 14.0)]).buffer(1.6)):
            return False
    return True

  def _under_ramp(x, z):
    Rmp = ramp
    if not Rmp:
      return False
    fx, fz = Rmp['f'][0], Rmp['f'][1]
    # 匝道板中心在 (x,z)，沿 f 向长 len、横向宽 w。多留边，避免站在板端外侧仍顶着赭色底。
    dx, dz = x - Rmp['x'], z - Rmp['z']
    along = dx * fx + dz * fz
    lat = abs(-dx * fz + dz * fx)
    return abs(along) < Rmp['len'] / 2 + 8.0 and lat < Rmp['w'] / 2 + 4.0

  def _ramp_poly():
    Rmp = ramp
    fx, fz = Rmp['f'][0], Rmp['f'][1]
    tx, tz = Rmp['t'][0], Rmp['t'][1]
    cx, cz = Rmp['x'], Rmp['z']
    hl, hw = Rmp['len'] / 2.0, Rmp['w'] / 2.0
    return Polygon([
      (cx + fx * a + tx * b, cz + fz * a + tz * b)
      for a, b in ((-hl, -hw), (-hl, hw), (hl, hw), (hl, -hw))
    ])

  def _ramp_in_view(x, z, look, half_deg=30.0, reach=36.0):
    """只拦合拢墙河侧的匝道悬挑（头顶/前景）；墙外远景板可以入画。"""
    if not ramp:
      return False
    if _under_ramp(x, z):
      return True
    lx, lz = look[0] - x, look[1] - z
    L = math.hypot(lx, lz) or 1
    ux, uz = lx / L, lz / L
    tan_h = math.tan(math.radians(half_deg))
    poly = _ramp_poly()
    pts = list(poly.exterior.coords)
    for i in range(len(poly.exterior.coords) - 1):
      a, b = poly.exterior.coords[i], poly.exterior.coords[i + 1]
      for t in (0.0, 0.25, 0.5, 0.75):
        pts.append((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t))
    for px, pz in pts:
      # 墙外（沿 te 朝合拢外）是远景，放过
      back = -((px - wall_p[0]) * te[0] + (pz - wall_p[1]) * te[1])
      if back <= 0.8:
        continue
      dx, dz = px - x, pz - z
      along = dx * ux + dz * uz
      if along < 0.8 or along > reach:
        continue
      lat = abs(dx * uz - dz * ux)
      ang = math.degrees(math.atan2(lat, along))
      # 近处/头顶，或太靠近画面中心的悬挑才拒；17 m 外、偏在画边的远景板放过
      if along < 15.0 and lat < along * tan_h:
        return True
      if ang < 22.0 and along < 28.0 and lat < along * tan_h:
        return True
    return False

  def _look_hits(x, z, look, reach=16.0):
    """前方 reach 米内视线不要撞上房墙。"""
    lx, lz = look[0] - x, look[1] - z
    L = math.hypot(lx, lz) or 1
    ux, uz = lx / L, lz / L
    hit = LineString([(x + ux * 0.6, z + uz * 0.6), (x + ux * reach, z + uz * reach)]).buffer(1.6)
    for h in HOUSES:
      if h.get('gone'):
        continue
      if _hpoly0(h).intersects(hit):
        return True
    return False

  cams = {}
  look_m = (eog[0] + te0[0] * 18, eog[1] + te0[1] * 18)
  placed_m = False
  for ds in (2, 4, 0, 6, 8, -2):
    for side in (-1, 1):
      for off in (HW_YX + 5.5, HW_YX + 7, HW_YX + 4.5, HW_YX + 8, HW_YX + 10):
        (mx, mz), _, _ = at_yx(max(s_east0 + ds, s_east0), side * off)
        if _cam_ok(mx, mz) and _clear_front(mx, mz, look_m):
          cams['mouth'] = cam_at(mx, mz, look_m, note='涧田湖东口看出水，沿东段')
          placed_m = True
          break
      if placed_m:
        break
    if placed_m:
      break
  if not placed_m:
    (mx, mz), _, _ = at_yx(s_east0 + 2, -(HW_YX + 4.5))
    cams['mouth'] = cam_at(mx, mz, look_m, note='涧田湖东口看出水，沿东段')
    print('WARN cam mouth fallback', (round(mx, 2), round(mz, 2)))

  def _place_bridge_cam(b, note):
    look = (b['x'], b['z'])
    # 先试离牌更远的 n 向后退，再沿桥切向错开，避开灯杆/石牌顶满前景。
    for sgn in (1, -1):
      for along_n in (11, 13, 15, 9, 17, 8):
        for along_t in (0, 3.5, -3.5, 5.5, -5.5, 7.5, -7.5, 2, -2):
          x = b['x'] + b['n'][0] * sgn * along_n + b['t'][0] * along_t
          z = b['z'] + b['n'][1] * sgn * along_n + b['t'][1] * along_t
          if not _cam_ok(x, z) or not _clear_front(x, z, look):
            continue
          return cam_at(x, z, look, note=note)
    # 退回：至少拉开与牌的距离
    x = b['x'] + b['n'][0] * (b['half'] + 10)
    z = b['z'] + b['n'][1] * (b['half'] + 10)
    return cam_at(x, z, look, note=note)

  for b in BRC:
    if b.get('style') == 'jianshan' and b.get('plate'):
      cams['jianshan'] = _place_bridge_cam(b, '涧山巷')
    elif b.get('style') == 'anon38':
      cams['anon38'] = _place_bridge_cam(b, '无名 38 m 跨')
    elif b.get('style') == 'anon9':
      cams['anon9'] = _place_bridge_cam(b, '无名 9 m 跨')
    elif b.get('style') == 'anon17':
      cams['anon17'] = _place_bridge_cam(b, '无名 17 m 跨')

  # 南岸街景：站在河与房子之间的步道上沿街看，一侧是水，一侧是房，不要站到房子背后去对空地。
  def _wall_ahead(x, z, look, reach=12.0, half_deg=18.0):
    lx, lz = look[0] - x, look[1] - z
    L = math.hypot(lx, lz) or 1
    ux, uz = lx / L, lz / L
    ray = LineString([(x + ux * 0.8, z + uz * 0.8), (x + ux * reach, z + uz * reach)]).buffer(0.9)
    for h in HOUSES:
      if h.get('gone'):
        continue
      poly = _hpoly0(h)
      dx, dz = h['x'] - x, h['z'] - z
      along = dx * ux + dz * uz
      if along < 0.8 or along > reach + 3:
        continue
      lat = abs(dx * uz - dz * ux)
      ang = math.degrees(math.atan2(lat, along))
      if ang < half_deg and poly.intersects(ray):
        return True
    return False

  mid_s = (s_east0 + yx.length) / 2
  found_s = None
  best_s = None
  s_tries = [mid_s + d for d in (0, -16, 16, -32, 32, -48, 48, -64, 64, 12, -12, 24, -24, 40, -40, 80, -80)]
  for s_try in s_tries:
    if s_try < s_east0 + 24 or s_try > yx.length - 40:
      continue
    for side in (-1, 1):
      for off in (HW_YX + 6.5, HW_YX + 7.5, HW_YX + 8.5, HW_YX + 9.5, HW_YX + 5.8):
        (sx, sz), tdir, nn = at_yx(s_try, side * off)
        if not _cam_ok(sx, sz):
          continue
        wd = Point(sx, sz).distance(water)
        if not (4.0 <= wd <= 10.5):
          continue
        for sg, inward in ((1, 3.0), (1, 1.5), (1, 5.0), (-1, 3.0), (-1, 1.5)):
          look = (sx + tdir[0] * sg * 26.0 - nn[0] * side * inward,
                  sz + tdir[1] * sg * 26.0 - nn[1] * side * inward)
          if _wall_ahead(sx, sz, look, 12.0, 18.0):
            continue
          lx, lz = look[0] - sx, look[1] - sz
          L = math.hypot(lx, lz) or 1
          ux, uz = lx / L, lz / L
          lamp_ok = True
          for lam in lamps:
            dx, dz = lam[0] - sx, lam[1] - sz
            along = dx * ux + dz * uz
            lat = abs(dx * uz - dz * ux)
            if 0.4 < along < 4.0 and lat < 1.2:
              lamp_ok = False
              break
          if not lamp_ok:
            continue
          score = 2.0
          n_side = 0
          for h in HOUSES:
            if h.get('gone'):
              continue
            dx, dz = h['x'] - sx, h['z'] - sz
            along = dx * ux + dz * uz
            dist = math.hypot(dx, dz)
            if 4.0 < dist < 22.0 and 3.0 < along < 22.0:
              ang = math.degrees(math.atan2(abs(dx * uz - dz * ux), along))
              if 18.0 <= ang <= 70.0:
                n_side += 1
          score += min(n_side, 3) * 2
          score += max(0.0, 9.0 - abs(wd - 7.0))
          rec = (score, sx, sz, look, s_try, side, off, wd, n_side)
          if best_s is None or rec[0] > best_s[0]:
            best_s = rec
  if best_s and best_s[0] >= 4.0:
    found_s = best_s
    cams['south'] = cam_at(found_s[1], found_s[2], found_s[3], pitch=0.10, note='东段南岸街景')
    print('7C cam south at s', round(found_s[4], 1), 'side', found_s[5], 'off', found_s[6],
          'dWater', round(found_s[7], 1), 'nSideH', found_s[8], 'score', round(found_s[0], 1))
  else:
    (sx, sz), tdir, nn = at_yx(mid_s, -(HW_YX + 7.5))
    look = (sx + tdir[0] * 26.0 + nn[0] * 3.0, sz + tdir[1] * 26.0 + nn[1] * 3.0)
    cams['south'] = cam_at(sx, sz, look, pitch=0.10, note='东段南岸街景')
    print('WARN cam south fallback', (round(sx, 2), round(sz, 2)), 'best', None if not best_s else best_s[0])


  # 合拢机位：站在岸上斜看合拢墙和水面；不要站在河侧悬挑下，墙外远景板可以入画。
  placed_c = False
  for back in (16, 18, 20, 14, 22, 12, 10, 24, 8):
    for lat in (16, -16, 18, -18, 14, -14, 20, -20, 12, -12, 22, -22, 10, -10):
      cx = wall_p[0] - te[0] * back + ne[0] * lat
      cz = wall_p[1] - te[1] * back + ne[1] * lat
      look_c = (wall_p[0] - te[0] * 1.0 + ne[0] * (12.0 if lat >= 0 else -12.0),
                wall_p[1] - te[1] * 1.0 + ne[1] * (12.0 if lat >= 0 else -12.0))
      if _under_ramp(cx, cz) or _ramp_in_view(cx, cz, look_c):
        continue
      if _cam_ok(cx, cz) and _clear_front(cx, cz, look_c) and not _look_hits(cx, cz, look_c, 12.0):
        cams['cap'] = cam_at(cx, cz, look_c, pitch=0.08, note='命名东头合拢')
        placed_c = True
        print('7C cam cap back', back, 'lat', lat, 'dRamp', round(_ramp_poly().distance(Point(cx, cz)), 1))
        break
    if placed_c:
      break
  if not placed_c:
    print('WARN cam cap no candidate, scanning leftovers')
    for back in range(8, 28, 2):
      for lat in (18, -18, 16, -16, 20, -20, 14, -14, 22, -22):
        cx = wall_p[0] - te[0] * back + ne[0] * lat
        cz = wall_p[1] - te[1] * back + ne[1] * lat
        look_c = (wall_p[0], wall_p[1])
        if _under_ramp(cx, cz) or _ramp_in_view(cx, cz, look_c):
          continue
        if _cam_ok(cx, cz) and not _look_hits(cx, cz, look_c, 10.0):
          cams['cap'] = cam_at(cx, cz, look_c, pitch=0.08, note='命名东头合拢')
          placed_c = True
          print('7C cam cap leftover back', back, 'lat', lat)
          break
      if placed_c:
        break
  if not placed_c:
    print('WARN cam cap could not place')

  # 7B/7C 接缝：站在湖东北岸，沿 te0 看出水口
  jx, jz = lakeMouthBank
  look_j = (eog[0] + te0[0] * 18, eog[1] + te0[1] * 18)
  placed_j = False
  for back in (0, 1, 2, 3, 4, 5, 6):
    cand = (jx + left_te[0] * back * 0.8 - te0[0] * back * 0.2,
            jz + left_te[1] * back * 0.8 - te0[1] * back * 0.2)
    if _cam_ok(*cand) and _clear_front(*cand, look_j):
      jx, jz = cand
      placed_j = True
      break
  if not placed_j:
    for back in (0, 1, 2, 3, 4, 5):
      cand = (jx + left_te[0] * back * 0.8 - te0[0] * back * 0.2,
              jz + left_te[1] * back * 0.8 - te0[1] * back * 0.2)
      if _cam_ok(*cand):
        jx, jz = cand
        placed_j = True
        break
  cams['joint'] = cam_at(jx, jz, look_j, note='7B/7C 涧田湖东口接缝')
  if not placed_j:
    print('WARN cam joint not clear', (jx, jz))

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
    'mouthOpen': mouthOpen, 'lakeMouthBank': lakeMouthBank,
    'minR': round(r0, 2),
    'minRAt': [round(pmin[0], 2), round(pmin[1], 2)] if pmin else None,
    'minRS': round(smin, 2),
    'minRMouth': round(_minr_window(yx, s_east0 - 40, s_east0 + 40)[0], 2),
    'cams': cams,
    'zone': zone7c,
    'gone': {'houses': GONE_H, 'trees': GONE_T},
    'jaJnSha1': JA_JN_SHA1,
    'note': '7C：洋下河东段自涧田湖东口延伸至命名东头合拢；涧山巷有名短巷桥；无名桥不挂牌；东头匝道只作远景，不开站不开船',
  }
  g['A7CDATA'] = A7CDATA
  print('7C zone', A7CDATA['zone'], 'yxLen', A7CDATA['yxLen'], 'added', A7CDATA['official']['game'],
        'bridges', A7CDATA['bridges'], 'houses', len(HOUSES) - nH0, 'lamps', len(lamps),
        'minR', A7CDATA['minR'], 'minRMouth', A7CDATA['minRMouth'], 'sEast0', A7CDATA['sEast0'])
