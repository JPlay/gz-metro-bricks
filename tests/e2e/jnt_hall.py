# 中山纪念堂室内（小美第二轮走查的两条）：
# 1. 舞台两侧踏步：从观众区走上东侧踏步 → 站到「天下为公」匾下面（舞台面 y≈1.1）→ 从西侧踏步走下来回到地面（真碰撞，autopilot 走）
# 2. 到达卡只弹一次：台阶前第一次到达弹卡（关掉）→ 进门 → 上二楼楼座：没有卡 → 下楼出门、再走过台阶前到达区：不弹卡
#    → 第二次进门上楼座：仍然没有卡
# 另外每个机位记录绘制调用 / 三角形（面数），预算 90k 面 / 50 次绘制。
# 用法：python tests/e2e/jnt_hall.py [base-url]
import asyncio, sys, json, os, math
from PIL import Image
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
    await safe_shot(pg, path=SHOTS + name + '.jpg', type='jpeg', quality=60, timeout=180000)
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

# 舞台 3P 镜头区：三个坏点 × yaw 0..2π/8 + 匾下横走；每帧主角可见、红幕占比 ≤ 30%
STAGE_SPOTS = [
    ('E_top', 602.9, 1.1, 9.81),
    ('W_top', 597.1, 1.1, 9.8),
    ('oldbad', 597.03, 0.05, 6.72),
]
STAGE_YAWS = [i * math.pi / 4 for i in range(8)]
async def red_frac(pg, path):
    await safe_shot(pg, path=path, type='jpeg', quality=70, timeout=180000)
    im = Image.open(path).convert('RGB').resize((64, 40))
    px = list(im.getdata())
    return sum(1 for (R, G, B) in px if R > 120 and G < 70 and B < 70) / len(px)
async def stage_cam_audit(pg):
    if await pg.evaluate('__game.player.view') != 'third':
        await pg.evaluate('__game.toggleView()')
    for name, x, y, z in STAGE_SPOTS:
        for i, yaw in enumerate(STAGE_YAWS):
            await pg.evaluate(f'__game.teleport({x},{y},{z},{yaw}); __game.player.pitch=-0.1; __game.player._stageCamK=1')
            await asyncio.sleep(1.0)
            info = await pg.evaluate('(()=>{const pl=__game.player,c=pl.cam;return{en:pl.model.isEnabled(),fade:+(pl._heroFade??1).toFixed(3),k:+(pl._stageCamK||0).toFixed(3),pos:[+pl.position.x.toFixed(2),+pl.position.y.toFixed(2),+pl.position.z.toFixed(2)],cam:[+c.position.x.toFixed(2),+c.position.y.toFixed(2),+c.position.z.toFixed(2)],yaw:+pl.yaw.toFixed(3),aimYaw:pl.aimYaw,camRotY:+c.rotation.y.toFixed(3)}})()')
            vis = info['en'] and info['fade'] > 0.5
            rf = await red_frac(pg, SHOTS + f'stageCam_{name}_y{i}.jpg')
            ok(f'stageCam:{name}:yaw{i}:hero', vis, info)
            ok(f'stageCam:{name}:yaw{i}:red', rf <= 0.30, {'redFrac': round(rf, 3), **info})
            # 镜头 yaw 必须跟玩家 yaw（不许 aimYaw 翻转）
            dyaw = abs((info['camRotY'] - info['yaw'] + math.pi) % (2*math.pi) - math.pi)
            ok(f'stageCam:{name}:yaw{i}:noFlip', info.get('aimYaw') is None and dyaw < 0.15, {'dyaw': round(dyaw, 3), **info})
    # 匾下东→西横走：每帧主角不得被藏；若干采样点红幕 ≤ 30%
    await pg.evaluate("""(()=>{
      if (window.__scObs) { __game.scene.onAfterRenderObservable.remove(window.__scObs); window.__scObs=null; }
      const H=window.__scH={n:0,hid:0};
      window.__scObs=__game.scene.onAfterRenderObservable.add(()=>{
        const pl=__game.player; if (pl.view!=='third') return;
        H.n++; if (!pl.model.isEnabled() || (pl._heroFade??1)<0.5) H.hid++;
      });
    })()""")
    await pg.evaluate('__game.teleport(602.9,1.1,9.7,Math.PI); __game.player.pitch=-0.1; __game.player._stageCamK=1; __game.player.vy=0; __game.player.grounded=true')
    await asyncio.sleep(0.8)
    # yaw=π 时 stick 右 = 世界 −x；用摇杆横走，避免 autopilot 在台上大步长穿地
    await pg.evaluate('__game.setMove(1, 0)')
    walked = False
    for _ in range(50):
        spos = await st(pg)
        if spos['pos'][1] < 0.5:  # 掉下舞台则失败
            break
        if spos['pos'][0] <= 597.25:
            walked = True; break
        await asyncio.sleep(0.2)
    await pg.evaluate('__game.setMove(0, 0)')
    hid = await pg.evaluate('(()=>{const H=window.__scH||{n:0,hid:0}; if(window.__scObs){__game.scene.onAfterRenderObservable.remove(window.__scObs);window.__scObs=null;} return H;})()')
    ok('stageCam:plaqueWalk:reached', walked, {'walked': walked, 'pos': (await st(pg))['pos'], **hid})
    ok('stageCam:plaqueWalk:heroVisible', hid.get('n', 0) > 0 and hid.get('hid', 1) == 0, hid)
    for tag, x in (('plaqueE', 602.5), ('plaqueM', 600.0), ('plaqueW', 597.5)):
        await pg.evaluate(f'__game.teleport({x},1.1,9.7,Math.PI); __game.player.pitch=-0.1; __game.player._stageCamK=1')
        await asyncio.sleep(0.8)
        info = await pg.evaluate('(()=>{const pl=__game.player;return{en:pl.model.isEnabled(),fade:+(pl._heroFade??1).toFixed(3),cam:[+pl.cam.position.x.toFixed(2),+pl.cam.position.y.toFixed(2),+pl.cam.position.z.toFixed(2)]}})()')
        rf = await red_frac(pg, SHOTS + f'stageCam_{tag}.jpg')
        ok(f'stageCam:{tag}:hero', info['en'] and info['fade'] > 0.5, info)
        ok(f'stageCam:{tag}:red', rf <= 0.30, {'redFrac': round(rf, 3), **info})

