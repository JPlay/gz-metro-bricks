# 厦门出站街区：站厅出口通道 → 楼梯 → 街面（江头 2 号口：莲龙小学 / 莲花小学）；后埔 2 号口：鑫利花园 256 号楼 → 楼梯上 2 楼 → 进 201 → 出楼 → 回车站
import asyncio, sys, json, os
sys.path.insert(0, os.path.dirname(__file__))
from common import *
from journey import GCLOCK, auto, wait, log
from perfhud import perf
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8177/'
BUDGET = {'draws': 50, 'tris': 186754}
R = {'checks': {}, 'perf': {}}
def ok(k, v): R['checks'][k] = bool(v); log('check', k, bool(v)); return v
async def S(pg): return await pg.evaluate('(() => { const m = __game.xmMetro, s = __game.state(); return { pos: s.pos, zone: s.zone, street: m.street ? m.street.info() : null, z: m.street ? m.street.zoneOf(__game.player.position) : null }; })()')
async def main():
  async with async_playwright() as p:
    b, pg, logs = await open_game(p, URL + ('&' if '?' in URL else '?') + 'q=1&start=gzdz&line=1')
    await pg.evaluate(GCLOCK); await pg.evaluate('__game.setDtMax(0.25)'); await asyncio.sleep(0.8)
    await pg.evaluate("""(() => { const g=__game; g.east.ensure(); g.east.side='xm'; g.east.cur={st:g.station, loc:'xmmetro', area:'metro'}; g.station.kit.root.setEnabled(false); g.xmMetro.enterFromRailway(g.player); if (g.player.view!=='first') g.toggleView(); })()""")
    # —— 江头：站厅 → 2 号出口通道 → 楼梯 → 街面 ——
    await pg.evaluate("(() => { __game.xmMetro.buildStation('jtou'); __game.player.spawn(3010, -6.45, -15, Math.PI); })()"); await asyncio.sleep(1)
    await auto(pg, [[3010, -20], [3010, -30], [3010, -36.5]])
    s = await S(pg); ok('jtouStreet', s['street'] and s['street']['code'] == 'jtou' and s['zone'] == 'street')
    d = await perf(pg, 3, 0.25); R['perf']['jtou-street'] = d
    await auto(pg, [[4000, -1.5], [4000, -4.5]])
    s = await S(pg); ok('backToStation', s['street'] is None and abs(s['pos'][2] + 34.4) < 1.5)
    # —— 后埔：出站 → 鑫利花园北门 → 256 号楼 ——
    await pg.evaluate("(() => { const m = __game.xmMetro; m.buildStation('hpu'); m.goStreet(); })()"); await asyncio.sleep(1)
    s = await S(pg); ok('hpuStreet', s['street'] and s['street']['code'] == 'hpu')
    await auto(pg, [[4000, 4], [3970, 4], [3970, -6.8], [3960, -6.8]])   # 出亭子 → 人行道
    await pg.evaluate('__game.player.spawn(3920, 0.05, -7, 0)')   # 沿人行道走 40 m 在低 fps 下太慢，直接到北门前
    await auto(pg, [[3920, 8], [3914, 20], [3914, 28.6], [3914, 30.5]])
    s = await S(pg); ok('in256', s['street'] and s['street']['inside'] == 256 and s['z'].get('floor') == 1); log('in', s)
    d = await perf(pg, 3, 0.25); R['perf']['256-stair'] = d
    # 楼梯：上半跑（左）→ 休息平台 → 下半跑（右）→ 2 楼平台 → 左户 201
    await auto(pg, [[3999.4, 1001.0], [3999.4, 1004.2], [3999.4, 1005.2], [4000.6, 1005.2], [4000.6, 1004.2], [4000.6, 1001.4], [4000.3, 999.4], [3999.0, 999.3], [3996.5, 999.3], [3995, 997]])
    s = await S(pg); log('2F', s); ok('unit201', s['z'] and s['z'].get('floor') == 2 and s['z'].get('inUnit') and s['pos'][0] < 3998.5)
    d = await perf(pg, 3, 0.25); R['perf']['unit'] = d
    # 出户 → 下楼 → 出楼
    await auto(pg, [[3996.5, 999.3], [3999.0, 999.3], [4000.6, 1001.4], [4000.6, 1004.2], [4000.6, 1005.2], [3999.4, 1005.2], [3999.4, 1004.2], [3999.4, 1001.0], [4000, 999.2], [4000, 996.5]])
    s = await S(pg); log('out', s); ok('outOf256', s['street'] and s['street']['inside'] is None and s['zone'] == 'street')
    R['overBudget'] = [k for k, v in R['perf'].items() if v['draws'] > BUDGET['draws'] or v['tris'] > BUDGET['tris']]
    R['errors'] = errs(logs); good = all(R['checks'].values()) and not R['errors'] and not R['overBudget']
    print(json.dumps(R, ensure_ascii=False, indent=1, default=str))
    print('XMSTREET', 'PASS' if good else 'FAIL', [k for k, v in R['checks'].items() if not v], flush=True)
    await b.close()
    if not good: sys.exit(1)
if __name__ == "__main__": asyncio.run(main())
