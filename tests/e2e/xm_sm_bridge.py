# 乌石浦 · SM 商场：每栋楼都是真的多层商场（xmSMMall.js）
#  · 一期 / 黄宝石 / 红宝石 / 蓝宝石：1F 坐扶梯一层层到顶层（每层走几步、核对高度和楼层），顶层坐观光电梯（点轿厢里的楼层按钮）回 1F
#  · 一期：楼梯间 1F → 2F → 1F
#  · 天桥：一期 2F 门 → 天桥 1 → 黄宝石 2F → 回一期；一期 2F 门 → 天桥 2 → 三期 2F → 回一期；每次进门后走到扶梯口
#  · 每个视角 ≤ 9 万三角形、≤ 50 draw；SHOTS=目录 时存截图（带 FPS / draws / tris 角标）
#  · 黄宝石中庭金环吊灯（topaz_chandelier）：1F 仰视 / 3F 平视 / 5F 走廊斜看（1p + 3p）+ 3P 穿中庭行走峰值 < WALK_TRIS（8.5 万）、≤ 50 draw；
#    关裁剪全量只记录。CHAND=1 时只跑这一段（配 MALLS=, SKIP_BRIDGES=1；MALLS 为空字符串会回落到全部 4 栋）
import asyncio, sys, json, os, math
sys.path.insert(0, os.path.dirname(__file__))
from common import *
from journey import GCLOCK, auto, log, tap
from perfhud import perf, overlay, overlay_off
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8177/'
OUT = os.environ.get('SHOTS'); OUT2 = os.environ.get('SHOTS2') or OUT
ONLY = (os.environ.get('MALLS') or 'sm-city,sm-topaz,sm-ruby,sm-sapphire').split(',')
XS, TRIS, DRAWS, FH = 4000, 90000, 50, 5.5
WALK_TRIS = int(os.environ.get('WALK_TRIS', '85000'))   # 3P 行走峰值上限（严格小于）
# 行走峰值记录（与 xm_sm_p4 同款；这里单独一份，免得循环 import）
PK_RESET = "() => { window.__pk = { tris: 0, draws: 0, at: null, dat: null, n: 0 }; }"
PK_ON = """() => { const g = __game, s = g.scene, e = g.engine, o = g.xmMetro.street.inside ? g.xmMetro.street.inside.o : { x: 0, y: 0, z: 0 };
  window.__pkObs = s.onAfterRenderObservable.add(() => { const t = Math.round(s.getActiveIndices() / 3), d = (e._drawCalls && e._drawCalls.current) || 0, P = window.__pk, q = g.player.position; P.n++;
    const here = [q.x - o.x, q.y - o.y, q.z - o.z].map(v => Math.round(v * 10) / 10); if (t > P.tris) { P.tris = t; P.at = here; } if (d > P.draws) { P.draws = d; P.dat = here; } }); }"""
PK_PAUSE = "() => { __game.scene.onAfterRenderObservable.remove(window.__pkObs); return window.__pk; }"
FULL = """() => { const s = __game.scene, mm = s.meshes; for (const m of mm) m.alwaysSelectAsActiveMesh = true; s.render(); const t = Math.round(s.getActiveIndices() / 3), n = s.getActiveMeshes().length;
  for (const m of mm) m.alwaysSelectAsActiveMesh = false; s.render(); return { tris: t, n }; }"""
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
  if o: await overlay(pg, d, label); await safe_shot(pg, path=f'{o}/{name}.jpg', type='jpeg', quality=82, timeout=240000); await overlay_off(pg)
async def pose(pg, x, y, z, yaw, pitch=0.0):
  await pg.evaluate(f"(() => {{ const p = __game.player; p.spawn({x}, {y}, {z}, {yaw}); p.yaw = {yaw}; p.pitch = {pitch}; }})()"); await asyncio.sleep(0.4)
async def split(pg, pts, mx=20):   # autopilot 每个航点限 12 s 游戏时间：长段切成 ≤mx m
  s = await S(pg); x, z = s['pos'][0], s['pos'][2]; seg = []
  for tx, tz in pts:
    n = max(1, math.ceil(math.hypot(tx - x, tz - z) / mx))
    seg += [[x + (tx - x) * k / n, z + (tz - z) * k / n] for k in range(1, n + 1)]; x, z = tx, tz
  return seg
async def go(pg, o, pts):   # 楼内局部坐标 → 世界坐标
  return await auto(pg, await split(pg, [[o['x'] + x, o['z'] + z] for x, z in pts]))
