# 厦门地铁景点：站内出口播报与出口号一致；已建街区 → 出口通道上街 → 走出出口亭看景点（性能预算）→ 回车站
import asyncio, sys, json, os
sys.path.insert(0, os.path.dirname(__file__))
from common import *
from journey import GCLOCK, auto, log
from perfhud import perf
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8177/'
AREA = {'draws': 50, 'tris': 186754}
VIEW_TRIS = 90000   # 景点街区：任何视角 ≤ 9 万三角形（用“整片街区所有可见网格之和”兜底，比单一视角更严）
BUILT = ['zsp', 'dqn', 'jmx', 'sdy', 'gys', 'zhl', 'lbn', 'gqi', 'yby', 'grn', 'ctg', 'hbz', 'ylz', 'hcw', 'yxd']   # 已建街区（含育秀东路新东方）
CODES = BUILT + ['zhl', 'lbn', 'gqi', 'yby', 'grn', 'ctg', 'hbz', 'ylz', 'hcw', 'yxd']   # 报站/出口文本
R = {'checks': {}, 'perf': {}, 'info': {}, 'area': {}}
def ok(k, v): R['checks'][k] = bool(v); log('check', k, bool(v)); return v
async def S(pg): return await pg.evaluate('(() => { const m = __game.xmMetro, s = __game.state(); return { pos: s.pos, zone: s.zone, street: m.street ? m.street.info() : null }; })()')
async def main():
  async with async_playwright() as p:
    b, pg, logs = await open_game(p, URL + ('&' if '?' in URL else '?') + 'q=1&start=gzdz&line=1')
    await pg.evaluate(GCLOCK); await pg.evaluate('__game.setDtMax(0.25)'); await asyncio.sleep(0.8)
    await pg.evaluate("""(() => { const g=__game; g.east.ensure(); g.east.side='xm'; g.east.cur={st:g.station, loc:'xmmetro', area:'metro'}; g.station.kit.root.setEnabled(false); g.xmMetro.enterFromRailway(g.player); if (g.player.view!=='first') g.toggleView(); })()""")
    # 出口号：街区出口亭 / 站内导向牌 与 报站文本一致
    meta = await pg.evaluate("""async (codes) => { const V = await import('/js/data/xm-visits.js'), A = await import('/js/world/xmAttr.js');
      return codes.map(c => ({ code: c, n: (A.ATTR_EXITS[c] || {}).n, line: (A.ATTR_EXITS[c] || {}).line, guides: V.xmGuides(c).map(g => g.exit), ann: (V.xmExitTexts(c) || [''])[0], en: (V.xmExitTexts(c) || ['', '', ''])[2] })); }""", CODES)
    for m in meta:
      c = m['code']
      ok(c + ':exit', m['guides'] and (m['n'] in m['guides'] if c in BUILT else True) and all(f"{g}出口" in m['ann'] or f"{g}号出口" in m['ann'] for g in m['guides']) and all(f"Exit {g}" in m['en'] for g in m['guides']))
    for c in BUILT:
      await pg.evaluate("(c) => { const m = __game.xmMetro; if (m.street) m.backFromStreet(); m.buildStation(c); __game.player.spawn(3010, -6.45, -15, Math.PI); }", c); await asyncio.sleep(1)
      await auto(pg, [[3010, -20], [3010, -30], [3010, -36.5]])
      s = await S(pg); ok(c + ':street', s['street'] and s['street']['code'] == c and s['zone'] == 'street')
      R['info'][c] = s['street']
      ok(c + ':atlas', s['street'] and s['street']['atlasOverflow'] == 0)   # 招牌图集不能溢出（溢出会从左上角覆盖别的招牌）
      # 出亭子往前走几步，回头看景点方向（+z）
      await auto(pg, [[4000, 6], [4000, 9]])
      await pg.evaluate('__game.player.yaw = 0; __game.player.pitch = 0.05')
      await asyncio.sleep(1.2)
      d = await perf(pg, 3, 0.25); R['perf'][c] = d; log('perf', c, d)
      R['area'][c] = await pg.evaluate("() => __game.scene.meshes.filter(m => m.isEnabled() && m.isVisible && m.getTotalIndices).reduce((t, m) => t + m.getTotalIndices() / 3 * (m.instances ? 1 + m.instances.length : 1), 0)"); log('areaTris', c, R['area'][c])
      ok(c + ':tris90k', d['tris'] <= VIEW_TRIS and R['area'][c] <= VIEW_TRIS)
      s = await S(pg); ok(c + ':walk', s['street'] and s['pos'][2] > 5)
      await auto(pg, [[4000, 2], [4000, -1.5], [4000, -4.5]])
      s = await S(pg); ok(c + ':back', s['street'] is None and abs(s['pos'][2] + 34.4) < 1.5)
    R['overBudget'] = [k for k, v in R['perf'].items() if v['draws'] > AREA['draws'] or v['tris'] > AREA['tris']]
    R['errors'] = errs(logs); good = all(R['checks'].values()) and not R['errors'] and not R['overBudget']
    print(json.dumps(R, ensure_ascii=False, indent=1, default=str))
    print('XMATTR', 'PASS' if good else 'FAIL', [k for k, v in R['checks'].items() if not v], R['overBudget'], flush=True)
    await b.close()
    if not good: sys.exit(1)
if __name__ == "__main__": asyncio.run(main())
