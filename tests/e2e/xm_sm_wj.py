# 乌石浦 · SM 旺街（地下美食街，xmWangJie.js）：门前广场入口亭 → 南厅 → 旺街 → 北厅扶梯 / 楼梯 → SM 一期 1F；另两条出口：楼梯上街、西边闸机回地铁站
#  · 视角：街上入口亭 / 旺街直街 / 西侧铺位 / 地铁闸机 / 北厅扶梯（第一 + 第三人称；每个 ≤ 9 万三角形、≤ 50 draw）
#  · 拍完从南厅楼梯上街（gate 'main'）
#  · 3P 行走预算（wj-walk-3p）：4B 出口亭 → 入口亭进旺街 → 直街往北 → 掉头走回南头 → 再往北上 1F 进一期 → 一期正门出
#    → 街上走回入口亭 → 再进 → 闸机口；整段每帧记峰值，< WALK_TRIS（8.5 万）三角形、≤ 50 draw（中途截图那几下不计）
#  · 关裁剪全量（wj-full-street / wj-full-inside）：所有网格 alwaysSelectAsActiveMesh，< FULL_TRIS（8.8 万）
#  · SHOTS=目录 存截图
import asyncio, sys, json, os, math
sys.path.insert(0, os.path.dirname(__file__))
import xm_sm_bridge as xb
from xm_sm_bridge import S, view, shot, pose, ok, R, XS, org, info
from common import *
from journey import GCLOCK, auto, log
from xm_sm_p4 import PEAK_ON, PEAK_PAUSE
WALK_TRIS = int(os.environ.get('WALK_TRIS', '85000'))   # 3P 行走峰值上限（严格小于）
FULL_TRIS = int(os.environ.get('FULL_TRIS', '88000'))   # 关裁剪全量上限（严格小于）
FULL = """() => { const s = __game.scene, mm = s.meshes; for (const m of mm) m.alwaysSelectAsActiveMesh = true; s.render(); const t = Math.round(s.getActiveIndices() / 3), n = s.getActiveMeshes().length;
  for (const m of mm) m.alwaysSelectAsActiveMesh = false; s.render(); return { tris: t, n }; }"""
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8177/'
GX, GZ = 9, 1   # 入口亭（街区局部坐标）：口朝南，往北走进去

async def both(pg, name, label, x, y, z, yaw, pitch=0.0, zone='street'):   # 世界坐标
  await view(pg, 'third'); await pose(pg, x, y, z, yaw, pitch); await shot(pg, name + '-3p', label + ' (3rd person)')
  await view(pg, 'first'); await pose(pg, x, y, z, yaw, pitch); await shot(pg, name + '-1p', label + ' (1st person)'); await view(pg, 'third')
  s = await S(pg); ok(name + ':pose', s['zone'] == zone and abs(s['pos'][2] - z) < 2)

async def enter_gate(pg, tag):
  await pose(pg, XS + GX, 0.05, GZ - 2.5, 0); await auto(pg, [[XS + GX, GZ + 2.5]]); await asyncio.sleep(1)
  s = await S(pg); good = ok(f'{tag}:in', s['inside'] == 'sm-wj' and s['zone'] == 'interior')
  return (await org(pg)) if good else None

