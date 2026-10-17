# 美食店性能对比：公园前街面两个固定机位，有店 vs ?nofood=1 无店（绘制调用 / 活动三角形，取多帧最大值）。
#   python3 tests/e2e/brother_perf.py <base-url> [截图目录]
import asyncio, sys, os, json
sys.path.insert(0, os.path.dirname(__file__))
from common import *
from perfhud import perf, overlay, overlay_off
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8123/'
OUT = sys.argv[2].rstrip('/') + '/' if len(sys.argv) > 2 else None
VIEWS = {'street-gyq': '__game.teleport(6,0.05,-47,-2.2); __game.player.yaw=-2.2; __game.player.pitch=0.1; __game.player.dist=5',
         'toward-station': '__game.teleport(0,0.05,-50,0); __game.player.facing=0; __game.player.yaw=0; __game.player.pitch=0.12; __game.player.dist=2.6',
         'at-teahouse': '__game.teleport(-9.2,0.05,-55,-Math.PI/2); __game.player.yaw=-Math.PI/2; __game.player.pitch=0.03; __game.player.dist=8'}
async def main():
    R = {}
    async with async_playwright() as p:
        for tag, q in [('shops', ''), ('nofood', '&nofood=1')]:
            b, pg, logs = await open_game(p, BASE + '?q=1&char=mingming' + q)
            await pg.evaluate('__game.setDtMax(0.12)'); await asyncio.sleep(2)
            for v, js in VIEWS.items():
                await pg.evaluate(js); await asyncio.sleep(3)
                d = await perf(pg, n=6, gap=0.3); R[f'{v}/{tag}'] = d; print(v, tag, d, flush=True)
                if OUT:
                    await overlay(pg, d, f'{v} {tag}'); await pg.screenshot(path=f'{OUT}19-perf-{v}-{tag}.png', timeout=240000); await overlay_off(pg)
            assert not errs(logs), errs(logs); await b.close()
    print('PERF', json.dumps(R))
asyncio.run(main())
