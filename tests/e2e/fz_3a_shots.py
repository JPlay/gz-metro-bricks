# 福州内河 3A 取景 + 性能（白天 / 夜里同机位，传送取景；正式验收走 fz_river.py g_gm_east 真走）
# 用法：FZQS='&t=day'|'&t=night' python tests/e2e/fz_3a_shots.py <base-url> <截图目录> [call]   （call：最后站到魁岐停靠点浮码头上把 D 船叫过来，拍 D 船靠站）
# 每个机位：截图（看目标方向）+ 该方向 draws / 三角形 + 四个正交朝向的 draws / 三角形（夜里 ≤ 白天按同一机位同一朝向比）
import asyncio, sys, json, os, math, time
sys.path.insert(0, os.path.dirname(__file__))
from common import *
from journey import GCLOCK, auto, wait, log
from perfhud import perf
BASE = sys.argv[1]; OUT = sys.argv[2].rstrip('/'); os.makedirs(OUT, exist_ok=True); CALL = len(sys.argv) > 3 and 'call' in sys.argv[3]
QS = os.environ.get('FZQS', '&t=day'); TAG = 'night' if 't=night' in QS else 'day'
SPOTS = """(async () => { const M = await import('/js/data/fz-river.js'); const F = M.FZR, A3 = F.a3, G = A3.gate, gm = M.RIVERS.gm.line, hw = F.rivers.gm.hw, P = id => M.PIERS.find(p => p.id === id);
  const at = (s, l) => { const a = gm.at(s, l); return [a.x, a.z]; }, pf = (p, a, b) => [p.x + p.t[0] * a - p.n[0] * b, p.z + p.t[1] * a - p.n[1] * b];
  const gmg = P('gmg'), gD = P('gmgD'), kq = P('kq'), b4 = M.BRIDGES.find(b => b.id === 'gm4'), L = gm.len, mo = [A3.mj.o[0] + A3.mj.t[0] * 150, A3.mj.o[1] + A3.mj.t[1] * 150], WY = M.WY;
  return [
    ['sign_gmg_B_D_rows', ...pf(gmg, -9.6, -2.8), ...gmg.sign, 0.1, 0.05],
    ['gmg_B_and_D_berths', ...at(gD.s - 26, hw + 3.0), ...at((gmg.s + gD.s) / 2 + 2, hw - 3), -0.12, 0.05],
    ['d_boat_white_at_gmgD', ...at(gD.s + 10, hw + 0.6), ...at(gD.s + 1, hw - 3.2), 0.32, 0.05],   // pitch 正 = 低头（原 −0.32 是抬头看树）
    ['d_boat_white_from_opposite_bank', ...at(gD.s + 6, -(hw + 3)), ...gD.berth, -0.06, 0.05],
    ['d_deck_from_B_pontoon', ...pf(gmg, 7.0, 1.2), ...gD.berth, -0.1, WY + 0.5],
    ['d_boat_bow_plate_closeup', ...at(gD.s - 7.2, hw - 1.0), ...at(gD.s - 4.0, hw - 3.0), 0.3, WY + 0.5],   // 小美：D 船近景（白篷 + 蓝绿垂边 + 船头「D」牌）
    ['seg_from_fuguang_bridge', b4.x, b4.z, ...at(b4.s + 80, 0), 0.0, 0.1],
    ['seg_fuguang_bridge_from_bank', ...at(b4.s - 45, hw + 4), b4.x, b4.z, 0.04, 0.05],
    ['seg_mid_promenade', ...at(A3.gmALen + 260, hw + 4), ...at(A3.gmALen + 340, 0), 0.02, 0.05],
    ['seg_bend_east_bank', ...at(900, -(hw + 4)), ...at(970, 0), 0.02, 0.05],
    ['sign_kq', ...pf(kq, -9.6, -2.8), ...kq.sign, 0.1, 0.05],
    ['kq_stop_from_bank', ...at(kq.s - 22, hw + 3), ...kq.berth, -0.08, 0.05],
    ['gate_front_west_bank', ...at(G.s - 45, hw + 1.2), G.x, G.z, 0.03, 0.05],   // 小美 11-17：往河边挪开，别被榕树干挡
    ['gate_front_east_bank', ...at(G.s - 48, -(hw + 2.0)), G.x, G.z, 0.03, 0.05],
    ['gate_from_lookout', ...G.view, G.x, G.z, 0.02, 0.05],
    ['minjiang_from_lookout', ...(G.mjView || G.view), ...mo, 0.0, 0.05],   // 观景处挪到闸上游后，看闽江仍在闸旁原位置
  ]; })()"""
