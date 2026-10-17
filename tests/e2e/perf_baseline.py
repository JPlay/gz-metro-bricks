# 性能基准：站厅（公园前）几个机位的绘制调用 / 活动三角形（和 r3 截图同一测法）。python3 tests/e2e/perf_baseline.py <base-url> [q] [out]
import asyncio, sys, json
sys.path.insert(0,__import__('os').path.dirname(__file__))
from common import *
from perfhud import perf, overlay
BASE=sys.argv[1] if len(sys.argv)>1 else 'http://localhost:8123/'
Q=sys.argv[2] if len(sys.argv)>2 else '1'
OUT=sys.argv[3] if len(sys.argv)>3 else None
POSES=[('concourse-gates',0,-5.95,-11,0,0.1,'third'),('concourse-west',8,-5.95,-6,-1.57,0.05,'first'),('concourse-paid',-2,-5.95,6,3.14,0.05,'third')]
async def main():
  R={}
  async with async_playwright() as p:
    b,pg,logs=await open_game(p,BASE+'?q='+Q)
    await pg.evaluate('__game.setDtMax(0.12)'); await asyncio.sleep(2)
    for name,x,y,z,yaw,pitch,v in POSES:
        if await pg.evaluate('__game.player.view')!=v: await pg.evaluate('__game.toggleView()')
        await pg.evaluate(f'__game.teleport({x},{y},{z},{yaw}); __game.player.pitch={pitch}')
        await asyncio.sleep(1.5); R[name]=await perf(pg)
        if OUT: await overlay(pg,R[name],name); await pg.screenshot(path=f'{OUT}/baseline-{name}.png')
    R['errors']=errs(logs)
    print('BASELINE', json.dumps(R, ensure_ascii=False))
    await b.close()
asyncio.run(main())
