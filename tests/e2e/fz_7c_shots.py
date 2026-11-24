# 福州内河 7C 取景 + 性能（白天 / 夜里同机位，传送取景；正式验收走 fz_river.py o_yx_east 真走）
# 用法：FZQS='&t=day'|'&t=night' python tests/e2e/fz_7c_shots.py <base-url> <截图目录>
import asyncio, sys, json, os
sys.path.insert(0, os.path.dirname(__file__))
from common import *
from journey import GCLOCK
from perfhud import perf
BASE = sys.argv[1]; OUT = sys.argv[2].rstrip('/'); os.makedirs(OUT, exist_ok=True)
QS = os.environ.get('FZQS', '&t=day'); TAG = 'night' if 't=night' in QS else 'day'
# 全部 7C 交图机位，含 7B/7C 接缝 joint
SPOTS = """(async () => { const M = await import('/js/data/fz-river.js'); const F = M.FZR, A = F.a7c;
  if (!A) return [];
  const C = A.cams || {};
  const cam = (name, c, pitchDef, yDef) => [name, c.x, c.z, c.look[0], c.look[2], (c.pitch != null ? c.pitch : pitchDef), c.y || yDef, 1];
  const order = ['joint', 'mouth', 'jianshan', 'anon38', 'anon9', 'south', 'anon17', 'cap'];
  const out = [];
  for (const n of order) { if (C[n]) out.push(cam(n, C[n], 0.08, 1.55)); }
  for (const n of Object.keys(C)) { if (!order.includes(n)) out.push(cam(n, C[n], 0.08, 1.55)); }
  return out; })()"""

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
    si = await pg.evaluate('__game.fzMetro.street ? __game.fzMetro.street.info() : null')
    R['street'] = si
    print('street', json.dumps({k: (si or {}).get(k) for k in ('kiosk', 'net', 'night')}), flush=True)
    if await pg.evaluate('__game.player.view') != 'first': await pg.evaluate('__game.toggleView()')
    spots = await pg.evaluate(SPOTS)
    print('spots', [s[0] for s in spots], flush=True)
    ONLY = set(filter(None, os.environ.get('FZSPOTS', '').split(',')))
    for spot in spots:
      hover = int(spot[7]) if len(spot) > 7 else 0
      name, x, z, tx, tz, pitch, y = spot[:7]
      if ONLY and name not in ONLY: continue
      await pg.evaluate("(() => { const S=__game.fzMetro.street, R=S.kit.root.position, pl=__game.player;"
                        + " if (window.__fzHold) { clearInterval(window.__fzHold); window.__fzHold=null; }"
                        + f" pl.spawn(R.x+({x}), {y}, R.z+({z}), Math.atan2(({tx})-({x}), ({tz})-({z}))); pl.pitch={pitch};"
                        + (f" window.__fzHold = setInterval(() => {{ pl.position.x=R.x+({x}); pl.position.y={y}; pl.position.z=R.z+({z}); pl.vy=0; pl.grounded=true; const b=document.getElementById('bShore'); if (b) b.hidden=true; }}, 16);" if hover else "")
                        + " })()")
      await asyncio.sleep(3.0); fn = f'{OUT}/{name}_{TAG}.jpg'
      if await safe_shot(pg, path=fn, type='jpeg', quality=72): R['shots'].append(fn)
      view = await perf(pg, 3, 0.3); yaw0 = await pg.evaluate('__game.player.yaw'); rows = []
      for k in range(4):
        await pg.evaluate(f"__game.player.yaw = {k} * Math.PI / 2; __game.player.pitch = 0.08"); rows.append(await perf(pg, 3, 0.3))
      # restore look for a clean confirmation frame already saved
      await pg.evaluate(f"__game.player.yaw = {yaw0}; __game.player.pitch = {pitch}")
      pos = await pg.evaluate('(() => { const S=__game.fzMetro.street, R=S.kit.root.position, p=__game.player.position; return [+(p.x-R.x).toFixed(2), +p.y.toFixed(2), +(p.z-R.z).toFixed(2)]; })()')
      g7 = await pg.evaluate('(() => { const n = __game.fzMetro.street.kit.groupNodes.g7day; return n ? n.isEnabled(false) : null; })()')
      R['spots'][name] = {'view': view, 'yaw0': yaw0, 'yaws': rows, 'pos': pos, 'g7day': g7, 'max': {'draws': max(r['draws'] for r in rows + [view]), 'tris': max(r['tris'] for r in rows + [view])}}
      print('perf', name, 'view', view['draws'], view['tris'], 'yaws', [(r['draws'], r['tris']) for r in rows], 'g7day', g7, 'pos', pos, flush=True)
    R['errors'] = [l for l in errs(logs) if l[0] in ('error', 'pageerror')][:8]
    print('ERRORS', R['errors'])
    await pg.evaluate("if (window.__fzHold) { clearInterval(window.__fzHold); window.__fzHold=null; }")
    await b.close()
  json.dump(R, open(f'{OUT}/perf_{TAG}.json', 'w'), ensure_ascii=False, indent=1, default=str)
  print('SHOTS7C DONE', TAG, flush=True)
asyncio.run(main())
