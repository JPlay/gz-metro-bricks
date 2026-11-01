# 乌石浦 · SM 商场：每栋楼都是真的多层商场（xmSMMall.js）
#  · 一期 / 黄宝石 / 红宝石 / 蓝宝石：1F 坐扶梯一层层到顶层（每层走几步、核对高度和楼层），顶层坐观光电梯（点轿厢里的楼层按钮）回 1F
#  · 一期：楼梯间 1F → 2F → 1F
#  · 天桥：一期 2F 门 → 天桥 1 → 黄宝石 2F → 回一期；一期 2F 门 → 天桥 2 → 三期 2F → 回一期；每次进门后走到扶梯口
#  · 每个视角 ≤ 9 万三角形、≤ 50 draw；SHOTS=目录 时存截图（带 FPS / draws / tris 角标）
import asyncio, sys, json, os, math
sys.path.insert(0, os.path.dirname(__file__))
from common import *
from journey import GCLOCK, auto, log, tap
from perfhud import perf, overlay, overlay_off
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8177/'
OUT = os.environ.get('SHOTS'); OUT2 = os.environ.get('SHOTS2') or OUT
ONLY = (os.environ.get('MALLS') or 'sm-city,sm-topaz,sm-ruby,sm-sapphire').split(',')
XS, TRIS, DRAWS, FH = 4000, 90000, 50, 5.5
R = {'checks': {}, 'perf': {}}
def ok(k, v): R['checks'][k] = bool(v); log('check', k, bool(v)); return v
ST = '(() => { const m = __game.xmMetro, s = __game.state(), i = m.street && m.street.inside; return { pos: s.pos, zone: s.zone, inside: i ? i.id : null, gate: i ? i.o.gate : null, floor: s.zone === "interior" && i ? i.floorOf(__game.player.position) + 1 : null, lift: i && i.lift ? i.info().lift : null }; })()'
async def S(pg): return await pg.evaluate(ST)
async def info(pg): return await pg.evaluate('(() => { const i = __game.xmMetro.street.inside; return i ? i.info() : null; })()')
async def org(pg): return await pg.evaluate('(() => { const i = __game.xmMetro.street.inside; return i ? i.o : null; })()')
async def view(pg, v):
  if await pg.evaluate('__game.player.view') != v: await pg.evaluate('__game.toggleView()')
async def shot(pg, name, label, out=None):
  await asyncio.sleep(1.2); d = await perf(pg, 3, 0.25); R['perf'][name] = d; log('perf', name, d)
  ok(name + ':budget', d['tris'] <= TRIS and d['draws'] <= DRAWS)
  o = out or OUT
  if o: await overlay(pg, d, label); await pg.screenshot(path=f'{o}/{name}.jpg', type='jpeg', quality=82); await overlay_off(pg)
async def pose(pg, x, y, z, yaw, pitch=0.0):
  await pg.evaluate(f"(() => {{ const p = __game.player; p.spawn({x}, {y}, {z}, {yaw}); p.yaw = {yaw}; p.pitch = {pitch}; }})()"); await asyncio.sleep(0.4)
async def go(pg, o, pts):   # 楼内局部坐标 → 世界坐标
  return await auto(pg, [[o['x'] + x, o['z'] + z] for x, z in pts])
def atY(s, o, f, tol=0.5): return s['pos'][1] is not None and abs(s['pos'][1] - o['y'] - f * FH) < tol

async def walk_steps(pg, o, I, f, side):   # 到了 f 层（0 起）：在走廊里走几步，核对位置 / 高度 / 楼层
  x, z = (3.2, side * 12.2)
  ok_ = await go(pg, o, [[x, 21 + z]]); s = await S(pg)
  ok(f"{I['id']}:walk{f + 1}F", ok_ and atY(s, o, f) and s['floor'] == f + 1 and abs(s['pos'][0] - o['x'] - x) < 1.2 and abs(s['pos'][2] - o['z'] - 21 - z) < 1.2)

