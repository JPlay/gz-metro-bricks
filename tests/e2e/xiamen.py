# 动车广州东 → 厦门北（第一阶段）：广州东站 5 站台 → 复兴号 5 号车厢 → 坐下 → 关门、发车广播 → 站台往后滑走 → 车里起身走几步（行驶中）
# → 快进 ×10 → 城市 / 田野 / 山和隧道 / 九龙江特大桥 / 厦门 → 制动、厦门北站站台滑进来停稳 → 开门、到站广播 → 下车站在厦门北站站台上
# → 从同一扇车门上车、坐下 → 回程 D3311 开回广州东 → 下车回到广州东站站台。
# 断言：每一段都走得到；车门关好才开车、开车时出不去；各路段远景按顺序出现；广播（字幕事件）按顺序；每个镜头 ≤66 draws / 186,754 tris；没有报错。
# 评审截图（iPad 横屏 1112×834，不贴角标）：a 关门开出广州东站台、b 车窗外的九龙江特大桥、c 在厦门北站下车。
# 用法：python tests/e2e/xiamen.py [base-url] [截图目录] [q]
import asyncio, sys, json, os
sys.path.insert(0, os.path.dirname(__file__))
from common import *
from journey import GCLOCK, gt, auto, wait, log
from perfhud import perf
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8123/'
OUT = (sys.argv[2] if len(sys.argv) > 2 else '/workspace/gz-shots-polish/xm-r1/').rstrip('/') + '/'
Q = sys.argv[3] if len(sys.argv) > 3 else '1'
BUDGET = {'draws': 66, 'tris': 186754}
EO, XO = 2200, 3000
R = {'perf': {}, 'checks': {}}
def ok(name, v): R['checks'][name] = bool(v); log('check', name, bool(v)); return v
async def E(pg): return await pg.evaluate('__game.east.info()')
async def view(pg, v):
    if await pg.evaluate('__game.player.view') != v: await pg.evaluate('__game.toggleView()')
async def measure(pg, name):
    d = await perf(pg, 4, 0.25); R['perf'][name] = d; log('perf', name, d); return d
async def shot(pg, name, settle=1.0):
    await asyncio.sleep(settle); await measure(pg, name)
    await pg.screenshot(path=OUT + name + '.png', timeout=180000)
async def until_rt(pg, rt, speed=10):
    await pg.evaluate(f'__game.east.setSpeed({speed})')
    r = await wait(pg, f'(__game.east.info().ride||{{rt:1e9}}).rt > {rt}', 400)
    await pg.evaluate('__game.east.setSpeed(1)'); return r
async def sit_row14(pg):
    await auto(pg, [[EO + 10.6, 0.25], [EO + 9.0, 0.3], [EO + 4.2, 0.3]])
    await pg.evaluate('__game.act()'); await asyncio.sleep(0.8)
    return (await st(pg))['seat'].get('seated')
