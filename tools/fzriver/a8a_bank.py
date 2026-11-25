# 8A 湖岸改低驳岸（小美 11-25 20:06 ①）：过了入湖口以后的湖岸墙改成高出水面 ~1 m 的矮驳岸，
# 墙顶后面一条草带、再顺坡升回 0（步道层）。渠段墙不动；墙在入湖口 / 码头水湾 / 可走范围边上渐变回 0。
import math
from shapely.geometry import LineString, Point, Polygon, box, MultiLineString
from shapely.ops import unary_union

DROP = 2.0                      # 驳岸顶 = 水面 + 1.0（WY=-3 → y=-2.0）
D = [0.0, 1.1, 2.3, 3.5, 4.7, 6.0]   # 等距线（离湖岸 m）：0~1.1 草带平台，1.1~6 缓坡回到 0
TAPJ, TAPB = 5.0, 3.0           # 入湖口 / 水湾接头渐变长度（5 m 内降到矮驳岸）；可走范围边界渐变
CH = LineString([(996, -124), (988, -110), (978, -100), (970, -93), (964, -86)]).buffer(6.5, cap_style=2)
CANAL = box(960, -260, 1040, -106)
PIERZ = box(1084, -80, 1112, -40)
# 3号码头岸侧入口（牌 + 引桥落岸）保持步道层：坡在这一圈外 3 m 内收回 0
KEEP = unary_union([Point(1104.6, -69.6).buffer(2.2), LineString([(1098.4, -72.1), (1103.4, -70.0)]).buffer(2.0)])

def smooth(t):
  t = max(0.0, min(1.0, t)); return t * t * (3 - 2 * t)

GS = 2.0
def frange(a, b, st):
  v = a
  while v < b - 1e-6:
    yield v; v += st

