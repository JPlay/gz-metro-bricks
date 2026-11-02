# 福州第三批性能点位探针（开发 / 回归用）：在“稳定帧”（到位后等 ≥6 s 游戏时间）量 draws / tris（第一 / 第三人称各采 6 帧取最大），
# 并按网格名列出本帧最贵的网格，方便定位。
#   djk   东街口 L1↔L4 换乘楼梯半中间（5012, -17.5, -1）朝 -x：两层站台各两趟车都停站（最坏情况）+ 没车两种
#   dfj   帝封江（叠层换乘）：每层站台中间各站一次，车全停站，核对“本层的车都画、别层的车不画”
#   wait  福州南东站房候车室（5020, 0, -72.08）朝 -2.6 rad（小美 p1 的机位）
# 用法：python tests/e2e/fz_perf_probe.py BASE parts(djk,wait) OUTJSON [SHOTDIR]
import asyncio, sys, json, os, time
sys.path.insert(0, os.path.dirname(__file__))
from common import *
from journey import GCLOCK, gt, auto, wait, log
from perfhud import perf, overlay, overlay_off
BASE = sys.argv[1]; PARTS = sys.argv[2].split(','); OUT = sys.argv[3]; SHOT = sys.argv[4].rstrip('/') + '/' if len(sys.argv) > 4 else None
FO = 5000; R = {'perf': {}, 'top': {}, 'checks': {}}
def ok(k, v): R['checks'][k] = bool(v); log('check', k, bool(v)); return v
TOP = """() => { const s=__game.scene, out={}; for (const m of s.getActiveMeshes().data.slice(0, s.getActiveMeshes().length)) { const n=(m.name||'?').replace(/[0-9]+$/,''), t=(m.getTotalIndices? m.getTotalIndices():0)/3; out[n]=(out[n]||0)+t; }
  return Object.entries(out).sort((a,b)=>b[1]-a[1]).slice(0,14).map(([n,t])=>[n,Math.round(t)]); }"""
async def view(pg, v):
    if await pg.evaluate('__game.player.view') != v: await pg.evaluate('void __game.toggleView()')
async def gsleep(pg, secs):
    g0 = await gt(pg); t0 = time.time()
    while await gt(pg) - g0 < secs and time.time() - t0 < 300: await asyncio.sleep(0.3)
async def screenshot(pg, path):
    for i in range(2):
        try: await pg.screenshot(path=path, timeout=120000); return True
        except Exception as e: log('shot timeout/retry', i, path, repr(e)[:120])
    return False
async def measure(pg, name, yaw, pitch, settle=6):
    d = {}
    for v in ('first', 'third'):
        await view(pg, v); await pg.evaluate(f'__game.player.yaw={yaw}; __game.player.pitch={pitch}')
        await gsleep(pg, settle); d[v] = await perf(pg, 6, 0.3); R['top'][f'{name}:{v}'] = await pg.evaluate(TOP)
        if SHOT and v == 'first':
            await overlay(pg, d[v], name); await screenshot(pg, f'{SHOT}{name}.png'); await overlay_off(pg)
    d['draws'] = max(d['first']['draws'], d['third']['draws']); d['tris'] = max(d['first']['tris'], d['third']['tris'])
    d['pos'] = (await st(pg))['pos']; R['perf'][name] = d
    log('perf', name, d['first'], d['third'], 'top', R['top'][f'{name}:first'][:6])
    ok(name + ':budget', d['draws'] <= 50 and d['tris'] <= 90000)
    json.dump(R, open(OUT, 'w'), ensure_ascii=False, indent=1, default=str)
