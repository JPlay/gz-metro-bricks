# 福州内河 8A 首件取景：入湖口（渠→湖、半岛）与 3号码头（栈桥+可读牌），白天/夜里同机位。
# 用法：FZQS='&t=day'|'&t=night' python tests/e2e/fz_8a_shots.py <base-url> <截图目录>
import asyncio, sys, json, os
sys.path.insert(0, os.path.dirname(__file__))
from common import *
from journey import GCLOCK
from perfhud import perf
BASE = sys.argv[1]; OUT = sys.argv[2].rstrip('/'); os.makedirs(OUT, exist_ok=True)
QS = os.environ.get('FZQS', '&t=day'); TAG = 'night' if 't=night' in QS else 'day'
SPOTS = """(async () => {
  const M = await import('/js/data/fz-river.js');
  const A = M.FZR.a8a;
  if (!A || !A.cams) return [];
  const cam = (name, c) => [name, c.x, c.z, c.look[0], c.look[2], (c.pitch != null ? c.pitch : 0.04), c.y || 1.6, 1];
  const out = [];
  if (A.cams.inlet) out.push(cam('inlet', A.cams.inlet));
  if (A.cams.pier3) out.push(cam('pier3', A.cams.pier3));
  return out;
})()"""

async def main():
  R = {'tag': TAG, 'spots': {}, 'shots': []}
  async with async_playwright() as p:
    b, pg, logs = await open_game(p, BASE + '?q=1' + QS)
    await pg.evaluate(GCLOCK)
    await pg.evaluate(f"__game.setDtMax({float(os.environ.get('FZDT', '0.25'))})")
    await asyncio.sleep(1)
    await pg.evaluate("""(() => { const g=__game; g.east.ensure(); g.east.side='fz'; g.east.cur={st:g.station, loc:'fzmetro', area:'metro'}; g.station.kit.root.setEnabled(false); g.fzMetro.enterFromRailway(g.player); })()""")
    await asyncio.sleep(1.5)
    code = os.environ.get('FZKIOSK', 'fzgmg')  # 光明港 D，与 3B 凤坂河同一入口
    await pg.evaluate(f"""(async () => {{ const E = await import('/js/data/fz-exits.js'); const X = E.FZ_EXITS['{code}']; const ex = X.attr === 'fzriver' ? X : (X.more || []).find(e => e.attr === 'fzriver'); const m=__game.fzMetro; m.buildStation('{code}'); m.goStreet(ex); }})()""")
    await asyncio.sleep(5)
    si = await pg.evaluate('__game.fzMetro.street ? __game.fzMetro.street.info() : null')
    R['street'] = si
    print('street', json.dumps({k: (si or {}).get(k) for k in ('kiosk', 'net', 'night')}), flush=True)
    if await pg.evaluate('__game.player.view') != 'first':
      await pg.evaluate('__game.toggleView()')
    spots = await pg.evaluate(SPOTS)
    # 机位覆盖：不要站在福新东路路面（沥青主导），也不要贴着牌子把英文裁掉
    # 入湖口：渠西岸、桥南，向北沿水面看桥洞与半岛
    # 3号码头：退到岸上约 8 m，牌全文（中英）可读，弯形栈桥在画面中
    # 以数据机位为底，微调：入湖口沿渠看水面，3号退开让中英全文入画
    C = None
    spots = [
      # 渠西岸、桥南，沿水面看福新东路、入湖与半岛（避开路面）
      ['inlet', 985.2, -146.5, 998.0, -80.0, 0.10, 1.6, 1],
      # 3号码头：退到岸上，中英全文可读，弯形栈桥在画面中
      ['pier3', 1107.2, -80.8, 1093.5, -66.0, 0.05, 1.58, 1],
    ]
    print('spots', spots, flush=True)
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
      if await safe_shot(pg, path=fn, type='jpeg', quality=80): R['shots'].append(fn)
      view = await perf(pg, 3, 0.3); yaw0 = await pg.evaluate('__game.player.yaw'); rows = []
      for k in range(4):
        await pg.evaluate(f"__game.player.yaw = {k} * Math.PI / 2; __game.player.pitch = 0.08"); rows.append(await perf(pg, 3, 0.3))
      pos = await pg.evaluate('(() => { const S=__game.fzMetro.street, R=S.kit.root.position, p=__game.player.position; return [+(p.x-R.x).toFixed(2), +p.y.toFixed(2), +(p.z-R.z).toFixed(2)]; })()')
      g7 = await pg.evaluate('(() => { const n = __game.fzMetro.street.kit.groupNodes.g7day; return n ? n.isEnabled(false) : null; })()')
      R['spots'][name] = {'view': view, 'yaw0': yaw0, 'yaws': rows, 'pos': pos, 'g7day': g7,
                          'max': {'draws': max(r['draws'] for r in rows + [view]), 'tris': max(r['tris'] for r in rows + [view])}}
      print('perf', name, 'view', view['draws'], view['tris'], 'yaws', [(r['draws'], r['tris']) for r in rows], 'max', R['spots'][name]['max'], 'g7day', g7, 'pos', pos, flush=True)
    R['errors'] = [l for l in errs(logs) if l[0] in ('error', 'pageerror')][:8]
    print('ERRORS', R['errors'])
    await pg.evaluate("if (window.__fzHold) { clearInterval(window.__fzHold); window.__fzHold=null; }")
    await b.close()
  json.dump(R, open(f'{OUT}/perf_{TAG}.json', 'w'), ensure_ascii=False, indent=1, default=str)
  print('SHOTS8A DONE', TAG, flush=True)
asyncio.run(main())
