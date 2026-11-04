# 乌石浦 · SM 三期（batch 2）：L 形裙楼 + 「夏花」广场 + voco + 可走的 3F 连廊（三期 3F ↔ 二期黄宝石 3F）
#  · 街面：嘉禾路西侧广场 / 东南圆角 / 夏花 / 连廊仰视 / voco 塔楼（第一 + 第三人称）
#  · 1F 正门进三期 → 核对 4 层、店名（官网楼层指引：1F NIKE RISE 1200 … 3F 卡通尼 + 万达影城，4F 怂重庆火锅厂）
#  · 3F 连廊门出去 → 连廊上（y 11）→ 进黄宝石 3F → 出来 → 走回三期 3F → 1F 正门出街
#  · 每个视角 ≤ 9 万三角形、≤ 50 draw；SHOTS=目录 存截图
import asyncio, sys, json, os, math
sys.path.insert(0, os.path.dirname(__file__))
import xm_sm_bridge as xb
from xm_sm_bridge import S, info, org, view, shot, pose, go, ok, R, XS, FH, enter_main
from common import *
from journey import GCLOCK, auto, log
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8177/'

async def both(pg, name, label, x, z, yaw, pitch=0.0, y=0.05):
  await view(pg, 'third'); await pose(pg, x, y, z, yaw, pitch); await shot(pg, name + '-3p', label + ' (3rd person)')
  await view(pg, 'first'); await pose(pg, x, y, z, yaw, pitch); await shot(pg, name + '-1p', label + ' (1st person)'); await view(pg, 'third')
  s = await S(pg); ok(name + ':pose', s['zone'] == 'street' and abs(s['pos'][1] - y) < 1 and abs(s['pos'][2] - z) < 2)

async def street(pg):
  await both(pg, 'p3-east-plaza', 'Phase III east face on 嘉禾路 + 夏花 plaza', XS - 40, 140, math.atan2(-14, 26), -0.12)
  await both(pg, 'p3-se-corner', 'Phase III rounded SE corner + skybridge 2', XS - 44, 112, math.atan2(-22, 22), -0.18)
  await both(pg, 'p3-xiahua', '夏花 sculpture (秦岭) + water garden', XS - 45, 150, math.atan2(-8, 10), -0.3)
  await both(pg, 'p3-link3-below', 'L3 link Phase III ↔ Topaz from below', XS - 86, 124.5, -math.pi / 2, -0.4)
  await both(pg, 'p3-voco', 'voco hotel tower + drop-off (嘉禾路403)', XS - 42, 197, math.atan2(-84, -29), -0.34)

