# 用法：/workspace/.venv-geo/bin/python tools/fzriver/osm_3b.py [osm 目录]（默认 /workspace/fzriver/osm，2026-11-13 抓取）
# 福州内河 3B：晋安河北段（温泉公园 → 琴亭湖）上游接湖的几段无名 river way + 琴亭湖湖面 + 凤坂河中线 + 两条河上 OSM 有名字的路桥，
#   写到 b3_osm_m.json（米，原点东街口站，x 东、z 北；同 rivers_osm_m.json）。
# - 晋安河 way 209804035 北头在 (843, 3549)；再往北到琴亭湖是 4 段无名 waterway=river（286203598 / 209804041 / 209804045 / 209804043，未实地核实名字，按晋安河上游接湖）
# - 琴亭湖 way 286203565（natural=water, lake）；凤坂河 way 456904974（北头 (4535, −922) → 南口 (4484, −2856) 入光明港）
# - 桥：extra.json 里 bridge=yes + name 的 way，和中线相交的（无名桥不放，同 2D / 3A）
# © OpenStreetMap contributors, ODbL
import json, math, os, sys
from shapely.geometry import LineString, Point
from shapely.ops import substring
OSM = sys.argv[1] if len(sys.argv) > 1 else '/workspace/fzriver/osm'
HERE = os.path.dirname(os.path.abspath(__file__))
lat0, lon0 = 26.0890606, 119.2945129
def P(lat, lon): return ((lon - lon0) * 111320 * math.cos(math.radians(lat0)), (lat - lat0) * 110574)
ww = {e['id']: e for e in json.load(open(os.path.join(OSM, 'waterways.json')))['elements']}
ex = {e['id']: e for e in json.load(open(os.path.join(OSM, 'extra.json')))['elements']}
d = json.load(open(os.path.join(HERE, 'rivers_osm_m.json'))); RJ = LineString(d['rivers']['晋安河'])
UP = [286203598, 209804041, 209804045, 209804043]
up = []
for i in UP:
  for p in ww[i]['geometry']:
    q = P(p['lat'], p['lon'])
    if not up or math.dist(up[-1], q) > 0.1: up.append(q)
assert math.dist(up[-1], RJ.coords[0]) < 1, (up[-1], RJ.coords[0])
jnReal = LineString(up + list(substring(RJ, 0, 2300).coords)[1:])   # 湖口 → 晋安河（到温泉公园路桥以南）
lake = [P(p['lat'], p['lon']) for p in ex[286203565]['geometry']]
fb = [P(p['lat'], p['lon']) for p in ww[456904974]['geometry']]
FB = LineString(fb)
bridges = {'jn': {}, 'fb': {}}
for e in ex.values():
  t = e.get('tags', {})
  if e['type'] != 'way' or 'bridge' not in t or not t.get('name') or not e.get('geometry'): continue
  L = LineString([P(p['lat'], p['lon']) for p in e['geometry']])
  for k, line in (('jn', jnReal), ('fb', FB)):
    if not L.intersects(line): continue
    x = L.intersection(line); x = x if x.geom_type == 'Point' else x.centroid
    bridges[k].setdefault(t['name'], []).append({'way': e['id'], 'c': [round(x.x, 1), round(x.y, 1)], 's': round(line.project(x), 1), 'len': round(L.length, 1), 'highway': t.get('highway')})
out = {'source': 'OSM ways 209804035 (晋安河) + 286203598/209804041/209804045/209804043 (无名 river，接琴亭湖) + 286203565 (琴亭湖) + 456904974 (凤坂河) + named bridges (extra.json); © OpenStreetMap contributors, ODbL',
       'jnUp': [[round(x, 1), round(z, 1)] for x, z in up], 'lake': [[round(x, 1), round(z, 1)] for x, z in lake], 'fb': [[round(x, 1), round(z, 1)] for x, z in fb], 'bridges': bridges,
       'note': '晋安河北头到琴亭湖的 4 段 river way 在 OSM 没有名字（按晋安河上游接湖，未实地核实）；凤坂河北头接化工河，3B 只做到这里（前屿西路 / 福马路一带）'}
json.dump(out, open(os.path.join(HERE, 'b3_osm_m.json'), 'w'), ensure_ascii=False, indent=0)
print('jnUp', len(up), 'lake', len(lake), 'fb', len(fb), 'bridges', {k: {n: [b['s'] for b in v] for n, v in B.items()} for k, B in bridges.items()})
