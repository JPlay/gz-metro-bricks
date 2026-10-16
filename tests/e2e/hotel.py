# 丽呈铂锐酒店（农讲所站）端到端：街上看外观 → 走进正门 → 大堂按电梯（门开）→ 进轿厢按 3 → 3F 走廊 → 302 双床房（门自己开）
# → 坐床、躺下、坐起来、起身 → 坐电梯回大堂 → 走楼梯 1F → 2F → 3F（楼梯间“传送”换楼层）→ 坐电梯下楼 → 出门回到街上。
# 每张截图贴性能角标，对照站厅预算（66 次绘制 / 186,754 三角形）。
# 用法：python tests/e2e/hotel.py [base-url] [截图目录]
import asyncio, sys, json, math
sys.path.insert(0,__import__('os').path.dirname(__file__))
from common import *
from journey import GCLOCK, auto, wait, log
from perfhud import perf, overlay
BASE=sys.argv[1] if len(sys.argv)>1 else 'http://localhost:8123/'
OUT=(sys.argv[2] if len(sys.argv)>2 else '/workspace/gz-shots-polish/hotel-r1/').rstrip('/')+'/'
BUDGET={'draws':66,'tris':186754}
HX=1000
R={'perf':{}}
async def view(pg, v):
    if await pg.evaluate('__game.player.view')!=v: await pg.evaluate('__game.toggleView()')
async def pose(pg, x, y, z, yaw, pitch, v='third', settle=1.2):
    await view(pg, v); await pg.evaluate(f'__game.teleport({x},{y},{z},{yaw}); __game.player.pitch={pitch}'); await asyncio.sleep(settle)
async def look(pg, yaw, pitch): await pg.evaluate(f'__game.player.yaw={yaw}; __game.player.pitch={pitch}')
async def shot(pg, name, settle=1.2):
    await asyncio.sleep(settle); d=await perf(pg); R['perf'][name]=d; await overlay(pg,d,name); await pg.screenshot(path=OUT+name+'.png', timeout=180000); log('shot',name,d)
