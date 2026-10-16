# 中山纪念堂端到端（r3，不再是“任务”：没有任务条 / 分步提示 / 地图目的地）：公园前 2 号线上车 → 坐 1 站到纪念堂
# （下一站报站接“纪念堂站附近有中山纪念堂，欢迎下车游玩，请从C出口出站”三语 + 车厢屏黄条“本站可前往：中山纪念堂”）
# → 站台“中山纪念堂 C出口”牌 → 站厅 → C 出口 → 沿东风中路人行道往东 → 头门中间拱门
# → 中轴大道 → 绕过孙中山像 → 纪念堂台阶前（取景机位 + “努力！” + 小知识卡）→ 进门（独立室内场景）
# → 后排看舞台 → 坐下 → 上二楼楼座往下看 → 从大门出来回到街面。
# 另外断言：坐在车厢里时，对面来车不会播“X 站台 … 列车即将进站”（只给站台上的人听）。
# 每张截图贴性能角标（无头 SwiftShader 的 FPS + 绘制调用 + 活动三角形），并对照站厅基线预算检查。
# 用法：python tests/e2e/sysy.py [base-url] [截图目录] [q]
import asyncio, sys, json, math
sys.path.insert(0,__import__('os').path.dirname(__file__))
from common import *
from journey import GCLOCK, gt, auto, wait, slot, board, log
from perfhud import perf, overlay
BASE=sys.argv[1] if len(sys.argv)>1 else 'http://localhost:8123/'
OUT=(sys.argv[2] if len(sys.argv)>2 else '/workspace/gz-shots-polish/sysy-r3/').rstrip('/')+'/'
Q=sys.argv[3] if len(sys.argv)>3 else '1'
# 预算 = 现有站厅（公园前站厅闸机机位，a904278，q=1，同一测法）的最大值
BUDGET={'draws':66,'tris':186754}
R={'perf':{}}
async def view(pg, v):
    if await pg.evaluate('__game.player.view')!=v: await pg.evaluate('__game.toggleView()')
async def shot(pg, name, settle=1.2):
    await asyncio.sleep(settle); d=await perf(pg); R['perf'][name]=d
    await overlay(pg, d, name); await pg.screenshot(path=OUT+name+'.png', timeout=180000); log('shot', name, d)
async def look(pg, yaw, pitch): await pg.evaluate(f'__game.player.yaw={yaw}; __game.player.pitch={pitch}')
async def pose(pg, x, y, z, yaw, pitch, v='third', settle=1.2):
    await view(pg, v); await pg.evaluate(f'__game.teleport({x},{y},{z},{yaw}); __game.player.pitch={pitch}'); await asyncio.sleep(settle)