def atY(s, o, f, tol=0.5): return s['pos'][1] is not None and abs(s['pos'][1] - o['y'] - f * FH) < tol

async def walk_steps(pg, o, I, f, side):   # 到了 f 层（0 起）：在走廊里走几步，核对位置 / 高度 / 楼层
  x, z = (3.2, side * 12.2)
  ok_ = await go(pg, o, [[x, 21 + z]]); s = await S(pg)
  ok(f"{I['id']}:walk{f + 1}F", ok_ and atY(s, o, f) and s['floor'] == f + 1 and abs(s['pos'][0] - o['x'] - x) < 1.2 and abs(s['pos'][2] - o['z'] - 21 - z) < 1.2)

async def esc_shot(pg, mid, I, o, x, a, side):   # 2F 扶梯口，看着 2F→3F 上行扶梯
  s = await S(pg); yaw = 0 if side > 0 else math.pi
  await view(pg, 'first'); await pose(pg, o['x'] + x + 0.6, s['pos'][1], o['z'] + a - side * 2.2, yaw, -0.18)
  await shot(pg, f'{mid}-esc2to3F', f'{mid} 2F → 3F escalator', OUT2); await view(pg, 'third')
  await pose(pg, o['x'] + x, s['pos'][1], o['z'] + a, yaw)

async def climb(pg, I, o, mid):
  NF, sx = I['floors'], I['edge']['sx']
  await go(pg, o, [[0, 7], [-0.9, sx[0][0] - 1.4]])
  for p in range(NF - 1):
    x = -0.9 if p % 2 == 0 else -2.7; Sz, Nz = sx[p % 2]
    a, b, side = (Sz - 1.4, Nz + 1.4, 1) if p % 2 == 0 else (Nz + 1.4, Sz - 1.4, -1)
    await go(pg, o, [[x, a]])
    if p == 1: await esc_shot(pg, mid, I, o, x, a, side)
    r = await go(pg, o, [[x, b]]); s = await S(pg)
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

async def fc_shot(pg, mid, I, o):   # 顶层：站在南走廊东段，往东北看——东边一排美食档口 + 北边影城（隔着中空）
  NF = I['floors']; x, z, yaw = (4.0, 21 - 10.6, 0.42) if mid == 'sm-topaz' else (7.6, 21 - 9.4, 0.42)
  await view(pg, 'first'); await pose(pg, o['x'] + x, o['y'] + (NF - 1) * FH + 0.05, o['z'] + z, yaw, 0.04)
  await shot(pg, f'{mid}-foodcourt-top', f'{mid} {NF}F food court & cinema', OUT2); await view(pg, 'third')

async def esc_only(pg, mid):   # 只补拍 2F→3F 扶梯（已完整跑过的楼）
  if not await enter_main(pg, mid): return
  I = await info(pg); o = await org(pg); Sz, Nz = I['edge']['sx'][1]
  await pose(pg, o['x'] - 2.7, o['y'] + FH + 0.05, o['z'] + Nz + 1.4, math.pi); await asyncio.sleep(1)
  s = await S(pg); ok(f'{mid}:esc2Fpose', s['floor'] == 2)
  await esc_shot(pg, mid, I, o, -2.7, Nz + 1.4, -1)
  if os.environ.get('FC') == '1': await fc_shot(pg, mid, I, o)
  await pose(pg, o['x'], o['y'] + 0.05, o['z'] + 4, math.pi); s = await leave_main(pg, o); ok(f'{mid}:escOnlyOut', s['inside'] is None)

