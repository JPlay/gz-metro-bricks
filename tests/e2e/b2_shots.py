# 第二批检查点截图（png + jpg）：4 号线站台（西门）、4 号线列车进站停站、4 号线车厢里、东街口 1→4 号线换乘楼梯、福州线网图（4 号线 + 景点图标）。
# 只为截图（会用 call() 叫车、spawn 摆机位）；真坐车的断言在 fz_ride.py。用法：python tests/e2e/b2_shots.py BASE OUTDIR
import asyncio, sys, json, os
sys.path.insert(0, os.path.dirname(__file__))
from common import *
from journey import GCLOCK, auto, wait, log
from perfhud import perf
BASE = sys.argv[1]; OUT = sys.argv[2].rstrip('/') + '/'
FO = 5000; R = {'perf': {}}
async def view(pg, v):
    if await pg.evaluate('__game.player.view') != v: await pg.evaluate('__game.toggleView()')
async def shot(pg, name, settle=1.5):
    await asyncio.sleep(settle); d = await perf(pg, 4, 0.25); R['perf'][name] = d; log('perf', name, d)
    if await safe_shot(pg, path=OUT + name + '.png', timeout=180000):
        from PIL import Image; Image.open(OUT + name + '.png').convert('RGB').save(OUT + name + '.jpg', quality=88)
async def main():
  os.makedirs(OUT, exist_ok=True)
  async with async_playwright() as p:
    b, pg, logs = await open_game(p, BASE + '?q=1')
    await pg.evaluate(GCLOCK); await pg.evaluate('__game.setDtMax(0.25)'); await asyncio.sleep(1)
    await pg.evaluate("""(() => { const g=__game; g.east.ensure(); g.east.side='fz'; g.east.cur={st:g.station, loc:'fzmetro', area:'metro'}; g.station.kit.root.setEnabled(false); g.fzMetro.enterFromRailway(g.player); })()""")
    await asyncio.sleep(1.5)
    if len(sys.argv) > 3 and sys.argv[3] == 'map':   # 只拍线网图 + 点景点图标看卡片
        g2 = await pg.evaluate("(() => { const m=__game.fzMetro; m.buildStation('fzdjk'); return m.station.platforms.map(P=>({y:P.y, zc:P.zc})); })()")
        await pg.evaluate(f"__game.player.spawn({FO + 22.5}, {g2[0]['y'] + 0.05}, {g2[0]['zc'] - 1.0}, -Math.PI/2)"); await asyncio.sleep(2)
        log('logs', len(logs), [str(x)[:200] for x in logs[:5]])
        R['perfNoMap'] = await perf(pg, 3, 0.25); log('perf platform (map closed)', R['perfNoMap'])
        await pg.evaluate('__game.openMap()')
        # 等打开动画（nmIn 淡入）真正播完再拍：headless 1–2 fps 时 1.5 秒内动画可能还停在半透明
        R['mapAnim'] = await pg.evaluate("(async () => { await Promise.all(document.getAnimations().filter(a => a.animationName === 'nmIn').map(a => a.finished)); await new Promise(r => setTimeout(r, 300)); return getComputedStyle(document.querySelector('#netmap')).opacity; })()")
        log('map opacity after nmIn', R['mapAnim']); await shot(pg, 'fz-netmap-l4', 1.5)
        R['mapSub'] = await pg.evaluate("document.querySelector('#netmap .ttl small').textContent")
        c = await pg.evaluate("(()=>{const r=document.querySelector('#netmap g.attr[data-attr=fz-fzdjk] circle').getBoundingClientRect(); return [r.x+r.width/2, r.y+r.height/2];})()")
        await pg.mouse.click(c[0], c[1]); await asyncio.sleep(0.8); R['card'] = await pg.evaluate('__game.state().attrCard')
        await shot(pg, 'fz-netmap-card', 0.5); await pg.evaluate('__game.closeMap()')
        R['errors'] = errs(logs); await b.close(); print(json.dumps(R, ensure_ascii=False, default=str)); print('B2_SHOTS DONE', len(R['errors']), 'errors'); return
    # 西门站 4 号线站台
    g = await pg.evaluate("""(() => { const m=__game.fzMetro, st=m.buildStation('fzxm'); const s=m.slots.find(o=>o.line===4&&o.step===-1); return {trackZ:s.side.trackZ, zc:s.P.zc, y:s.P.y}; })()""")
    sg = 1 if g['zc'] > g['trackZ'] else -1; R['geo'] = g
    await pg.evaluate(f"__game.player.spawn({FO - 14}, {g['y'] + 0.05}, {g['trackZ'] + sg * 3.2}, Math.PI/2)")
    await view(pg, 'first'); await pg.evaluate('__game.player.pitch=0.02'); await shot(pg, 'fz-l4-platform')
    CAR = len(sys.argv) > 3 and sys.argv[3] == 'car'
    await pg.evaluate('__game.call(4,-1)')
    if CAR:   # 车厢：站在车门口等（人在门口车门不关），开门后走进去
        await pg.evaluate(f"__game.player.spawn({FO}, {g['y'] + 0.05}, {g['trackZ'] + sg * 2.0}, 0)")
    await wait(pg, "['opening','dwell'].includes((__game.fzMetro.slots.find(o=>o.line===4&&o.step===-1)||{}).state)", 60)
    if not CAR:
        await pg.evaluate(f"__game.player.spawn({FO - 12}, {g['y'] + 0.05}, {g['trackZ'] + sg * 4.5}, Math.PI/2 + {sg} * 0.35); __game.player.pitch=0.02")
        await shot(pg, 'fz-l4-train', 1.0)
    else:
        await auto(pg, [[FO, g['trackZ'] + sg * 0.3], [FO - 4, g['trackZ']]])
        await pg.evaluate('__game.player.yaw=-Math.PI/2; __game.player.pitch=0.03'); await shot(pg, 'fz-l4-car', 1.0)
    R['aboard'] = await pg.evaluate('__game.state().aboard')
    if CAR: R['errors'] = errs(logs); await b.close(); print(json.dumps(R, ensure_ascii=False, default=str)); return
    # 东街口：1 号线站台往下看 4 号线换乘楼梯
    g2 = await pg.evaluate("""(() => { const m=__game.fzMetro; m.buildStation('fzdjk'); return m.station.platforms.map(P=>({line:P.line, y:P.y, zc:P.zc})); })()""")
    R['djk'] = g2
    await pg.evaluate(f"__game.player.spawn({FO + 22.5}, {g2[0]['y'] + 0.05}, {g2[0]['zc'] - 1.0}, -Math.PI/2); __game.player.pitch=0.25")
    await shot(pg, 'fz-djk-transfer')
    # 线网图
    await pg.evaluate('__game.openMap()'); await shot(pg, 'fz-netmap-l4', 1.5); await pg.evaluate('__game.closeMap()')
    R['errors'] = errs(logs); await b.close()
  print(json.dumps(R, ensure_ascii=False, indent=1, default=str)); print('B2_SHOTS DONE', len(R['errors']), 'errors')
if __name__ == "__main__": asyncio.run(main())
