# 乌石浦 · 厦门 SM 城市广场：4B 出口上街 → 一期 / 二期外观 + 天桥（走上去走过去）→ 进黄宝石中庭坐扶梯上 2F → 出来 → 进一期 → 回车站
# 每个视角 ≤ 9 万三角形、≤ 50 draw；招牌图集不溢出
import asyncio, sys, json, os
sys.path.insert(0, os.path.dirname(__file__))
from common import *
from journey import GCLOCK, auto, log
from perfhud import perf
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8177/'
OUT = os.environ.get('SHOTS')   # 设了就顺便存截图
XS, TRIS, DRAWS = 4000, 90000, 50
R = {'checks': {}, 'perf': {}, 'area': {}}
def ok(k, v): R['checks'][k] = bool(v); log('check', k, bool(v)); return v
async def S(pg): return await pg.evaluate('(() => { const m = __game.xmMetro, s = __game.state(); return { pos: s.pos, zone: s.zone, street: m.street ? m.street.info() : null }; })()')
AREA = "() => __game.scene.meshes.filter(m => m.isEnabled() && m.isVisible && m.getTotalIndices).reduce((t, m) => t + m.getTotalIndices() / 3 * (m.instances ? 1 + m.instances.length : 1), 0)"
async def budget(pg, name, area=False):
  await asyncio.sleep(1.2)
  if OUT: await pg.screenshot(path=f'{OUT}/{name}.png')
  d = await perf(pg, 3, 0.25); R['perf'][name] = d; log('perf', name, d)
  ok(name + ':budget', d['tris'] <= TRIS and d['draws'] <= DRAWS)
  if area: R['area'][name] = a = await pg.evaluate(AREA); log('area', name, a); ok(name + ':area90k', a <= TRIS)
async def look(pg, x, y, z, yaw, pitch, name):
  await pg.evaluate(f"(() => {{ const p = __game.player; p.spawn({x}, {y}, {z}, {yaw}); p.yaw = {yaw}; p.pitch = {pitch}; }})()"); await budget(pg, name)