async def topaz_chandelier(pg, o):   # 黄宝石中庭金环吊灯（xmSMMall.js topazChandelier；中庭中心 = 楼内 (0, 21)，环在 y 23.9–26.7）
  async def both(name, label, x, f, z, yaw, p1, p3=None):
    for v, pt in (('first', p1), ('third', p1 if p3 is None else p3)):
      await view(pg, v); await pose(pg, o['x'] + x, o['y'] + f * FH + 0.05, o['z'] + z, yaw, pt)
      await shot(pg, f'{name}-{v[0]}p', f'{label} ({v} person)', OUT2)
    await view(pg, 'third'); s = await S(pg); ok(f'{name}:floor', s['floor'] == f + 1)
  await both('topaz-chand-1F-up', 'Topaz 1F under the atrium, looking up at the gold-ring chandelier', 7.2, 0, 21, -1.5708, -1.33, -0.35)   # 中庭空洞东缘正下方、几乎竖直往上看（视线不穿 |x|<3.4 的扶梯组）
  await both('topaz-chand-3F', 'Topaz 3F corridor, eye level across the atrium', 10.6, 2, 21, -1.5708, -0.8, -0.35)   # 东侧走廊朝西看，视线从扶梯上方越过
  await both('topaz-chand-5F-oblique', 'Topaz 5F corridor, oblique view of the chandelier', 4.0, 4, 21 - 10.6, -0.36, -0.08, -0.1)
  # 3P 穿中庭行走峰值：1F 从门厅走进中庭、在吊灯下方东西两侧各走一个来回（避开扶梯 |x| < 3.4、西侧电梯井 x < −5.3，不穿北端扶梯脚），再到 5F 走廊绕半圈
  await view(pg, 'third'); await pg.evaluate(PK_RESET)
  await pose(pg, o['x'], o['y'] + 0.05, o['z'] + 4, 0); await asyncio.sleep(0.6); await pg.evaluate(PK_ON)
  r1 = await go(pg, o, [[0, 7], [4.4, 13.5], [4.4, 28.5], [4.4, 13.5], [0, 7], [-4.4, 13.5], [-4.4, 28.5], [-4.4, 13.5], [0, 7]]); s = await S(pg)
  ok('topaz-chand-walk1F', r1 and s['floor'] == 1)
  # 1F 绕吊灯顺/逆时针各一圈（3P）。
  # 东西向只在 z=7（中庭南、扶梯脚以南）穿越；南北向在 x=±5.0（避开 |x|<3.4 扶梯、西侧电梯井 x<-5.3）。
  # 长边拆成 28→13.5→7，避免一次穿中庭被扶梯脚吸进去（chand4 卡在 ~[1.8,28.5]）。
  # 峰值计数器不停，和 walk1F / 5F 共用，最后一次 PAUSE 作为 walk-3p。
  def _in_atrium(s):
    return s['floor'] == 1 and s.get('inside') == 'sm-topaz' and abs(s['pos'][0] - o['x']) < 9 and abs(s['pos'][2] - (o['z'] + 21)) < 12
  PK_READ = "() => Object.assign({}, window.__pk)"
  # 若中途 teleport 丢了 observer，重绑但保留峰值（不清零）
  PK_REARM = """() => { const g=__game,s=g.scene,e=g.engine,o=g.xmMetro.street.inside?g.xmMetro.street.inside.o:{x:0,y:0,z:0};
    const P=window.__pk||(window.__pk={tris:0,draws:0,at:null,dat:null,n:0});
    if(window.__pkObs) try{s.onAfterRenderObservable.remove(window.__pkObs)}catch(err){}
    window.__pkObs=s.onAfterRenderObservable.add(()=>{const t=Math.round(s.getActiveIndices()/3),d=(e._drawCalls&&e._drawCalls.current)||0,q=g.player.position;P.n++;
      const here=[q.x-o.x,q.y-o.y,q.z-o.z].map(v=>Math.round(v*10)/10); if(t>P.tris){P.tris=t;P.at=here} if(d>P.draws){P.draws=d;P.dat=here};}); }"""
  XW, ZE, ZN, ZS = 5.0, 13.5, 28.0, 7.0
  # 顺时针：东侧北上 → 回到南交叉带 → 西穿 → 西侧北上 → 回南 → 东穿回起点
  cw_pts = [[XW, ZE], [XW, ZN], [XW, ZE], [XW, ZS], [-XW, ZS], [-XW, ZE], [-XW, ZN], [-XW, ZE], [-XW, ZS], [XW, ZS], [XW, ZE]]
  # 逆时针：东侧先南下西穿，西侧北上再回南，东穿后北上回到起点
  ccw_pts = [[XW, ZE], [XW, ZS], [-XW, ZS], [-XW, ZE], [-XW, ZN], [-XW, ZE], [-XW, ZS], [XW, ZS], [XW, ZE], [XW, ZN], [XW, ZE]]
  await pose(pg, o['x'] + XW, o['y'] + 0.05, o['z'] + ZE, 0); await asyncio.sleep(0.4)
  await pg.evaluate(PK_REARM)
  rcw = await go(pg, o, cw_pts); s = await S(pg)
  ok('topaz-chand-1F-cw', rcw and _in_atrium(s)); R['perf']['topaz-chand-1F-cw-end'] = {'pos': s['pos'], 'floor': s['floor'], 'inside': s.get('inside')}
  d_cw = await pg.evaluate(PK_READ); R['perf']['topaz-chand-1F-cw'] = d_cw; log('walkPeak topaz-chand-1F-cw', d_cw)
  ok('topaz-chand-1F-cw:budget', d_cw['n'] > 20 and d_cw['tris'] < WALK_TRIS and d_cw['draws'] <= DRAWS)
  await pose(pg, o['x'] + XW, o['y'] + 0.05, o['z'] + ZE, math.pi); await asyncio.sleep(0.4)
  await pg.evaluate(PK_REARM)
  rccw = await go(pg, o, ccw_pts); s = await S(pg)
  ok('topaz-chand-1F-ccw', rccw and _in_atrium(s)); R['perf']['topaz-chand-1F-ccw-end'] = {'pos': s['pos'], 'floor': s['floor'], 'inside': s.get('inside')}
  d_ccw = await pg.evaluate(PK_READ); R['perf']['topaz-chand-1F-ccw'] = d_ccw; log('walkPeak topaz-chand-1F-ccw', d_ccw)
  ok('topaz-chand-1F-ccw:budget', d_ccw['n'] > 20 and d_ccw['tris'] < WALK_TRIS and d_ccw['draws'] <= DRAWS)
  await pose(pg, o['x'] + 4.0, o['y'] + 4 * FH + 0.05, o['z'] + 21 - 10.6, -0.36); await asyncio.sleep(0.6)
  await pg.evaluate(PK_REARM)
  r5 = await go(pg, o, [[round(10.6 * math.cos(math.radians(a)), 2), round(21 + 10.6 * math.sin(math.radians(a)), 2)] for a in range(-70, 11, 20)]); s = await S(pg)
  ok('topaz-chand-walk5F', r5 and s['floor'] == 5)
  d = await pg.evaluate(PK_PAUSE); R['perf']['topaz-chand-walk-3p'] = d; log('walkPeak topaz-chand-walk-3p', d)
  ok('topaz-chand-walk-3p:budget', d['n'] > 50 and d['tris'] < WALK_TRIS and d['draws'] <= DRAWS)
  await pose(pg, o['x'], o['y'] + 0.05, o['z'] + 13, 0, -0.3); await asyncio.sleep(0.6)
  f = await pg.evaluate(FULL); R['perf']['topaz-full'] = f; log('FULL topaz (info only)', f)
  await pose(pg, o['x'], o['y'] + 0.05, o['z'] + 4, 0)