async def main():
  async with async_playwright() as p:
    b, pg, logs = await open_game(p, URL + ('&' if '?' in URL else '?') + 'q=1&start=gzdz&line=1')
    await pg.evaluate(GCLOCK); await pg.evaluate('__game.setDtMax(0.25)'); await asyncio.sleep(0.8)
    await pg.evaluate("""(() => { const g=__game; g.east.ensure(); g.east.side='xm'; g.east.cur={st:g.station, loc:'xmmetro', area:'metro'}; g.station.kit.root.setEnabled(false); g.xmMetro.enterFromRailway(g.player); })()""")
    await pg.evaluate("() => { const m = __game.xmMetro; m.buildStation('wsp'); const P = m.station.platforms[0]; __game.player.spawn(3020, P.y + 0.05, P.zc + 2, Math.PI / 2); }"); await asyncio.sleep(1)
    await pg.evaluate("() => { __game.player.spawn(3010, -6.45, -15, Math.PI); }"); await asyncio.sleep(1)
    await auto(pg, [[3010, -20], [3010, -30], [3010, -36.5]])
    s = await S(pg); ok('street', s['zone'] == 'street')
    si = await pg.evaluate('__game.xmMetro.street.info()'); log('street atlas', si); ok('streetAtlas', si['atlasOverflow'] == 0)
    await street(pg)
    # ---- 1F 正门进三期 ----
    if await enter_main(pg, 'sm-p3'):
      I = await info(pg); o = await org(pg); SF = I['shopFloors']; log('p3 floors', SF)
      ok('p3:floors', I['floors'] == 4); ok('p3:atlas', I['overflow'] == 0); ok('p3:lk3gate', 'lk3' in I['gates'] and 'br2' in I['gates'])
      ok('p3:shopsUnique', len(I['shops']) == len(set(I['shops'])) and all(len(f) >= 6 for f in SF))
      ok('p3:1F-nike', 'NIKE RISE 1200' in SF[0]); ok('p3:3F-cartoony', '卡通尼' in SF[2]); ok('p3:4F-song', '怂重庆火锅厂' in SF[3])
      await view(pg, 'first'); await pose(pg, o['x'] + 5, 0.05, o['z'] + 16, -0.95, -0.45); await shot(pg, 'p3-atrium-up', 'Phase III 1F atrium'); await view(pg, 'third')
      # ---- 3F：卡通尼（南）对着万达影城（北，隔中空）----
      y3 = o['y'] + 2 * FH + 0.05
      await view(pg, 'first'); await pose(pg, o['x'] + 4, y3, o['z'] + 9.5, 0.15, 0.05); await shot(pg, 'p3-3F-cinema', 'Phase III 3F → 万达影城 across the void')
      await pose(pg, o['x'] - 2, y3, o['z'] + 10.5, math.pi + 0.5, 0.0); await shot(pg, 'p3-3F-cartoony-link', 'Phase III 3F 卡通尼 + L3 link door'); await view(pg, 'third')
      await pose(pg, o['x'] - 7, y3, o['z'] + 10, math.pi)
      await go(pg, o, [[-7, 4], [-7, -4]]); await asyncio.sleep(1); s = await S(pg)
      ok('lk3:outP3', s['inside'] is None and abs(s['pos'][1] - 11) < 0.6 and abs(s['pos'][0] - (XS - 104)) < 2 and abs(s['pos'][2] - 126) < 2.5)
      await view(pg, 'first'); await pg.evaluate('__game.player.yaw = Math.PI; __game.player.pitch = 0.02'); await shot(pg, 'p3-link3-walk-1p', 'L3 link → Topaz (1st person)')
      await view(pg, 'third'); await pg.evaluate('__game.player.yaw = Math.PI; __game.player.pitch = 0.1'); await shot(pg, 'p3-link3-walk-3p', 'L3 link → Topaz (3rd person)')
      await auto(pg, [[XS - 104, 119.3]]); await asyncio.sleep(1); s = await S(pg)
      ok('lk3:inTopaz3F', s['inside'] == 'sm-topaz' and s['gate'] == 'lk3' and s['floor'] == 3)
      if s['inside'] == 'sm-topaz':
        o = await org(pg); await view(pg, 'first'); await pg.evaluate('__game.player.pitch = 0.04'); await shot(pg, 'p3-topaz3F-from-link', 'Topaz 3F from L3 link'); await view(pg, 'third')
        await go(pg, o, [[0, 36], [0, 47]]); await asyncio.sleep(1); s = await S(pg)
        ok('lk3:outTopaz', s['inside'] is None and abs(s['pos'][1] - 11) < 0.6 and abs(s['pos'][2] - 122) < 2.5)
        await view(pg, 'first'); await pg.evaluate('__game.player.yaw = 0; __game.player.pitch = 0.02'); await shot(pg, 'p3-link3-back-1p', 'L3 link → Phase III (1st person)'); await view(pg, 'third')
        await auto(pg, [[XS - 104, 128.6]]); await asyncio.sleep(1); s = await S(pg)
        ok('lk3:backIntoP3', s['inside'] == 'sm-p3' and s['gate'] == 'lk3' and s['floor'] == 3)
      o = await org(pg)
      if s['inside'] == 'sm-p3':
        await go(pg, o, [[-7, 9]]); s = await S(pg); ok('p3:3Fring', s['floor'] == 3)
        await pose(pg, o['x'], o['y'] + 0.05, o['z'] + 4, math.pi); s = await xb.leave_main(pg, o)
        ok('p3:outMain', s['inside'] is None and s['zone'] == 'street' and abs(s['pos'][1]) < 0.5 and s['pos'][0] - XS > -60)
    R['errors'] = errs(logs); good = all(R['checks'].values()) and not R['errors']
    print(json.dumps(R, ensure_ascii=False, indent=1, default=str))
    print('XMSMP3', 'PASS' if good else 'FAIL', [k for k, v in R['checks'].items() if not v], flush=True)
    await b.close()
    if not good: sys.exit(1)
if __name__ == "__main__": asyncio.run(main())
