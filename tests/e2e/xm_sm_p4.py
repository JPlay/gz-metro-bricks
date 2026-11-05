# 乌石浦 · SM 四期（batch 2）：兴山路东的 CHAO BLOCK 裙楼 + 3 栋 SM国际中心塔楼 + 一期北侧 4C 工地（街面，不进楼）
#  · 街面：兴山路看 CHAO BLOCK 西立面 / 仙岳路口看 A 栋 / 大步路 BIG BLUE / 中庭蓝楼梯 / 4C 围挡 + 塔吊（第一 + 第三人称）
#  · 走一圈：4B 出口 → 仙岳路北人行道往东 → 过兴山路 → 大步路（南段）→ 中庭 → 蓝楼梯上 2F 平台（y 6）→ 平台北头 → 下楼梯
#    → 握爪公园门口 → 大步路（北段）→ 北口 → 兴山路西侧往北 → 过街到一期北侧 → 沿 4C 围挡往西
#  · 每个视角 ≤ 9 万三角形、≤ 50 draw；SHOTS=目录 存截图
import asyncio, sys, json, os, math
sys.path.insert(0, os.path.dirname(__file__))
import xm_sm_bridge as xb
from xm_sm_bridge import S, view, shot, pose, ok, R, XS
from common import *
from journey import GCLOCK, auto, log
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8177/'

async def both(pg, name, label, x, z, yaw, pitch=0.0, y=0.05):
  await view(pg, 'third'); await pose(pg, XS + x, y, z, yaw, pitch); await shot(pg, name + '-3p', label + ' (3rd person)')
  await view(pg, 'first'); await pose(pg, XS + x, y, z, yaw, pitch); await shot(pg, name + '-1p', label + ' (1st person)'); await view(pg, 'third')
  s = await S(pg); ok(name + ':pose', s['zone'] == 'street' and abs(s['pos'][1] - y) < 1 and abs(s['pos'][2] - z) < 2)

async def walk(pg, name, pts, check):   # 街区局部坐标；长段切成 ≤ 20 m
  r = await auto(pg, await xb.split(pg, [[XS + x, z] for x, z in pts])); s = await S(pg)
  lx, y, z = s['pos'][0] - XS, s['pos'][1], s['pos'][2]
  return ok('walk:' + name, r and s['zone'] == 'street' and check(lx, y, z))

PEAK_ON = """() => { const g = __game, s = g.scene, e = g.engine; window.__pk = window.__pk || { tris: 0, draws: 0, at: null, dat: null, n: 0 };
  window.__pkObs = s.onAfterRenderObservable.add(() => { const t = Math.round(s.getActiveIndices() / 3), d = (e._drawCalls && e._drawCalls.current) || 0, P = window.__pk, q = g.player.position; P.n++;
    const here = [q.x - 4000, q.y, q.z].map(v => Math.round(v * 10) / 10); if (t > P.tris) { P.tris = t; P.at = here; } if (d > P.draws) { P.draws = d; P.dat = here; } }); }"""
PEAK_PAUSE = "() => { __game.scene.onAfterRenderObservable.remove(window.__pkObs); return window.__pk; }"

def near(x, z, tol=1.5): return lambda lx, y, lz: math.hypot(lx - x, lz - z) < tol

async def street(pg):
  await both(pg, 'p4-chao-west', 'CHAO BLOCK west face + SM国际中心 from 兴山路', 88, 44, math.atan2(42, -30), -0.28)
  await both(pg, 'p4-corner', '仙岳路 × 兴山路: tower A + LED band', 86, -11, math.atan2(52, 24), -0.42)
  await both(pg, 'p4-bigblue', '大步路 BIG BLUE (blue ceiling, gold rings)', 120, -6, 0.0, -0.04)
  await both(pg, 'p4-courtyard', 'Courtyard: blue stair + 2F terrace + 潮 mural', 110, 31, math.atan2(20, 18), -0.22)
  await both(pg, 'p4-bb-ceiling', '大步路 ceiling from below: beams + gradient + gold rings + double-sided sign', 120, 20, 0.0, -0.7)
  await both(pg, 'p4-blue-stair', 'Blue stair from the courtyard (matte treads)', 128, 37, 0.0, -0.22)
  await both(pg, 'p4-4c', '4C site north of Phase I: hoarding + shells + crane', 101, 156, math.atan2(-45, 27), -0.55)

