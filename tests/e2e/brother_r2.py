# 哥哥明明 r2 复查截图：明明正面 / 背面、两兄弟并排站在站厅、一个门面（骑楼：廊深 + 玻璃门）。
#   python3 tests/e2e/brother_r2.py <base-url> [out] [--doors]   （--doors 另外把三种门各拍一张到 out/doors-*）
import asyncio, sys, os, json
sys.path.insert(0, os.path.dirname(__file__))
from common import *
from perfhud import perf, overlay, overlay_off
BASE = sys.argv[1] if len(sys.argv) > 1 and sys.argv[1].startswith('http') else 'http://localhost:8123/'
OUT = (sys.argv[2] if len(sys.argv) > 2 and not sys.argv[2].startswith('--') else '/workspace/gz-shots-polish/brother-r2').rstrip('/') + '/'
DOORS = '--doors' in sys.argv
os.makedirs(OUT, exist_ok=True); PERF = {}
async def shot(pg, name, settle=1.5):
    await asyncio.sleep(settle); d = await perf(pg, n=4, gap=0.3); PERF[name] = d
    await overlay(pg, d, name); await pg.screenshot(path=OUT + name + '.png', timeout=240000); await overlay_off(pg); print('shot', name, d, flush=True)
async def main():
    async with async_playwright() as p:
        b, pg, logs = await open_game(p, BASE + '?q=1&char=mingming')
        await pg.evaluate('__game.setDtMax(0.12)'); await asyncio.sleep(2)
        for name, yaw in [('01-ming-front', 3.14159), ('02-ming-back', 0)]:
            await pg.evaluate(f'__game.teleport(0,0.05,-50,0); __game.player.facing=0; __game.player.yaw={yaw}; __game.player.pitch=0.12; __game.player.dist=2.4')
            await shot(pg, name)
        # 两兄弟并排站在站厅（闸机前），都面向镜头
        await pg.evaluate('__game.teleport(0.55,-5.95,-11,0); __game.player.facing=0; __game.player.yaw=3.14159; __game.player.pitch=0.1; __game.player.dist=3.4')
        await asyncio.sleep(1.5); await pg.evaluate("__game.brother.buddy(-0.55,-5.95,-11,0,'idle')")
        await shot(pg, '03-brothers-concourse', settle=2.5)
        await pg.evaluate("__game.brother.buddy(null)")
        assert not errs(logs), errs(logs); await b.close()
        shops = [('jnt', '04-storefront-qilou')] + ([('gyq', 'doors-teahouse'), ('cjc', 'doors-stall')] if DOORS else [])
        for code, name in shops:
            b, pg, logs = await open_game(p, BASE + f'?q=1&char=mingming&start={code}')
            await pg.evaluate('__game.setDtMax(0.12)'); await asyncio.sleep(2)
            s = (await pg.evaluate('__game.brother.food.info()'))['shops'][0]; yaw = s['yawIn']
            x = -13.6 + 5.5 if s['out'][0] < 0 else 13.6 - 5.5
            await pg.evaluate(f"__game.teleport({x},0.05,-50.6,{yaw}); __game.player.facing={yaw}-0.75; __game.player.yaw={yaw}-0.35; __game.player.pitch=0.05; __game.player.dist=3.4")
            await shot(pg, name, settle=3)
            assert not errs(logs), errs(logs); await b.close()
    print('PERF', json.dumps(PERF))
asyncio.run(main())