async def main():
  async with async_playwright() as p:
    b, pg, logs = await open_game(p, BASE + '?q=1')
    await pg.evaluate(GCLOCK); await pg.evaluate('__game.setDtMax(0.25)'); await asyncio.sleep(1)
    if 'djk' in PARTS:
      await pg.evaluate("""(() => { const g=__game; g.east.ensure(); g.east.side='fz'; g.east.cur={st:g.station, loc:'fzmetro', area:'metro'}; g.station.kit.root.setEnabled(false); g.fzMetro.enterFromRailway(g.player); })()""")
      await asyncio.sleep(1.5)
      g = await pg.evaluate("""(() => { const m=__game.fzMetro; m.buildStation('fzdjk'); m.slots.forEach(s => { s.state='away'; s.t=999; s.train.setVisible(false); });
        return m.slots.map(s => ({line:s.line, step:s.step, y:s.P.y, zc:s.P.zc})); })()""")
      R['djkSlots'] = g
      await pg.evaluate("void __game.player.spawn(5012, -17.3, -1, -Math.PI/2)"); await gsleep(pg, 2)
      await measure(pg, 'djk-midstair-notrain', '-Math.PI/2', -0.1)
      await pg.evaluate("__game.fzMetro.slots.forEach(o => { o.t = 0; })")
      ok('djk:allDwell', await wait(pg, "__game.fzMetro.slots.every(o => o.state==='dwell')", 120))
      await pg.evaluate("__game.fzMetro.slots.forEach(o => { if (o.state==='dwell') o.t = 1e9; })")   # 车一直停着（最坏情况）
      await pg.evaluate("void __game.player.spawn(5012, -17.3, -1, -Math.PI/2)"); await gsleep(pg, 2)
      await measure(pg, 'djk-midstair-4trains', '-Math.PI/2', -0.1)
      for x in (5006, 5009, 5015, 5018):   # 楼梯其它几个位置
        await pg.evaluate(f"void __game.player.spawn({x}, -22 + ({x}-5000-3.5)/(19.5-3.5)*9 + 0.4, -1, -Math.PI/2)"); await gsleep(pg, 2)
        await measure(pg, f'djk-stair-x{x - FO}-4trains', '-Math.PI/2', -0.1, 4)
        await measure(pg, f'djk-stair-x{x - FO}-up-4trains', 'Math.PI/2', 0.05, 4)
      await pg.evaluate("__game.fzMetro.slots.forEach(o => { if (o.state==='dwell') o.t = 0.5; })")
    if 'dfj' in PARTS:
      if 'djk' not in PARTS:
        await pg.evaluate("""(() => { const g=__game; g.east.ensure(); g.east.side='fz'; g.east.cur={st:g.station, loc:'fzmetro', area:'metro'}; g.station.kit.root.setEnabled(false); g.fzMetro.enterFromRailway(g.player); })()""")
        await asyncio.sleep(1.5)
      plats = await pg.evaluate("""(() => { const m=__game.fzMetro; m.buildStation('fzdfj'); m.slots.forEach(s => { s.t = 0; });
        return m.station.platforms.map(q => ({y:q.y, zc:q.zc})); })()""")
      R['dfjPlats'] = plats
      ok('dfj:allDwell', await wait(pg, "__game.fzMetro.slots.every(o => o.state==='dwell')", 120))
      await pg.evaluate("__game.fzMetro.slots.forEach(o => { if (o.state==='dwell') o.t = 1e9; })")
      VIS = "__game.fzMetro.slots.map(s => ({line:s.line, step:s.step, y:s.P.y, zc:s.P.zc, state:s.state, vis:s.train.root.isEnabled()}))"
      for i, q in enumerate(plats):
        await pg.evaluate(f"void __game.player.spawn({FO}, {q['y']} + 0.05, {q['zc']}, Math.PI/2)"); await gsleep(pg, 2)
        v = await pg.evaluate(VIS); R[f'dfj-plat{i}-vis'] = v
        mine = [o for o in v if o['y'] == q['y']]; other = [o for o in v if o['y'] != q['y']]
        ok(f'dfj-plat{i}(y{q["y"]},z{q["zc"]}):ownTrainsShown', mine and all(o['vis'] for o in mine))
        ok(f'dfj-plat{i}:otherLevelHidden', all(not o['vis'] for o in other))
        await measure(pg, f'dfj-plat{i}-y{q["y"]}', 'Math.PI/2', -0.05, 3)
      await pg.evaluate("__game.fzMetro.slots.forEach(o => { if (o.state==='dwell') o.t = 0.5; })")
    if 'wait' in PARTS:
      await pg.evaluate("""(() => { const g=__game; g.east.ensure(); g.east.side='fz'; const P=g.east.rails.fz.plat(true); P.show('solo'); g.east.cur={st:g.station, loc:'fzs', area:'platform'}; g.station.kit.root.setEnabled(false); g.player.spawn(5020, 0.05, -72.08, -2.6); })()""")
      await gsleep(pg, 3); R['waitArea'] = await pg.evaluate('__game.east.info().area'); ok('wait:area', R['waitArea'] == 'wait')
      await measure(pg, 'fzs-waitinghall', -2.6, -0.04)
      for nm, x, z, yaw in [('fzs-wait-west', 4960, -82, 1.2), ('fzs-wait-mid', 5000, -82, -1.57), ('fzs-wait-east', 5060, -82, 1.57), ('fzs-wait-eastcorner', 5070, -75, -2.2)]:
        await pg.evaluate(f"void __game.player.spawn({x}, 0.05, {z}, {yaw})"); await gsleep(pg, 2)
        await measure(pg, nm, yaw, -0.04, 4)
    R['errors'] = errs(logs)[:10]
    await b.close()
  json.dump(R, open(OUT, 'w'), ensure_ascii=False, indent=1, default=str)
  print('FZ_PERF_PROBE', 'PASS' if all(R['checks'].values()) else 'FAIL', [k for k, v in R['checks'].items() if not v], flush=True)
asyncio.run(main())
