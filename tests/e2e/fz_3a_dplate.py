# 3A 小美：D 船近景（白篷 + 蓝绿垂边 + 船头「D」牌）昼 / 夜各拍几张 + 该方向 draws / 三角形（原尺寸 1112×834，传送取景）
# 用法：FZQS='&t=day'|'&t=night' python tests/e2e/fz_3a_dplate.py <base-url> <截图目录>
import asyncio, sys, json, os
sys.path.insert(0, os.path.dirname(__file__))
from common import *
from journey import GCLOCK
from perfhud import perf
BASE = sys.argv[1]; OUT = sys.argv[2].rstrip('/'); os.makedirs(OUT, exist_ok=True)
QS = os.environ.get('FZQS', '&t=day'); TAG = 'night' if 't=night' in QS else 'day'
CAMS = """(async () => { const M = await import('/js/data/fz-river.js'); const gm = M.RIVERS.gm.line, hw = M.FZR.rivers.gm.hw, gD = M.PIERS.find(p => p.id === 'gmgD'), WY = M.WY;
  const at = (s, l) => { const a = gm.at(s, l); return [a.x, a.z]; }, b = __game.fzMetro.street.boats.D.info();
  return { boat: b, cams: [
    ['d_plate_closeup_boat', ...at(gD.s - 8.5, hw - 1.8), ...at(gD.s - 4.0, hw - 3.0), 0.3, WY + 0.5],   // 整船：白篷 + 蓝绿垂边 + 船头「D」牌
    ['d_plate_closeup_near', ...at(gD.s - 6.0, hw - 0.6), ...at(gD.s - 4.0, hw - 3.0), 0.55, WY + 0.5],   // 近看「D」牌
  ] }; })()"""
async def main():
  R = {'tag': TAG, 'shots': {}}
  async with async_playwright() as p:
    b, pg, logs = await open_game(p, BASE + '?q=1' + QS)
    await pg.evaluate(GCLOCK); await pg.evaluate('__game.setDtMax(0.25)'); await asyncio.sleep(1)
    await pg.evaluate("""(() => { const g=__game; g.east.ensure(); g.east.side='fz'; g.east.cur={st:g.station, loc:'fzmetro', area:'metro'}; g.station.kit.root.setEnabled(false); g.fzMetro.enterFromRailway(g.player); })()""")
    await asyncio.sleep(1.5)
    await pg.evaluate("""(async () => { const E = await import('/js/data/fz-exits.js'); const X = E.FZ_EXITS['fzgmg']; const ex = X.attr === 'fzriver' ? X : (X.more || []).find(e => e.attr === 'fzriver'); const m=__game.fzMetro; m.buildStation('fzgmg'); m.goStreet(ex); })()""")
    await asyncio.sleep(5)
    if await pg.evaluate('__game.player.view') != 'first': await pg.evaluate('__game.toggleView()')
    C = await pg.evaluate(CAMS); print('D boat', json.dumps({k: C['boat'][k] for k in ('phase', 'at', 's')}), flush=True)
    for name, x, z, tx, tz, pitch, y in C['cams']:
      await pg.evaluate(f"(() => {{ const S=__game.fzMetro.street, R=S.kit.root.position; __game.player.spawn(R.x+({x}), {y}, R.z+({z}), Math.atan2(({tx})-({x}), ({tz})-({z}))); __game.player.pitch={pitch}; }})()")
      await asyncio.sleep(3.0); fn = f'{OUT}/{name}_{TAG}.jpg'
      if await safe_shot(pg, path=fn, type='jpeg', quality=80):
        d = await perf(pg, 3, 0.3); R['shots'][fn] = d; print('shot', fn, d['draws'], d['tris'], flush=True)
    R['errors'] = [l for l in errs(logs) if l[0] in ('error', 'pageerror')][:8]; print('ERRORS', R['errors'])
    await b.close()
  json.dump(R, open(f'{OUT}/dplate_{TAG}.json', 'w'), ensure_ascii=False, indent=1, default=str)
asyncio.run(main())
