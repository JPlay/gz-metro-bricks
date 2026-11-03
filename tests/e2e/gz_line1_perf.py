# 广州 1 号线 / 公园前 性能点位探针（PR perf-gz-line1）：每帧 ≤50 draws、≤90k tris，第一 / 第三人称都量。
#   lsly   烈士陵园 1 号线站台（24.6, -12, 10.15，小美下车点），两侧车停站，4 个朝向
#   gyq2   公园前 2 号线站台（y -22, zc 44），两侧车停站，4 个朝向；顺带 1 号线站台
#   ride   西门口上车（走上去）→ 出站 → 隧道（这时重建公园前）→ 公园前进站停站：逐帧采样（第三人称），
#          到站后车上 4 个朝向第一 / 第三人称；再坐一段 公园前 → 农讲所（第一人称逐帧采样）
# 用法：python tests/e2e/gz_line1_perf.py BASE parts(lsly,gyq2,ride | 小段 gyqL2,gyqL1,ride1) OUTJSON [SHOTDIR]
# 游戏时钟：和 fz_perf_probe 一样 setDtMax(0.25) + 自己驱动渲染（tick），等待全部按游戏时间。
import asyncio, sys, json, os, time, math
sys.path.insert(0, os.path.dirname(__file__))
from common import *
from journey import GCLOCK, gt, auto, wait, log, board
from perfhud import perf
BASE = sys.argv[1].rstrip('/') + '/'; PARTS = sys.argv[2].split(','); OUT = sys.argv[3]; SHOT = sys.argv[4].rstrip('/') + '/' if len(sys.argv) > 4 else None
if SHOT: os.makedirs(SHOT, exist_ok=True)
R = {'perf': {}, 'top': {}, 'frames': {}, 'checks': {}}
def save(): json.dump(R, open(OUT, 'w'), ensure_ascii=False, indent=1, default=str)
def ok(k, v, info=None): R['checks'][k] = bool(v); log('check', k, bool(v), '' if info is None else json.dumps(info, ensure_ascii=False, default=str)[:300]); save(); return v
TICK = """window.__startTick = (speed) => { const g=__game, e=g.engine, sc=g.scene; e.stopRenderLoop(); e.getDeltaTime = () => 50; e.setHardwareScalingLevel(4);
  window.__hiShot = () => { e.setHardwareScalingLevel(1); sc.render(); }; window.__loShot = () => { e.setHardwareScalingLevel(4); };
  window.__tick = setInterval(() => { const t0=performance.now(); let n=0; while (n < (speed||6) && performance.now()-t0 < 60) { try { sc.render(); } catch(err) { window.__tickErr = String(err); } n++; } }, 20); }"""
TOP = """(() => { const s=__game.scene, out={}; const am=s.getActiveMeshes(); for (let i=0;i<am.length;i++) { const m=am.data[i]; const n=(m.parent&&m.parent.name?m.parent.name.replace(/^st-[a-z0-9]+/,'st')+'/':'')+(m.name||'?'); const t=(m.getTotalIndices? m.getTotalIndices():0)/3; out[n]=(out[n]||0)+Math.round(t); }
  return Object.entries(out).sort((a,b)=>b[1]-a[1]).slice(0,12); })()"""
# 逐帧采样（挂 scene.onAfterRender：__startTick 停了引擎渲染循环、自己调 scene.render()，engine.onEndFrame 不会触发）：按 (站, 隧道, 车状态) 分桶记最大值；超预算帧记前 12 帧的最贵网格
FRAMES = """(() => { if (window.__fw) return; window.__fw = {on:false, b:{}, over:[]};
  __game.scene.onAfterRenderObservable.add(() => { const W=window.__fw; if (!W.on) return; const g=__game, e=g.engine, d=(e._drawCalls&&e._drawCalls.current)||0, tr=Math.round(g.scene.getActiveIndices()/3);
    const s=g.state(), m=g.metro, sl=m.ride&&m.ride.slot; const k=s.code+'|'+(s.inTunnel?'tun':(m.ride?m.ride.phase:'-'))+'|'+(sl?sl.state:'-')+'|'+g.player.view;
    const B=W.b[k]||(W.b[k]={n:0,d:0,t:0}); B.n++; if (d>B.d) B.d=d; if (tr>B.t) B.t=tr;
    if ((d>50||tr>90000) && W.over.length<12) { const am=g.scene.getActiveMeshes(), o={}; for (let i=0;i<am.length;i++){const x=am.data[i]; const n=(x.parent&&x.parent.name?x.parent.name.replace(/^st-[a-z0-9]+/,'st')+'/':'')+x.name; o[n]=(o[n]||0)+Math.round((x.getTotalIndices?x.getTotalIndices():0)/3);} W.over.push({k, d, tr, pos:s.pos, top:Object.entries(o).sort((a,b)=>b[1]-a[1]).slice(0,8)}); } }); })()"""