async def H(pg): return (await st(pg))['hotel']
LIFT="__game.state().hotel.interior.lift"
async def main():
  import os; os.makedirs(OUT, exist_ok=True)
  async with async_playwright() as p:
    b,pg,logs=await open_game(p, BASE.rstrip('/')+'/?q=1&start=njs&line=1')
    await pg.evaluate(GCLOCK); await pg.evaluate('__game.setDtMax(0.25)'); await asyncio.sleep(1.5)
    # 1. 外观（中山四路南侧人行道，往东南看德政中路口）
    await pose(pg,16,0.05,-64,2.57,-0.38,'first',1.5); await shot(pg,'01-exterior')
    # 2. 走进正门
    await pose(pg,29.4,0.05,-93,math.pi/2,0.05,'third',0.8); await auto(pg,[[31.4,-93]])
    R['entered']=await wait(pg,"__game.state().hotel.inside",6); s=await st(pg); R['zone']=s['zone']; R['audioZone']=s['audio']['zone']
    # 3. 电梯口按「按电梯」→ 门开
    await auto(pg,[[HX+6.9,-0.3]]); s=await st(pg); R['actLift']=s['act']
    await pg.evaluate('__game.act()'); R['liftOpen']=await wait(pg,LIFT+".state=='open'",20)
    await pose(pg,HX+0.8,0.05,-3.4,1.12,0.02,'third',0.6); await shot(pg,'02-lobby-lift',0.6)
    # 4. 进轿厢，楼层按钮面板出现，按 3
    await pg.evaluate('__game.teleport(%d,0.05,-0.2,1.57)'%(HX+6.9)); await pg.evaluate('__game.hotel.call()'); await wait(pg,LIFT+".state=='open'",20); await auto(pg,[[HX+9.5,0]])
    h=await H(pg); R['inLift']=h['where']=='lift'; R['panel']=h['panel']
    if not h['interior']['lift']['state'] in ('open','opening'): await pg.evaluate('__game.hotel.call()')
    await view(pg,'first'); await look(pg,-math.pi/2+0.35,0.15); await shot(pg,'x1-in-lift',0.8)
    await pg.evaluate("document.querySelector('#liftPanel .flb[data-f=\"3\"]').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));document.querySelector('#liftPanel .flb[data-f=\"3\"]').dispatchEvent(new PointerEvent('pointerup',{bubbles:true}))")
    await asyncio.sleep(0.5)
    if (await H(pg))['interior']['lift']['target']!=3 and (await H(pg))['interior']['lift']['state']!='moving': await pg.evaluate('__game.hotel.press(3)')
    R['rode3']=await wait(pg,LIFT+".floor==3 && "+LIFT+".state=='open'",30); h=await H(pg); R['floorAfterRide']=h['interior']['floor']; R['posAfterRide']=(await st(pg))['pos']
    # 5. 3F 走廊
    await view(pg,'third'); await auto(pg,[[HX+6.5,0],[HX+3.2,0]]); await look(pg,-math.pi/2,0.04); await shot(pg,'03-corridor',1.0)
    R['plates']=[r['n'] for r in (await H(pg))['interior']['rooms']]
    # 6. 302 双床房：走近门自己开，进去
    R['intoRoom']=await auto(pg,[[HX-4,0],[HX-4,2.3],[HX-3.0,3.9]]); h=await H(pg); R['where']=h['where']; R['doorOpen']=[r['open'] for r in h['interior']['rooms']]
    await pose(pg,HX-2.5,4.55,3.7,-0.78,0.22,'first',1.2); await shot(pg,'04-twin-room')
    # 7. 坐床 → 躺下 → 坐起来 → 起身
    await pose(pg,HX-3.6,4.55,4.25,-math.pi/2,0.1,'third',0.8)
    s=await st(pg); R['actBed']=s['act']; await pg.evaluate('__game.act()'); await wait(pg,"__game.state().seat.seated",5)
    R['seatBed']=(await st(pg))['seat']; R['lieBtn']=(await H(pg))['lieBtn']
    await pg.evaluate("__game.hotel.toggleLie()"); await asyncio.sleep(0.8); R['lying']=(await H(pg))['lying']
    await look(pg,-2.5,0.62); await shot(pg,'x2-lying',1.0)
    await pg.evaluate("__game.hotel.toggleLie()"); await asyncio.sleep(0.4); R['satUp']=not (await H(pg))['lying']
    await pg.evaluate('__game.act()'); await asyncio.sleep(0.6); R['stood']=not (await st(pg))['seat']['seated']
    # 8. 回走廊，坐电梯下大堂
    await auto(pg,[[HX-3.4,3.0],[HX-4,1.6],[HX-4,0],[HX+6.9,-0.2]]); await pg.evaluate('__game.hotel.call()')
    await wait(pg,LIFT+".state=='open'",30); await auto(pg,[[HX+9.5,0]]); await pg.evaluate('__game.hotel.press(1)')
    R['rode1']=await wait(pg,LIFT+".floor==1 && "+LIFT+".state=='open'",30); R['posLobby']=(await st(pg))['pos']
    # 9. 楼梯 1F → 2F → 3F
    await auto(pg,[[HX+6.6,0],[HX+6.6,2.65],[HX+9.0,2.65],[HX+11.5,2.7],[HX+11.5,6.9],[HX+9.1,7.0],[HX+9.1,2.7]])
    s=await st(pg); h=await H(pg); R['stairs2F']=[s['pos'][1], h['interior']['floor']]
    await auto(pg,[[HX+11.5,2.7],[HX+11.5,6.9],[HX+9.1,7.0],[HX+9.1,2.6]])
    s=await st(pg); h=await H(pg); R['stairs3F']=[s['pos'][1], h['interior']['floor']]
    await view(pg,'third'); await look(pg,-math.pi/2,0.1); await shot(pg,'x3-stairs-3f',1.0)
    await auto(pg,[[HX+6.6,2.6],[HX+6.9,-0.2]]); R['plates3F']=[r['n'] for r in (await H(pg))['interior']['rooms']]
    # 10. 电梯下楼，出门
    await pg.evaluate('__game.hotel.call()'); await wait(pg,LIFT+".state=='open'",30); await auto(pg,[[HX+9.5,0]]); await pg.evaluate('__game.hotel.press(1)')
    await wait(pg,LIFT+".floor==1 && "+LIFT+".state=='open'",30)
    await auto(pg,[[HX+6.6,0],[HX+0,-3],[HX+0,-6.2]])
    R['out']=await wait(pg,"!__game.state().hotel.inside",6); s=await st(pg); R['outPos']=s['pos']; R['outZone']=s['zone']
    R['errors']=errs(logs)[:5]
    R['overBudget']=[k for k,v in R['perf'].items() if not k.startswith('x') and (v['draws']>BUDGET['draws'] or v['tris']>BUDGET['tris'])]
    print(json.dumps(R, ensure_ascii=False, indent=1, default=str))
    ok=R['entered'] and R['zone']=='hall' and (R['actLift'] or {}).get('label')=='按电梯' and R['liftOpen'] and R['inLift'] and R['panel'] and R['rode3'] and R['floorAfterRide']==3 \
       and R['plates'][0].startswith('3') and R['where']=='room' and max(R['doorOpen'])>0.7 and (R['actBed'] or {}).get('label')=='坐下' and R['seatBed'].get('seated') and R['lieBtn'] \
       and R['lying'] and R['satUp'] and R['stood'] and R['rode1'] and abs(R['stairs2F'][0]-4.5)<0.3 and R['stairs2F'][1]==2 and abs(R['stairs3F'][0]-4.5)<0.4 and R['stairs3F'][1]==3 \
       and R['out'] and R['outZone']=='street' and not R['overBudget'] and not R['errors']
    print('HOTEL', 'PASS' if ok else 'FAIL', flush=True)
    await b.close()
if __name__ == "__main__": asyncio.run(main())
