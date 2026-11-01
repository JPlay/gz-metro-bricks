# 第三批检查点截图（png + jpg）+ 预算：2 / 6 号线、滨海快线（F1）站台（两趟车同时在站 = 最坏情况）+ 车厢里；
# 帝封江三层站（4 / 5 / F1 六趟车同时在站，每层都量）+ 换乘楼梯；福州全网线网图（打开动画播完后拍）+ 标签重叠检查。
# 只为截图（用 call() 叫车、车停稳后把游戏时间冻住、spawn 摆机位）；真坐车的断言在 fz_ride.py。
# 用法：python tests/e2e/b3_shots.py BASE OUTDIR
import asyncio, sys, json, os
sys.path.insert(0, os.path.dirname(__file__))
from common import *
from journey import GCLOCK, auto, wait, log
from perfhud import perf, overlay, overlay_off
BASE = sys.argv[1]; OUT = sys.argv[2].rstrip('/') + '/'; PARTS = (sys.argv[3] if len(sys.argv) > 3 else 'lines,dfj,map').split(',')
FO = 5000; R = {'perf': {}, 'scene': {}, 'checks': {}}
BUDGET = {'draws': 50, 'tris': 90000}
def ok(k, v): R['checks'][k] = bool(v); log('check', k, bool(v)); return v
SCENE_TRIS = "() => __game.scene.meshes.filter(m => m.isEnabled() && m.isVisible && m.getTotalIndices).reduce((t, m) => t + m.getTotalIndices() / 3 * (m.instances ? 1 + m.instances.length : 1), 0)"
async def view(pg, v):
    if await pg.evaluate('__game.player.view') != v: await pg.evaluate('__game.toggleView()')
async def shot(pg, name, settle=1.5, budget=True):
    await asyncio.sleep(settle); d = await perf(pg, 4, 0.25); R['perf'][name] = d; log('perf', name, d)
    if budget: ok(name + ':budget', d['draws'] <= BUDGET['draws'] and d['tris'] <= BUDGET['tris'])
    await overlay(pg, d, name); await pg.screenshot(path=OUT + name + '.png', timeout=180000); await overlay_off(pg)
    from PIL import Image; Image.open(OUT + name + '.png').convert('RGB').save(OUT + name + '.jpg', quality=88)
    return d
async def trains_in(pg, code, lines):
    """建站，叫 lines 上两个方向的车，等全部开门停稳后冻结游戏时间"""
    await pg.evaluate('__game.setDtMax(0.25)')
    g = await pg.evaluate(f"""(() => {{ const m=__game.fzMetro; m.buildStation('{code}'); m.slots.forEach(s => {{ s.state='away'; s.t=999; s.train.setVisible(false); }});
      return m.slots.map(s => ({{line:s.line, step:s.step, trackZ:s.side.trackZ, zc:s.P.zc, y:s.P.y}})); }})()""")
    await pg.evaluate(f"__game.player.spawn({FO - 30}, {g[0]['y'] + 0.05}, {g[0]['zc']}, Math.PI/2)")
    want = json.dumps(lines)
    # 不用 call()：终点站（帝封江是 4 号线终点）两侧同一个方向，call(line, step) 只叫得到其中一侧
    await pg.evaluate(f"__game.fzMetro.slots.forEach(o => {{ if ({want}.includes(o.line)) o.t = 0; }})")
    good = await wait(pg, f"__game.fzMetro.slots.filter(o => {want}.includes(o.line)).every(o => ['dwell'].includes(o.state))", 120)
    await pg.evaluate('__game.setDtMax(1e-6)')
    n = await pg.evaluate(f"__game.fzMetro.slots.filter(o => {want}.includes(o.line) && o.train.root.isEnabled() && o.state==='dwell').length")
    R.setdefault('slots', {})[code] = await pg.evaluate("__game.fzMetro.slots.map(o => [o.line, o.step, o.state, o.train.root.isEnabled()])")
    log('slots', code, R['slots'][code], 'good', good)
    return g, n
