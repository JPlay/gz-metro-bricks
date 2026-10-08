# 第 4 轮验收截图：天空（街上抬头约 45°）、脚印（平地 + 楼梯，靠近镜头）、站口 01、玩家头部特写（检查头顶无红点）。
#   python3 tests/e2e/r4_shots.py <base-url> <输出目录> [q]
# 加载画面另用 tests/e2e/loading_shots.py。软件渲染下单帧很慢，截图超时放宽到 180 秒。
import asyncio, sys, os, json
sys.path.insert(0, os.path.dirname(__file__))
from common import *
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8123/'
OUT = (sys.argv[2] if len(sys.argv) > 2 else '/workspace/gz-shots-polish/live-r4/').rstrip('/') + '/'
Q = sys.argv[3] if len(sys.argv) > 3 else '1'
ONLY = set(sys.argv[4].split(',')) if len(sys.argv) > 4 else None
os.makedirs(OUT, exist_ok=True)
R = {}
async def view(pg, v):
    if await pg.evaluate('__game.player.view') != v: await pg.evaluate('__game.toggleView()')
async def pose(pg, x, y, z, yaw, pitch, v, settle=1.2, dist=4.2):
    await view(pg, v)
    await pg.evaluate(f'__game.teleport({x},{y},{z},{yaw}); __game.player.pitch={pitch}; __game.player.dist={dist}')
    await asyncio.sleep(settle)
async def shot(pg, name):
    await pg.screenshot(path=OUT + name + '.png', timeout=180000)
    s = await st(pg); R[name] = {'pos': s['pos'], 'yaw': s['yaw'], 'pitch': s['pitch'], 'view': s['view'], 'camPos': s['camPos'], 'footCount': s['footCount'], 'footSnap': s.get('footSnap')}
    print(name, json.dumps(R[name]), flush=True)
def want(k): return ONLY is None or k in ONLY
async def walk(pg, pts):
    r = await pg.evaluate(f'__game.autopilot({json.dumps(pts)}, false)'); return r['ok']
async def main():
  async with async_playwright() as p:
    b, pg, logs = await open_game(p, BASE + '?q=' + Q)
    await asyncio.sleep(2.5)
    if want('street'):
        await pose(pg, 0, 0.05, -49, 0, 0.12, 'third', 1.5); await shot(pg, '01-street-entrance')
    if want('head'):
        # 头部特写：第三人称拉近、略俯视看帽顶；再转过身看正脸
        await pose(pg, 0, 0.05, -49, 0, 0.5, 'third', 1.5, 1.8); await shot(pg, 'head-closeup-top')
        await pose(pg, 0, 0.05, -49, 0, 0.1, 'third', 0.5, 1.8); await pg.evaluate('__game.player.facing=Math.PI'); await asyncio.sleep(1.0); await shot(pg, 'head-closeup-front')
        await pose(pg, 0, 0.05, -49, 0, 0.12, 'first', 1.0); await shot(pg, 'head-firstperson')
        # 头顶上方有没有“脱离”的小块：取玩家网格顶部 25cm 内的顶点高度，看有没有 >2cm 的断层
        R['headGap'] = await pg.evaluate('''(()=>{const m=__game.player.person.mesh; const pos=m.getVerticesData(BABYLON.VertexBuffer.PositionKind); const ys=[]; for(let i=1;i<pos.length;i+=3) ys.push(pos[i]); ys.sort((a,b)=>b-a); const top=ys[0]; let gap=0; for(let i=1;i<ys.length && ys[i]>top-0.25;i++) gap=Math.max(gap, ys[i-1]-ys[i]); return {top:+top.toFixed(3), maxGap:+gap.toFixed(3)};})()''')
        print('headGap', R['headGap'], flush=True)
    if want('sky'):
        await pose(pg, 0, 0.05, -49, 0.6, -0.785, 'first', 1.5); await shot(pg, 'sky-street-look-up-45')
        await pose(pg, 0, 0.05, -49, 2.6, -0.25, 'first', 1.5); await shot(pg, 'sky-street-horizon')
        await pose(pg, 0, 0.05, -49, 0.6, -0.35, 'third', 1.5); await shot(pg, 'sky-street-third-person-up')
    if want('feet'):
        if not (await st(pg))['foot']: await pg.evaluate('__game.toggleFoot()')
        # 平地：从出生点往站口走 4.5m，镜头在身后，脚印就在镜头前下方
        await pose(pg, 0, 0.05, -49, 0, 0.12, 'third', 0.5)
        await walk(pg, [[0, -44.5]]); await asyncio.sleep(0.3); await shot(pg, 'feet-flat-near-camera')
        # 镜头拉近、压低（最容易糊成一大片的情况）
        await pg.evaluate('__game.player.dist=1.8; __game.player.pitch=0.4'); await asyncio.sleep(1.0); await shot(pg, 'feet-flat-camera-close')
        # 转身看刚走过的脚印
        await pg.evaluate('__game.player.yaw=Math.PI; __game.player.pitch=0.35; __game.player.dist=4.2'); await asyncio.sleep(1.2); await shot(pg, 'feet-flat-look-back')
        # 楼梯：站厅 → 站台楼梯（x 从 -1 往 15 下行，z 12.2–15.8）
        await pg.evaluate('__game.toggleFoot(); __game.toggleFoot()')
        # 走楼梯左半边（z=13.2），避开 z=14 的中间扶手，脚印不被扶手挡住
        await pose(pg, -3.5, -5.95, 13.2, 1.5708, 0.3, 'third', 0.5)
        await walk(pg, [[2, 13.2], [6.5, 13.2]]); await asyncio.sleep(0.3); await shot(pg, 'feet-stairs-walking-down')
        # 侧后方高处往回看：看脚印是不是一级一级贴在踏步面上
        await pg.evaluate('__game.player.yaw=-2.2; __game.player.pitch=0.55; __game.player.dist=4.5'); await asyncio.sleep(1.2); await shot(pg, 'feet-stairs-look-back')
        R['feetY'] = await pg.evaluate('__game.scene.meshes.filter(m=>/^fp/.test(m.name)&&m.isEnabled()).map(m=>[+m.position.x.toFixed(2),+m.position.y.toFixed(3),+m.position.z.toFixed(2)])')
        print('feetY', R['feetY'], flush=True)
    R['errors'] = errs(logs)
    json.dump(R, open(OUT + 'r4_shots.json', 'w'), ensure_ascii=False, indent=1)
    print('errors', R['errors'])
    await b.close()
asyncio.run(main())
