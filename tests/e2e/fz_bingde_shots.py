# 彬德水闸取景（4A HOLD：fzNight 灯带改到墩帽/檐下，需日+夜对照，夜 draws ≤ 昼）
# 用法：FZQS='&t=day'|'&t=night' python tests/e2e/fz_bingde_shots.py <base-url> <截图目录>
import asyncio, sys, json, os
sys.path.insert(0, os.path.dirname(__file__))
from common import *
from journey import GCLOCK
from perfhud import perf
BASE = sys.argv[1]; OUT = sys.argv[2].rstrip('/'); os.makedirs(OUT, exist_ok=True)
QS = os.environ.get('FZQS', '&t=day'); TAG = 'night' if 't=night' in QS else 'day'
async def main():
  R = {'tag': TAG, 'spots': {}, 'shots': []}
  async with async_playwright() as p:
    b, pg, logs = await open_game(p, BASE + '?q=1' + QS)
    await pg.evaluate(GCLOCK); await pg.evaluate(f"__game.setDtMax({float(os.environ.get('FZDT', '0.25'))})"); await asyncio.sleep(1)
    await pg.evaluate("""(() => { const g=__game; g.east.ensure(); g.east.side='fz'; g.east.cur={st:g.station, loc:'fzmetro', area:'metro'}; g.station.kit.root.setEnabled(false); g.fzMetro.enterFromRailway(g.player); })()""")
    await asyncio.sleep(1.5)
    await pg.evaluate("""(async () => { const E = await import('/js/data/fz-exits.js'); const X = E.FZ_EXITS['fznh']; const ex = X.attr === 'fzriver' ? X : (X.more || []).find(e => e.attr === 'fzriver'); const m=__game.fzMetro; m.buildStation('fznh'); m.goStreet(ex); })()""")
    await asyncio.sleep(5)
    si = await pg.evaluate('__game.fzMetro.street ? __game.fzMetro.street.info() : null')
    R['street'] = {k: si.get(k) for k in ('kiosk', 'net', 'route', 'atlasOverflow', 'night')} if si else None
    print('street', json.dumps(R['street']), flush=True)
    if await pg.evaluate('__game.player.view') != 'first': await pg.evaluate('__game.toggleView()')
    spots = await pg.evaluate("""(async () => { const M = await import('/js/data/fz-river.js'); const S = M.FZR.c2.sluice;
      const front = [S.x - S.t[0] * 22, S.z - S.t[1] * 22];
      return [
        ['bingde_from_lookout', ...S.view, S.x, S.z, 0.02, 0.05],
        ['bingde_front', ...front, S.x, S.z, 0.04, 0.05],
      ]; })()""")
    for name, x, z, tx, tz, pitch, y in spots:
      await pg.evaluate(f"(() => {{ const S=__game.fzMetro.street, R=S.kit.root.position; __game.player.spawn(R.x+({x}), {y}, R.z+({z}), Math.atan2(({tx})-({x}), ({tz})-({z}))); __game.player.pitch={pitch}; }})()")
      await asyncio.sleep(3.0); fn = f'{OUT}/{name}_{TAG}.jpg'
      if await safe_shot(pg, path=fn, type='jpeg', quality=72): R['shots'].append(fn)
      view = await perf(pg, 3, 0.3); yaw0 = await pg.evaluate('__game.player.yaw'); rows = []
      for k in range(4):
        await pg.evaluate(f"__game.player.yaw = {k} * Math.PI / 2; __game.player.pitch = 0.08"); rows.append(await perf(pg, 3, 0.3))
      R['spots'][name] = {'view': view, 'yaw0': yaw0, 'yaws': rows, 'max': {'draws': max(r['draws'] for r in rows + [view]), 'tris': max(r['tris'] for r in rows + [view])}}
      print('perf', name, 'view', view['draws'], view['tris'], 'yaws', [(r['draws'], r['tris']) for r in rows], 'max', R['spots'][name]['max'], flush=True)
    R['errors'] = [l for l in errs(logs) if l[0] in ('error', 'pageerror')][:8]
    print('ERRORS', R['errors'], flush=True)
    await b.close()
  json.dump(R, open(f'{OUT}/perf_bingde_{TAG}.json', 'w'), ensure_ascii=False, indent=1, default=str)
  print('SHOTS_BINGDE DONE', TAG, flush=True)
asyncio.run(main())