def build(g, ctx):
  water, land, region, WALL = ctx['water'], ctx['land'], ctx['region'], ctx['WALL']
  clip = ctx['clip']; CELL = g['CELL']; tri, ccw_up = g['tri'], g['ccw_up']
  # 合拢墙那两条线（立在岸地上）：不画墙面 / 石栏，只留看不见的挡墙（小美 ③）
  ncap = 0
  for C in ctx.get('caps', []):
    hx, hz = C['t'][0] * C['len'] / 2, C['t'][1] * C['len'] / 2
    cl = LineString([(C['x'] - hx, C['z'] - hz), (C['x'] + hx, C['z'] + hz)])
    for w in WALL:
      if w[4] == 0 and cl.distance(Point(w[0], w[1])) < 0.3 and cl.distance(Point(w[2], w[3])) < 0.3:
        w[4] = 3; ncap += 1
  print('8A cap walls -> flag3', ncap)
  lake_w = []
  railed = set()
  for w in WALL:
    mx, mz = (w[0] + w[2]) / 2, (w[1] + w[3]) / 2
    m = Point(mx, mz)
    inP = PIERZ.contains(m)
    # 小美（b6d2e59 复核 A）：3号水湾的 3 m 岸墙也降成矮驳岸 + 草带；原来有石栏的（flag 0 / 6）矮石栏跟着降到驳岸顶，看不见的挡墙保留
    if not (w[4] == 0 or (inP and w[4] == 6)): continue
    if not clip.contains(m): continue
    if CH.contains(m) or CANAL.contains(m): continue
    if mz < -110: continue
    L = math.hypot(w[2] - w[0], w[3] - w[1]) or 1
    nx, nz = (w[3] - w[1]) / L, -(w[2] - w[0]) / L
    if not (water.contains(Point(mx + nx * 0.6, mz + nz * 0.6)) or water.contains(Point(mx - nx * 0.6, mz - nz * 0.6))): continue
    lake_w.append(w)
    if inP: railed.add(id(w))
  ends = {}
  for w in lake_w:
    for p in ((w[0], w[1]), (w[2], w[3])):
      k = (round(p[0] * 20), round(p[1] * 20)); ends[k] = ends.get(k, 0) + 1
  J = [Point(k[0] / 20, k[1] / 20) for k, c in ends.items() if c == 1]
  Jg = unary_union(J) if J else None
  bnd = region.exterior if region.geom_type == 'Polygon' else unary_union([p.exterior for p in region.geoms])
  S = MultiLineString([[(w[0], w[1]), (w[2], w[3])] for w in lake_w])
  lake_ids = set(id(w) for w in lake_w)
  ex = S.buffer(D[-1] + 8).bounds
  others = [w for w in WALL if id(w) not in lake_ids and w[4] != 3 and max(w[0], w[2]) > ex[0] and min(w[0], w[2]) < ex[2] and max(w[1], w[3]) > ex[1] and min(w[1], w[3]) < ex[3]]
  NL = MultiLineString([[(w[0], w[1]), (w[2], w[3])] for w in others]) if others else None
  def taper(x, z):
    p = Point(x, z); f = 1.0
    if Jg is not None: f = min(f, Jg.distance(p) / TAPJ)
    if NL is not None: f = min(f, NL.distance(p) / 4.0)
    f = min(f, bnd.distance(p) / TAPB, KEEP.distance(p) / 3.0)
    return max(0.0, f)
  def Y(x, z):
    d = S.distance(Point(x, z))
    if d >= D[-1] - 1e-3: return 0.0
    base = -DROP if d <= D[1] else -DROP * (1 - smooth((d - D[1]) / (D[-1] - D[1])))
    y = base * taper(x, z)
    return 0.0 if y > -0.004 else round(y, 3)
  for w in lake_w: w[4] = 8 if id(w) in railed else 7   # 8 = 矮驳岸 + 驳岸顶矮石栏 + 看不见的挡墙（3号水湾）
  Bk = [None] + [S.buffer(d, quad_segs=3).simplify(0.12).buffer(0) for d in D[1:]]
  band = land.intersection(Bk[-1]).buffer(0)
  land_main = land.difference(Bk[-1]).buffer(0)
  rings = []
  prev = None
  for k in range(1, len(D)):
    r = land.intersection(Bk[k]) if prev is None else land.intersection(Bk[k]).difference(prev)
    rings.append(r.buffer(0)); prev = Bk[k]
  # 重新三角化受影响的陆地格子（其余格子原样，不动别段像素）
  LAND = g['LAND']; nt = 0
  bx0, bz0, bx1, bz1 = band.bounds
  for i in range(math.floor(bx0 / CELL), math.floor(bx1 / CELL) + 1):
    for jz in range(math.floor(bz0 / CELL), math.floor(bz1 / CELL) + 1):
      cb = box(i * CELL, jz * CELL, (i + 1) * CELL, (jz + 1) * CELL)
      if not cb.intersects(band): continue
      tris = []
      for ri, poly in enumerate([land_main] + rings):
        part = poly.intersection(cb)
        if part.is_empty: continue
        # 坡带按 GS 米网格切小块再三角化，让顶点密到能跟上 Y() 的非线性（防止长三角线性插值出台阶/竖条）
        subs = [part] if ri == 0 else [part.intersection(box(x0, z0, x0 + GS, z0 + GS))
                for x0 in frange(i * CELL, (i + 1) * CELL, GS) for z0 in frange(jz * CELL, (jz + 1) * CELL, GS)]
        for sp in subs:
          if sp.is_empty: continue
          gs = [sp] if sp.geom_type == 'Polygon' else [q for q in getattr(sp, 'geoms', []) if q.geom_type == 'Polygon']
          for q in gs:
            if q.area < 0.01: continue
            tris += [ccw_up(c) for c in tri(q) if abs((c[1][0]-c[0][0])*(c[2][1]-c[0][1])-(c[2][0]-c[0][0])*(c[1][1]-c[0][1])) > 2e-3]
      V = {}; P = []; I = []
      for c in tris:
        ks = [(round(x, 2), round(z, 2)) for x, z in c]
        if len(set(ks)) < 3: continue
        for key in ks:
          if key not in V: V[key] = len(P); P.append(key)
          I.append(V[key])
      ys = [Y(x, z) for x, z in P]
      LAND[f'{i},{jz}'] = {'p': [v for xz in P for v in xz], 'i': I, 'y': ys}
      nt += len(I) // 3
  # 驳岸墙两端顶高（JS 画墙面 / 压顶用）
  low = []
  for w in lake_w:
    ya = round(-DROP * taper(w[0], w[1]), 3); yb = round(-DROP * taper(w[2], w[3]), 3)
    low.append([w[0], w[1], w[2], w[3], ya, yb, w[5] if len(w) > 5 else 1, 1 if w[4] == 8 else 0])
  print('8A low bank: lake walls', len(lake_w), 'railed(bay)', len(railed), 'junctions', len(J), 'band area', round(band.area, 1), 'cell tris', nt)
  return {'band': band, 'Y': Y, 'low': low, 'S': S, 'drop': DROP, 'D': D[-1]}
