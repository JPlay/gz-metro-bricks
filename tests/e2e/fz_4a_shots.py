# 福州内河 4A 取景 + 性能（白天 / 夜里同机位，传送取景；正式验收走 fz_river.py i_gm_west 真走）
# 用法：FZQS='&t=day'|'&t=night' python tests/e2e/fz_4a_shots.py <base-url> <截图目录>
import asyncio, sys, json, os
sys.path.insert(0, os.path.dirname(__file__))
from common import *
from journey import GCLOCK
from perfhud import perf
BASE = sys.argv[1]; OUT = sys.argv[2].rstrip('/'); os.makedirs(OUT, exist_ok=True)
QS = os.environ.get('FZQS', '&t=day'); TAG = 'night' if 't=night' in QS else 'day'
SPOTS = """(async () => { const M = await import('/js/data/fz-river.js'); const F = M.FZR, A4 = F.a4, G = A4.gate, gw = M.RIVERS.gw.line, gm = M.RIVERS.gm.line, hw = F.rivers.gw.hw;
  const at = (s, l) => { const a = gw.at(s, l); return [a.x, a.z]; };
  const b = M.BRIDGES.find(q => q.id === 'gw1'), Y = A4.yz, sg = A4.sign, yz = A4.signs.find(s => s.id === 'yzh');
  const tip = [Y.c[0] + Y.d[0] * (Y.len * 0.7), Y.c[1] + Y.d[1] * (Y.len * 0.7)];
  const Pt = (a, b) => [G.x + G.t[0] * a + G.n[0] * b, G.z + G.t[1] * a + G.n[1] * b];
  const front = Pt(-25, 0), frontS = Pt(-25, -5), frontN = Pt(-25, 8);   // 六一中路桥面、离闸 25 m 正对，三孔可数
  // 闸西 xg 水面在 a4.xg 网格、不在 isWater/isLand：人会掉穿。03 主镜头在水面上方悬停；岸上备用站在闸西约 8 m 的南/北岸（a=8 才有地）。
  // 03 主镜头：贴着闸西面在水面上方悬停（再往西就贴上远岸墙），略低头看水面+两岸+远楼。岸上备用 a=8 南/北岸。
  const westCam = Pt(9, 0), westCamS = Pt(8, -22), westCamN = Pt(8, 22), westLook = Pt(30, 0), westLookS = Pt(28, 10), westLookN = Pt(28, -10);
  // 04 主镜头：光明港水面上、河口北 8 m 悬停，往南看两岸内转合拢；yz_mouth_along 留西岸陆地备用。
  const yzCam = [Y.c[0] - Y.d[0] * 8, Y.c[1] - Y.d[1] * 8];
  const yzAlong = [Y.c[0] + Y.d[0] * 2 - Y.d[1] * (-14), Y.c[1] + Y.d[1] * 2 + Y.d[0] * (-14)];
  const G9 = F.a3.gate;
  return [
    ['gate_from_lookout', ...front, G.x, G.z, 0.05, 0.35],
    ['gate_front_south_bank', ...frontS, G.x, G.z, 0.05, 0.35],
    ['gate_front_north_bank', ...frontN, G.x, G.z, 0.05, 0.35],
    ['sign_xingang', sg.x - sg.n[0] * 5.5, sg.z - sg.n[1] * 5.5, sg.x, sg.z, 0.12, 0.05],
    ['liuyi_bridge_from_south', b.x - b.n[0] * (b.half + 4), b.z - b.n[1] * (b.half + 4), b.x, b.z, 0.04, 0.05],
    ['liuyi_deck_looking_west', ...westCamS, ...westLookS, 0.08, 0.05, 0],
    ['xingang_west_far_water', ...westCam, ...westLook, 0.22, 1.8, 1],
    ['xingang_west_from_north', ...westCamN, ...westLookN, 0.08, 0.05, 0],
    ['yz_mouth', ...yzCam, ...tip, 0.12, 1.4, 1],
    ['yz_mouth_along', ...yzAlong, ...tip, 0.08, 0.05, 0],
    ['yz_sign', yz.x - yz.f[0] * 5, yz.z - yz.f[1] * 5, yz.x, yz.z, 0.1, 0.05],
    ['join_from_east', ...(() => { const a = gm.at(30, hw + 3); return [a.x, a.z]; })(), ...at(8, 0), 0.02, 0.05],
    ['jiumen_from_lookout', ...G9.view, G9.x, G9.z, 0.02, 0.05],
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
    R['street'] = {k: si.get(k) for k in ('kiosk', 'net', 'route', 'atlasOverflow', 'night')} if si else None
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
      g4 = await pg.evaluate('(() => { const n = __game.fzMetro.street.kit.groupNodes.g4day; return n ? n.isEnabled(false) : null; })()')
      R['spots'][name] = {'view': view, 'yaw0': yaw0, 'yaws': rows, 'pos': pos, 'g4day': g4, 'max': {'draws': max(r['draws'] for r in rows + [view]), 'tris': max(r['tris'] for r in rows + [view])}}
      print('perf', name, 'view', view['draws'], view['tris'], 'yaws', [(r['draws'], r['tris']) for r in rows], 'g4day', g4, 'pos', pos, flush=True)
    R['errors'] = [l for l in errs(logs) if l[0] in ('error', 'pageerror')][:8]
    print('ERRORS', R['errors'])
    await pg.evaluate("if (window.__fzHold) { clearInterval(window.__fzHold); window.__fzHold=null; }")
    await b.close()
  json.dump(R, open(f'{OUT}/perf_{TAG}.json', 'w'), ensure_ascii=False, indent=1, default=str)
  print('SHOTS4A DONE', TAG, flush=True)
asyncio.run(main())