async def fw_start(pg): await pg.evaluate("(window.__fw.b={}, window.__fw.over=[], window.__fw.on=true)")
async def fw_stop(pg, name):
    w = await pg.evaluate("(() => { const W=window.__fw; W.on=false; return {b:W.b, over:W.over}; })()")
    R['frames'][name] = w; save()
    mx = {'draws': max([v['d'] for v in w['b'].values()] or [0]), 'tris': max([v['t'] for v in w['b'].values()] or [0])}
    log('frames', name, mx, {k: (v['n'], v['d'], v['t']) for k, v in w['b'].items()})
    for o in w['over'][:4]: log('  over', o['k'], o['d'], o['tr'], o['top'][:5])
    return mx
async def view(pg, v):
    if await pg.evaluate('__game.player.view') != v: await pg.evaluate('void __game.toggleView()')
async def gsleep(pg, secs):
    g0 = await gt(pg); t0 = time.time()
    while await gt(pg) - g0 < secs and time.time() - t0 < 300: await asyncio.sleep(0.3)
async def shot(pg, name):
    if not SHOT: return
    try:
        await pg.evaluate('__hiShot()'); await pg.screenshot(path=f'{SHOT}{name}.png', timeout=120000); log('shot', name)
    except Exception as e: log('shotfail', name, repr(e)[:100])
    finally:
        try: await pg.evaluate('__loShot()')
        except Exception: pass
async def spot(pg, name, yaws=4, pitch=None, shots=()):
    """当前位置：第一 / 第三人称 × yaws 个朝向，各采 3 帧取最大"""
    y0 = await pg.evaluate('__game.player.yaw'); d = {}
    for v in ('third', 'first'):
        await view(pg, v)
        for k in range(yaws):
            yw = y0 + k * 2 * math.pi / yaws
            await pg.evaluate(f'__game.player.yaw={yw}' + (f'; __game.player.pitch={pitch}' if pitch is not None else '')); await gsleep(pg, 0.8)
            r = await perf(pg, 3, 0.25); d[f'{v}{k}'] = r
            if r['draws'] > 50 or r['tris'] > 90000 or k == 0: R['top'][f'{name}:{v}{k}'] = await pg.evaluate(TOP)
            if (v, k) in shots: await shot(pg, f'{name}-{v}{k}')
    await pg.evaluate(f'__game.player.yaw={y0}'); await view(pg, 'third')
    mx = {v: {'draws': max(x['draws'] for kk, x in d.items() if kk.startswith(v)), 'tris': max(x['tris'] for kk, x in d.items() if kk.startswith(v))} for v in ('first', 'third')}
    s = await st(pg); R['perf'][name] = {'max': mx, 'dirs': d, 'pos': s['pos'], 'zone': s['zone'], 'aboard': s.get('aboard')}
    log('PERF', name, mx, s['pos'], s['zone'])
    ok(name + ':budget', all(m['draws'] <= 50 and m['tris'] <= 90000 for m in mx.values()), mx)
async def boot(pg, qs):
    await pg.goto(BASE + qs); await pg.wait_for_function('window.__game', timeout=120000)
    await pg.evaluate(TICK); await pg.evaluate('__startTick(6)'); await pg.evaluate(GCLOCK); await pg.evaluate('__game.setDtMax(0.25)')
    await pg.evaluate(FRAMES); await gsleep(pg, 2)
HOLD = "window.__holdObs||(window.__holdObs=1,window.__hold=[],__game.scene.onBeforeRenderObservable.add(()=>{for(const [l,k] of window.__hold){const s=__game.metro.slots.find(o=>o.line==l&&o.step==k);if(s&&s.state=='dwell'&&s.t<6)s.t=6}}))"
async def all_dwell(pg, line):
    await pg.evaluate(HOLD)
    okd = await wait(pg, f"(__game.metro.slots.filter(o=>o.line=={line}).forEach(o=>{{ if(o.state==='away') o.t=0; }}), __game.metro.slots.filter(o=>o.line=={line}).every(o=>o.state==='dwell'))", 90)
    await pg.evaluate(f"window.__hold=[[{line},1],[{line},-1]]"); return okd
async def part_lsly(pg):
    await boot(pg, '?q=1&start=lsly&line=1&char=mingming')
    ok('lsly:allDwell', await all_dwell(pg, 1))
    await pg.evaluate('void __game.player.spawn(24.6, -11.95, 10.15, 0)'); await gsleep(pg, 2)
    await spot(pg, 'lsly-platform', shots=(('third', 0), ('first', 0)))
    await pg.evaluate('void __game.player.spawn(0, -11.95, 14, Math.PI/2)'); await gsleep(pg, 2)
    await spot(pg, 'lsly-platform-mid', shots=(('third', 0),))
    await pg.evaluate("window.__hold=[]")
