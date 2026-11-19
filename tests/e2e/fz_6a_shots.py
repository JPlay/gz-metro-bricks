# 福州内河 6A 取景 + 性能（白天 / 夜里同机位，传送取景；正式验收走 fz_river.py k_hq_east 真走）
# 用法：FZQS='&t=day'|'&t=night' python tests/e2e/fz_6a_shots.py <base-url> <截图目录>
# 无 a6 的 3B 基线（origin/main 96f7417）也可以拍 mouth_east（只用 jn）。
import asyncio, sys, json, os
sys.path.insert(0, os.path.dirname(__file__))
from common import *
from journey import GCLOCK
from perfhud import perf
BASE = sys.argv[1]; OUT = sys.argv[2].rstrip('/'); os.makedirs(OUT, exist_ok=True)
QS = os.environ.get('FZQS', '&t=day'); TAG = 'night' if 't=night' in QS else 'day'
SPOTS = """(async () => { const M = await import('/js/data/fz-river.js'); const F = M.FZR, jn = M.RIVERS.jn.line, jh = F.rivers.jn.hw;
  const JN_S = (F.a6 && F.a6.jnS) || 466.2;
  const east = jn.at(JN_S, -(jh + 2.8)), lookW = jn.at(JN_S, +(jh + 8));
  const out = [
    ['mouth_east', east.x, east.z, lookW.x, lookW.z, 0.08, 1.6, 0],
  ];
  if (!F.a6) return out;
  const A6 = F.a6, G = A6.gate, hq = M.RIVERS.hq.line, hw = F.rivers.hq.hw;
  const br = (name) => M.BRIDGES.find(q => q.name === name && q.river === 'hq');
  const b2 = br('北二环'), b1 = br('北浪路');
  const bSide = (b, sg, back, lat, y) => [b.x + b.t[0] * -(b.w / 2 + back) + b.n[0] * sg * lat, b.z + b.t[1] * -(b.w / 2 + back) + b.n[1] * sg * lat];
  const U = (A6.under || [])[0];
  const signCam = [G.view[0] + G.t[0] * 7.0 + G.n[0] * G.side * 6.0, G.view[1] + G.t[1] * 7.0 + G.n[1] * G.side * 6.0];
  const signLook = [G.view[0] + G.t[0] * -3.2, G.view[1] + G.t[1] * -3.2];
  out.push(
    ['chayuan_from_lookout', ...G.view, G.x, G.z, 0.04, 0.05, 0],
    ['chayuan_front', ...(() => { const p = [G.x + G.t[0] * -16 + G.n[0] * (G.houseSide || 1) * 6, G.z + G.t[1] * -16 + G.n[1] * (G.houseSide || 1) * 6]; return p; })(), G.x, G.z, 0.08, 2.0, 1],
    ['sign_chayuan', ...signCam, ...signLook, 0.08, 0.05, 0],
    ['beierhuan_from_bank', ...bSide(b2, -1, 16, -10), b2.x, b2.z, 0.10, 2.4, 1],
    ['beilang_from_bank', ...bSide(b1, 1, 12, 7), b1.x, b1.z, 0.10, 1.8, 1],
    ['beierhuan_under', U.x, U.z, U.x + U.t[0] * 6, U.z + U.t[1] * 6, 0.22, 0.05, 0],
    ['banks_street', ...(() => { const s = Math.max(40, (b2.s + b1.s) / 2), p = hq.at(s, -(hw + 2.2)), q = hq.at(Math.min(hq.len - 8, s + 36), 0); return [p.x, p.z, q.x, q.z]; })(), 0.08, 0.05, 0],
  );
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
      pos = await pg.evaluate('(() => { const S=__game.fzMetro.street, R=S.kit.root.position, p=__game.player.position; return [+(p.x-R.x).toFixed(2), +p.y.toFixed(2), +(p.z-R.z).toFixed(2)]; })()')
      g6 = await pg.evaluate('(() => { const n = __game.fzMetro.street.kit.groupNodes.g6day; return n ? n.isEnabled(false) : null; })()')
      R['spots'][name] = {'view': view, 'yaw0': yaw0, 'yaws': rows, 'pos': pos, 'g6day': g6, 'max': {'draws': max(r['draws'] for r in rows + [view]), 'tris': max(r['tris'] for r in rows + [view])}}
      print('perf', name, 'view', view['draws'], view['tris'], 'yaws', [(r['draws'], r['tris']) for r in rows], 'g6day', g6, 'pos', pos, flush=True)
    R['errors'] = [l for l in errs(logs) if l[0] in ('error', 'pageerror')][:8]
    print('ERRORS', R['errors'])
    await pg.evaluate("if (window.__fzHold) { clearInterval(window.__fzHold); window.__fzHold=null; }")
    await b.close()
  json.dump(R, open(f'{OUT}/perf_{TAG}.json', 'w'), ensure_ascii=False, indent=1, default=str)
  print('SHOTS6A DONE', TAG, flush=True)
asyncio.run(main())
