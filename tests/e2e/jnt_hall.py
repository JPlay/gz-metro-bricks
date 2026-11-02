# 中山纪念堂室内（小美第二轮走查的两条）：
# 1. 舞台两侧踏步：从观众区走上东侧踏步 → 站到「天下为公」匾下面（舞台面 y≈1.1）→ 从西侧踏步走下来回到地面（真碰撞，autopilot 走）
# 2. 到达卡只弹一次：台阶前第一次到达弹卡（关掉）→ 进门 → 上二楼楼座：没有卡 → 下楼出门、再走过台阶前到达区：不弹卡
#    → 第二次进门上楼座：仍然没有卡
# 另外每个机位记录绘制调用 / 三角形（面数），预算 90k 面 / 50 次绘制。
# 用法：python tests/e2e/jnt_hall.py [base-url]
import asyncio, sys, json, os
sys.path.insert(0, os.path.dirname(__file__))
from common import *
from journey import GCLOCK, auto, wait, log
from perfhud import perf
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8123/'
SHOTS = '/tmp/jnt_hall/'; os.makedirs(SHOTS, exist_ok=True)
BUDGET = {'tris': 90000, 'draws': 50}
R = {'checks': {}, 'perf': {}}
def ok(k, v, extra=None):
    R['checks'][k] = bool(v); log('check', k, bool(v), '' if v else extra); return v
CARD = "(()=>{const d=__game.state().discover;return d.card||d.cardSoon||!document.getElementById('goalCard').hidden})()"
TO_HALL = [[72, 1.0], [72, 8.6], [72, 10.6]]
UP_BALCONY = [[600, -16.5], [600, -20.5], [597.4, -20.5], [595, -20.5], [592, -20.5], [589.4, -20.5], [588.9, -18.0], [594, -17.9], [600, -17.9], [600, -16.2], [600, -14], [600, -12.45]]
DOWN_BALCONY = [[600, -14], [600, -16.2], [600, -17.9], [594, -17.9], [588.9, -18.0], [589.4, -20.5], [592, -20.5], [595, -20.5], [597.4, -20.5], [600, -20.5]]
async def walk(pg, pts):
    for pt in pts:
        if not await auto(pg, [pt]): return False
    return True
async def P(pg, name):
    d = await perf(pg); R['perf'][name] = d; log('perf', name, d)
    await pg.screenshot(path=SHOTS + name + '.jpg', type='jpeg', quality=60, timeout=180000)
    ok(f'perf:{name}:budget', d['tris'] < BUDGET['tris'] and d['draws'] < BUDGET['draws'], d)
async def no_card(pg, name, secs=4):
    # 游戏时间 secs 秒内卡片一直不出现（含“马上要弹”的计时）
    appeared = await wait(pg, CARD, secs)
    ok(name, not appeared, await pg.evaluate('__game.state().discover'))
async def balcony(pg, n):
    await walk(pg, UP_BALCONY); s = await st(pg)
    ok(f'balcony{n}:reached', s['zone'] == 'hall' and s['pos'][1] > 4 and s['pos'][2] > -13.5, s['pos'])
    await no_card(pg, f'balcony{n}:noArrivalCard')
    if n == 1: await P(pg, 'balcony')
    await walk(pg, DOWN_BALCONY); s = await st(pg); ok(f'balcony{n}:backDown', s['pos'][1] < 0.3, s['pos'])
