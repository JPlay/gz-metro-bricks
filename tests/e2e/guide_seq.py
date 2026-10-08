# 脚印/箭头 + 镜头序列：从出生点 (0,0,-48) 朝站口走，每隔一会截一张，记录 pitch / yaw / 镜头位置。
#   python3 tests/e2e/guide_seq.py <url> <输出目录>
# 先打开脚印，用鼠标按住左下摇杆往前推（评审当时就是鼠标），再用触摸摇杆走一段；街面白箭头应一直指向站口（屏幕上方），镜头不应变成顶视。
import asyncio, sys, os, json
sys.path.insert(0, os.path.dirname(__file__))
from common import *
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8123/?q=1'
OUT = (sys.argv[2] if len(sys.argv) > 2 else '/workspace/gz-shots-3d/').rstrip('/') + '/'
os.makedirs(OUT, exist_ok=True)
async def main():
    R = []
    async with async_playwright() as p:
        b, pg, logs = await open_game(p, URL)
        await asyncio.sleep(2.0)
        box = await pg.locator('#bFoot').bounding_box(); await pg.touchscreen.tap(box['x'] + 40, box['y'] + 40); await asyncio.sleep(0.5)
        async def snap(name):
            s = await st(pg); await pg.screenshot(path=OUT + name + '.png', timeout=120000)
            e = {'shot': name, 'pos': s['pos'], 'yaw': s['yaw'], 'pitch': s['pitch'], 'camPos': s['camPos'], 'foot': s['footCount'], 'camAbovePlayer': round(s['camPos'][1] - s['pos'][1], 2)}
            R.append(e); print(json.dumps(e, ensure_ascii=False))
        await snap('seq-00-spawn')
        # 鼠标按住摇杆往前推（同时鼠标上下乱动，旧版会把 pitch 拖成顶视）
        await pg.mouse.move(200, 640); await pg.mouse.down()
        for k in range(1, 12): await pg.mouse.move(200 + (k % 3) * 6, 640 - k * 7); await asyncio.sleep(0.03)
        for i in range(1, 4):
            for _ in range(10):
                if await pg.evaluate(f'__game.player.position.z > {-48 + i * 1.6}'): break
                await asyncio.sleep(0.5)
            await snap(f'seq-0{i}-mouse-stick-walk')
        await pg.mouse.up()
        # 触摸摇杆继续走到站口前
        cdp = await pg.context.new_cdp_session(pg)
        await cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': 200, 'y': 640, 'id': 1}]})
        for k in range(1, 10): await cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': 200, 'y': 640 - k * 6, 'id': 1}]}); await asyncio.sleep(0.03)
        for i in range(4, 7):
            for _ in range(12):
                if await pg.evaluate(f'__game.player.position.z > {-48 + i * 1.6}'): break
                await asyncio.sleep(0.5)
            await snap(f'seq-0{i}-touch-stick-walk')
        await cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
        await asyncio.sleep(1.0); await snap('seq-07-near-entrance')
        await b.close()
    ok = all(abs(e['yaw']) < 1e-3 and e['pitch'] <= 0.55 + 1e-6 for e in R)
    print('SEQ', 'PASS' if ok else 'FAIL', 'maxPitch', max(e['pitch'] for e in R), 'yaws', sorted(set(e['yaw'] for e in R)), 'errs', errs(logs)[:3])
asyncio.run(main())
