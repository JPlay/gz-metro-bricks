# 福州内河 3B 取景 + 性能（白天 / 夜里同机位，传送取景；正式验收走 fz_river.py g_ja_north 真走）
# 用法：FZQS='&t=day'|'&t=night' python tests/e2e/fz_3b_shots.py <base-url> <截图目录>
# 每个机位：截图（看目标方向）+ 该方向 draws / 三角形 + 四个正交朝向的 draws / 三角形（夜里 ≤ 白天按同一机位同一朝向比）
# 机位 pitch：正 = 低头（3A 教训：别把 −0.3 当成低头）；y = 眼睛脚下高度（岸上 0.05，桥面 0.1）
import asyncio, sys, json, os, math, time
sys.path.insert(0, os.path.dirname(__file__))
from common import *
from journey import GCLOCK, auto, wait, log
from perfhud import perf
BASE = sys.argv[1]; OUT = sys.argv[2].rstrip('/'); os.makedirs(OUT, exist_ok=True)
QS = os.environ.get('FZQS', '&t=day'); TAG = 'night' if 't=night' in QS else 'day'
SPOTS = """(async () => { const M = await import('/js/data/fz-river.js'); const F = M.FZR, B3 = F.b3, RV = M.RIVERS, B = id => M.BRIDGES.find(b => b.id === id);
  const at = (r, s, l) => { const a = RV[r].line.at(s, l); return [a.x, a.z]; }, hj = RV.jn.hw, hf = RV.fb.hw, hg = RV.gm.hw, J = RV.jn.line.len, Fb = RV.fb.line.len;
  const j1 = B('jn1'), j2 = B('jn2'), j3 = B('jn3'), ja1 = B('ja1'), f1 = B('fb1'), f4 = B('fb4'), f5 = B('fb5'), gm3 = M.BRIDGES.find(b => b.name === '前横南路');
  const S = id => B3.signs.find(s => s.id === id), qs = S('qth'), fs = S('fbh'), Lc = B3.lake.c, ms = B3.lake.mouthS;
  // 湖：从湖口往湖心方向看；湖北岸（离湖口最远的一段湖岸步道）往回看
  const ring = []; for (let i = 0; i < B3.lake.ring.length; i += 2) ring.push([B3.lake.ring[i], B3.lake.ring[i + 1]]);
  const mouth = at('jn', ms, 0), far = ring.reduce((a, q) => Math.hypot(q[0] - mouth[0], q[1] - mouth[1]) > Math.hypot(a[0] - mouth[0], a[1] - mouth[1]) ? q : a, ring[0]);
  const out = (q, d) => { const dx = q[0] - Lc[0], dz = q[1] - Lc[1], l = Math.hypot(dx, dz); return [q[0] + dx / l * d, q[1] + dz / l * d]; };
  const north = ring.reduce((a, q) => q[1] > a[1] ? q : a, ring[0]), west = ring.reduce((a, q) => q[0] < a[0] ? q : a, ring[0]);
  // 岸上机位贴着栏杆（hw+1.4）；前 22 m 视线 1.8 m 内有树干就沿河挪（3A 教训：别让树干挡镜头）
  const TR = F.trees.filter(t => t[5] !== 'gone'), seg = (p, a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz, u = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / L2)); return Math.hypot(p[0] - a[0] - u * dx, p[1] - a[1] - u * dz); };
  const clear = (c, t) => { const d = Math.hypot(t[0] - c[0], t[1] - c[1]), ux = (t[0] - c[0]) / d, uz = (t[1] - c[1]) / d, e = [c[0] + ux * Math.min(30, d), c[1] + uz * Math.min(30, d)];
    return !TR.some(q => { const qx = q[0] - c[0], qz = q[1] - c[1], r = Math.hypot(qx, qz), f = (qx * ux + qz * uz) / (r || 1);
      return (r < 16 && f > Math.cos(0.8)) || seg(q, c, e) < 1.8; }); }   // 16 m 内画面（±46°）里不能有树干；30 m 内视线 1.8 m 内也不能有
  const nearB = (r, s) => M.BRIDGES.some(b => b.river === r && Math.abs(b.s - s) < b.w / 2 + 6);   // 别站到桥头 / 桥墙后面
  const bank = (r, s0, lat, tgt) => { for (const k of [0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 6, -6, 7, -7, 8, -8]) { if (nearB(r, s0 + k * 4)) continue; const c = at(r, s0 + k * 4, lat), t = typeof tgt === 'function' ? tgt(s0 + k * 4) : tgt; if (clear(c, t)) return [...c, ...t]; } const c = at(r, s0, lat); return [...c, ...(typeof tgt === 'function' ? tgt(s0) : tgt)]; };
  const LP = B3.lamps.map(l => [[l[0] - l[2] * 1.5 - l[3] * 6, l[1] - l[3] * 1.5 + l[2] * 6], [l[0] + l[2] * 22, l[1] + l[3] * 22]]), lamp = LP.slice(Math.floor(LP.length / 2)).concat(LP).find(([c, t]) => clear(c, t)) || LP[0];
  const Ting = B3.ting, tingCam = (() => { for (const d of [26, 22, 30, 34, 20]) for (const q of ring) { if (Math.abs(Math.hypot(q[0] - Ting.x, q[1] - Ting.z) - d) > 2) continue; const c = out(q, 3.0); if (M.isLand(c[0], c[1]) && !M.isWater(c[0], c[1]) && clear(c, [Ting.x, Ting.z])) return c; } return out(far, 3.0); })();
  const deckEdge = (b, dir) => { const e = RV[b.river].line.at(b.s + dir * (b.w / 2 - 1.2), 0); return [e.x, e.z, ...at(b.river, b.s + dir * 90, 0)]; };
  return [
    ['jn_from_wenquan_bridge', ...at('ja', ja1.s - (ja1.w / 2 - 1.2), 0), ...at('jn', J - 70, 0), 0.12, 0.1],   // 温泉公园路桥北沿往北看晋安河北段
    ['jn_hualin_bridge_from_bank', ...bank('jn', j3.s - 45, hj + 1.4, [j3.x, j3.z]), 0.04, 0.05],
    ['jn_from_beierhuan_bridge', ...deckEdge(j2, -1), 0.12, 0.1],
    ['jn_beierhuan_bridge_from_bank', ...bank('jn', j2.s + 45, -(hj + 1.4), [j2.x, j2.z]), 0.04, 0.05],
    ['jn_nongxin_bridge_from_bank', ...bank('jn', j1.s + 40, hj + 1.4, [j1.x, j1.z]), 0.04, 0.05],
    ['jn_mid_promenade', ...bank('jn', 340, -(hj + 1.4), s => at('jn', s - 80, 0)), 0.03, 0.05],
    ['qth_sign', qs.x - qs.f[0] * 6, qs.z - qs.f[1] * 6, qs.x, qs.z, 0.06, 0.05],
    ['qth_lake_from_mouth', ...bank('jn', ms + 6, hj + 1.4, Lc), 0.02, 0.05],
    ['qth_lake_from_far_shore', ...out(far, 1.6), ...Lc, 0.02, 0.05],
    ['qth_lake_promenade_north', ...out(north, 1.6), ...out(west, 1.6), 0.03, 0.05],
    ['qth_lake_lamp_bench', ...lamp[0], ...lamp[1], 0.16, 0.05],
    ['qth_ting_along_shore', ...tingCam, Ting.x, Ting.z, 0.06, 0.05],   // 小美 11-17：琴亭 + 草坡（沿湖岸 20–34 m 外看亭子）
    ['qth_ting_from_lake_mouth', ...bank('jn', ms + 6, hj + 1.4, [Ting.x, Ting.z]), 0.02, 0.05],   // 湖口隔湖看远岸草坡 + 琴亭   // 灯 + 长椅 + 湖面同框（低头看到水）   // 灯 + 长椅 + 湖面同框
    ['fb_mouth_from_gm_south_bank', ...bank('gm', B3.fbMouth.gmS, hg + 1.4, at('fb', Fb - 60, 0)), 0.03, 0.05],
    ['fb_mouth_from_gm_north_promenade', ...bank('gm', B3.fbMouth.gmS + 34, -(hg + 1.4), at('fb', Fb - 12, 0)), 0.06, 0.05],   // 光明港北岸步道（凤坂河口东边）看河口
    ['fb_sign', fs.x + fs.f[0] * 6, fs.z + fs.f[1] * 6, fs.x, fs.z, 0.06, 0.05],
    ['fb_lianfeng_bridge_from_bank', ...bank('fb', f4.s - 36, hf + 1.4, [f4.x, f4.z]), 0.04, 0.05],   // 远洋路桥上游 40 m 正好是连凤路桥头，改拍连凤路桥
    ['fb_from_yuanyang_bridge', ...deckEdge(f5, -1), 0.12, 0.1],
    ['fb_mid_promenade', ...bank('fb', 280, -(hf + 1.4), s => at('fb', s - 80, 0)), 0.03, 0.05],
    ['fb_fuma_bridge_from_bank', ...bank('fb', f1.s + 40, -(hf + 1.4), [f1.x, f1.z]), 0.04, 0.05],
    ['fb_north_end_cap', ...bank('fb', 34, hf + 1.4, at('fb', 0, 0)), 0.1, 0.05],
  ]; })()"""