async def route(pg):
  # 第三人称边走边量（小美 的口径）：整条路线每帧记 活动三角形 / draw 峰值（只有平台上的 1p 截图那一下不计）
  await view(pg, 'third'); await pose(pg, XS + 2, 0.05, 3, math.pi / 2); await pg.evaluate('window.__pk = null'); await pg.evaluate(PEAK_ON)
  await walk(pg, 'eastSidewalk', [[20, -10.5], [86, -10.5]], near(86, -10.5))
  await walk(pg, 'crossXingshan', [[96, -10.5], [106, -10.5], [120, -10.5]], near(120, -10.5))
  await walk(pg, 'bigBlueSouth', [[120, -4], [120, 26]], lambda x, y, z: abs(x - 120) < 1.5 and abs(z - 26) < 1.5 and y < 0.5)
  await walk(pg, 'courtyard', [[120, 34], [128, 37]], near(128, 37))
  await walk(pg, 'blueStairUp', [[128, 46], [128, 54.5], [128, 57]], lambda x, y, z: abs(y - 6) < 0.4 and near(128, 57)(x, y, z))
  await walk(pg, 'terrace', [[133, 57], [133, 75]], lambda x, y, z: abs(y - 6) < 0.4 and near(133, 75)(x, y, z))
  if R['checks'].get('walk:terrace'):
    await pg.evaluate(PEAK_PAUSE); await view(pg, 'first'); await pg.evaluate('__game.player.yaw = Math.PI * 1.25; __game.player.pitch = 0.12')
    await shot(pg, 'p4-terrace-1p', 'From the 2F terrace over the courtyard'); await view(pg, 'third'); await pg.evaluate(PEAK_ON)
  await walk(pg, 'blueStairDown', [[133, 57], [128, 57], [128, 54], [128, 38]], lambda x, y, z: y < 0.5 and near(128, 38)(x, y, z))
  await walk(pg, 'pawPark', [[118, 38], [118, 50], [114, 54.5]], near(114, 54.5))
  await walk(pg, 'bigBlueNorth', [[120, 70], [120, 84], [120, 116], [120, 121]], near(120, 121))
  await walk(pg, 'toPhase1North', [[104, 124], [104, 160.5], [88, 160.5], [60, 161.3]], near(60, 161.3))
  await walk(pg, 'along4C', [[30, 161.3], [14, 161.3]], lambda x, y, z: near(14, 161.3)(x, y, z) and y < 0.5)
  d = await pg.evaluate(PEAK_PAUSE); R['perf']['p4-walk-3p'] = d; log('walkPeak p4-walk-3p', d)
  ok('p4-walk-3p:budget', d['n'] > 50 and d['tris'] <= xb.TRIS and d['draws'] <= xb.DRAWS)

async def main():
  async with async_playwright() as p:
    b, pg, logs = await open_game(p, URL + ('&' if '?' in URL else '?') + 'q=1&start=gzdz&line=1')
    await pg.evaluate(GCLOCK); await pg.evaluate('__game.setDtMax(0.25)'); await asyncio.sleep(0.8)
    await pg.evaluate("""(() => { const g=__game; g.east.ensure(); g.east.side='xm'; g.east.cur={st:g.station, loc:'xmmetro', area:'metro'}; g.station.kit.root.setEnabled(false); g.xmMetro.enterFromRailway(g.player); })()""")
    await pg.evaluate("() => { const m = __game.xmMetro; m.buildStation('wsp'); const P = m.station.platforms[0]; __game.player.spawn(3020, P.y + 0.05, P.zc + 2, Math.PI / 2); }"); await asyncio.sleep(1)
    await pg.evaluate("() => { __game.player.spawn(3010, -6.45, -15, Math.PI); }"); await asyncio.sleep(1)
    await auto(pg, [[3010, -20], [3010, -30], [3010, -36.5]])
    s = await S(pg); ok('street', s['zone'] == 'street')
    si = await pg.evaluate('__game.xmMetro.street.info()'); log('street atlas', si); ok('streetAtlas', si['atlasOverflow'] == 0)
    if os.environ.get('SKIP_SHOTS') != '1': await street(pg)
    if os.environ.get('SKIP_WALK') != '1': await route(pg)
    R['errors'] = errs(logs); good = all(R['checks'].values()) and not R['errors']
    print(json.dumps(R, ensure_ascii=False, indent=1, default=str))
    print('XMSMP4', 'PASS' if good else 'FAIL', [k for k, v in R['checks'].items() if not v], flush=True)
    await b.close()
    if not good: sys.exit(1)
if __name__ == "__main__": asyncio.run(main())