async def ann(pg): return (await st(pg))['audio']['log']['announced']
async def main():
  import os; os.makedirs(OUT, exist_ok=True)
  async with async_playwright() as p:
    b,pg,logs=await open_game(p, BASE+f'?q={Q}&start=gyq&line=2')
    await pg.evaluate(GCLOCK); await pg.evaluate('__game.setDtMax(0.12)')
    await pg.touchscreen.tap(560,300); await asyncio.sleep(1.0)
    # 没有任务条；地图上也没有“目的地”
    R['noChip']=await pg.evaluate("!document.getElementById('goal')")
    await pg.evaluate('__game.openMap()'); await asyncio.sleep(0.6)
    R['noMapDest']=await pg.evaluate("!document.querySelector('#netmap .dest')")
    await asyncio.sleep(0.6); await pg.evaluate('__game.closeMap()'); await asyncio.sleep(0.4)
    # 1. 上车（2 号线往嘉禾望岗，A 侧，x=18.6 的门）
    await auto(pg, [[18.6,40.5]])
    R['board']=await board(pg,2,1,[[18.6,39.6],[18.6,36.6]],[18.6,40.5])
    n0=len(await ann(pg))
    R['tunnel']=await wait(pg, "__game.state().inTunnel", 90)
    # 2. 进纪念堂站：停站时站到 LCD 跟前（第一人称，抬头），屏上“到站 中山纪念堂 + 请从 C 出口出站”
    R['arriving']=await wait(pg, "__game.state().code=='jnt' && !__game.state().inTunnel", 120)
    await wait(pg, f"{slot(2,1)}.state=='dwell'", 60)
    # 车厢静止时列车局部 = 世界偏移；中间车厢 LCD 在 x=cx±3（cx=18.6）。站在 LCD 东侧 1.05m，朝西抬头。
    troot=await pg.evaluate("(()=>{const sl=__game.metro.slots.find(o=>o.line==2&&o.step==1); const r=sl.train.root.position; return [r.x,r.y,r.z]})()")
    lx=troot[0]+18.6-3
    await view(pg,'first'); await pg.evaluate(f'__game.teleport({lx+1.05},{troot[1]+0.05},{troot[2]},-Math.PI/2); __game.player.pitch=-0.58')
    await asyncio.sleep(1.0); R['stillAboard']=(await st(pg))['aboard']
    await shot(pg,'01-car-screen',0.8)
    # 对面（往广州南）也叫一趟车进站：车厢里不该播站台进站广播
    await pg.evaluate('__game.call(2,-1)')
    await wait(pg, f"['arrive','dwell'].includes({slot(2,-1)}.state)", 25)
    await asyncio.sleep(2.0)
    a=await ann(pg); ride=a[n0:]
    R['rideAnn']=ride; R['noPlatformAnnInCar']=not any('.platform.' in x for x in ride)
    R['visitAnn']=[x for x in ride if 'visit.jnt' in x]
    # 3. 下车（车厢屏拍完后列车可能快关门了，直接站到站台上）→ 站台“中山纪念堂 C出口”牌
    await view(pg,'third'); await pg.evaluate(f'__game.teleport(18.6,{troot[1]+0.05},12.6,0)'); await asyncio.sleep(0.8)
    await auto(pg, [[18.6,13.1]])
    s=await st(pg); R['offAt']=[s['code'], s['zone'], s['aboard']]
    await look(pg,-math.pi/2,-0.05); await shot(pg,'x1-platform-sign',1.2)
    # 4. 楼梯 → 站厅 → 出站闸机 → C 出口通道 → 街面
    await auto(pg, [[15.4,13.1],[-1.6,13.1],[-2.2,13.1],[-2.2,1.4],[2,1.4],[2,-4.6],[8.6,-4.6]])
    s=await st(pg); R['concourse']=s['zone']
    await look(pg,math.pi*0.92,-0.12); await shot(pg,'x2-exit-sign',1.2)
    await auto(pg, [[10.5,-4.6],[10.5,-15.6],[1.2,-15.6],[1.2,-20],[1.2,-36],[1.2,-40]])
    await auto(pg, [[1.2,-50]])
    s=await st(pg); R['street']=[s['zone'], s['pos']]
    await asyncio.sleep(2.0); a=await ann(pg); R['noStreetHint']=not any('hint.' in x for x in a)
    # 5. 沿人行道往东到头门；对面人行道看头门正面（第一人称抬头）
    await auto(pg, [[1.2,-63.2],[72,-63.2]], True)
    await pose(pg,72,0.05,-79.6,0,-0.3,'first'); await shot(pg,'02-gate-front',1.0)
    # 栏杆特写：人行道上斜看石柱 + 铁花栏杆
    await pose(pg,42,0.05,-61.9,0.42,0.06,'first'); await shot(pg,'04-fence',1.0)
    # 6. 回到门口，穿中间拱门进去，中轴大道看纪念堂（稍偏离轴线，孙中山像不挡主楼）
    await pose(pg,72,0.05,-64.5,0,0.05,'third',0.8)
    await auto(pg, [[72,-56]])
    s=await st(pg); R['inPark']=[s['zone'], s['pos']]
    await auto(pg, [[69.2,-48]]); await look(pg,0.04,0.02); await shot(pg,'03-axis',1.2)
    # 7. 中轴往北，绕过像，到台阶前 → 取景机位 + 努力 + 到达卡
    R['walkUp']=await auto(pg, [[68.6,-14],[67.4,-9],[67.4,1.2]], True)
    R['arrived']=await wait(pg, "__game.state().discover.done", 10); await pg.evaluate('__game.setMove(0,0)')
    R['framed']=await pg.evaluate('!!__game.player.frame')
    R['cheer']=await wait(pg, "!!(__game.player.emote && __game.player.emote.mode=='cheer')", 4)
    await shot(pg,'05-arrival',0.2)
    R['cardSoon']=await wait(pg, "__game.state().discover.card", 6)
    s=await st(pg); R['done']=s['discover']
    await pg.touchscreen.tap(*(lambda bb:(bb['x']+bb['width']/2, bb['y']+bb['height']/2))(await pg.locator('#goalCard .ok').bounding_box()))
    R['cardClosed']=await wait(pg, "!__game.state().discover.card", 5)
    # 8. 上台阶进大门 → 室内（独立场景）
    await auto(pg, [[72,1.0],[72,8.6],[72,10.6]])
    R['entered']=await wait(pg, "__game.state().zone=='hall'", 6)
    s=await st(pg); R['hallInfo']=s.get('hall'); R['inPos']=s['pos']
    await auto(pg, [[600,-16.5],[600,-7.2]]); await look(pg,0,0.0); await shot(pg,'06-auditorium',1.4)
    # 坐下（后排一个空座，用原来的“坐下”按钮）
    sx=await pg.evaluate("(()=>{const s=__game.station.interior.seats.find(s=>s.wy==0&&s.wz<0&&Math.abs(s.wx-600)>3&&Math.abs(s.wx-600)<5);return [s.wx,s.wz,s.face]})()")
    await pose(pg, sx[0]+0.3*math.sin(sx[2]),0.05, sx[1]+0.3*math.cos(sx[2]), sx[2], 0.1)
    R['actSit']=(await st(pg))['act']; await pg.evaluate('__game.act()'); await asyncio.sleep(0.8)
    R['seat']=(await st(pg))['seat']; await shot(pg,'07-seated',0.8)
    await pg.evaluate('__game.act()'); await asyncio.sleep(0.5); R['stood']=not (await st(pg))['seat'].get('seated')
    # 9. 走楼梯上二楼楼座（西侧楼梯 → 桥 → 楼座门 → 走道），第一人称往下看
    await pose(pg,600,0.05,-20.5,-math.pi/2,0,'third',0.6)
    R['stairs']=await auto(pg, [[597.4,-20.5],[589.4,-20.5],[588.9,-18.0],[600,-17.9],[600,-16.2],[600,-12.6]])
    s=await st(pg); R['balcony']=s['pos']
    await view(pg,'first'); await look(pg,0,0.32); await shot(pg,'08-balcony-down',1.2)
    # 10. 出门回街面
    await pose(pg,600,0.05,-21.5,math.pi,0,'third',0.5)
    await pg.evaluate('__game.setMove(0,1)'); await wait(pg, "__game.state().zone!='hall'", 6); await pg.evaluate('__game.setMove(0,0)')
    s=await st(pg); R['out']=[s['zone'], s['pos']]
    R['errors']=errs(logs); R['gameSeconds']=round(await gt(pg),1)
    # 预算只管 r3 要求的镜头；x* 是原有车站内景（站台 / 站厅导向牌），只记录
    R['overBudget']=[k for k,v in R['perf'].items() if not k.startswith('x') and (v['draws']>BUDGET['draws'] or v['tris']>BUDGET['tris'])]
    print(json.dumps(R, ensure_ascii=False, indent=1, default=str))
    ok=R['noChip'] and R['noMapDest'] and R['board'] and R['arriving'] and R['noPlatformAnnInCar'] and len(R['visitAnn'])>=3 and R['offAt'][0]=='jnt' and not R['offAt'][2] \
       and R['street'][0]=='street' and R['noStreetHint'] and R['arrived'] and R['framed'] and R['cheer'] and R['cardSoon'] and R['cardClosed'] \
       and R['entered'] and (R['seat'] or {}).get('hall') and R['stood'] and R['balcony'][1]>4 and R['out'][0]!='hall' \
       and not R['overBudget'] and not R['errors']
    print('SYSY', 'PASS' if ok else 'FAIL', flush=True)
    await b.close()
    if not ok: sys.exit(1)
asyncio.run(main())