async def main():
  R = {'tag': TAG, 'spots': {}, 'shots': []}
  async with async_playwright() as p:
    b, pg, logs = await open_game(p, BASE + '?q=1' + QS)
    await pg.evaluate(GCLOCK); await pg.evaluate('__game.setDtMax(0.25)'); await asyncio.sleep(1)
    await pg.evaluate("""(() => { const g=__game; g.east.ensure(); g.east.side='fz'; g.east.cur={st:g.station, loc:'fzmetro', area:'metro'}; g.station.kit.root.setEnabled(false); g.fzMetro.enterFromRailway(g.player); })()""")
    await asyncio.sleep(1.5)
    code = os.environ.get('FZKIOSK', 'fzdm')
    await pg.evaluate(f"""(async () => {{ const E = await import('/js/data/fz-exits.js'); const X = E.FZ_EXITS['{code}']; const ex = X.attr === 'fzriver' ? X : (X.more || []).find(e => e.attr === 'fzriver'); const m=__game.fzMetro; m.buildStation('{code}'); m.goStreet(ex); }})()""")
    await asyncio.sleep(5)
    si = await pg.evaluate('__game.fzMetro.street ? __game.fzMetro.street.info() : null')
    R['street'] = {k: si.get(k) for k in ('kiosk', 'net', 'route', 'atlasOverflow', 'night')} if si else None
    print('street', json.dumps(R['street']), flush=True)
    if await pg.evaluate('__game.player.view') != 'first': await pg.evaluate('__game.toggleView()')   # 第一人称取景：人物不挡牌子
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
      R['spots'][name] = {'view': view, 'yaw0': yaw0, 'yaws': rows, 'pos': pos, 'want': [round(x, 2), round(z, 2)], 'max': {'draws': max(r['draws'] for r in rows + [view]), 'tris': max(r['tris'] for r in rows + [view])}}
      print('perf', name, 'view', view['draws'], view['tris'], 'yaws', [(r['draws'], r['tris']) for r in rows], 'pos', pos, flush=True)
    R['errors'] = [l for l in errs(logs) if l[0] in ('error', 'pageerror')][:8]
    print('ERRORS', R['errors'])
    await b.close()
  json.dump(R, open(f'{OUT}/perf_{TAG}.json', 'w'), ensure_ascii=False, indent=1, default=str)
  print('SHOTS3B DONE', TAG, flush=True)
asyncio.run(main())
