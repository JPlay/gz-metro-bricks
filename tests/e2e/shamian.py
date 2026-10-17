# 沙面端到端：黄沙站 1 号线站台 → 站厅 → D 出口 → 街面（第一眼：马路对面沙基涌的小石桥和沙面大街）
# → 过斑马线 → 过小石桥 → 沙面大街榕树林荫道 → 露德圣母堂门前 → 街尽头珠江边栏杆。
# 断言：沙面的 Kit（park-hs）在地面上启用、走得过桥（z < -94）、走得到江边又不会掉进江里（停在栏杆前）、
#       河涌栏杆挡人（不过桥直接往南走走不下去）、每个镜头不超预算（≤ 50 draws / 186,754 tris）、鸟叫起来了、没有报错。
# 用法：python tests/e2e/shamian.py [base-url] [截图目录] [q]
import asyncio, sys, json, math, os
sys.path.insert(0, os.path.dirname(__file__))
from common import *
from journey import GCLOCK, gt, auto, wait, log
from perfhud import perf, overlay
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8123/'
OUT = (sys.argv[2] if len(sys.argv) > 2 else '/workspace/gz-shots-polish/sm-r1/').rstrip('/') + '/'
Q = sys.argv[3] if len(sys.argv) > 3 else '1'
BUDGET = {'draws': 50, 'tris': 186754}
R = {'perf': {}}
async def view(pg, v):
    if await pg.evaluate('__game.player.view') != v: await pg.evaluate('__game.toggleView()')
async def shot(pg, name, settle=1.2):
    await asyncio.sleep(settle); d = await perf(pg); R['perf'][name] = d
    await overlay(pg, d, name); await pg.screenshot(path=OUT + name + '.png', timeout=180000); log('shot', name, d)
async def pose(pg, x, y, z, yaw, pitch, v='third', settle=1.2):
    await view(pg, v); await pg.evaluate(f'__game.teleport({x},{y},{z},{yaw}); __game.player.pitch={pitch}'); await asyncio.sleep(settle)
async def walk(pg, mx, my, secs):
    await pg.evaluate(f'__game.setMove({mx},{my})'); await wait(pg, 'false', game=secs); await pg.evaluate('__game.setMove(0,0)')
async def go(pg, pts, tries=3):
    # autopilot 偶尔被站厅里站着的行人挡住：从卡住的位置往旁边让一步（横向偏 1.2 / -1.2 / 2.4 米）再走剩下的路
    for k in range(tries):
        r = await pg.evaluate(f'__game.autopilot({json.dumps(pts)}, false)'); s = await st(pg); log('go', pts[-1], '->', r['ok'], s['pos'], s['zone'])
        if r['ok']: return True
        x, z = s['pos'][0], s['pos'][2]; t = r.get('target') or pts[0]
        i = next((j for j, q in enumerate(pts) if q == t), 0)
        dx, dz = t[0] - x, t[1] - z; L = math.hypot(dx, dz) or 1; off = [1.2, -1.2, 2.4][k % 3]
        side = [x - dz / L * off, z + dx / L * off]
        pts = [side, [side[0] + dx / L * 1.5, side[1] + dz / L * 1.5]] + pts[i:]
    return False
async def main():
  os.makedirs(OUT, exist_ok=True)
  async with async_playwright() as p:
    b, pg, logs = await open_game(p, BASE + f'?q={Q}&start=hs&line=1')
    await pg.evaluate(GCLOCK); await pg.evaluate('__game.setDtMax(0.25)'); await asyncio.sleep(1.5)
    s = await st(pg); R['start'] = [s['code'], s['zone']]
    # 1. 站台 → 站厅 → D 出口通道 → 街面
    await view(pg, 'third'); await pg.evaluate('__game.teleport(18.6,-11.95,12.6,0)'); await asyncio.sleep(0.8)
    await go(pg, [[18.6, 13.1], [15.4, 13.1], [-1.6, 13.1], [-2.2, 13.1], [-2.2, 1.4], [2, 1.4], [2, -4.6], [8.6, -4.6]])
    await go(pg, [[10.5, -4.6], [10.5, -15.6], [1.2, -15.6], [1.2, -20], [1.2, -36], [1.2, -40.5]])
    s = await st(pg); R['street'] = [s['zone'], s['pos']]
    R['parkOn'] = await pg.evaluate("!!(__game.station.park && __game.station.park.root.isEnabled() && __game.station.sm)")
    # 2. 出站第一眼（第三人称，朝南）：马路对面小石桥 + 沙面大街的洋楼、榕树、教堂尖塔
    await pose(pg, 1.2, 0.05, -40.5, math.pi, 0.0, 'third', 1.0); await shot(pg, '01-first-view', 1.5)
    # 3. 过斑马线 → 小石桥 → 沙面大街
    await pose(pg, 1.2, 0.05, -40.5, math.pi, 0, 'third', 0.4)
    R['toBridge'] = await go(pg, [[1.2, -50], [0.5, -63], [0.5, -79], [0.5, -88], [0.5, -97]])
    s = await st(pg); R['acrossBridge'] = s['pos']
    # 4. 河涌栏杆挡人：桥东边的岸上往南走，不应该掉进沙基涌
    await pose(pg, 12, 0.05, -80, math.pi, 0, 'third', 0.5); await walk(pg, 0, 1, 3.0)
    s = await st(pg); R['canalRail'] = s['pos']
    # 5. 榕树林荫道（站在林荫道边，朝南看）
    await pose(pg, 5.4, 0.05, -98, math.pi, 0.0, 'third', 1.0); await shot(pg, '02-boulevard', 1.5)
    # 6. 露德圣母堂门前（第三人称，从门前斜对面看：白色尖塔、正立面、拍照的铜像；第三人称最多抬头约 20°，所以站远一点）
    await pose(pg, 4.0, 0.05, -121, 2.82, -0.35, 'third', 1.0); await shot(pg, '03-chapel-front', 1.5)
    # 7. 走到街尽头的珠江边：被栏杆挡住，不掉进江里；鸟叫已经起来、车流声轻下去
    await pose(pg, 6.2, 0.05, -186, math.pi, 0, 'third', 0.4)
    R['toRiver'] = await go(pg, [[6.2, -196], [6.2, -199.4]])
    await walk(pg, 0, 1, 2.0)
    s = await st(pg); R['river'] = s['pos']; R['audioEnv'] = s['audio']['env']
    R['errors'] = errs(logs); R['gameSeconds'] = round(await gt(pg), 1)
    R['overBudget'] = [k for k, v in R['perf'].items() if v['draws'] > BUDGET['draws'] or v['tris'] > BUDGET['tris']]
    print(json.dumps(R, ensure_ascii=False, indent=1, default=str))
    ok = R['start'][0] == 'hs' and R['street'][0] == 'street' and R['parkOn'] and R['acrossBridge'][2] < -94 and R['acrossBridge'][1] > -0.3 \
       and R['canalRail'][2] > -82.6 and R['canalRail'][1] > -0.3 and R['river'][2] > -200.2 and R['river'][2] < -196 and R['river'][1] > -0.3 \
       and R['audioEnv'].get('birds', 0) > 0.5 and R['audioEnv']['street'] < 0.5 and not R['overBudget'] and not R['errors']
    print('SHAMIAN', 'PASS' if ok else 'FAIL', flush=True)
    await b.close()
    if not ok: sys.exit(1)
if __name__ == "__main__": asyncio.run(main())
