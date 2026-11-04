# 福州火车南站地铁闸机（国铁换乘通道 → 地铁站厅的闸机线，(4906.7, -12.86, -80) 朝 -x）性能复查：两条来路分别真走过来
#   gz：广州东 → 复兴号 D3309 → 福州南     xm：厦门北站台 → G3028 → 福州南（同小美 p2 / fz.py 的起点）
# 动车用游戏自带的“快进 ×10”（只是快进，场景状态一样）；下车 → 出站层 → 出站口 5 → 换乘通道 → 闸机。
# 到闸机后按游戏时间分几次取样（0.8 s 墙钟“刚到”、1 / 3 / 6 / 12 s 游戏时间），第一 / 第三人称各采 6 帧取最大，并按根节点列出本帧画的网格。
# 用法：python tests/e2e/fz_gate_probe.py BASE from(gz|xm) OUTJSON [SHOTDIR]（给了 SHOTDIR 就在最后按 4 个朝向各截一张第三人称图，查有没有穿帮）
import asyncio, sys, json, os, time, math
sys.path.insert(0, os.path.dirname(__file__))
from common import *
from journey import GCLOCK, gt, auto, wait, log
from perfhud import perf
BASE, FROM, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
SHOTS = sys.argv[4] if len(sys.argv) > 4 else None
EO, XO, FO = 2200, 3000, 5000
R = {'from': FROM, 'perf': {}, 'roots': {}, 'checks': {}, 'state': {}}
def ok(k, v, info=None): R['checks'][k] = bool(v); log('check', k, bool(v), '' if info is None else json.dumps(info, ensure_ascii=False, default=str)[:300]); save(); return v
def save(): json.dump(R, open(OUT, 'w'), ensure_ascii=False, indent=1, default=str)
ROOTS = """() => { const s=__game.scene, A=s.getActiveMeshes(), out={}; for (let i=0;i<A.length;i++) { const m=A.data[i]; let r=m; while (r.parent) r=r.parent; const n=(r.name||'?'); const t=(m.getTotalIndices? m.getTotalIndices():0)/3; const o=out[n]||(out[n]=[0,0]); o[0]++; o[1]+=t; }
  return Object.entries(out).sort((a,b)=>b[1][1]-a[1][1]).slice(0,16).map(([n,v])=>[n,v[0],Math.round(v[1])]); }"""
ENABLED = """() => __game.scene.rootNodes.filter(n => n.isEnabled && n.isEnabled() && n.getChildMeshes && n.getChildMeshes().length).map(n => n.name + ':' + n.getChildMeshes().filter(m=>m.isEnabled()).length)"""
SLOTS = "__game.fzMetro.slots.map(s => [s.line, s.step, s.state, s.train.root.isEnabled()])"
async def E(pg): return await pg.evaluate('__game.east.info()')
async def view(pg, v):
    if await pg.evaluate('__game.player.view') != v: await pg.evaluate('void __game.toggleView()')
async def gsleep(pg, secs):
    g0 = await gt(pg); t0 = time.time()
    while await gt(pg) - g0 < secs and time.time() - t0 < 300: await asyncio.sleep(0.3)
async def to_emu_gz(pg):
    await pg.evaluate('__game.teleport(18.6,-11.95,12.6,0)'); await asyncio.sleep(0.8)
    await auto(pg, [[18.6, 13.1], [15.4, 13.1], [-1.6, 13.1], [-2.2, 13.1], [-2.2, 1.4], [2, 1.4], [2, -4.6], [8.6, -4.6]])
    ok1 = await auto(pg, [[10.5, -4.6], [10.5, -12.0], [10.5, -15.6], [6.0, -15.6], [1.2, -15.6], [1.2, -20], [1.2, -36], [1.2, -40.5]])
    if not ok1:
        s = await st(pg); await auto(pg, [[10.5, s['pos'][2]], [10.5, -18.5], [8.0, -18.5], [4.0, -18.5], [1.2, -18.5], [1.2, -28], [1.2, -36], [1.2, -40.5]])
    await auto(pg, [[1.2, -50], [0, -62], [0, -80], [0, -86], [0, -92], [1.5, -100]])
    await auto(pg, [[1.5, -108], [1.5, -111.9], [1.5, -115], [1.5, -117.4], [9, -117.4], [9, -122.5]])
    await auto(pg, [[9, -124], [-5.8, -124], [-5.8, -127.3], [-5.8, -128.6]])
    return await wait(pg, '__game.east.info().inside', 6)