async def climb(pg, I, o, mid):
  NF, sx = I['floors'], I['edge']['sx']
  await go(pg, o, [[0, 7], [-0.9, sx[0][0] - 1.4]])
  for p in range(NF - 1):
    x = -0.9 if p % 2 == 0 else -2.7; Sz, Nz = sx[p % 2]
    a, b, side = (Sz - 1.4, Nz + 1.4, 1) if p % 2 == 0 else (Nz + 1.4, Sz - 1.4, -1)
    await go(pg, o, [[x, a]]); r = await go(pg, o, [[x, b]]); s = await S(pg)
    ok(f'{mid}:esc{p + 1}to{p + 2}F', r and atY(s, o, p + 1) and s['floor'] == p + 2)
    await walk_steps(pg, o, I, p + 1, side)
    if p == NF - 2: return side
    nx = -0.9 if (p + 1) % 2 == 0 else -2.7; ns = sx[(p + 1) % 2]
    await go(pg, o, [[nx, (ns[1] + 1.4) if side > 0 else (ns[0] - 1.4)]])

def ring_to_lift(n, side):   # 顶层从扶梯口沿走廊走到西边的电梯厅（不穿中空、不撞美食广场的桌子）
  if n == 16:
    a0 = math.pi / 2 if side > 0 else -math.pi / 2; pts = []
    for k in range(1, 9): a = a0 + (math.pi - a0 if side > 0 else -math.pi - a0) * k / 8; pts.append([round(9.8 * math.cos(a), 2), round(21 + 9.8 * math.sin(a), 2)])
    return pts + [[-9.3, 21]]
  return [[-9.4, 21 + side * 9.4], [-9.4, 21 + side * 2.5], [-9.3, 21]]

async def lift_down(pg, I, o, mid, shots):
  NF = I['floors']
  for _ in range(90):
    s = await S(pg)
    if s['lift']['floor'] == NF and s['lift']['state'] == 'open': break
    await asyncio.sleep(1)
  ok(f'{mid}:liftCalled', s['lift']['floor'] == NF and s['lift']['state'] == 'open')
  await go(pg, o, [[-7.6, 21], [-6.6, 21]]); s = await S(pg)
  panel = await pg.evaluate("(() => { const el = document.getElementById('smLiftPanel'); return el && !el.hidden ? [...el.querySelectorAll('.flb')].map(b => +b.dataset.f) : null; })()")
  ok(f'{mid}:inCar', await pg.evaluate('(() => { const i = __game.xmMetro.street.inside; return i.inCar(__game.player.position); })()'))
  ok(f'{mid}:panelAllFloors', panel is not None and sorted(panel) == list(range(1, NF + 1)))
  if shots:
    await view(pg, 'first'); await pg.evaluate('__game.player.yaw = Math.PI / 2 + 0.25; __game.player.pitch = 0.05')
    await shot(pg, f'{mid}-lift-inside', f'{mid} glass lift (in car, {NF}F)', OUT2); await view(pg, 'third')
  try: await tap(pg, '#smLiftPanel .flb[data-f="1"]'); tapped = True
  except Exception as e: log('tap failed', e); tapped = False
  for _ in range(5):
    await asyncio.sleep(1)
    if (await S(pg))['lift']['state'] != 'open': break
  if (await S(pg))['lift']['state'] == 'open': tapped = False; await pg.evaluate('__game.xmMetro.street.inside.press(1)')
  ok(f'{mid}:tap1F', tapped)
  ymax, moving = -1, False
  for _ in range(120):
    s = await S(pg)
    if s['lift']['state'] == 'moving': moving = True
    if moving and s['lift']['floor'] == 1 and s['lift']['state'] in ('open', 'opening'): break
    await asyncio.sleep(1)
  ok(f'{mid}:liftRode', moving and s['lift']['floor'] == 1 and atY(s, o, 0, 0.3))
  await asyncio.sleep(1.5); r = await go(pg, o, [[-9.6, 21], [-11, 18]]); s = await S(pg)
  ok(f'{mid}:liftOut1F', r and s['floor'] == 1 and atY(s, o, 0) and s['pos'][0] - o['x'] < -9)

async def enter_main(pg, mid):
  P = {'sm-city': ([XS + 51, 16], [[XS + 51, 23]]), 'sm-topaz': ([XS - 72, 96], [[XS - 79.5, 96]]),
       'sm-ruby': ([XS - 72, 24], [[XS - 79.5, 24]]), 'sm-sapphire': ([XS - 144, 125], [[XS - 144, 118.5]]), 'sm-p3': ([XS - 55, 176], [[XS - 61.5, 176]])}[mid]
  await pose(pg, P[0][0], 0.05, P[0][1], 0); await auto(pg, P[1]); await asyncio.sleep(1)
  s = await S(pg); ok(f'{mid}:in', s['inside'] == mid and s['zone'] == 'interior' and s['floor'] == 1)
  return s['inside'] == mid