async def part_gyq2(pg): await part_gyqL2(pg); await part_gyqL1(pg, boot_=False)
# 小段（每次持锁只测一两个点位用）：gyqL2 = 2 号线站台两处；gyqL1 = 1 号线站台
async def part_gyqL2(pg):
    await boot(pg, '?q=1&start=gyq&line=2&char=mingming')
    ok('gyq2:allDwell', await all_dwell(pg, 2))
    await pg.evaluate('void __game.player.spawn(18.6, -21.95, 42.6, Math.PI/2)'); await gsleep(pg, 2)
    await spot(pg, 'gyq-L2-platform', shots=(('third', 0), ('first', 0)))
    await pg.evaluate('void __game.player.spawn(0, -21.95, 44, Math.PI/2)'); await gsleep(pg, 2)
    await spot(pg, 'gyq-L2-platform-mid', shots=(('third', 0),))
    await pg.evaluate("window.__hold=[]")
async def part_gyqL1(pg, boot_=True):
    if boot_: await boot(pg, '?q=1&start=gyq&line=1&char=mingming')
    ok('gyq1:allDwell', await all_dwell(pg, 1))
    await pg.evaluate('void __game.player.spawn(18.6, -11.95, 12.6, Math.PI/2)'); await gsleep(pg, 2)
    await spot(pg, 'gyq-L1-platform', shots=(('third', 0), ('third', 2)))
    await pg.evaluate("window.__hold=[]")
async def ride_leg(pg, name, to):
    """已在车上、车停站：逐帧采样直到到 to 站停站开门"""
    await fw_start(pg)
    okr = await wait(pg, f"(() => {{ const s=__game.state(), m=__game.metro, sl=m.ride&&m.ride.slot; return s.code=='{to}' && !s.inTunnel && sl && sl.state=='dwell'; }})()", 120)
    await pg.evaluate("window.__hold=[[__game.metro.ride.line, __game.metro.ride.step]]")
    mx = await fw_stop(pg, name); ok(name + ':arrived', okr); ok(name + ':everyFrameBudget', mx['draws'] <= 50 and mx['tris'] <= 90000, mx)
async def part_ride1(pg): await part_ride(pg, legs=1)
async def part_ride(pg, legs=2):
    await boot(pg, '?q=1&start=xmk&line=1&char=mingming')
    await pg.evaluate(HOLD); await view(pg, 'third')
    await pg.evaluate('void __game.player.spawn(18.6, -11.95, 12.6, 0)'); await gsleep(pg, 1)
    if not ok('ride:boarded', await board(pg, 1, 1, [[24.6, 10], [24.6, 6.6]], [24.6, 10.5])): return
    z = await pg.evaluate("(()=>{const m=__game.metro; const s=m.slots.find(o=>o.train.root.isEnabled()&&m.playerOn(o.train)); return s?s.train.root.position.z:null})()")
    if z is not None: await auto(pg, [[22.0, z]])
    await ride_leg(pg, 'ride-xmk-gyq-third', 'gyq')
    await spot(pg, 'gyq-aboard-L1', shots=(('third', 0), ('first', 0), ('third', 3)) if legs > 1 else (('third', 0), ('first', 0)))
    if legs < 2: await pg.evaluate("window.__hold=[]"); return
    await pg.evaluate("window.__hold=[]"); await view(pg, 'first')
    await ride_leg(pg, 'ride-gyq-njs-first', 'njs')
    await pg.evaluate("window.__hold=[]"); await view(pg, 'third')
async def main():
  async with async_playwright() as p:
    b, pg, logs = await open_game(p, BASE + '?q=1&char=mingming')
    try:
      for part in PARTS:   # 每段单独 try：一段出错不影响后面几段
        try: await {'lsly': part_lsly, 'gyq2': part_gyq2, 'ride': part_ride, 'gyqL2': part_gyqL2, 'gyqL1': part_gyqL1, 'ride1': part_ride1}[part](pg)
        except Exception as e:
          import traceback; R.setdefault('exception', {})[part] = traceback.format_exc(); log('EXC', part, repr(e)[:300]); ok(part + ':exception', False)
          try: await pg.evaluate("window.__fw && (window.__fw.on=false); window.__hold=[]")
          except Exception: pass
    finally:
      hard = [e for e in errs(logs) if e[0] in ('error', 'pageerror')]; R['errors'] = errs(logs)[:40]; ok('noHardErrors', not hard, hard[:4]); save(); await b.close()
  bad = [k for k, v in R['checks'].items() if not v]
  print('GZ_LINE1_PERF', 'FAILED' if bad else 'ALL OK', bad, flush=True); sys.exit(1 if bad else 0)
asyncio.run(main())
