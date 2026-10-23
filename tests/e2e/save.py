# 存档 / 续玩：厦门地铁站台存档 → 刷新后回到站台；坐车途中存档 → 回到最后到过的站台；坏档 / 版本不对 → 默认开局
# 用法：python tests/e2e/save.py [base-url]
import asyncio, sys, json, os
sys.path.insert(0, os.path.dirname(__file__))
from common import *
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8177/'
R = {'checks': {}}
def ok(k, v): R['checks'][k] = bool(v); print('check', k, bool(v), flush=True)
async def ready(pg):
    await pg.wait_for_function('window.__game || document.querySelector("#loading.err")', timeout=120000)
    return await pg.evaluate('!!window.__game')
async def reload(pg):
    for k in range(3):
        try: await pg.goto(URL, wait_until='load', timeout=120000); break
        except Exception as e: print('nav retry', k, str(e)[:80], flush=True); await asyncio.sleep(1)
    return await ready(pg)
async def main():
  async with async_playwright() as p:
    b, pg, logs = await open_game(p, URL)
    s = await st(pg); ok('freshDefault', s['code'] == 'gyq' and await pg.evaluate('__game.save.resumed()') is None)
    ok('restartButton', await pg.evaluate('!!document.querySelector("#netmap header .restart")'))
    # 1) 厦门地铁 吕厝 2 号线站台上存档
    await pg.evaluate("""(() => { const g=__game; g.east.ensure(); g.east.side='xm'; g.east.cur={st:g.station, loc:'xmmetro', area:'metro'};
      g.xmMetro.enterFromRailway(g.player); g.xmMetro.buildStation('lcu');
      const P=g.xmMetro.station.platforms.find(p=>p.line===2); g.player.spawn(3000+12, P.y+0.05, P.zc+2, 1.2); })()""")
    await asyncio.sleep(1.5)
    s0 = await st(pg); ok('wrote', await pg.evaluate('__game.save.write()'))
    sv = await pg.evaluate('__game.save.read()'); print('save', sv, flush=True)
    ok('saveXm', sv and sv['city'] == 'xm' and sv['code'] == 'lcu' and sv['v'] == 1)
    ok('reload1', await reload(pg)); await asyncio.sleep(1.5)
    s = await st(pg); print('after reload', s['code'], s['zone'], s['pos'], flush=True)
    ok('resumeXm', await pg.evaluate('__game.save.resumed()') == 'xm' and s['code'] == 'lcu' and s['zone'] == 'platform'
       and abs(s['pos'][0] - s0['pos'][0]) < 0.6 and abs(s['pos'][1] - s0['pos'][1]) < 0.6 and abs(s['pos'][2] - s0['pos'][2]) < 0.6)
    # 2) 坐车途中的存档（platform:true）→ 回到那个站的站台
    await pg.evaluate("""(() => { __game.save.off(); localStorage.setItem('gzmb.save', JSON.stringify({v:1, city:'xm', code:'gds', line:2, platform:true, t:Date.now()})); })()""")
    ok('reload2', await reload(pg)); await asyncio.sleep(1.5)
    s = await st(pg); print('after reload2', s['code'], s['zone'], s['pos'], flush=True)
    ok('resumeRidePlatform', s['code'] == 'gds' and s['zone'] == 'platform' and not s['aboard'])
    # 3) 坏档 → 默认开局（不白屏）
    await pg.evaluate("""(() => { __game.save.off(); localStorage.setItem('gzmb.save', '{bad json'); })()""")
    ok('reload3', await reload(pg)); await asyncio.sleep(1)
    s = await st(pg); ok('corruptDefault', s['code'] == 'gyq' and await pg.evaluate('__game.save.resumed()') is None)
    # 4) 版本不对 → 默认开局
    await pg.evaluate("""(() => { __game.save.off(); localStorage.setItem('gzmb.save', JSON.stringify({v:99, city:'xm', code:'lcu', pos:[3000,-22,0], yaw:0})); })()""")
    ok('reload4', await reload(pg)); await asyncio.sleep(1)
    s = await st(pg); ok('versionDefault', s['code'] == 'gyq' and await pg.evaluate('__game.save.resumed()') is None)
    # 5) 广州：站里存档 → 刷新回来
    await pg.evaluate("""(() => { __game.save.off(); localStorage.removeItem('gzmb.save'); })()""")
    ok('reload5', await reload(pg)); await asyncio.sleep(1)
    await pg.evaluate('__game.teleport(18.6,-11.95,12.6,0)'); await asyncio.sleep(1); s0 = await st(pg)
    await pg.evaluate('__game.save.write()'); ok('reload6', await reload(pg)); await asyncio.sleep(1)
    s = await st(pg); ok('resumeGz', await pg.evaluate('__game.save.resumed()') == 'gz' and s['code'] == s0['code'] and abs(s['pos'][2] - s0['pos'][2]) < 0.6)
    R['errors'] = errs(logs)
    good = all(R['checks'].values()) and not R['errors']
    print(json.dumps(R, ensure_ascii=False, indent=1, default=str))
    print('SAVE', 'PASS' if good else 'FAIL', [k for k, v in R['checks'].items() if not v], flush=True)
    await b.close()
    if not good: sys.exit(1)
if __name__ == "__main__": asyncio.run(main())