async def leave_main(pg, o):
  await go(pg, o, [[0, 3], [0, -4.5]]); await asyncio.sleep(0.8); return await S(pg)

async def stairwell(pg, o, I):
  st = I['stair']; c = 21 + (st['door'][0] + st['door'][1]) / 2; ra, rb = (st['rA'][0] + st['rA'][1]) / 2, (st['rB'][0] + st['rB'][1]) / 2; ln = 21 + (st['land'][0] + st['land'][1]) / 2
  await go(pg, o, [[12.5, c], [ra, c], [ra, ln], [rb, ln], [rb, c]]); s = await S(pg); ok('sm-city:stairUp2F', atY(s, o, 1) and s['floor'] == 2)
  await go(pg, o, [[12.5, c]]); s = await S(pg); ok('sm-city:stair2Fout', atY(s, o, 1) and s['pos'][0] - o['x'] < 13.5)
  await go(pg, o, [[rb, c], [rb, ln], [ra, ln], [ra, c], [12.5, c]]); s = await S(pg); ok('sm-city:stairDown1F', atY(s, o, 0) and s['floor'] == 1)

async def mall_full(pg, mid):
  if not await enter_main(pg, mid): return
  I = await info(pg); o = await org(pg)
  ok(f'{mid}:floors', I['floors'] == (6 if mid == 'sm-city' else 5))
  ok(f'{mid}:shopsUnique', len(I['shops']) == len(set(I['shops'])) and all(len(f) >= 6 for f in I['shopFloors']))
  ok(f'{mid}:atlas', I['overflow'] == 0)
  if mid in ('sm-city', 'sm-topaz'):
    await view(pg, 'first'); await pose(pg, o['x'] + 5, 0.05, o['z'] + 16, -0.95, -0.55)
    await shot(pg, f'{mid}-atrium-up', f'{mid} 1F atrium, escalators to {I["floors"]}F', OUT2); await view(pg, 'third')
    await pose(pg, o['x'], 0.05, o['z'] + 4, 0)
  if mid == 'sm-city': await stairwell(pg, o, I)
  side = await climb(pg, I, o, mid)
  if mid in ('sm-city', 'sm-topaz'):
    s = await S(pg); n = 16 if mid == 'sm-topaz' else 4
    fx, fz = (-3, 21 - 10.2) if n == 16 else (-4, 21 - 10.5)
    await view(pg, 'first'); await pose(pg, o['x'] + fx, s['pos'][1], o['z'] + fz, -math.pi / 2 - 0.5, 0.12)
    await shot(pg, f'{mid}-foodcourt-top', f'{mid} {I["floors"]}F food court & cinema', OUT2); await view(pg, 'third')
    await pose(pg, s['pos'][0], s['pos'][1], s['pos'][2], 0)
  await go(pg, o, ring_to_lift(16 if mid == 'sm-topaz' else 4, side))
  await lift_down(pg, I, o, mid, mid in ('sm-city', 'sm-topaz'))
  s = await leave_main(pg, o); ok(f'{mid}:out', s['inside'] is None and s['zone'] == 'street' and abs(s['pos'][1]) < 0.5)

GATE_ROUTE = {   # 楼内局部：门内 → 2F 扶梯口（一期：天桥门在西边 c = ±7；黄宝石 / 三期：南边 c = 0，正门的上面）
  ('sm-city', 'br1'): [[-14, 14], [-9.4, 14], [-9.4, 9.4 + 21], [-2.7, 29 + 1.4]], ('sm-city', 'br2'): [[-14, 28], [-9.4, 28], [-9.4, 30.4], [-2.7, 30.4]],
  ('sm-topaz', 'br1'): [[0, 6.5]] + [[round(9.8 * math.cos(math.radians(a)), 2), round(21 + 9.8 * math.sin(math.radians(a)), 2)] for a in range(-100, -261, -20)] + [[-2.7, 28.54 + 1.4]],
  ('sm-p3', 'br2'): [[0, 4.5], [-4.2, 12.6], [-9.4, 11.6], [-9.4, 30.4], [-2.7, 30.4]]}
