# 任意机位的绘制调用 / 三角形：python3 tests/e2e/perf_probe.py <url> '<json [[name,x,y,z,yaw,pitch,view],...]>' [out]
import asyncio, sys, json
sys.path.insert(0,__import__('os').path.dirname(__file__))
from common import *
from perfhud import perf, overlay
async def main():
  url, poses, out = sys.argv[1], json.loads(sys.argv[2]), (sys.argv[3] if len(sys.argv)>3 else None)
  R={}
  async with async_playwright() as p:
    b,pg,logs=await open_game(p,url)
    await pg.evaluate('__game.setDtMax(0.12)'); await asyncio.sleep(2)
    for name,x,y,z,yaw,pitch,v in poses:
        if await pg.evaluate('__game.player.view')!=v: await pg.evaluate('__game.toggleView()')
        await pg.evaluate(f'__game.teleport({x},{y},{z},{yaw}); __game.player.pitch={pitch}')
        await asyncio.sleep(2.0); R[name]=await perf(pg)
        if out: await overlay(pg,R[name],name); await pg.screenshot(path=f'{out}/{name}.png')
    R['errors']=errs(logs)[:5]
    print('PROBE', json.dumps(R, ensure_ascii=False))
    await b.close()
asyncio.run(main())
