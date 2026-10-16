# 小任务“去中山纪念堂”端到端：公园前 2 号线站台上车 → 坐 1 站到纪念堂（报站 + 车厢屏提示）→ 下车跟着绿色引导带
# → 站台导向牌 → 楼梯 → 出站闸机 → C 出口 → 街面路口指路牌 → 前广场 → 正门前到达（主角“努力！”+ 到达卡）。
# 用法：python tests/e2e/sysy.py [base-url] [截图目录] [q]
import asyncio, sys, json, time
sys.path.insert(0,__import__('os').path.dirname(__file__))
from common import *
from journey import GCLOCK, gt, auto, wait, slot, board, log
BASE=sys.argv[1] if len(sys.argv)>1 else 'http://localhost:8123/'
OUT=(sys.argv[2] if len(sys.argv)>2 else '/workspace/gz-shots-polish/sysy-r1/').rstrip('/')+'/'
Q=sys.argv[3] if len(sys.argv)>3 else '1'
R={}
async def view(pg, v):
    if await pg.evaluate('__game.player.view')!=v: await pg.evaluate('__game.toggleView()')
async def shot(pg, name, settle=1.0):
    await asyncio.sleep(settle); await pg.screenshot(path=OUT+name+'.png', timeout=180000); log('shot', name)
async def hint(pg): return (await st(pg))['mission']['step']
async def pose(pg, x, y, z, yaw, pitch, v='third', settle=1.2):
    await view(pg, v); await pg.evaluate(f'__game.teleport({x},{y},{z},{yaw}); __game.player.pitch={pitch}'); await asyncio.sleep(settle)
async def main():
  import os; os.makedirs(OUT, exist_ok=True)
  async with async_playwright() as p:
    b,pg,logs=await open_game(p, BASE+f'?q={Q}&start=gyq&line=2')
    await pg.evaluate(GCLOCK); await pg.evaluate('__game.setDtMax(0.12)')
    await pg.touchscreen.tap(560,300); await asyncio.sleep(1.0)
    # 0. 任务卡：在公园前 2 号线站台上，提示坐往嘉禾望岗的车
    R['hintStart']=await hint(pg); log('hint', R['hintStart'])
    # 地图里纪念堂标成目的地
    await pg.evaluate('__game.openMap()'); await asyncio.sleep(0.6)
    R['mapDest']=await pg.evaluate("!!document.querySelector('#netmap .dest') && document.querySelector('#netmap .dest').textContent.includes('中山纪念堂')")
    await shot(pg,'00-map-destination',0.6); await pg.evaluate('__game.closeMap()'); await asyncio.sleep(0.4)
    # 1. 上车（2 号线往嘉禾望岗，A 侧，x=18.6 的门）
    await auto(pg, [[18.6,40.5]])
    R['board']=await board(pg,2,1,[[18.6,39.6],[18.6,36.6]],[18.6,40.5])
    R['tunnel']=await wait(pg, "__game.state().inTunnel", 90); R['hintRide']=await hint(pg); log('ride hint', R['hintRide'])
    if await wait(pg, "__game.state().code=='jnt' && __game.state().inTunnel", 60): R['hintCruise']=await hint(pg); log('cruise hint', R['hintCruise'])
    # 2. 进纪念堂站：车厢 LCD（到站 + 黄色提示条）
    R['arriving']=await wait(pg, "__game.state().code=='jnt' && !__game.state().inTunnel", 120)
    await view(pg,'first'); await pg.evaluate('__game.player.yaw=Math.PI/2; __game.player.pitch=-0.32')
    await wait(pg, "(__game.state().metro.slots.find(s=>s.line==2&&s.step==1)||{}).state=='dwell'", 60)
    await shot(pg,'01-car-screen',0.8)
    s=await st(pg); R['announced']=[a for a in s['audio']['log']['announced'] if 'jnt' in a]; R['hintArrive']=s['mission']['step']
    R['attractionAnn']=any('attraction.jnt' in a for a in s['audio']['log']['announced'])
    # 3. 下车 → 站台导向牌
    await view(pg,'third'); await auto(pg, [[18.6,9.5],[18.6,13.1]])
    s=await st(pg); R['offAt']=[s['code'], s['zone'], s['aboard']]; R['hintPlatform']=s['mission']['step']
    await pg.evaluate('__game.player.yaw=-Math.PI/2; __game.player.pitch=-0.05'); await shot(pg,'02-platform-sign',1.2)
    # 4. 楼梯 → 站厅 → 出站闸机 → 安检旁出口 → C 出口通道
    await auto(pg, [[15.4,13.1],[-1.6,13.1],[-2.2,13.1],[-2.2,1.4],[2,1.4],[2,-4.6],[8.6,-4.6]])
    s=await st(pg); R['concourse']=[s['zone'], s['mission']['step']]
    await pg.evaluate('__game.player.yaw=Math.PI*0.92; __game.player.pitch=-0.12'); await shot(pg,'03-exit-sign',1.2)
    await auto(pg, [[10.5,-4.6],[10.5,-15.6],[1.2,-15.6],[1.2,-20],[1.2,-36],[1.2,-40]])
    s=await st(pg); R['street']=[s['zone'], s['pos'], s['mission']['step']]
    # 5. 街面：路口指路牌
    await auto(pg, [[1.2,-48.5]]); await pg.evaluate('__game.player.yaw=Math.PI; __game.player.pitch=0.06'); await shot(pg,'04-street-fingerpost',1.0)
    await auto(pg, [[1.2,-55.5],[31.6,-55.5],[31.6,-50]])
    # 6. 前广场：纪念堂正面全景
    await pg.evaluate('__game.player.yaw=0.12; __game.player.pitch=-0.22'); await shot(pg,'05-hall-panorama',1.0)
    # 7. 到达：台阶前的金色圈 → 庆祝 + 到达卡
    await auto(pg, [[31.6,-36],[34,-33.2]]); await pg.evaluate('__game.setMove(0,0)')
    R['arrived']=await wait(pg, "__game.state().mission.done && __game.state().mission.card", 10)
    await pg.evaluate('__game.player.yaw=Math.PI'); await asyncio.sleep(0.3)
    R['cheer']=await wait(pg, "!!(__game.player.emote && __game.player.emote.mode=='cheer')", 8)
    await shot(pg,'06-arrival',0.6)
    s=await st(pg); R['done']=s['mission']; R['goalHidden']=await pg.evaluate('!__game.station.goalGem.isEnabled()')
    await pg.touchscreen.tap(*(lambda bb:(bb['x']+bb['width']/2, bb['y']+bb['height']/2))(await pg.locator('#goalCard .ok').bounding_box()))
    R['cardClosed']=await wait(pg, "!__game.state().mission.card", 5)
    R['errors']=errs(logs); R['gameSeconds']=round(await gt(pg),1)
    print(json.dumps(R, ensure_ascii=False, indent=1, default=str))
    ok=R['mapDest'] and R['board'] and R['arriving'] and R['attractionAnn'] and R['offAt'][0]=='jnt' and R['street'][0]=='street' and R['arrived'] and R['cheer'] and R['cardClosed'] and not R['errors'] \
       and '嘉禾望岗' in R['hintStart'] and '纪念堂' in R['hintArrive']
    print('SYSY', 'PASS' if ok else 'FAIL', flush=True)
    await b.close()
    if not ok: sys.exit(1)
asyncio.run(main())
