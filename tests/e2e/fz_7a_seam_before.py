# 7A 汇入口同机位「之前」：在不含 7A 的树（main d26fb85）上拍 a7a.cams.seam。
# 用法：FZQS='&t=day' python tests/e2e/fz_7a_seam_before.py <base-url> <截图目录>
import asyncio, sys, json, os
sys.path.insert(0, os.path.dirname(__file__))
from common import *
from journey import GCLOCK
from perfhud import perf
BASE = sys.argv[1]; OUT = sys.argv[2].rstrip('/'); os.makedirs(OUT, exist_ok=True)
QS = os.environ.get('FZQS', '&t=day'); TAG = 'night' if 't=night' in QS else 'day'
# 与 7A a7a.cams.seam 同一机位
X, Z, Y, TX, TZ, PITCH = 327.69, 439.96, 1.8, 376.15, 421.39, 0.08
async def main():
  R = {'tag': TAG, 'spots': {}, 'shots': []}
  async with async_playwright() as p:
    b, pg, logs = await open_game(p, BASE + '?q=1' + QS)
    await pg.evaluate(GCLOCK); await pg.evaluate(f"__game.setDtMax({float(os.environ.get('FZDT', '0.25'))})"); await asyncio.sleep(1)
    await pg.evaluate("""(() => { const g=__game; g.east.ensure(); g.east.side='fz'; g.east.cur={st:g.station, loc:'fzmetro', area:'metro'}; g.station.kit.root.setEnabled(false); g.fzMetro.enterFromRailway(g.player); })()""")
    await asyncio.sleep(1.5)
    code = os.environ.get('FZKIOSK', 'fzdm')
    await pg.evaluate(f"""(async () => {{ const E = await import('/js/data/fz-exits.js'); const X = E.FZ_EXITS['{code}']; const ex = X.attr === 'fzriver' ? X : (X.more || []).find(e => e.attr === 'fzriver'); const m=__game.fzMetro; m.buildStation('{code}'); m.goStreet(ex); }})()""")
    await asyncio.sleep(5)
    if await pg.evaluate('__game.player.view') != 'first': await pg.evaluate('__game.toggleView()')
    await pg.evaluate("(() => { const S=__game.fzMetro.street, R=S.kit.root.position, pl=__game.player;"
                      + " if (window.__fzHold) { clearInterval(window.__fzHold); window.__fzHold=null; }"
                      + f" pl.spawn(R.x+({X}), {Y}, R.z+({Z}), Math.atan2(({TX})-({X}), ({TZ})-({Z}))); pl.pitch={PITCH};"
                      + f" window.__fzHold = setInterval(() => {{ pl.position.x=R.x+({X}); pl.position.y={Y}; pl.position.z=R.z+({Z}); pl.vy=0; pl.grounded=true; const b=document.getElementById('bShore'); if (b) b.hidden=true; }}, 16);"
                      + " })()")
    await asyncio.sleep(3.0); fn = f'{OUT}/seam_before_{TAG}.jpg'
    if await safe_shot(pg, path=fn, type='jpeg', quality=72): R['shots'].append(fn)
    view = await perf(pg, 3, 0.3)
    R['spots']['seam_before'] = {'view': view}
    print('perf seam_before', view['draws'], view['tris'], flush=True)
    R['errors'] = [l for l in errs(logs) if l[0] in ('error', 'pageerror')][:8]
    print('ERRORS', R['errors'])
    await pg.evaluate("if (window.__fzHold) { clearInterval(window.__fzHold); window.__fzHold=null; }")
    await b.close()
  json.dump(R, open(f'{OUT}/perf_{TAG}.json', 'w'), ensure_ascii=False, indent=1, default=str)
  print('SHOTS7A_BEFORE DONE', TAG, flush=True)
asyncio.run(main())