async def sample(pg, tag):
    d = {}
    for v in ('first', 'third'):
        await view(pg, v); await pg.evaluate('__game.player.yaw=-Math.PI/2; __game.player.pitch=0.02')
        await asyncio.sleep(0.3); d[v] = await perf(pg, 6, 0.3); R['roots'][f'{tag}:{v}'] = await pg.evaluate(ROOTS)
    d['draws'] = max(d['first']['draws'], d['third']['draws']); d['tris'] = max(d['first']['tris'], d['third']['tris']); d['pos'] = (await st(pg))['pos']; d['gt'] = round(await gt(pg), 1)
    R['perf'][tag] = d; log('perf', tag, d['first'], d['third'], R['roots'][f'{tag}:first'][:6]); save()
    return d
async def main():
  async with async_playwright() as p:
    b, pg, logs = await open_game(p, BASE + '?q=1&start=gzdz&line=1')
    await pg.evaluate(GCLOCK); await pg.evaluate('__game.setDtMax(0.25)'); await asyncio.sleep(1)
    if FROM == 'xm':
      await pg.evaluate("""(() => { const g=__game; g.east.ensure(); g.east.side='xm'; g.east.xmn.show('solo'); g.east.cur={st:g.station, loc:'xmn', area:'platform'}; g.station.kit.root.setEnabled(false); g.player.spawn(3000-5.8, 0.05, -126.2, Math.PI); })()""")
      await asyncio.sleep(1); await auto(pg, [[XO - 5.8, -127.3], [XO - 5.8, -128.6]]); ok('inCar', await wait(pg, '__game.east.info().inside', 8))
    else: ok('inCar', await to_emu_gz(pg))
    await auto(pg, [[EO + 10.6, 0.25], [EO + 9.0, 0.3], [EO + 4.2, 0.3]]); await pg.evaluate('__game.act()'); await asyncio.sleep(0.8)
    ok('picker', await wait(pg, '__game.east.info().picker', 8))
    await pg.evaluate("document.querySelector('#destPick .dp-card[data-dest=fz]').dispatchEvent(new PointerEvent('pointerup', {bubbles:true}))")
    ok('ride', await wait(pg, '!!__game.east.info().ride && __game.east.info().ride.dest==="fz"', 10))
    ok('run', await wait(pg, '__game.east.info().ride && __game.east.info().ride.phase==="run"', 30))
    await pg.evaluate('__game.east.setSpeed(10)'); await pg.evaluate('__game.setDtMax(0.2)')
    ok('arrived', await wait(pg, '__game.east.info().count.arrived.includes("fz")', 900, wall=5400, poll=2))
    await pg.evaluate('__game.setDtMax(0.25)')
    ok('doorOpen', await wait(pg, '__game.east.info().door <= 0', 10))
    if (await st(pg))['seat'].get('seated'): await pg.evaluate('__game.act()'); await asyncio.sleep(0.6)
    await view(pg, 'third'); await auto(pg, [[EO + 9.0, 0.25], [EO + 10.6, 0.25], [EO + 11.2, 0.9], [EO + 11.2, 2.0]])
    ok('alightFzs', await wait(pg, '__game.east.info().loc === "fzs"', 8))
    for l in [[[FO - 4.6, -126.6], [FO - 8, -123.3], [FO - 12, -123.3]], [[FO - 30, -123.3]]]: await auto(pg, l)
    await auto(pg, [[FO - 24, -112], [FO - 20, -104]]); await auto(pg, [[FO - 20, -96], [FO - 20, -88]]); await auto(pg, [[FO - 30, -80], [FO - 42, -80]])
    await auto(pg, [[FO - 42, -80], [FO - 64, -80]]); await auto(pg, [[FO - 86, -80], [FO - 94, -80]])
    await auto(pg, [[FO - 99, -79.4], [FO - 99, -75.8]]); await auto(pg, [[FO - 108.5, -75.8], [FO - 108.5, -80]])
    await auto(pg, [[FO - 101, -80], [FO - 93, -80]])
    ok('toMetro', await wait(pg, '__game.east.info().loc==="fzmetro" && !!(__game.fzMetro && __game.fzMetro.station)', 8))
    g0 = await gt(pg); R['state']['enabledRoots@arrive'] = await pg.evaluate(ENABLED)
    # 刚到（同小美 pf：0.8 s 墙钟）
    await view(pg, 'first'); await pg.evaluate('__game.player.yaw=-Math.PI/2; __game.player.pitch=0.02'); await asyncio.sleep(0.8)
    a = await perf(pg, 4, 0.3); R['perf']['quick:first'] = a; R['roots']['quick:first'] = await pg.evaluate(ROOTS); log('perf quick first', a, R['roots']['quick:first'][:6])
    TS = (1, 3, 6, 12, 20, 30, 45, 60)   # 多等几轮，让 1 / 5 号线列车进出站都落在采样里
    for t in TS:
        g = await gt(pg) - g0
        if g < t: await gsleep(pg, t - g)
        await sample(pg, f'settled{t}s')
        R['state'][f'slots@{t}s'] = await pg.evaluate(SLOTS)
    R['state']['enabledRoots@end'] = await pg.evaluate(ENABLED)
    R['state']['fzsViews'] = await pg.evaluate("(() => { const n = __game.east.fzs && __game.east.fzs.station && __game.east.fzs.station.kit.groupNodes; return n ? Object.fromEntries(Object.entries(n).map(([k, v]) => [k, v.isEnabled()])) : null; })()")
    if SHOTS:
        os.makedirs(SHOTS, exist_ok=True); await view(pg, 'third')
        for i, (nm, yaw, pitch) in enumerate([('w', -math.pi / 2, 0.02), ('e', math.pi / 2, 0.02), ('n', 0, 0.02), ('s', math.pi, 0.02), ('e-up', math.pi / 2, 0.45)]):
            await pg.evaluate(f'__game.player.yaw={yaw}; __game.player.pitch={pitch}'); await asyncio.sleep(1.5)
            d = await perf(pg, 3, 0.3); R['perf'][f'look-{nm}'] = d; R['roots'][f'look-{nm}'] = await pg.evaluate(ROOTS); log('look', nm, d, R['roots'][f'look-{nm}'][:8])
            await safe_shot(pg, f'{SHOTS}/gate-{FROM}-{nm}.png')
        L = [R['perf'][k] for k in R['perf'] if k.startswith('look-')]
        ok('lookBudget', all(x['draws'] <= 50 and x['tris'] <= 90000 for x in L), [(x['draws'], x['tris']) for x in L])
    S = [R['perf'][f'settled{t}s'] for t in TS if t >= 3]
    ok('settledBudget', all(x['draws'] <= 50 and x['tris'] <= 90000 for x in S), [(x['draws'], x['tris']) for x in S])
    R['errors'] = errs(logs)[:10]
    await b.close()
  save(); print('FZ_GATE_PROBE', FROM, 'PASS' if all(R['checks'].values()) else 'FAIL', [k for k, v in R['checks'].items() if not v], flush=True)
asyncio.run(main())
sys.exit(0 if R['checks'] and all(R['checks'].values()) else 1)
