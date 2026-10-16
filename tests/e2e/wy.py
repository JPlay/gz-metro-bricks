# 越秀公园五羊石像端到端：越秀公园站 2 号线站台 → 站厅 → B1 出口 → 街面（第一眼：南边马路对面的小山岗和石像）
# → 过斑马线 → 山脚 → 两段石阶（中间歇脚平台）上到山顶平台 → 石像跟前。
# 断言：走得上去（最后 y≈山顶高度）、不能从草坡上直接爬（侧面绕不上去）、每个镜头不超预算、没有报错。
# 用法：python tests/e2e/wy.py [base-url] [截图目录] [q]
import asyncio, sys, json, math, os
sys.path.insert(0, os.path.dirname(__file__))
from common import *
from journey import GCLOCK, gt, auto, wait, log
from perfhud import perf, overlay
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8123/'
OUT = (sys.argv[2] if len(sys.argv) > 2 else '/workspace/gz-shots-polish/wy-r1/').rstrip('/') + '/'
Q = sys.argv[3] if len(sys.argv) > 3 else '1'
BUDGET = {'draws': 66, 'tris': 186754}
TOP_Y = 5.0   # 山顶平台高度（js/world/wy.js WY.H）
R = {'perf': {}}
async def view(pg, v):
    if await pg.evaluate('__game.player.view') != v: await pg.evaluate('__game.toggleView()')
async def shot(pg, name, settle=1.2):
    await asyncio.sleep(settle); d = await perf(pg); R['perf'][name] = d
    await overlay(pg, d, name); await pg.screenshot(path=OUT + name + '.png', timeout=180000); log('shot', name, d)
async def pose(pg, x, y, z, yaw, pitch, v='third', settle=1.2):
    await view(pg, v); await pg.evaluate(f'__game.teleport({x},{y},{z},{yaw}); __game.player.pitch={pitch}'); await asyncio.sleep(settle)
async def main():
  os.makedirs(OUT, exist_ok=True)
  async with async_playwright() as p:
    b, pg, logs = await open_game(p, BASE + f'?q={Q}&start=yxgy&line=2')
    await pg.evaluate(GCLOCK); await pg.evaluate('__game.setDtMax(0.25)'); await asyncio.sleep(1.5)
    s = await st(pg); R['start'] = [s['code'], s['zone']]
    # 1. 站台 → 站厅 → B1 出口通道 → 街面（和纪念堂站同一套车站布局）
    await view(pg, 'third'); await pg.evaluate('__game.teleport(18.6,-11.95,12.6,0)'); await asyncio.sleep(0.8)
    await auto(pg, [[18.6, 13.1], [15.4, 13.1], [-1.6, 13.1], [-2.2, 13.1], [-2.2, 1.4], [2, 1.4], [2, -4.6], [8.6, -4.6]])
    await auto(pg, [[10.5, -4.6], [10.5, -15.6], [1.2, -15.6], [1.2, -20], [1.2, -36], [1.2, -40.5]])
    s = await st(pg); R['street'] = [s['zone'], s['pos']]
    # 2. 出站第一眼（刚走出站口雨棚，第三人称，朝南）：马路对面的小山岗 + 五羊石像
    await pg.evaluate('__game.player.pitch=0.0'); await shot(pg, '02-first-view', 1.5)
    R['parkOn'] = await pg.evaluate("__game.station.park.root.isEnabled()")
    # 3. 过斑马线到山脚
    R['toFoot'] = await auto(pg, [[1.2, -50], [0, -62], [0, -80], [0, -84.2]])
    s = await st(pg); R['foot'] = s['pos']
    # 4. 台阶底往上看石像（第一人称抬头）
    await pose(pg, 0, 0.05, -83.6, math.pi, -0.32, 'first', 1.2); await shot(pg, '01-steps-lookup')
    # 5. 走上两段石阶 → 歇脚平台 → 山顶平台
    await pose(pg, 0, 0.05, -84.2, math.pi, 0, 'third', 0.6)
    R['upSteps'] = await auto(pg, [[0, -90], [0, -93.3], [0, -97], [0, -100.6], [0, -102.4]])
    s = await st(pg); R['top'] = s['pos']
    # 6. 侧面草坡爬不上去：从山脚东侧往山顶方向走，高度不应该上去
    await pose(pg, 14, 0.05, -88, -2.4, 0, 'third', 0.6)
    await pg.evaluate('__game.setMove(0,1)'); await asyncio.sleep(3.0); await pg.evaluate('__game.setMove(0,0)')
    s = await st(pg); R['slope'] = s['pos']
    R['errors'] = errs(logs); R['gameSeconds'] = round(await gt(pg), 1)
    R['overBudget'] = [k for k, v in R['perf'].items() if v['draws'] > BUDGET['draws'] or v['tris'] > BUDGET['tris']]
    print(json.dumps(R, ensure_ascii=False, indent=1, default=str))
    ok = R['start'][0] == 'yxgy' and R['street'][0] == 'street' and R['parkOn'] and R['foot'][2] < -82 \
       and abs(R['top'][1] - TOP_Y) < 0.4 and R['top'][2] < -101 and R['slope'][1] < 1.2 and not R['overBudget'] and not R['errors']
    print('WY', 'PASS' if ok else 'FAIL', flush=True)
    await b.close()
    if not ok: sys.exit(1)
if __name__ == "__main__": asyncio.run(main())
