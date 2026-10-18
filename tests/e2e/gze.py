# 广州东站端到端：1 号线广州东站站台 → 站厅 → 出口 → 街面 → 过斑马线 → 火车站候车大厅（发车屏、座椅）
# → 检票闸机（走近自动开）→ 5 站台 → 复兴号 5 号车厢开着的车门 → 车厢里（独立场景）→ 走到座位旁坐下（第一人称看车头方向）
# → 起身 → 从车门下车回到站台。顺路拍 3 张评审截图（不贴角标）。
# 大厅里看不见列车：站台在闸机后面，闸机后一道挡墙（5 站台）挡住，绕过去才到站台。
# 断言：每一段都走得到、车厢加载 / 卸载正确、坐下成功、每个镜头不超预算（≤66 draws / 186,754 tris）、没有报错。
# 用法：python tests/e2e/gze.py [base-url] [截图目录] [q]
import asyncio, sys, json, math, os
sys.path.insert(0, os.path.dirname(__file__))
from common import *
from journey import GCLOCK, gt, auto, wait, log
from perfhud import perf
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8123/'
OUT = (sys.argv[2] if len(sys.argv) > 2 else '/workspace/gz-shots-polish/gze-r2/').rstrip('/') + '/'
Q = sys.argv[3] if len(sys.argv) > 3 else '1'
BUDGET = {'draws': 66, 'tris': 186754}
EO = 2200          # 车厢内景放在 x=2200（js/game/east.js EO）
R = {'perf': {}}
async def view(pg, v):
    if await pg.evaluate('__game.player.view') != v: await pg.evaluate('__game.toggleView()')
async def measure(pg, name):
    d = await perf(pg); R['perf'][name] = d; log('perf', name, d); return d
async def shot(pg, name, settle=1.5):
    await asyncio.sleep(settle); await measure(pg, name)
    await pg.screenshot(path=OUT + name + '.png', timeout=180000)
async def pose(pg, x, y, z, yaw, pitch, v='third', settle=1.2):
    await view(pg, v); await pg.evaluate(f'__game.teleport({x},{y},{z},{yaw}); __game.player.pitch={pitch}'); await asyncio.sleep(settle)
async def main():
  os.makedirs(OUT, exist_ok=True)
  async with async_playwright() as p:
    b, pg, logs = await open_game(p, BASE + f'?q={Q}&start=gzdz&line=1')
    await pg.evaluate(GCLOCK); await pg.evaluate('__game.setDtMax(0.25)'); await asyncio.sleep(1.5)
    s = await st(pg); R['start'] = [s['code'], s['zone'], s['pos']]
    await view(pg, 'third')
    # 1. 地铁站台 → 站厅 → 出口通道 → 街面（标准车站布局）
    await pg.evaluate('__game.teleport(18.6,-11.95,12.6,0)'); await asyncio.sleep(0.8)
    await auto(pg, [[18.6, 13.1], [15.4, 13.1], [-1.6, 13.1], [-2.2, 13.1], [-2.2, 1.4], [2, 1.4], [2, -4.6], [8.6, -4.6]])
    await auto(pg, [[10.5, -4.6], [10.5, -15.6], [1.2, -15.6], [1.2, -20], [1.2, -36], [1.2, -40.5]])
    s = await st(pg); R['street'] = [s['zone'], s['pos']]
    await measure(pg, 'street')
    # 2. 过斑马线 → 候车大厅正门 → 大厅里（发车屏下）
    R['toHall'] = await auto(pg, [[1.2, -50], [0, -62], [0, -80], [0, -86], [0, -92], [1.5, -100]])
    await measure(pg, 'hall')
    # 3. 检票闸机（走近自动开）→ 站台
    R['gates'] = await auto(pg, [[1.5, -108], [1.5, -111.9], [1.5, -115], [1.5, -117.4], [9, -117.4], [9, -122.5]])   # 闸机后绕过 5 站台挡墙
    s = await st(pg); R['platform'] = s['pos']
    await measure(pg, 'platform')
    # 4. 复兴号 5 号车厢的车门（x=-5.8）→ 走进去
    await auto(pg, [[9, -124], [-5.8, -124], [-5.8, -127.3], [-5.8, -128.6]])   # 走进车门那一刻被传送进车厢，autopilot 自己停下
    R['inside'] = await wait(pg, '__game.state().east && __game.state().east.inside', 4)
    s = await st(pg); R['car'] = [s['zone'], s['pos'], s['east']]
    await measure(pg, 'car')
    # 5. 车厢里：门厅 → 端门 → 过道，走到第 14 排二人座旁坐下
    R['toSeat'] = await auto(pg, [[EO + 10.6, 0.25], [EO + 9.0, 0.3], [EO + 4.2, 0.3]])   # 第 14 排二人座（往前还有 4 排，看得到端门上的显示屏）
    s = await st(pg); R['actBeforeSit'] = s['act']
    await pg.evaluate('__game.act()'); await asyncio.sleep(1.0)
    s = await st(pg); R['seat'] = s['seat']
    # 03：坐着，第一人称看车头方向（前排椅背、两边大窗、行李架、端门上的显示屏）
    await view(pg, 'first'); await pg.evaluate('__game.player.yaw=Math.PI/2; __game.player.pitch=0.02')
    await shot(pg, '03-seat-forward')
    # 6. 起身 → 回门厅 → 下车回到站台
    await pg.evaluate('__game.act()'); await asyncio.sleep(0.8)
    s = await st(pg); R['stood'] = not s['seat']['seated']
    await view(pg, 'third')
    await auto(pg, [[EO + 9.0, 0.25], [EO + 10.6, 0.25], [EO + 11.2, 0.9], [EO + 11.2, 1.6]])
    R['outside'] = await wait(pg, '!__game.state().east.inside', 4)
    s = await st(pg); R['back'] = [s['zone'], s['pos']]
    # 7. 评审截图
    # 01：候车大厅里面（座椅、发车屏、玻璃幕墙同框）；02：站台上看 5 号车厢开着的车门（门洞往里缩，看得见车厢里）
    await pose(pg, -18, 0.05, -110.5, 0.85, -0.2, 'first'); await shot(pg, '01-hall-inside')
    await pose(pg, -3.5, 0.05, -125.9, -2.31, 0.05, 'first'); await shot(pg, '02-door-05')
    R['errors'] = errs(logs); R['gameSeconds'] = round(await gt(pg), 1)
    R['overBudget'] = [k for k, v in R['perf'].items() if v['draws'] > BUDGET['draws'] or v['tris'] > BUDGET['tris']]
    print(json.dumps(R, ensure_ascii=False, indent=1, default=str))
    ok = R['start'][0] == 'gzdz' and R['street'][0] == 'street' and R['toHall'] and R['gates'] and R['platform'][2] < -117 \
       and R['inside'] and R['car'][1][0] > 400 and R['toSeat'] and R['seat'].get('seated') and R['stood'] \
       and R['outside'] and R['back'][1][2] > -128 and R['back'][1][0] < 0 and not R['overBudget'] and not R['errors']
    print('GZE', 'PASS' if ok else 'FAIL', flush=True)
    await b.close()
    if not ok: sys.exit(1)
if __name__ == "__main__": asyncio.run(main())
