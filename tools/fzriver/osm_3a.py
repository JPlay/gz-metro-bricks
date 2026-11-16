# 用法：/workspace/.venv-geo/bin/python tools/fzriver/osm_3a.py [osm 目录]（默认 /workspace/fzriver/osm，2026-11-13 抓取）
# 福州内河 3A：光明港东段（光明港码头 → 魁岐）真实中线 + 魁岐一带闸坝 + 沿线有名字的路桥，写到 gm_east_osm_m.json（米，原点东街口站，x 东、z 北；同 rivers_osm_m.json）
# 中线：relation 11108281（光明港水面多边形）竖切 / 横切取中点（同 1B gen_e.py 的做法）：东西向一段（x 4970 → 6150）按 x 竖切，南北向一段（z −3300 → −4880）按 z 横切，
#   最后接到中间那组坝（way 780472906 / 780472912 = 游戏里的魁岐九门闸，位置见 PLAN-3 §1；三组坝哪组是九门闸未实地核实）。
# © OpenStreetMap contributors, ODbL
import json, math, os, sys
from shapely.geometry import LineString, Point
from shapely.ops import polygonize, unary_union
OSM = sys.argv[1] if len(sys.argv) > 1 else '/workspace/fzriver/osm'
HERE = os.path.dirname(os.path.abspath(__file__))
lat0, lon0 = 26.0890606, 119.2945129
def P(lat, lon): return ((lon - lon0) * 111320 * math.cos(math.radians(lat0)), (lat - lat0) * 110574)
rel = [e for e in json.load(open(os.path.join(OSM, 'rel.json')))['elements'] if e['id'] == 11108281][0]
outer = [LineString([P(p['lat'], p['lon']) for p in m['geometry']]) for m in rel['members'] if m['role'] == 'outer']
inner = [LineString([P(p['lat'], p['lon']) for p in m['geometry']]) for m in rel['members'] if m['role'] == 'inner']
W = unary_union(list(polygonize(unary_union(outer))))
if inner: W = W.difference(unary_union(list(polygonize(unary_union(inner)))))
g = max(W.geoms, key=lambda q: q.area) if W.geom_type == 'MultiPolygon' else W
def segs(L):
  L = L.intersection(g); return [s for s in ([L] if L.geom_type == 'LineString' else list(getattr(L, 'geoms', []))) if s.geom_type == 'LineString' and s.length > 5]
pts = []
for x in range(4970, 6151, 20):
  S = segs(LineString([(x, -3600), (x, -2600)])); s = min(S, key=lambda q: abs(q.centroid.y + 2950))
  pts.append([round(x, 1), round(s.centroid.y, 1), round(s.length, 1)])
for z in range(-3300, -4881, -20):
  S = segs(LineString([(5800, z), (7600, z)])); s = max(S, key=lambda q: q.length)
  pts.append([round(s.centroid.x, 1), round(z, 1), round(s.length, 1)])
ex = {e['id']: e for e in json.load(open(os.path.join(OSM, 'extra.json')))['elements']}
dams = {i: [[round(a, 1), round(b, 1)] for a, b in [P(p['lat'], p['lon']) for p in ex[i]['geometry']]] for i in (780472905, 780472906, 780472907, 780472912)}
gate = [round(sum(p[0] for i in (780472906, 780472912) for p in dams[i]) / sum(len(dams[i]) for i in (780472906, 780472912)), 1),
        round(sum(p[1] for i in (780472906, 780472912) for p in dams[i]) / sum(len(dams[i]) for i in (780472906, 780472912)), 1)]
bridges = {}
for e in ex.values():
  t = e.get('tags', {})
  if 'bridge' in t and t.get('name') and e.get('geometry') and len(e['geometry']) > 1:
    L = LineString([P(p['lat'], p['lon']) for p in e['geometry']])
    if L.intersects(g) and L.centroid.x > 4700:
      c = L.intersection(g).centroid; bridges.setdefault(t['name'], []).append({'way': e['id'], 'c': [round(c.x, 1), round(c.y, 1)], 'span': round(L.intersection(g).length, 1), 'highway': t.get('highway')})
out = {'source': 'OSM relation 11108281 + ways 780472905/06/07/12 + named bridges (extra.json, lon ≤ 119.36); © OpenStreetMap contributors, ODbL',
       'mid': pts, 'gate': gate, 'dams': {str(k): v for k, v in dams.items()}, 'bridges': bridges,
       'note': '桥只查到 lon ≤ 119.36（x ≤ ~6550 m）：extra.json 的有名桥查询框到 119.36；再往东（南北向一段到魁岐）没有核过桥（3A 里不放桥）'}
json.dump(out, open(os.path.join(HERE, 'gm_east_osm_m.json'), 'w'), ensure_ascii=False, indent=0)
print('mid', len(pts), 'gate', gate, 'bridges', {k: [b['c'] for b in v] for k, v in bridges.items()})