async def main():
  async with async_playwright() as p:
    b, pg, logs = await open_game(p, URL + ('&' if '?' in URL else '?') + 'q=1&start=gzdz&line=1')
    await pg.evaluate("window.__caps = []; addEventListener('gz-audio-caption', e => { if (e.detail) __caps.push([Math.round(performance.now()), e.detail.id, e.detail.lang]); })")
    await pg.evaluate(GCLOCK); await pg.evaluate('__game.setDtMax(0.25)'); await asyncio.sleep(0.8)
    await pg.evaluate("""(() => { const g=__game; g.east.ensure(); g.east.side='xm'; g.east.cur={st:g.station, loc:'xmmetro', area:'metro'}; g.station.kit.root.setEnabled(false); g.xmMetro.enterFromRailway(g.player); if (g.player.view!=='first') g.toggleView(); })()""")
    # 出口资料：4B 去 SM；乌石浦 7 个出口都在表里
    meta = await pg.evaluate("""async () => { const E = await import('/js/data/xm-exits.js'), A = await import('/js/world/xmAttr.js');
      const t = (E.XM_EXIT_TABLE || {}).wsp || []; return { n: (A.ATTR_EXITS.wsp || {}).n, to: (A.ATTR_EXITS.wsp || {}).to, table: t.map(e => e.n || e.exit || e[0]) }; }""")
    log('meta', meta)
    ok('exit4B', meta['n'] == '4B' and any('SM' in s for s in meta['to'] or []))
    ok('exitTable7', len(meta['table']) == 7)
    # 报站：广州东站开局时的粤语欢迎广播不能带进厦门；乌石浦站台自己的欢迎广播按 普通话 → 闽南语 → 英语
    await pg.evaluate("__caps.push(['XM'])")
    await pg.evaluate("() => { const m = __game.xmMetro; m.buildStation('wsp'); const P = m.station.platforms[0]; __game.player.spawn(3020, P.y + 0.05, P.zc + 2, Math.PI / 2); }")
    for _ in range(40):
      await asyncio.sleep(1)
      if await pg.evaluate("__caps.some(c => c[1] === 'voice.welcome.wsp.en')"): break
    caps = await pg.evaluate('__caps'); after = caps[[i for i, c in enumerate(caps) if c[0] == 'XM'][0] + 1:]
    log('captions', after)
    ok('annNoCantoneseInXm', not any(len(c) > 2 and (c[2] == 'yue' or 'gzdz' in c[1]) for c in after))
    ok('annWelcomeWsp', [c[2] for c in after if len(c) > 2 and c[1].startswith('voice.welcome.wsp.')] == ['zh', 'nan', 'en'])
    await pg.evaluate("() => { __game.player.spawn(3010, -6.45, -15, Math.PI); }"); await asyncio.sleep(1)
    await auto(pg, [[3010, -20], [3010, -30], [3010, -36.5]])
    s = await S(pg); ok('street', s['street'] and s['street']['code'] == 'wsp' and s['zone'] == 'street')
    ok('atlas', s['street'] and s['street']['atlasOverflow'] == 0)
    await auto(pg, [[XS, 6], [XS, 9]])
    await pg.evaluate('__game.player.yaw = 0; __game.player.pitch = 0.05'); await budget(pg, 'exit4B', area=True)
    await look(pg, XS - 8, 0.05, -8, 0.5, -0.12, 'phase1')
    await look(pg, XS - 30, 0.05, 30, -0.9, -0.15, 'phase2')
    # 天桥 1：东侧楼梯上去（y≈6），走过嘉禾路，西侧楼梯下来
    await pg.evaluate(f"__game.player.spawn({XS + 4}, 0.05, 42, 0)"); await asyncio.sleep(0.5)
    await auto(pg, [[XS + 4, 52], [XS + 4, 62.5]])
    s = await S(pg); ok('bridgeUp', abs(s['pos'][1] - 6) < 0.6)
    await auto(pg, [[XS - 20, 63], [XS - 50, 63], [XS - 64, 63]])
    s = await S(pg); ok('bridgeCross', abs(s['pos'][1] - 6) < 0.6 and s['pos'][0] < XS - 60)
    await pg.evaluate('__game.player.yaw = Math.PI / 2; __game.player.pitch = 0'); await budget(pg, 'bridge')
    await auto(pg, [[XS - 64, 58], [XS - 64, 50], [XS - 64, 42]])
    s = await S(pg); ok('bridgeDown', s['pos'][1] < 0.5 and s['pos'][2] < 44)
    # 黄宝石中庭（二期西侧门）
    await auto(pg, [[XS - 72, 42], [XS - 72, 58], [XS - 72, 72], [XS - 72, 86], [XS - 72, 96]]); await auto(pg, [[XS - 79.5, 96]]); await asyncio.sleep(1)
    s = await S(pg); ok('topazIn', s['street'] and s['street']['inside'] == 'sm-topaz' and s['zone'] == 'interior')
    ia = await pg.evaluate('(() => { const i = __game.xmMetro.street.inside; return { ov: i.atlas.overflow, o: i.o }; })()'); ok('topazAtlas', ia['ov'] == 0)
    ox, oz = ia['o']['x'], ia['o']['z']
    await pg.evaluate('__game.player.yaw = 0; __game.player.pitch = -0.2'); await budget(pg, 'atrium', area=True)
    await auto(pg, [[ox, oz + 12], [ox, oz + 18], [ox, oz + 31]])
    s = await S(pg); ok('escalator2F', abs(s['pos'][1] - ia['o']['y'] - 5.5) < 0.6)
    await budget(pg, 'atrium2F')
    await auto(pg, [[ox, oz + 18], [ox, oz + 8], [ox, oz + 1]]); await auto(pg, [[ox, oz - 4.5]]); await asyncio.sleep(0.8)
    s = await S(pg); ok('topazOut', s['street'] and s['street']['inside'] is None and s['zone'] == 'street' and abs(s['pos'][0] - (XS - 75.4)) < 3 and abs(s['pos'][2] - 96) < 3)
    # 一期正门（仙岳路侧）
    await pg.evaluate(f"__game.player.spawn({XS + 51}, 0.05, 16, 0)"); await asyncio.sleep(0.5)
    await auto(pg, [[XS + 51, 23]]); await asyncio.sleep(1)
    s = await S(pg); ok('cityIn', s['street'] and s['street']['inside'] == 'sm-city')
    ia = await pg.evaluate('(() => { const i = __game.xmMetro.street.inside; return { ov: i.atlas.overflow, o: i.o }; })()'); ok('cityAtlas', ia['ov'] == 0)
    await pg.evaluate('__game.player.yaw = 0; __game.player.pitch = -0.1'); await budget(pg, 'cityAtrium')
    ox, oz = ia['o']['x'], ia['o']['z']
    await auto(pg, [[ox, oz + 1], [ox, oz - 4.5]]); await asyncio.sleep(0.8)
    s = await S(pg); ok('cityOut', s['street'] and s['street']['inside'] is None and abs(s['pos'][0] - (XS + 51)) < 3)
    # 回车站
    await pg.evaluate(f"__game.player.spawn({XS}, 0.05, 4, Math.PI)"); await asyncio.sleep(0.5)
    await auto(pg, [[XS, 2], [XS, -1.5], [XS, -4.5]])
    s = await S(pg); ok('back', s['street'] is None and abs(s['pos'][2] + 34.4) < 1.5)
    R['errors'] = errs(logs); good = all(R['checks'].values()) and not R['errors']
    print(json.dumps(R, ensure_ascii=False, indent=1, default=str))
    print('XMSM', 'PASS' if good else 'FAIL', [k for k, v in R['checks'].items() if not v], flush=True)
    await b.close()
    if not good: sys.exit(1)
if __name__ == "__main__": asyncio.run(main())
