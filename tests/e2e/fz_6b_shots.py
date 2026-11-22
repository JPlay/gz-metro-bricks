# 福州内河 6B 取景 + 性能（白天 / 夜里同机位，传送取景；正式验收走 fz_river.py k_hq_west 真走）
# 用法：FZQS='&t=day'|'&t=night' python tests/e2e/fz_6b_shots.py <base-url> <截图目录>
import asyncio, sys, json, os
sys.path.insert(0, os.path.dirname(__file__))
from common import *
from journey import GCLOCK
from perfhud import perf
BASE = sys.argv[1]; OUT = sys.argv[2].rstrip('/'); os.makedirs(OUT, exist_ok=True)
QS = os.environ.get('FZQS', '&t=day'); TAG = 'night' if 't=night' in QS else 'day'
SPOTS = """(async () => { const M = await import('/js/data/fz-river.js'); const F = M.FZR, A = F.a6b, A6 = F.a6;
  if (!A) return [];
  const br = (name) => M.BRIDGES.find(q => q.name === name && q.river === 'hq');
  const sh = M.BRIDGES.find(q => q.style === 'short' && q.a6b);
  const ff = br('福飞路'), jc = br('江厝路'), hj = br('湖景路'), dj = br('大井路'), n2 = br('北二环'), bl = br('北浪路');
  const C = A.cams;
  const side = (b, tu, nv, y) => [b.x + b.t[0] * tu + b.n[0] * nv, b.z + b.t[1] * tu + b.n[1] * nv];
  const out = [
    ['seam', C.seam.x, C.seam.z, C.seam.look[0], C.seam.look[2], C.seam.pitch || 0.10, C.seam.y || 2.4, 1],
    ['fufei', C.fufei.x, C.fufei.z, C.fufei.look[0], C.fufei.look[2], C.fufei.pitch || 0.12, C.fufei.y || 3.2, 1],
    ['fufei_side', ...(() => { const p = side(ff, -(ff.w / 2 + 12), 1.5); const q = side(ff, -(ff.w / 2 - 0.5), 0); return [...p, ...q]; })(), 0.02, 0.85, 1],
    ['rail', C.rail.x, C.rail.z, C.rail.look[0], C.rail.look[2], C.rail.pitch || 0.06, C.rail.y || 9.2, 1],
    // 大井/湖景/江厝/福飞：同一高度、同一后退距、河面上朝桥（沿河低机位），并排后福飞作宽度参照
    ...(() => { const up = (b) => { const p = side(b, 0, -(b.half + 22)); return [...p, b.x, b.z]; }; return [
      ['dajing_up', ...up(dj), 0.10, 2.4, 1],
      ['hujing_up', ...up(hj), 0.10, 2.4, 1],
      ['jiangcuo_up', ...up(jc), 0.10, 2.4, 1],
      ['fufei_up', ...up(ff), 0.10, 2.4, 1],
    ]; })(),
    // 岸边特写：贴近近岸水面、沿河退后，避开人行道树干
    ['hujing_from_bank', ...(() => { const p = side(hj, -(hj.hw - 0.6), -(hj.half + 12)); return [...p, hj.x, hj.z]; })(), 0.10, 1.8, 1],
    ['dajing_from_bank', ...(() => { const p = side(dj, -(dj.hw - 0.6), -(dj.half + 12)); return [...p, dj.x, dj.z]; })(), 0.10, 1.8, 1],
    ['jiangcuo_from_bank', ...(() => { const p = side(jc, -(jc.hw - 0.6), -(jc.half + 12)); return [...p, jc.x, jc.z]; })(), 0.10, 1.8, 1],
    ['short_from_bank', ...(() => { const p = side(sh, -(sh.hw - 0.6), -(sh.half + 12)); return [...p, sh.x, sh.z]; })(), 0.10, 1.8, 1],
    ['beierhuan_ref', ...(() => { const p = [n2.x + n2.t[0] * -(n2.w / 2 + 20) + n2.n[0] * -9, n2.z + n2.t[1] * -(n2.w / 2 + 20) + n2.n[1] * -9]; return [...p, n2.x, n2.z]; })(), 0.08, 1.8, 1],
    ['banks_street', ...(() => { const hq = M.RIVERS.hq.line, s = (jc.s + hj.s) / 2, p = hq.at(s, 0), q = hq.at(s + 30, 0); return [p.x, p.z, q.x, q.z]; })(), 0.22, 2.2, 1],
  ];
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
  print('SHOTS6B DONE', TAG, flush=True)
asyncio.run(main())