async def through_gate(pg, mid, gate, shotname=None, label=''):
  s = await S(pg); ok(f'bridge:{mid}:{gate}:in', s['inside'] == mid and s['gate'] == gate and s['floor'] == 2)
  o = await org(pg); ok(f'bridge:{mid}:{gate}:2F', atY(s, o, 1))
  if shotname:
    await view(pg, 'first'); await pg.evaluate('__game.player.pitch = 0.04'); await shot(pg, shotname, label); await view(pg, 'third')
  back = list(reversed(GATE_ROUTE[(mid, gate)]))
  r = await go(pg, o, GATE_ROUTE[(mid, gate)]); s2 = await S(pg); ok(f'bridge:{mid}:{gate}:toEscalator', r and atY(s2, o, 1) and s2['floor'] == 2)
  return o, back

async def gate_out(pg, mid, gate, o, back):
  I = await info(pg); gi = next(g for g in I['gates'] if g == gate)
  sd = {'sm-city': {'br1': (-1, -7), 'br2': (-1, 7)}, 'sm-topaz': {'br1': (0, -1)}, 'sm-p3': {'br2': (0, -1)}}[mid][gate]
  far = [[-25, 21 + sd[1]]] if sd[0] == -1 else [[0, -4.6 - 21 + 21]]
  if mid != 'sm-city': far = [[0, 21 - 25]]
  await go(pg, o, back[1:] + far); await asyncio.sleep(0.8); return await S(pg)

async def cross(pg, pts):
  # 桥上有走动的路人（会挡路）：被挡住就侧移 1.5 m 再走，最多 3 次
  for i in range(3):
    if await auto(pg, pts): return True
    s = await S(pg)
    if s['inside'] is not None: return True
    await auto(pg, [[s['pos'][0], s['pos'][2] + (1.5 if i % 2 == 0 else -3.0)]])
  return False