async def main():
  os.makedirs(OUT, exist_ok=True)
  async with async_playwright() as p:
    b, pg, logs = await open_game(p, BASE + '?q=1')
    await pg.evaluate(GCLOCK); await pg.evaluate('__game.setDtMax(0.25)'); await asyncio.sleep(1)
    await pg.evaluate("""(() => { const g=__game; g.east.ensure(); g.east.side='fz'; g.east.cur={st:g.station, loc:'fzmetro', area:'metro'}; g.station.kit.root.setEnabled(false); g.fzMetro.enterFromRailway(g.player); })()""")
    await asyncio.sleep(1.5)
    # —— 2 / 6 / F1：站台（两趟车在站）+ 车厢 ——
    for line, code, tag in [] if 'lines' not in PARTS else [(2, 'fzgs', 'l2'), (6, 'fzhc', 'l6'), (20, 'fzxq', 'f1')]:
      log('=== line', line, code)
      g, n = await trains_in(pg, code, [line]); ok(f'{tag}:twoTrains', n == len([x for x in g if x['line'] == line]) >= 2)
      s = [x for x in g if x['line'] == line][0]; sg = 1 if s['zc'] > s['trackZ'] else -1
      await view(pg, 'first')
      await pg.evaluate(f"__game.player.spawn({FO - 22}, {s['y'] + 0.05}, {s['trackZ'] + sg * 3.4}, Math.PI/2 + {sg} * 0.2); __game.player.pitch=0.02")
      await shot(pg, f'fz-{tag}-platform')
      R['scene'][f'fz-{tag}-platform'] = await pg.evaluate(SCENE_TRIS)
      await pg.evaluate(f"__game.player.spawn({FO - 4}, {s['y'] + 0.25}, {s['trackZ'] + sg * 0.2}, -Math.PI/2); __game.player.pitch=0.03")
      await shot(pg, f'fz-{tag}-car')
    # —— 帝封江：三层，6 趟车同时在站 ——
    if 'dfj' in PARTS:
      log('=== fzdfj')
      g, n = await trains_in(pg, 'fzdfj', [4, 5, 20]); R['dfjDwell'] = await pg.evaluate("__game.fzMetro.slots.filter(o => o.state==='dwell').length"); ok('dfj:allDwell', R['dfjDwell'] == len(g)); R['dfj'] = g
      levels = sorted({(x['y'], x['line']) for x in g}, reverse=True)
      for y, line in levels:
        s = [x for x in g if x['line'] == line][0]; sg = 1 if s['zc'] > s['trackZ'] else -1
        await view(pg, 'first')
        await pg.evaluate(f"__game.player.spawn({FO + 20}, {y + 0.05}, {s['trackZ'] + sg * 3.4}, -Math.PI/2 - {sg} * 0.15); __game.player.pitch=0.02")
        await asyncio.sleep(3)   # 多层站只显示玩家所在层的车（xmService：|p.y - P.y| < 5）
        vis = await pg.evaluate(f"__game.fzMetro.slots.filter(o => o.line === {line} && o.train.root.isEnabled()).length")
        ok(f'dfj:L{line}:twoTrainsVisible', vis == len([x for x in g if x['line'] == line]) >= 2)
        R['scene'][f'fz-dfj-L{line}'] = await pg.evaluate(SCENE_TRIS)
        await shot(pg, f'fz-dfj-L{line}-platform')
        await pg.evaluate(f"__game.player.spawn({FO + 2}, {y + 0.05}, {s['zc']}, -Math.PI/2); __game.player.pitch=0.12")
        await shot(pg, f'fz-dfj-L{line}-transfer')
      await pg.evaluate('__game.setDtMax(0.25)')
    # —— 帝封江换乘吊牌（每层都拍：读得清、不反字）——
    if 'signs' in PARTS:
      await pg.evaluate('__game.setDtMax(0.25)')
      await pg.evaluate("(() => { const m=__game.fzMetro; m.buildStation('fzdfj'); m.slots.forEach(s => { s.state='away'; s.t=999; s.train.setVisible(false); }); })()")
      await asyncio.sleep(1.5); await view(pg, 'first')
      R['xferSigns'] = await pg.evaluate("__game.fzMetro.slots.length")
      # L4：从站厅下楼梯（楼梯上 x -10）往 +x 看：出站牌背面 + 洞口两头的换乘牌；L4b：从 +x 那头往回看
      # L5：站台西头往 +x 看（下 F1 的洞口 + 4 号线楼梯脚），L5b 从东头往回看；L20（F1）：西头往 +x 看楼梯脚，L20b 东头往回看楼梯高端外侧
      for name, x, y, z, yaw, pitch in [('fz-dfj-signs-L4', -12, -10.6, 0.6, 'Math.PI/2', -0.02), ('fz-dfj-signs-L4b', 28, -12.95, 3.2, '-Math.PI/2 - 0.12', 0.06),
                                        ('fz-dfj-signs-L5', -25.2, -21.95, 3.6, 'Math.PI/2 + 0.5', 0.1), ('fz-dfj-signs-L5b', 26, -21.95, 4.8, '-Math.PI/2 - 0.16', 0.07),
                                        ('fz-dfj-signs-L20', -25.2, -30.95, 3.6, 'Math.PI/2 + 0.5', 0.1), ('fz-dfj-signs-L20b', 14, -30.95, 3.6, '-Math.PI/2 - 0.22', 0.07)]:
        await pg.evaluate(f"__game.player.spawn({FO} + {x}, {y}, {z}, {yaw}); __game.player.pitch={pitch}")
        await pg.evaluate('__game.setDtMax(1e-6)')
        R['scene'][name] = await pg.evaluate(SCENE_TRIS)
        await shot(pg, name)
        await pg.evaluate('__game.setDtMax(0.25)')
    if 'map' in PARTS:
      await pg.evaluate("(() => { const m=__game.fzMetro; m.buildStation('fzdjk'); m.slots.forEach(s => { s.state='away'; s.t=999; s.train.setVisible(false); }); })()")
      await asyncio.sleep(1)
      await pg.evaluate('__game.openMap()')
      R['mapAnim'] = await pg.evaluate("(async () => { await Promise.race([Promise.all(document.getAnimations().filter(a => a.animationName === 'nmIn').map(a => a.finished)), new Promise(r => setTimeout(r, 4000))]); await new Promise(r => setTimeout(r, 400)); return getComputedStyle(document.querySelector('#netmap')).opacity; })()")
      R['mapSub'] = await pg.evaluate("(document.querySelector('#netmap .ttl small')||{}).textContent")
      ok('netmap:subtitleAllLines', all(t in (R['mapSub'] or '') for t in ['1 号线', '2 号线', '4 号线', '5 号线', '6 号线', '滨海快线']))
      R['overlaps'] = await pg.evaluate("""(() => { const T=[...document.querySelectorAll('#netmap svg text')].filter(t => t.textContent.trim() && t.getBBox().width > 0);
        const bb=T.map(t => t.getBoundingClientRect()), out=[];
        for (let i=0;i<T.length;i++) for (let j=i+1;j<T.length;j++) { const a=bb[i], c=bb[j]; const w=Math.min(a.right,c.right)-Math.max(a.left,c.left), h=Math.min(a.bottom,c.bottom)-Math.max(a.top,c.top);
          if (w>1 && h>1 && w*h > 0.15*Math.min(a.width*a.height, c.width*c.height)) out.push(T[i].textContent+' × '+T[j].textContent); }
        return {n:T.length, out}; })()""")
      log('overlaps', R['overlaps'])
      ok('netmap:noLabelOverlap', not R['overlaps']['out'])
      await shot(pg, 'fz-netmap-b3', 0.5, budget=False)
      await pg.evaluate('__game.closeMap()')
    R['errors'] = errs(logs); await b.close()
  print(json.dumps(R, ensure_ascii=False, indent=1, default=str))
  over = [k for k, v in R['scene'].items() if v > BUDGET['tris']]
  print('B3_SHOTS', 'PASS' if all(R['checks'].values()) and not R['errors'] else 'FAIL', [k for k, v in R['checks'].items() if not v], 'sceneOver', over, flush=True)
if __name__ == "__main__": asyncio.run(main())