async def main():
    async with async_playwright() as p:
        b, pg, logs = await open_game(p, BASE + '?q=1&start=jnt&line=2')
        try:
            await pg.evaluate(GCLOCK); await pg.evaluate('__game.setDtMax(0.25)'); await asyncio.sleep(1.5)
            if await pg.evaluate('__game.player.view') != 'third': await pg.evaluate('__game.toggleView()')
            # 台阶前第一次到达：弹卡，点“好的”关掉
            await pg.evaluate('__game.teleport(68.6,0.05,-14,0)'); await asyncio.sleep(0.8)
            await walk(pg, [[67.4, -9], [67.4, 1.2]]); await pg.evaluate('__game.setMove(0,0)')
            ok('arrive1:card', await wait(pg, "__game.state().discover.card", 8), await pg.evaluate('__game.state().discover'))
            bb = await pg.locator('#goalCard .ok').bounding_box()
            await pg.touchscreen.tap(bb['x'] + bb['width'] / 2, bb['y'] + bb['height'] / 2)
            ok('arrive1:cardClosed', await wait(pg, "!__game.state().discover.card", 5))
            await walk(pg, TO_HALL); ok('hall1:entered', await wait(pg, "__game.state().zone=='hall'", 8))
            # 舞台：中间过道 → 东侧踏步 → 匾下 → 西侧踏步 → 地面
            await walk(pg, [[600, -16.5], [600, -7.2], [600, 5.4], [602.9, 6.4]]); s = await st(pg)
            ok('stage:atStepFoot', abs(s['pos'][0] - 602.9) < 0.6 and abs(s['pos'][2] - 6.4) < 0.6 and s['pos'][1] < 0.3, s['pos'])
            await walk(pg, [[602.9, 8.2], [602.9, 9.7]]); s = await st(pg)
            ok('stage:upEastSteps', s['pos'][1] > 1.0 and s['pos'][2] > 9.2, s['pos'])
            await walk(pg, [[600, 9.7]]); s = await st(pg)
            ok('stage:underPlaque', s['pos'][1] > 1.0 and abs(s['pos'][0] - 600) < 0.6 and 9.2 < s['pos'][2] < 10.4, s['pos'])
            await pg.evaluate('__game.player.yaw=Math.PI; __game.player.pitch=0.1'); await asyncio.sleep(1.0); await P(pg, 'stageUnderPlaque')
            await pg.evaluate('__game.teleport(600,0.05,0,0); __game.player.pitch=0.05'); await asyncio.sleep(1.5); await P(pg, 'stageSteps')
            await walk(pg, [[600, 5.4], [602.9, 6.4], [602.9, 9.7], [600, 9.7]])   # 摆机位后回到台上
            await walk(pg, [[597.1, 9.7], [597.1, 8.2], [597.1, 6.4]]); s = await st(pg)
            ok('stage:downWestSteps', s['pos'][1] < 0.3 and abs(s['pos'][0] - 597.1) < 0.6 and s['pos'][2] < 7.0, s['pos'])
            # 舞台中间（没有踏步的地方）仍然上不去：踏步是唯一的路
            await walk(pg, [[600, 7.6]]); await auto(pg, [[600, 10.5]]); s = await st(pg)
            ok('stage:solidFrontStillBlocks', s['pos'][1] < 0.3 and s['pos'][2] < 9.0, s['pos'])
            # 楼座第一次：没有卡
            await balcony(pg, 1)
            # 出门 → 走过台阶前到达区：不再弹卡
            await walk(pg, [[600, -22.5], [600, -25]]); s = await st(pg); ok('out1:street', s['zone'] == 'street', s['pos'])
            await walk(pg, [[72, 4], [70, 1], [67.4, -2]]); await no_card(pg, 'arrive2:noCard')
            # 第二次进门上楼座：仍然没有卡
            await walk(pg, [[67.4, 1.2], [72, 1.0]] + TO_HALL[1:]); ok('hall2:entered', await wait(pg, "__game.state().zone=='hall'", 8))
            await balcony(pg, 2)
            ok('noErrors', not errs(logs), errs(logs)[:5])
        finally: await b.close()
    print(json.dumps(R, ensure_ascii=False, indent=1))
    bad = [k for k, v in R['checks'].items() if not v]
    print('JNT_HALL', 'PASS' if not bad else 'FAIL ' + ','.join(bad), flush=True)
    if bad: sys.exit(1)
if __name__ == '__main__': asyncio.run(main())
