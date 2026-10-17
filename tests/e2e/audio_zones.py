# 声音分区 + 脚步声检查（读音频图里的实际增益）
#   python tests/e2e/audio_zones.py [base-url]
# 1) 越秀公园站台：地铁总闸 ≈1、站台环境床 >0、没有街面车流；列车声跟着列车远近变（trainNear）
# 2) 站着不动没有脚步；走起来有脚步（站内 = tile）；顶着墙走（被挡住）没有脚步
# 3) 沿 B1 出口楼梯往上走：中途地铁声渐弱（0.15 < metro < 0.85），到街面地铁声 ≈0、车流 >0、脚步 = stone
# 4) 酒店里：地铁 ≈0、所有环境床 ≈0（安静），脚步 = carpet
# 5) 饭店里：地铁 ≈0、饭店嘈杂床 >0，脚步 = carpet
import asyncio, sys, json, os, time
sys.path.insert(0, os.path.dirname(__file__))
from common import *
from journey import GCLOCK, gt, auto, wait, log
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8123/'
R = {}
A = '__game.state().audio'
async def au(pg): return await pg.evaluate(A)
def bed(a, k): return (a['gains']['beds'] or {}).get(k, 0)
def beds_max(a): return max([0] + list((a['gains']['beds'] or {}).values()))
async def steps(pg): return (await au(pg))['steps']['count']
async def gsleep(pg, sec, wall=120):
    """按游戏时间等（无头渲染很慢时墙钟 2.5 秒可能只有 0.5 秒游戏时间，脚步就少了）"""
    g0 = await gt(pg); t0 = time.time()
    while await gt(pg) - g0 < sec and time.time() - t0 < wall: await asyncio.sleep(0.2)
async def walk(pg, x, y, sec):
    await pg.evaluate(f'__game.setMove({x},{y})'); await gsleep(pg, sec); await pg.evaluate('__game.setMove(0,0)')
async def settle(pg, sec=2.0): await asyncio.sleep(sec)   # 音频淡变是墙钟时间（时间常数 0.3s）
async def unlock(pg):
    await pg.keyboard.press('F9'); await asyncio.sleep(0.6)   # 任意按键 = 用户手势（不点画面，免得触发游戏里的点击操作）
REC = """window.__rec = []; window.__recOn = false; __game.scene.onBeforeRenderObservable.add(() => { if (!window.__recOn) return;
  const a = __game.Audio.getState(), p = __game.player.position;
  window.__rec.push([+p.y.toFixed(2), a.gains ? a.gains.metro : null, a.env.metro, a.env.street, a.train.speed, a.train.near, a.steps.count, +p.x.toFixed(2), +p.z.toFixed(2)]); });"""
async def rec(pg, on):
    if on: await pg.evaluate('window.__rec = []; window.__recOn = true')
    else: return await pg.evaluate('window.__recOn = false; window.__rec')
def snap(a): return dict(env=a['env'], gains=a['gains'], steps=a['steps']['last'], context=a['context'])