async def mall_full(pg, mid):
  if not await enter_main(pg, mid): return
  I = await info(pg); o = await org(pg)
  ok(f'{mid}:floors', I['floors'] == {'sm-city': 6, 'sm-p3': 4}.get(mid, 5))
  ok(f'{mid}:shopsUnique', len(I['shops']) == len(set(I['shops'])) and all(len(f) >= 6 for f in I['shopFloors']))
  ok(f'{mid}:atlas', I['overflow'] == 0)
  if True:
    await view(pg, 'first'); await pose(pg, o['x'] + 5, 0.05, o['z'] + 16, -0.95, -0.55)
    await shot(pg, f'{mid}-atrium-up', f'{mid} 1F atrium, escalators to {I["floors"]}F', OUT2); await view(pg, 'third')
    await pose(pg, o['x'], 0.05, o['z'] + 4, 0)
  if mid == 'sm-topaz': await topaz_chandelier(pg, o)
  if mid == 'sm-city': await stairwell(pg, o, I)
  side = await climb(pg, I, o, mid)
  s = await S(pg); await fc_shot(pg, mid, I, o); await pose(pg, s['pos'][0], s['pos'][1], s['pos'][2], 0)
  await go(pg, o, ring_to_lift(16 if mid == 'sm-topaz' else 4, side))
  await lift_down(pg, I, o, mid, True)
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

async def cross(pg, pts):   # 桥上长距离步行（切段；走进门被传送也算到）
  if await auto(pg, await split(pg, pts)): return True
  s = await S(pg); return s['inside'] is not None

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
    for mid in (os.environ.get('ESCONLY') or '').split(','):
      if mid: await esc_only(pg, mid)
    if os.environ.get('CHAND') == '1' and await enter_main(pg, 'sm-topaz'):
      o = await org(pg); await topaz_chandelier(pg, o); s = await leave_main(pg, o); ok('sm-topaz:chandOut', s['inside'] is None)
    for mid in ONLY:
      if mid: await mall_full(pg, mid)
    R['errors'] = errs(logs); good = all(R['checks'].values()) and not R['errors']
    print(json.dumps(R, ensure_ascii=False, indent=1, default=str))
    print('XMSMBRIDGE', 'PASS' if good else 'FAIL', [k for k, v in R['checks'].items() if not v], flush=True)
    await b.close()
    if not good: sys.exit(1)
if __name__ == "__main__": asyncio.run(main())