async def main():
  async with async_playwright() as p:
    b, pg, logs = await open_game(p, URL + ('&' if '?' in URL else '?') + 'q=1&start=gzdz&line=1')
    await pg.evaluate(GCLOCK); await pg.evaluate('__game.setDtMax(0.25)'); await asyncio.sleep(0.8)
    await pg.evaluate("""(() => { const g=__game; g.east.ensure(); g.east.side='xm'; g.east.cur={st:g.station, loc:'xmmetro', area:'metro'}; g.station.kit.root.setEnabled(false); g.xmMetro.enterFromRailway(g.player); })()""")
    await pg.evaluate("() => { const m = __game.xmMetro; m.buildStation('wsp'); const P = m.station.platforms[0]; __game.player.spawn(3020, P.y + 0.05, P.zc + 2, Math.PI / 2); }"); await asyncio.sleep(1)
    await pg.evaluate("() => { __game.player.spawn(3010, -6.45, -15, Math.PI); }"); await asyncio.sleep(1)
    await auto(pg, [[3010, -20], [3010, -30], [3010, -36.5]])
    s = await S(pg); ok('street', s['zone'] == 'street')
    si = await pg.evaluate('__game.xmMetro.street.info()'); ok('streetAtlas', si['atlasOverflow'] == 0)
    shots = os.environ.get('SKIP_SHOTS') != '1'
    if shots: await both(pg, 'wj-gate', '旺街 entrance pavilion on the SM plaza (east of exit 4B)', XS + GX - 4, 0.05, GZ - 7, math.atan2(4, 7), -0.12)
    o = await enter_gate(pg, 'gate')
    if o:
      i = await info(pg); log('wj info', i); ok('wj:shops', len(i['shops']) >= 8 and i['overflow'] == 0)
      s = await S(pg); ok('wj:spawn', abs(s['pos'][0] - o['x'] - 6) < 1.5 and abs(s['pos'][2] - o['z'] + 2.6) < 1.5)
      if shots:
        X, Z = o['x'], o['z']
        await both(pg, 'wj-street', '旺街 main street, north from the gate', X - 0.5, 0.05, Z - 3, 0.0, -0.05, 'interior')
        await both(pg, 'wj-stalls', 'West stalls: 富贵开心果 / 茉酸奶 / 小周 / 有堂古', X + 1.5, 0.05, Z + 15, -math.pi / 2 - 0.45, -0.05, 'interior')
        await both(pg, 'wj-metro', 'South hall: Line 1 ticket gates (出闸入旺) + directory', X + 3, 0.05, Z - 4.5, -math.pi / 2 - 0.32, 0.02, 'interior')
        await both(pg, 'wj-north', 'North hall: escalator + stair to Phase I 1F, glass to B1', X - 5, 0.05, Z + 50, 0.45, 0.12, 'interior')
        await view(pg, 'third'); await pose(pg, X + 6, 0.05, Z - 2.6, 0)
      # 拍完：南厅楼梯上街（gate 'main' → 入口亭南边）
      await view(pg, 'third'); await xb.go(pg, o, [[6, -4], [6, -12.6]]); await asyncio.sleep(1); s = await S(pg)
      ok('walk:stairUp', s['inside'] is None and s['zone'] == 'street' and math.hypot(s['pos'][0] - XS - GX, s['pos'][2] - GZ + 1.8) < 1.5)
    if os.environ.get('SKIP_WALK') != '1':
      # 关裁剪全量（街面，4B 出口亭）
      await view(pg, 'third'); await pose(pg, XS, 0.05, 1.2, 0.0, -0.1); await asyncio.sleep(1)
      f = await pg.evaluate(FULL); R['perf']['wj-full-street'] = f; log('FULL street', f); ok('wj-full-street', f['tris'] < FULL_TRIS)
      # 3P 行走：4B 出口亭 → 入口亭（街区局部坐标）
      await pg.evaluate('window.__pk = null'); await pg.evaluate(PEAK_ON)
      await auto(pg, await xb.split(pg, [[XS, 2.5], [XS + GX, GZ - 3.5], [XS + GX, GZ + 2.5]])); await asyncio.sleep(1); s = await S(pg)
      o = await org(pg) if ok('walk:gateIn', s['inside'] == 'sm-wj' and s['zone'] == 'interior') else None
      if o:
        await pg.evaluate(PEAK_PAUSE); f = await pg.evaluate(FULL); R['perf']['wj-full-inside'] = f; log('FULL inside', f); ok('wj-full-inside', f['tris'] < FULL_TRIS); await pg.evaluate(PEAK_ON)
        # 直街往北
        r = await xb.go(pg, o, [[0, 0], [0, 20], [0, 40], [0, 50]]); s = await S(pg)
        ok('walk:streetNorth', r and s['inside'] == 'sm-wj' and abs(s['pos'][2] - o['z'] - 50) < 1.5)
        if shots:   # 走到北头回看整条街（截图那一下不计峰值）
          await pg.evaluate(PEAK_PAUSE); await pg.evaluate('__game.player.yaw = Math.PI; __game.player.pitch = -0.05')
          await shot(pg, 'wj-walk-back-3p', '旺街 from the north end, looking back south (3rd person, walking)'); await pg.evaluate(PEAK_ON)
        # 掉头走回南头（大门里）
        r = await xb.go(pg, o, [[0, 30], [0, 10], [0, 2]]); s = await S(pg)
        ok('walk:streetBack', r and s['inside'] == 'sm-wj' and abs(s['pos'][2] - o['z'] - 2) < 1.5)
        if shots:
          await pg.evaluate(PEAK_PAUSE); await pg.evaluate('__game.player.yaw = 0; __game.player.pitch = -0.05')
          await shot(pg, 'wj-walk-gate-3p', '旺街 gate (red header + lanterns), looking north (3rd person, walking)'); await pg.evaluate(PEAK_ON)
        # 再往北：北厅楼梯上 1F → 进一期
        await xb.go(pg, o, [[0, 20], [0, 40], [3, 54], [3, 56.4]]); s = await S(pg)
        ok('walk:street', s['inside'] == 'sm-wj' and abs(s['pos'][2] - o['z'] - 56.4) < 1.5)
        await xb.go(pg, o, [[3, 62], [3, 67.5], [5.4, 69.4]]); await asyncio.sleep(1); s = await S(pg)
        ok('walk:toPhase1', s['inside'] == 'sm-city' and s['zone'] == 'interior' and s['floor'] == 1)
        if s['inside'] == 'sm-city':
          s = await xb.leave_main(pg, await org(pg)); ok('walk:phase1Out', s['inside'] is None and s['zone'] == 'street' and abs(s['pos'][0] - XS - 51) < 3)
        # 街上走回入口亭 → 再进 → 闸机口
        await auto(pg, await xb.split(pg, [[XS + GX + 3, GZ - 4], [XS + GX, GZ - 3.5], [XS + GX, GZ + 2.5]])); await asyncio.sleep(1); s = await S(pg)
        o = await org(pg) if ok('walk:gateIn2', s['inside'] == 'sm-wj' and s['zone'] == 'interior') else None
        if o: await xb.go(pg, o, [[1, -4], [-8, -7.8], [-12, -7.8]])
      d = await pg.evaluate(PEAK_PAUSE); R['perf']['wj-walk-3p'] = d; log('walkPeak wj-walk-3p', d)
      ok('wj-walk-3p:budget', d['n'] > 50 and d['tris'] < WALK_TRIS and d['draws'] <= xb.DRAWS)
      if shots and o:
        await pg.evaluate('__game.player.yaw = -Math.PI / 2; __game.player.pitch = 0.0'); await shot(pg, 'wj-walk-metro-3p', 'Walking out through the Line 1 gates (3rd person)')
      # 出闸机 → 回乌石浦站
      if o:
        await xb.go(pg, o, [[-16.4, -7.8]]); await asyncio.sleep(1.2); s = await S(pg)
        ok('walk:metroBack', s['inside'] is None and s['zone'] not in ('street', 'interior'))
        st = await pg.evaluate('(() => { const m = __game.xmMetro; return { street: !!m.street, z: __game.player.position.z, zone: __game.state().zone }; })()'); log('back', st)
        ok('back:station', not st['street'] and abs(st['z'] + 34.4) < 1.5)
    R['errors'] = errs(logs); good = all(R['checks'].values()) and not R['errors']
    print(json.dumps(R, ensure_ascii=False, indent=1, default=str))
    print('XMSMWJ', 'PASS' if good else 'FAIL', [k for k, v in R['checks'].items() if not v], flush=True)
    await b.close()
    if not good: sys.exit(1)
if __name__ == "__main__": asyncio.run(main())
