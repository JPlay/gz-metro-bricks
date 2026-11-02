# 东街口换乘楼梯性能（按小美 p2 的真实路线）：福州南地铁站进站 → 坐 1 号线到东街口（上一站上车坐一站）→ 下车 → 出 C 口上街再回来 →
# 走到 L1↔L4 换乘楼梯半中间（5012, -17.5, -1）朝 -x。每个点先量“刚到”（0.8 s 墙钟，同 QA 的 pf）再量稳定帧（≥6 s 游戏时间）。
# 用法：python tests/e2e/fz_djk_route.py BASE OUTJSON
import asyncio, sys, json, os, time
sys.path.insert(0, os.path.dirname(__file__))
from common import *
from journey import GCLOCK, gt, auto, wait, log
from perfhud import perf
BASE = sys.argv[1]; OUT = sys.argv[2]; FO = 5000
R = {'perf': {}, 'roots': {}, 'checks': {}}
def ok(k, v, info=None): R['checks'][k] = bool(v); log('check', k, bool(v), '' if info is None else json.dumps(info, ensure_ascii=False, default=str)[:300]); return v
ROOTS = """() => { const s=__game.scene, A=s.getActiveMeshes(), out={}; for (let i=0;i<A.length;i++) { const m=A.data[i]; let r=m; while (r.parent) r=r.parent; const n=(r.name||'?')+'/'+(m.name||'?').replace(/[0-9]+$/,''); const t=(m.getTotalIndices? m.getTotalIndices():0)/3; const o=out[n]||(out[n]=[0,0]); o[0]++; o[1]+=t; }
  return Object.entries(out).sort((a,b)=>b[1][1]-a[1][1]).slice(0,16).map(([n,v])=>[n,v[0],Math.round(v[1])]); }"""
async def view(pg, v):
    if await pg.evaluate('__game.player.view') != v: await pg.evaluate('void __game.toggleView()')
async def gsleep(pg, secs):
    g0 = await gt(pg); t0 = time.time()
    while await gt(pg) - g0 < secs and time.time() - t0 < 300: await asyncio.sleep(0.3)
async def stair(pg, name):
    await pg.evaluate("void __game.player.spawn(5012, -17.3, -1, -Math.PI/2)")
    for tag, quick in (('quick', True), ('settled', False)):
        d = {}
        for v in ('first', 'third'):
            await view(pg, v); await pg.evaluate('__game.player.yaw=-Math.PI/2; __game.player.pitch=-0.1')
            if quick: await asyncio.sleep(0.8)
            else: await gsleep(pg, 6)
            d[v] = await perf(pg, 6 if not quick else 4, 0.3); R['roots'][f'{name}:{tag}:{v}'] = await pg.evaluate(ROOTS)
        d['draws'] = max(d['first']['draws'], d['third']['draws']); d['tris'] = max(d['first']['tris'], d['third']['tris'])
        R['perf'][f'{name}:{tag}'] = d; log('perf', name, tag, d['first'], d['third'], R['roots'][f'{name}:{tag}:third'][:6])
        ok(f'{name}:{tag}:budget', d['draws'] <= 50 and d['tris'] <= 90000)
        json.dump(R, open(OUT, 'w'), ensure_ascii=False, indent=1, default=str)
SLOT = "__game.fzMetro.slots.find(o=>o.line===%d&&o.step===%d)"
async def main():
  async with async_playwright() as p:
    b, pg, logs = await open_game(p, BASE + '?q=1')
    await pg.evaluate(GCLOCK); await pg.evaluate('__game.setDtMax(0.25)'); await asyncio.sleep(1)
    await pg.evaluate("""(() => { const g=__game; g.east.ensure(); g.east.side='fz'; g.east.cur={st:g.station, loc:'fzmetro', area:'metro'}; g.station.kit.root.setEnabled(false); g.fzMetro.enterFromRailway(g.player); })()""")
    await asyncio.sleep(2)
    plan = await pg.evaluate("""(async () => { const L = await import('/js/data/fz-lines.js'); const st = L.FZ_LINES[1].stations, i = st.indexOf('fzdjk');
      for (const step of [1, -1]) { const prev = st[i - step]; if (prev && L.fzNext(1, prev, step) === 'fzdjk') return { prev, step }; } return null; })()""")
    R['plan'] = plan; step = plan['step']
    await pg.evaluate(f"void __game.fzMetro.buildStation('{plan['prev']}')"); await asyncio.sleep(1)
    g = await pg.evaluate(f"(() => {{ const s={SLOT % (1, step)}; return {{trackZ:s.side.trackZ, zc:s.P.zc, y:s.P.y}}; }})()")
    sg = 1 if g['zc'] > g['trackZ'] else -1
    await pg.evaluate(f"void __game.player.spawn({FO}, {g['y']}+0.05, {g['trackZ'] + sg * 2.2}, 0)"); await asyncio.sleep(0.5)
    await pg.evaluate(f"void __game.fzMetro.call(1,{step})")
    ok('trainCame', await wait(pg, f"(({SLOT % (1, step)})||{{}}).state==='dwell'", 120))
    await pg.evaluate(f"(() => {{ const s={SLOT % (1, step)}; s.t=20; }})()")
    await auto(pg, [[FO, g['trackZ'] + sg * 0.4]]); ok('aboard', await wait(pg, '__game.state().aboard', 8))
    await pg.evaluate(f"(() => {{ const s={SLOT % (1, step)}; s.t=0.3; }})()")
    ok('arrived', await wait(pg, f"__game.fzMetro.code==='fzdjk' && (({SLOT % (1, step)})||{{}}).state==='dwell'", 400))
    await auto(pg, [[FO, g['trackZ'] + sg * 3.6]]); ok('alighted', await wait(pg, '!__game.state().aboard', 10))
    await stair(pg, 'afterRide')
    await pg.evaluate("void __game.fzMetro.goStreet()"); await asyncio.sleep(3)
    ok('street', await pg.evaluate('!!__game.fzMetro.street'))
    await pg.evaluate("void __game.fzMetro.backFromStreet()"); await asyncio.sleep(3)
    await stair(pg, 'afterStreet')
    R['errors'] = errs(logs)[:10]
    await b.close()
  json.dump(R, open(OUT, 'w'), ensure_ascii=False, indent=1, default=str)
  print('FZ_DJK_ROUTE', 'PASS' if all(R['checks'].values()) else 'FAIL', [k for k, v in R['checks'].items() if not v], flush=True)
asyncio.run(main())