async def stick_dirs_audit(pg):
    """摇杆四向：舞台区内外世界位移同号；镜头 yaw = 玩家 yaw（无 180° 倒向）。"""
    if await pg.evaluate('__game.player.view') != 'third':
        await pg.evaluate('__game.toggleView()')
    dirs = [('up', 0, 1), ('down', 0, -1), ('right', 1, 0), ('left', -1, 0)]
    async def measure(x, y, z, yaw, tag):
        out = {}
        for name, mx, my in dirs:
            await pg.evaluate(f'__game.teleport({x},{y},{z},{yaw}); __game.player.vel.set(0,0,0); __game.player.pitch=-0.1; __game.setMove(0,0)')
            await asyncio.sleep(0.35)
            p0 = await pg.evaluate('[+__game.player.position.x, +__game.player.position.z, +__game.player.yaw, +__game.player.cam.rotation.y, __game.player.aimYaw]')
            await pg.evaluate(f'__game.setMove({mx},{my})')
            await asyncio.sleep(0.7)
            await pg.evaluate('__game.setMove(0,0)')
            p1 = await pg.evaluate('[+__game.player.position.x, +__game.player.position.z]')
            out[name] = {'dx': p1[0]-p0[0], 'dz': p1[1]-p0[1], 'yaw0': p0[2], 'camY0': p0[3], 'aimYaw': p0[4]}
            log('stick', tag, name, out[name])
        return out
    # 区外过道（面对 +z）
    base = await measure(600, 0.05, 0, 0, 'aisle')
    # 舞台踏步顶（同 yaw=0，面对舞台深处）
    stage = await measure(602.9, 1.1, 9.81, 0, 'E_top')
    for name, _, _ in dirs:
        b, s_ = base[name], stage[name]
        # 世界位移主轴同号（允许被墙挡住幅度变小，但不能反向）
        same_x = abs(b['dx']) < 0.05 or abs(s_['dx']) < 0.05 or (b['dx'] * s_['dx'] > 0)
        same_z = abs(b['dz']) < 0.05 or abs(s_['dz']) < 0.05 or (b['dz'] * s_['dz'] > 0)
        # 至少有一个主分量明显动了且同号
        moved = abs(s_['dx']) + abs(s_['dz']) > 0.15
        ok(f'stick:{name}:sameWorldDir', same_x and same_z and moved, {'aisle': b, 'stage': s_})
        dy = abs((s_['camY0'] - s_['yaw0'] + math.pi) % (2*math.pi) - math.pi)
        ok(f'stick:{name}:camFollowsYaw', s_['aimYaw'] is None and dy < 0.15, {'dyaw': round(dy, 3), **s_})
    # 进出区过渡：从脚下走向踏步顶，cam.rotation.y 与 player.yaw 差不能突然跳 > 0.5
    await pg.evaluate('__game.teleport(602.9,0.05,6.4,0); __game.player.pitch=-0.1; __game.setMove(0,0)')
    await asyncio.sleep(0.4)
    await pg.evaluate("""(()=>{
      if (window.__scYawObs) { __game.scene.onAfterRenderObservable.remove(window.__scYawObs); }
      const H=window.__scYaw={n:0,maxJump:0,last:null};
      window.__scYawObs=__game.scene.onAfterRenderObservable.add(()=>{
        const pl=__game.player; if (pl.view!=='third') return;
        const d=pl.cam.rotation.y - pl.yaw; const dd=Math.atan2(Math.sin(d),Math.cos(d));
        if (H.last!==null) { const j=Math.abs(dd-H.last); if (j>H.maxJump) H.maxJump=j; }
        H.last=dd; H.n++;
      });
    })()""")
    await walk(pg, [[602.9, 8.2], [602.9, 9.7]])
    yinfo = await pg.evaluate('(()=>{const H=window.__scYaw||{n:0,maxJump:0}; if(window.__scYawObs){__game.scene.onAfterRenderObservable.remove(window.__scYawObs);window.__scYawObs=null;} return {n:H.n,maxJump:+(H.maxJump||0).toFixed(3)};})()')
    log('yawJump', yinfo)
    ok('stick:enterExit:noYawJump', yinfo.get('n', 0) > 5 and yinfo.get('maxJump', 99) < 0.5, yinfo)
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
            await stage_cam_audit(pg)
            await stick_dirs_audit(pg)
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