async def bridges(pg):
  # 天桥 1：一期 2F 门 ← 从桥上走进去
  await view(pg, 'third'); await pose(pg, XS + 9.6, 6.05, 63, math.pi / 2)
  await view(pg, 'first'); await shot(pg, 'after-br1-p1-entrance', 'AFTER br1 · SM City 2F glass doors'); await view(pg, 'third')
  await auto(pg, [[XS + 18, 63]]); await asyncio.sleep(1)
  o, back = await through_gate(pg, 'sm-city', 'br1', 'after-br1-inside-p1', 'AFTER inside SM City 2F from br1')
  s = await gate_out(pg, 'sm-city', 'br1', o, back)
  ok('bridge:br1:outP1', s['inside'] is None and abs(s['pos'][1] - 6) < 0.6 and abs(s['pos'][0] - (XS + 13.6)) < 2.5)
  await cross(pg, [[XS - 30, 63]]); await view(pg, 'first'); await pg.evaluate('__game.player.yaw = -Math.PI / 2; __game.player.pitch = 0.02')
  await shot(pg, 'after-br1-mid', 'AFTER br1 mid-bridge → Topaz'); await view(pg, 'third')
  await pose(pg, XS - 71.6, 6.05, 63, -math.pi / 2); await view(pg, 'first'); await shot(pg, 'after-br1-topaz-entrance', 'AFTER br1 · Topaz 2F glass doors'); await view(pg, 'third')
  await auto(pg, [[XS - 82, 63]]); await asyncio.sleep(1)
  o, back = await through_gate(pg, 'sm-topaz', 'br1', 'after-br1-inside-topaz', 'AFTER inside Topaz 2F from br1')
  s = await gate_out(pg, 'sm-topaz', 'br1', o, back)
  ok('bridge:br1:outTopaz', s['inside'] is None and abs(s['pos'][1] - 6) < 0.6 and abs(s['pos'][0] - (XS - 75.4)) < 2.5)
  await cross(pg, [[XS - 20, 63], [XS + 18, 63]]); await asyncio.sleep(1)
  s = await S(pg); ok('bridge:br1:backIntoP1', s['inside'] == 'sm-city' and s['gate'] == 'br1' and s['floor'] == 2)
  o = await org(pg)
  # 一期楼内从 br1 门走到 br2 门（2F 走廊，沿西边经过电梯厅）
  await go(pg, o, [[-14, 14], [-9.4, 14], [-9.4, 28], [-14, 28], [-25, 28]]); await asyncio.sleep(0.8)
  s = await S(pg); ok('bridge:br2:outP1', s['inside'] is None and abs(s['pos'][1] - 6) < 0.6 and abs(s['pos'][2] - 143) < 3)
  await pose(pg, XS + 9.6, 6.05, 143, math.pi / 2); await view(pg, 'first'); await shot(pg, 'after-br2-p1-entrance', 'AFTER br2 · SM City 2F glass doors'); await view(pg, 'third')
  await pose(pg, XS - 30, 6.05, 143, -math.pi / 2); await view(pg, 'first'); await shot(pg, 'after-br2-mid', 'AFTER br2 mid-bridge → Phase III'); await view(pg, 'third')
  await pose(pg, XS - 53.6, 6.05, 143, -math.pi / 2); await view(pg, 'first'); await shot(pg, 'after-br2-p3-entrance', 'AFTER br2 · Phase III 2F glass doors'); await view(pg, 'third')
  await auto(pg, [[XS - 64, 143]]); await asyncio.sleep(1)
  o, back = await through_gate(pg, 'sm-p3', 'br2', 'after-br2-inside-p3', 'AFTER inside Phase III 2F from br2')
  r = await go(pg, o, [[-2.7, 30.4]]); I = await info(pg); e = I['esc'][1]
  r = await go(pg, o, [[-2.7, e['to'][2] - 1.4]]); s = await S(pg); ok('sm-p3:esc2to3F', r and atY(s, o, 2) and s['floor'] == 3)
  await go(pg, o, [[2.7, e['to'][2] - 1.4]]); await go(pg, o, [[2.7, 30.4]])   # 同一对的下行扶梯（+2.7：3F 南 → 2F 北）
  s = await S(pg); ok('sm-p3:escDown3to2F', atY(s, o, 1) and s['floor'] == 2)
  s = await gate_out(pg, 'sm-p3', 'br2', o, [[-2.7, 30.4]] + back)
  ok('bridge:br2:outP3', s['inside'] is None and abs(s['pos'][1] - 6) < 0.6 and abs(s['pos'][0] - (XS - 57.4)) < 2.5)
  await cross(pg, [[XS - 20, 143], [XS + 18, 143]]); await asyncio.sleep(1)
  s = await S(pg); ok('bridge:br2:backIntoP1', s['inside'] == 'sm-city' and s['gate'] == 'br2' and s['floor'] == 2)
  o = await org(pg); await go(pg, o, [[-14, 28], [-25, 28]]); await asyncio.sleep(0.8)
  s = await S(pg); ok('bridge:br2:outAgain', s['inside'] is None and abs(s['pos'][1] - 6) < 0.6)

async def main():
  async with async_playwright() as p:
    b, pg, logs = await open_game(p, URL + ('&' if '?' in URL else '?') + 'q=1&start=gzdz&line=1')
    await pg.evaluate(GCLOCK); await pg.evaluate('__game.setDtMax(0.25)'); await asyncio.sleep(0.8)
    await pg.evaluate("""(() => { const g=__game; g.east.ensure(); g.east.side='xm'; g.east.cur={st:g.station, loc:'xmmetro', area:'metro'}; g.station.kit.root.setEnabled(false); g.xmMetro.enterFromRailway(g.player); })()""")
    await pg.evaluate("() => { const m = __game.xmMetro; m.buildStation('wsp'); const P = m.station.platforms[0]; __game.player.spawn(3020, P.y + 0.05, P.zc + 2, Math.PI / 2); }"); await asyncio.sleep(1)
    await pg.evaluate("() => { __game.player.spawn(3010, -6.45, -15, Math.PI); }"); await asyncio.sleep(1)
    await auto(pg, [[3010, -20], [3010, -30], [3010, -36.5]])
    s = await S(pg); ok('street', s['zone'] == 'street'); await view(pg, 'third')
    if os.environ.get('SKIP_BRIDGES') != '1': await bridges(pg)
    for mid in ONLY:
      if mid: await mall_full(pg, mid)
    R['errors'] = errs(logs); good = all(R['checks'].values()) and not R['errors']
    print(json.dumps(R, ensure_ascii=False, indent=1, default=str))
    print('XMSMBRIDGE', 'PASS' if good else 'FAIL', [k for k, v in R['checks'].items() if not v], flush=True)
    await b.close()
    if not good: sys.exit(1)
if __name__ == "__main__": asyncio.run(main())