async def main():
  R = {'tag': TAG, 'spots': {}, 'shots': []}
  async with async_playwright() as p:
    b, pg, logs = await open_game(p, BASE + '?q=1' + QS)
    await pg.evaluate(GCLOCK); await pg.evaluate('__game.setDtMax(0.25)'); await asyncio.sleep(1)
    await pg.evaluate("""(() => { const g=__game; g.east.ensure(); g.east.side='fz'; g.east.cur={st:g.station, loc:'fzmetro', area:'metro'}; g.station.kit.root.setEnabled(false); g.fzMetro.enterFromRailway(g.player); })()""")
    await asyncio.sleep(1.5)
    code = 'fzgmg'
    await pg.evaluate(f"""(async () => {{ const E = await import('/js/data/fz-exits.js'); const X = E.FZ_EXITS['{code}']; const ex = X.attr === 'fzriver' ? X : (X.more || []).find(e => e.attr === 'fzriver'); const m=__game.fzMetro; m.buildStation('{code}'); m.goStreet(ex); }})()""")
    await asyncio.sleep(5)
    si = await pg.evaluate('__game.fzMetro.street ? __game.fzMetro.street.info() : null')
    R['street'] = {k: si.get(k) for k in ('kiosk', 'net', 'route', 'atlasOverflow', 'night')} if si else None; R['boats'] = {k: v['at'] for k, v in (si.get('boats') or {}).items()} if si else None
    print('street', json.dumps(R['street']), json.dumps(R['boats']), flush=True)
    if await pg.evaluate('__game.player.view') != 'first': await pg.evaluate('__game.toggleView()')   # 第一人称取景：人物不挡牌子 / 闸
    spots = await pg.evaluate(SPOTS)
    ONLY = set(filter(None, os.environ.get('FZSPOTS', '').split(',')))   # 调机位用：只拍这几个
    for name, x, z, tx, tz, pitch, y in spots:
      if ONLY and name not in ONLY: continue
      await pg.evaluate(f"(() => {{ const S=__game.fzMetro.street, R=S.kit.root.position; __game.player.spawn(R.x+({x}), {y}, R.z+({z}), Math.atan2(({tx})-({x}), ({tz})-({z}))); __game.player.pitch={pitch}; }})()")
      await asyncio.sleep(3.0); fn = f'{OUT}/{name}_{TAG}.jpg'
      if await safe_shot(pg, path=fn, type='jpeg', quality=72): R['shots'].append(fn)
      view = await perf(pg, 3, 0.3); yaw0 = await pg.evaluate('__game.player.yaw'); rows = []
      for k in range(4):
        await pg.evaluate(f"__game.player.yaw = {k} * Math.PI / 2; __game.player.pitch = 0.08"); rows.append(await perf(pg, 3, 0.3))
      pos = await pg.evaluate('(() => { const S=__game.fzMetro.street, R=S.kit.root.position, p=__game.player.position; return [+(p.x-R.x).toFixed(2), +p.y.toFixed(2), +(p.z-R.z).toFixed(2)]; })()')
      g3 = await pg.evaluate('(() => { const n = __game.fzMetro.street.kit.groupNodes.g3day; return n ? n.isEnabled(false) : null; })()')
      R['spots'][name] = {'view': view, 'yaw0': yaw0, 'yaws': rows, 'pos': pos, 'g3day': g3, 'max': {'draws': max(r['draws'] for r in rows + [view]), 'tris': max(r['tris'] for r in rows + [view])}}
      print('perf', name, 'view', view['draws'], view['tris'], 'yaws', [(r['draws'], r['tris']) for r in rows], 'g3day', g3, 'pos', pos, flush=True)
    if CALL:   # 站到魁岐停靠点浮码头上：D 船被叫过来（双头船，靠稳后掉头），拍 D 船靠站
      kq = await pg.evaluate("(async () => { const M = await import('/js/data/fz-river.js'); const p = M.PIERS.find(p => p.id === 'kq'); return { x: p.x, z: p.z, t: p.t, n: p.n, berth: p.berth, wy: M.WY }; })()")
      pf = lambda a, b_: [kq['x'] + kq['t'][0] * a - kq['n'][0] * b_, kq['z'] + kq['t'][1] * a - kq['n'][1] * b_]
      x, z = pf(1.2, 1.5)
      await pg.evaluate(f"(() => {{ const S=__game.fzMetro.street, R=S.kit.root.position; __game.player.spawn(R.x+({x}), {kq['wy'] + 0.5}, R.z+({z}), 0); }})()")
      t0 = time.monotonic(); okb = False
      while time.monotonic() - t0 < 1500:
        bi = await pg.evaluate('__game.fzMetro.street.boats.D.info()')
        if bi['phase'] == 'dock' and bi['at'] == 'kq': okb = True; break
        await asyncio.sleep(2)
      R['call'] = {'arrived': okb, 'secs': round(time.monotonic() - t0), 'boat': bi}; print('call D → kq', okb, round(time.monotonic() - t0), flush=True)
      lx, lz = pf(-14, -3.0); bx, bz = kq['berth']
      await pg.evaluate(f"(() => {{ const S=__game.fzMetro.street, R=S.kit.root.position; __game.player.spawn(R.x+({lx}), 0.05, R.z+({lz}), Math.atan2(({bx})-({lx}), ({bz})-({lz}))); __game.player.pitch=-0.08; }})()")
      await asyncio.sleep(3.0); fn = f'{OUT}/d_boat_white_at_kq_{TAG}.jpg'
      if await safe_shot(pg, path=fn, type='jpeg', quality=72): R['shots'].append(fn)
      R['spots']['d_boat_at_kq'] = {'view': await perf(pg, 3, 0.3)}
    R['errors'] = [l for l in errs(logs) if l[0] in ('error', 'pageerror')][:8]
    print('ERRORS', R['errors'])
    await b.close()
  json.dump(R, open(f'{OUT}/perf_{TAG}.json', 'w'), ensure_ascii=False, indent=1, default=str)
  print('SHOTS3A DONE', TAG, flush=True)
asyncio.run(main())
