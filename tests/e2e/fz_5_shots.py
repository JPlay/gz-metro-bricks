# 福州内河 5 取景 + 性能（白天 / 夜里同机位，传送取景；正式验收走 fz_river.py j_yz_south 真走）
# 用法：FZQS='&t=day'|'&t=night' python tests/e2e/fz_5_shots.py <base-url> <截图目录>
import asyncio, sys, json, os
sys.path.insert(0, os.path.dirname(__file__))
from common import *
from journey import GCLOCK
from perfhud import perf
BASE = sys.argv[1]; OUT = sys.argv[2].rstrip('/'); os.makedirs(OUT, exist_ok=True)
QS = os.environ.get('FZQS', '&t=day'); TAG = 'night' if 't=night' in QS else 'day'
SPOTS = """(async () => { const M = await import('/js/data/fz-river.js'); const F = M.FZR, A5 = F.a5, A4 = F.a4, G = A5.gate, Y = A4.yz, yz = M.RIVERS.yz.line, hw = F.rivers.yz.hw;
  const Pt = (a, b) => [G.x + G.t[0] * a + G.n[0] * b, G.z + G.t[1] * a + G.n[1] * b];
  const Hs = G.houseSide || 1;
  // 正面：上游 20 m，略偏向泵房并抬高，看清两孔钢闸 + 侧泵房 + 后面闽江（不要贴进堰墙里）
  const front = Pt(-20, Hs * 6), frontLook = Pt(4, Hs * 1);
  // 闽江：跨过堰顶、在江面上空悬停，往对岸看宽水面 + 天际线（不要从堰墙里拍）
  const mjCam = Pt(14, Hs * 4), mjLook = Pt(120, 0);
  // 04 同机位：光明港水面上、河口北 8 m 悬停，往南看
  const yzCam = [Y.c[0] - Y.d[0] * 8, Y.c[1] - Y.d[1] * 8];
  const tip = [Y.c[0] + Y.d[0] * (Y.len * 0.7), Y.c[1] + Y.d[1] * (Y.len * 0.7)];
  const Gx = A4.gate, G9 = F.a3.gate;
  const xgFront = [Gx.x - Gx.t[0] * 25, Gx.z - Gx.t[1] * 25];
  const jmFront = G9.view;
  const br = (name) => M.BRIDGES.find(q => q.name === name && q.river === 'yz');
  const b1 = br('老药洲街'), b2 = br('瀛洲桥'), b3 = br('台江路');
  const bCam = (b, sg) => [b.x + b.n[0] * sg * (b.half + 6) + b.t[0] * -(b.w / 2 + 10), b.z + b.n[1] * sg * (b.half + 6) + b.t[1] * -(b.w / 2 + 10)];
  const bLook = (b) => [b.x, b.z];
  return [
    ['jiangsi_front', ...front, ...frontLook, 0.08, 2.2, 1],
    ['jiangsi_from_lookout', ...G.view, G.x, G.z, 0.04, 0.05, 0],
    ['minjiang_from_lookout', ...mjCam, ...mjLook, 0.10, 4.2, 1],
    ['sign_jiangsi', A5.sign.x - A5.sign.n[0] * 5.5, A5.sign.z - A5.sign.n[1] * 5.5, A5.sign.x, A5.sign.z, 0.12, 0.05, 0],
    ['yz_mouth', ...yzCam, ...tip, 0.12, 1.4, 1],
    ['bridge_laoyaozhou', ...bCam(b1, -1), ...bLook(b1), 0.08, 0.05, 0],
    ['bridge_yingzhou', ...bCam(b2, 1), ...bLook(b2), 0.08, 0.05, 0],
    ['bridge_taijiang', ...bCam(b3, -1), ...bLook(b3), 0.08, 0.05, 0],
    ['xingang_front', ...xgFront, Gx.x, Gx.z, 0.05, 1.6, 1],
    ['jiumen_front', ...jmFront, G9.x, G9.z, 0.05, 0.05, 0],
  ]; })()"""
async def main():
  R = {'tag': TAG, 'spots': {}, 'shots': []}
  async with async_playwright() as p:
    b, pg, logs = await open_game(p, BASE + '?q=1' + QS)
    await pg.evaluate(GCLOCK); await pg.evaluate(f"__game.setDtMax({float(os.environ.get('FZDT', '0.25'))})"); await asyncio.sleep(1)
    await pg.evaluate("""(() => { const g=__game; g.east.ensure(); g.east.side='fz'; g.east.cur={st:g.station, loc:'fzmetro', area:'metro'}; g.station.kit.root.setEnabled(false); g.fzMetro.enterFromRailway(g.player); })()""")
    await asyncio.sleep(1.5)
    code = 'fzgmg'
    await pg.evaluate(f"""(async () => {{ const E = await import('/js/data/fz-exits.js'); const X = E.FZ_EXITS['{code}']; const ex = X.attr === 'fzriver' ? X : (X.more || []).find(e => e.attr === 'fzriver'); const m=__game.fzMetro; m.buildStation('{code}'); m.goStreet(ex); }})()""")
    await asyncio.sleep(5)
    si = await pg.evaluate('__game.fzMetro.street ? __game.fzMetro.street.info() : null')
    R['street'] = si
    print('street', json.dumps(R['street']), flush=True)
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
      g5 = await pg.evaluate('(() => { const n = __game.fzMetro.street.kit.groupNodes.g5day; return n ? n.isEnabled(false) : null; })()')
      R['spots'][name] = {'view': view, 'yaw0': yaw0, 'yaws': rows, 'pos': pos, 'g5day': g5, 'max': {'draws': max(r['draws'] for r in rows + [view]), 'tris': max(r['tris'] for r in rows + [view])}}
      print('perf', name, 'view', view['draws'], view['tris'], 'yaws', [(r['draws'], r['tris']) for r in rows], 'g5day', g5, 'pos', pos, flush=True)
    R['errors'] = [l for l in errs(logs) if l[0] in ('error', 'pageerror')][:8]
    print('ERRORS', R['errors'])
    await pg.evaluate("if (window.__fzHold) { clearInterval(window.__fzHold); window.__fzHold=null; }")
    await b.close()
  json.dump(R, open(f'{OUT}/perf_{TAG}.json', 'w'), ensure_ascii=False, indent=1, default=str)
  print('SHOTS5 DONE', TAG, flush=True)
asyncio.run(main())