async def main():
  os.makedirs(OUT, exist_ok=True)
  async with async_playwright() as p:
    b, pg, logs = await open_game(p, BASE + f'?q={Q}&start=gzdz&line=1')
    await pg.evaluate(GCLOCK); await pg.evaluate('__game.setDtMax(0.25)')
    await pg.evaluate("window.__caps=[]; addEventListener('gz-audio-caption', e => { if (e.detail && e.detail.id && __caps[__caps.length-1] !== e.detail.id) __caps.push(e.detail.id); })")
    await asyncio.sleep(1.0)
    # 1. 广州东站 5 站台 → 车门 → 车厢里 → 第 14 排坐下
    await pg.evaluate('__game.teleport(-5.8,0.05,-126.2,Math.PI)'); await asyncio.sleep(0.8)
    await auto(pg, [[-5.8, -127.3], [-5.8, -128.6]])
    ok('inCar', await wait(pg, '__game.east.info().inside', 4))
    ok('seated', await sit_row14(pg))
    # 2. 关门 → 发车
    ok('closing', await wait(pg, '!!__game.east.info().ride', 6))
    ok('doorClosed', await wait(pg, '__game.east.info().door >= 1', 12))
    ok('departed', await wait(pg, '__game.east.info().ride.phase === "run"', 6))
    # a：关好门、列车开出广州东站台（站在过道往站台一侧看，站台和「广州东」站牌往后滑）
    await wait(pg, '__game.east.info().ride.rt > 4.5', 10)
    await pg.evaluate('__game.act()'); await asyncio.sleep(0.4)   # 起身（行驶中可以在车厢里走）
    # 站在门厅里看关好的车门（门上小窗是玻璃，外面的站台在往后退）+ 左边端门里的客室
    await view(pg, 'first'); await pg.evaluate(f'__game.teleport({EO + 12.1},0.05,-1.15,-0.42); __game.player.pitch=-0.02')
    await shot(pg, 'a-depart-gzdz', 0.8)
    e = await E(pg); ok('platformSliding', e['ride']['s'] > 3 and e['ride']['v'] > 1 and e['door'] >= 1)
    await pg.evaluate(f'__game.teleport({EO + 9.0},0.05,0.3,-Math.PI/2)'); await asyncio.sleep(0.5)
    # 行驶中在车厢里走动；走到车门口也下不了车
    s0 = (await st(pg))['pos']
    await auto(pg, [[EO + 6.0, 0.3], [EO + 2.0, 0.3]])
    s1 = await st(pg); ok('walkWhileMoving', abs(s1['pos'][0] - s0[0]) > 3 and (await E(pg))['inside'])
    await auto(pg, [[EO + 10.6, 0.25], [EO + 11.2, 0.9], [EO + 11.2, 1.6]])
    e = await E(pg); ok('cantExitMoving', e['inside'] and e['ride'] is not None)
    await auto(pg, [[EO + 10.6, 0.25], [EO + 9.0, 0.3]])
    # 3. 快进：路段顺序
    segs = []
    for rt in [30, 60, 90, 98, 112, 126, 140, 160]:
        await until_rt(pg, rt); e = await E(pg); segs.append((rt, e['ride']['seg']['near'], e['ride']['seg']['mid']))
        if rt == 30: await measure(pg, 'cruise-city')
        if rt == 98: await measure(pg, 'tunnel')
    R['segs'] = segs; log('segs', segs)
    mids = [m for _, _, m in segs]; order = [m for i, m in enumerate(mids) if i == 0 or mids[i - 1] != m]
    ok('segOrder', order == ['city', 'fields', 'mount', 'sea', 'xiamen'] and any(n == 'tunnel' for _, n, _ in segs) and any(n == 'bridge' for _, n, _ in segs))
    # 到站（b 九龙江特大桥在回程时拍）
    await pg.evaluate('__game.east.setSpeed(10)')
    ok('arrived', await wait(pg, '__game.east.info().count.arrived.length >= 1', 200))
    await pg.evaluate('__game.east.setSpeed(1)')
    e = await E(pg); ok('sideXm', e['side'] == 'xm' and e['xmn']['mode'] == 'car')
    ok('doorOpen', await wait(pg, '__game.east.info().door <= 0', 4))
    await measure(pg, 'arrived-in-car')
    # 4. 下车 → 厦门北站站台
    await view(pg, 'third')
    await auto(pg, [[EO + 10.6, 0.25], [EO + 11.2, 0.9], [EO + 11.2, 1.6]])
    ok('atXmn', await wait(pg, '__game.east.info().loc === "xmn"', 4))
    s = await st(pg); R['xmnPos'] = s['pos']; ok('xmnPos', s['pos'][0] > XO - 100 and abs(s['pos'][2] + 127.1) < 0.6)
    # c：刚下车，第三人称，站台、站名牌、停着的复兴号
    await pg.evaluate('__game.player.yaw=1.78; __game.player.pitch=0.06'); await auto(pg, [[XO - 4.6, -126.6]])
    await pg.evaluate('__game.player.yaw=1.78; __game.player.pitch=0.06')
    await shot(pg, 'c-arrive-xmn', 1.2)
    # 站台上走走（不掉下去）
    await auto(pg, [[XO - 2, -124.6], [XO + 20, -124.6], [XO - 30, -124.6]])
    s = await st(pg); ok('xmnWalk', s['pos'][1] > -0.5 and s['pos'][0] < XO - 25)
    await measure(pg, 'xmn-platform')
    # 5. 回程：从车门上车、坐下 → D3311 开回广州东；途中拍 b（九龙江特大桥）
    await auto(pg, [[XO - 5.8, -126.2], [XO - 5.8, -127.3], [XO - 5.8, -128.6]])
    ok('reboard', await wait(pg, '__game.east.info().inside', 4))
    ok('seated2', await sit_row14(pg))
    ok('rideBack', await wait(pg, '!!__game.east.info().ride && __game.east.info().ride.dest === "gz"', 6))
    await wait(pg, '__game.east.info().ride.phase === "run"', 10)
    await until_rt(pg, 31)
    # b：坐到第 13 排靠窗 A 座（测试直接换座），第一人称看窗外的九龙江特大桥
    await pg.evaluate('__game.act()'); await asyncio.sleep(0.4)
    await pg.evaluate("(() => { const s = __game.east.interior.seats.find(q => q.row === 13 && q.letter === 'A'); __game.seats.sit({ id: 'hall', root: { position: { x: 0, y: 0, z: 0 } }, pax: [] }, s); })()")
    await view(pg, 'first'); await asyncio.sleep(0.5); await pg.evaluate('__game.player.yaw=Math.PI*1.12; __game.player.pitch=-0.1')
    e = await E(pg); ok('bridgeSeg', e['ride']['seg']['bridge'])
    await shot(pg, 'b-bridge', 1.5)
    await until_rt(pg, 60)
    await pg.evaluate('__game.east.setSpeed(10)')
    ok('arrivedGz', await wait(pg, '__game.east.info().count.arrived.length >= 2', 200))
    await pg.evaluate('__game.east.setSpeed(1)')
    await wait(pg, '__game.east.info().door <= 0', 4)
    await view(pg, 'third')
    await auto(pg, [[EO + 10.6, 0.25], [EO + 11.2, 0.9], [EO + 11.2, 1.6]])
    ok('backGz', await wait(pg, '!__game.east.info().inside && __game.east.info().loc === null', 4))
    s = await st(pg); R['gzPos'] = s['pos']; ok('gzPos', s['code'] == 'gzdz' and s['pos'][0] < 0 and s['pos'][2] > -128)
    await measure(pg, 'gz-platform-after')
    caps = await pg.evaluate('__caps'); R['captions'] = [c for c in caps if 'emu' in c]
    want = ['voice.emu.doors.zh', 'voice.emu.depart.xm.zh', 'voice.emu.bridge.zh', 'voice.emu.next.xm.zh', 'voice.emu.arrive.xm.zh', 'voice.emu.depart.gz.zh', 'voice.emu.arrive.gz.zh']
    it = iter(R['captions']); ok('announcements', all(any(c == w for c in it) for w in want))
    R['errors'] = errs(logs); R['gameSeconds'] = round(await gt(pg), 1)
    R['overBudget'] = [k for k, v in R['perf'].items() if v['draws'] > BUDGET['draws'] or v['tris'] > BUDGET['tris']]
    print(json.dumps(R, ensure_ascii=False, indent=1, default=str))
    good = all(R['checks'].values()) and not R['overBudget'] and not R['errors']
    print('XIAMEN', 'PASS' if good else 'FAIL', [k for k, v in R['checks'].items() if not v], flush=True)
    await b.close()
    if not good: sys.exit(1)
if __name__ == "__main__": asyncio.run(main())