async def main():
  async with async_playwright() as p:
    ok = True
    # ---------- 越秀公园：站台 → 楼梯 → 街面 ----------
    b, pg, logs = await open_game(p, BASE + '?q=1&start=yxgy&line=2')
    await pg.evaluate(GCLOCK); await pg.evaluate(REC); await pg.evaluate('__game.setDtMax(0.25)'); await unlock(pg); await asyncio.sleep(1.0)
    await pg.evaluate('__game.teleport(18.6,-11.95,12.6,0)'); await settle(pg, 2.5)
    a = await au(pg); R['platform'] = snap(a)
    c1 = ok1 = a['context'] == 'running' and a['gains']['metro'] > 0.9 and bed(a, 'platform') > 0.3 and bed(a, 'street') < 0.02
    ok &= c1
    # 列车声跟着列车：站台上等一列车进站 / 出站，记 trainNear 的变化
    await rec(pg, True); await asyncio.sleep(45); tr = await rec(pg, False)
    near = [t[5] for t in tr if t[4] > 0.02]
    R['trainNear'] = dict(frames=len(tr), moving=len(near), min=min(near) if near else None, max=max(near) if near else None)
    ok &= len(near) > 5 and max(near) - min(near) > 0.3 and max(near) > 0.5
    # 脚步：站着不动 / 走 / 顶墙
    n0 = await steps(pg); await gsleep(pg, 2.0); R['stillSteps'] = await steps(pg) - n0
    n0 = await steps(pg); await walk(pg, 0, 1, 2.5); R['walkSteps'] = await steps(pg) - n0; R['walkSurface'] = (await au(pg))['steps']['last']
    await pg.evaluate('__game.teleport(18.6,-11.95,12.6,0)'); await asyncio.sleep(0.5)
    await pg.evaluate('__game.setMove(0,1)'); await asyncio.sleep(6)       # 往 +z 一直走，直到顶到站台边的屏蔽门 / 墙
    await rec(pg, True); await asyncio.sleep(2.5); tb = await rec(pg, False); await pg.evaluate('__game.setMove(0,0)')
    moved = ((tb[-1][7] - tb[0][7]) ** 2 + (tb[-1][8] - tb[0][8]) ** 2) ** 0.5 if len(tb) > 1 else 0; nb = tb[-1][6] - tb[0][6] if tb else 0
    R['blocked'] = dict(pos=tb[-1][7:] if tb else None, frames=len(tb), moved=round(moved, 2), steps=nb)
    ok &= R['stillSteps'] == 0 and R['walkSteps'] >= 2 and R['walkSurface']['surface'] == 'tile' and (moved > 0.3 * 2.5 or nb == 0)
    # 上出口：站台 → 站厅 → B1 通道 → 楼梯 → 街面，一路记 y 和地铁增益
    await pg.evaluate('__game.teleport(18.6,-11.95,12.6,0)'); await asyncio.sleep(0.8)
    await auto(pg, [[18.6, 13.1], [15.4, 13.1], [-1.6, 13.1], [-2.2, 13.1], [-2.2, 1.4], [2, 1.4], [2, -4.6], [8.6, -4.6]])
    R['toExit'] = await auto(pg, [[10.5, -4.6], [10.5, -15.6], [1.2, -15.6], [1.2, -20]])
    await rec(pg, True)
    for k in range(3):   # 偶尔被行人挡住：从当前位置接着走
        if await auto(pg, [[1.2, -36], [1.2, -40.5]]): break
        await auto(pg, [[1.2, (await st(pg))['pos'][2]]])
    trace = await rec(pg, False)
    R['stairs'] = trace[::max(1, len(trace) // 30)]
    mid = [t for t in trace if -5 < t[0] < -0.6 and t[1] is not None and 0.15 < t[1] < 0.85]
    R['stairsMid'] = mid[:4]; ok &= len(mid) > 0
    await settle(pg, 2.0); a = await au(pg); R['street'] = snap(a)
    n0 = await steps(pg); await walk(pg, 0, 1, 1.5); R['streetSurface'] = (await au(pg))['steps']['last']
    ok &= a['gains']['metro'] < 0.02 and a['gains']['pa'] < 0.02 and a['gains']['sfx'] < 0.02 and bed(a, 'platform') < 0.02 and bed(a, 'concourse') < 0.02 and bed(a, 'street') > 0.2 and R['streetSurface']['surface'] == 'stone'
    R['errors1'] = errs(logs); ok &= not R['errors1']
    await b.close()
    # ---------- 酒店 + 饭店（默认起点站有饭店） ----------
    b, pg, logs = await open_game(p, BASE + '?q=1&char=mingming')
    await pg.evaluate(GCLOCK); await pg.evaluate(REC); await pg.evaluate('__game.setDtMax(0.25)'); await unlock(pg); await asyncio.sleep(1.0)
    await pg.evaluate('__game.hotel.enter(__game.station)'); await settle(pg, 2.5)
    a = await au(pg); s = await st(pg); R['hotel'] = dict(snap(a), zone=s['zone'], inside=s['hotel']['inside'])
    n0 = await steps(pg); await walk(pg, 0, 1, 2.0); R['hotelSteps'] = await steps(pg) - n0; R['hotelSurface'] = (await au(pg))['steps']['last'] or {}
    ok &= s['hotel']['inside'] and a['gains']['metro'] < 0.02 and beds_max(a) < 0.02 and R['hotelSurface'].get('surface') == 'carpet'
    await pg.evaluate('__game.hotel.exit()'); await asyncio.sleep(1.5)
    F = '__game.brother.food'
    shops = (await pg.evaluate(F + '.info()'))['shops']; R['shop'] = shops[0]['id'] if shops else None
    if shops:
        sh = shops[0]; x, z = sh['out']
        await pg.evaluate(f"__game.teleport({x},0.05,{z},{sh['yawIn']}); __game.player.yaw={sh['yawIn']}"); await asyncio.sleep(1.0)
        await pg.evaluate('__game.setMove(0,0.8)'); await wait(pg, F + '.info().inside !== null', 120); await pg.evaluate('__game.setMove(0,0)')
        await settle(pg, 2.5); a = await au(pg); R['restaurant'] = snap(a)
        await walk(pg, 0, 0.8, 1.2); R['restSurface'] = (await au(pg))['steps']['last'] or {}
        ok &= a['gains']['metro'] < 0.02 and bed(a, 'restaurant') > 0.2 and bed(a, 'street') < 0.02 and R['restSurface'].get('surface') == 'carpet'
    else: ok = False
    R['errors2'] = errs(logs); ok &= not R['errors2']
    await b.close()
    print(json.dumps(R, ensure_ascii=False, indent=1, default=str))
    print('AUDIO_ZONES', 'PASS' if ok else 'FAIL', flush=True)
    if not ok: sys.exit(1)
if __name__ == "__main__": asyncio.run(main())
