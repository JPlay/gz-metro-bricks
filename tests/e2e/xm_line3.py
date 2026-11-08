# 厦门地铁 3 号线（厦门火车站—蔡厝）「真坐车 / 真走路」：不快进、不改 ride.t / slot.t / s.u，列车按自然班次进站；
# 上下车都是自动走路（__game.autopilot）真的走进 / 走出车门，换乘真的走楼梯；HUD 按钮用 Playwright tap（先 elementFromPoint 命中检查）。
#   PART=ride ：存档续玩进厦门火车站站台 → 等往蔡厝的车 → 走进车门 → 一站一站坐，每一站都走下车（站台上核对站名 / 层）再等下一班上车 → 蔡厝
#               → 蔡厝上往厦门火车站的车，连续坐回五缘湾（中途不下车）→ 下车。报站字幕：普通话 → 闽南语 → 英语。
#   PART=xfer ：厦门火车站 → 湖滨东路：楼梯上 1 号线 → 1 号线到文灶 → 回湖滨东路 → 楼梯下 3 号线 → 体育中心：上 2 号线 → 育秀东路 → 回体育中心 → 下 3 号线
#               → 火炬园：上 1 号线 → 塘边 → 回火炬园 → 下 3 号线 → 五缘湾：上 2 号线 → 钟宅 → 回五缘湾（2 号线终点）→ 下 3 号线 → 国际博览中心。
#               每段楼梯检查“不传送”（每帧位移 < 2.5 m）、走到的是另一条线的站台层。
#   PART=look ：厦门火车站「时光之旅」站台 / 站厅、人才中心标准站、湖滨东路 3 号线层的截图 + 绘制预算（≤50 draws）+ 线路图（tap「地图」）
# 用法：python tests/e2e/xm_line3.py BASE [截图目录]（PART 环境变量，默认 ride,xfer,look 全跑）
import asyncio, sys, json, os, time
sys.path.insert(0, os.path.dirname(__file__))
from common import *
from journey import GCLOCK, gt, auto, wait, log
from perfhud import perf
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8123/'
OUT = (sys.argv[2] if len(sys.argv) > 2 else '/tmp/xm_line3/').rstrip('/') + '/'
PARTS = os.environ.get('PART', 'ride,xfer,look').split(',')
XO = 3000; TELEPORT = 2.5; BUDGET = 50
R = {'checks': {}, 'hops': [], 'perf': {}, 'times': {}, 'jumps': {}}
T0 = time.time()
def ok(name, v, info=None):
    R['checks'][name] = bool(v); log('check', name, bool(v), f'{time.time() - T0:.0f}s', '' if info is None else info); return v
HOOKS = """(() => {
  window.__caps=[]; addEventListener('gz-audio-caption', e => { if (e.detail && e.detail.id && __caps[__caps.length-1] !== e.detail.id) __caps.push(e.detail.id); });
  window.__jmp={max:0, at:null, last:null}; __game.scene.onAfterRenderObservable.add(()=>{ const p=__game.player.position, J=window.__jmp;
    if (J.last) { const d=Math.hypot(p.x-J.last[0], p.y-J.last[1], p.z-J.last[2]); if (d>J.max) { J.max=d; J.at=[J.last, [p.x,p.y,p.z]]; } } J.last=[p.x,p.y,p.z]; });
})()"""
async def jreset(pg): await pg.evaluate('window.__jmp.max=0; window.__jmp.at=null; window.__jmp.last=null')
async def jcheck(pg, name):
    j = await pg.evaluate('window.__jmp'); R['jumps'][name] = j; return ok('noTeleport:' + name, j['max'] < TELEPORT, round(j['max'], 2))
SLOT = "__game.xmMetro.slots.find(o=>o.line===%d&&o.step===%d)"
async def geo(pg, line, step):
    return await pg.evaluate(f"(() => {{ const s={SLOT % (line, step)}; return s ? {{trackZ:s.side.trackZ, zc:s.P.zc, y:s.P.y, side:s.side.key}} : null; }})()")
async def where(pg):
    return await pg.evaluate("(() => { const s=__game.state(), m=__game.xmMetro, z=m.zoneOf(__game.player.position); return {code:m.code, zone:z.kind, line:z.P?z.P.line:null, y:+__game.player.position.y.toFixed(2), aboard:s.aboard}; })()")
async def board(pg, line, step, tag):
    """走到屏蔽门前（车门正对的位置）等自然进站的车，门开了走进去"""
    g = await geo(pg, line, step)
    if not ok(f'{tag}:slot', g): return False
    sg = 1 if g['zc'] > g['trackZ'] else -1
    await auto(pg, [[XO + 1, g['trackZ'] + sg * 3.4], [XO, g['trackZ'] + sg * 3.4], [XO, g['trackZ'] + sg * 2.0]])
    w = await where(pg); ok(f'{tag}:waitOnPlatform', w['zone'] == 'platform' and w['line'] == line, w)
    t0 = time.time()
    ok(f'{tag}:trainCame', await wait(pg, f"['opening','dwell'].includes(({SLOT % (line, step)}||{{}}).state)", 150))
    R['times'][tag + ':waitTrain'] = round(time.time() - t0)
    await auto(pg, [[XO, g['trackZ'] + sg * 0.4]])
    return ok(f'{tag}:aboard', await wait(pg, '__game.state().aboard', 6))
async def ride_to(pg, line, step, code, tag, hops, alight=True):
    """坐着不动，一站一站自然开（关门 → 出站 → 隧道 → 进站 → 开门 ……）直到 code 站开门；然后走出车门"""
    seen, phases, t0 = [], set(), time.time(); g0 = await gt(pg); last = (g0, t0)
    while await gt(pg) - g0 < 120 * hops + 120 and time.time() - t0 < 7200:
        g = await gt(pg)
        if g != last[0]: last = (g, time.time())
        elif time.time() - last[1] > 180: log(tag, 'game clock stalled 180s at', round(g, 1)); break
        i = await pg.evaluate(f"""(() => {{ const m=__game.xmMetro, s={SLOT % (line, step)}; return {{code:m.code, ride:m.ride?m.ride.phase:null, st:s?s.state:null, ab:__game.state().aboard}}; }})()""")
        if i['ride']: phases.add(i['ride'])
        if not seen or seen[-1] != i['code']: seen.append(i['code']); log(tag, 'at', i['code'], round(time.time() - t0))
        if not i['ab']: break
        if i['code'] == code and i['ride'] and i['st'] in ('opening', 'dwell') and len(seen) > 1: break
        await asyncio.sleep(0.4)
    R['hops'].append({'tag': tag, 'line': line, 'seen': seen, 'phases': sorted(phases), 'wall': round(time.time() - t0)})
    ok(f'{tag}:arrived', seen[-1] == code and len(seen) == hops + 1 and 'cruise' in phases and await pg.evaluate('__game.state().aboard'), seen)
    if not alight: return True
    g = await geo(pg, line, step); sg = 1 if g['zc'] > g['trackZ'] else -1
    await auto(pg, [[XO, g['trackZ'] + sg * 0.4], [XO, g['trackZ'] + sg * 3.6]])
    ok(f'{tag}:alighted', await wait(pg, '!__game.state().aboard && !__game.xmMetro.ride', 8))
    w = await where(pg); return ok(f'{tag}:onPlatform', w['code'] == code and w['zone'] == 'platform' and w['line'] == line and not w['aboard'], w)
# 换乘楼梯（吕厝同款：第一层站台中间开洞，直跑楼梯 x 4→20 往 +x 上；左半边 z≈-1 是步行梯，z=0 是扶手墙）
def stairs_down(zc=0): return [[[XO + 1, zc + 2.7], [XO + 21.6, zc + 2.7]], [[XO + 21.6, zc - 1.0], [XO + 19.5, zc - 1.0]], [[XO + 12, zc - 1.0], [XO + 3.5, zc - 1.0]], [[XO + 0, zc - 1.0], [XO + 0, zc]]]
def stairs_up(zc=0): return [[[XO + 0, zc - 1.0], [XO + 3.5, zc - 1.0]], [[XO + 12, zc - 1.0], [XO + 19.5, zc - 1.0]], [[XO + 21.6, zc - 1.0], [XO + 21.6, zc + 2.7]], [[XO + 1, zc + 2.7]]]
async def walk_xfer(pg, code, to_line, down, tag):
    await jreset(pg)
    for leg in (stairs_down() if down else stairs_up()): await auto(pg, leg, True)
    w = await where(pg); g = await pg.evaluate(f"__game.xmMetro.station.platformFor({to_line}).y")
    ok(f'{tag}:reached', w['code'] == code and w['zone'] == 'platform' and w['line'] == to_line and abs(w['y'] - g) < 0.5, w)
    await jcheck(pg, tag)
def caps_has(caps, *subs): return all(any(sb in c for c in caps) for sb in subs)

async def part_ride(pg):
    L3 = await pg.evaluate("(async () => (await import('/js/data/xm-lines.js')).XM_LINES[3].stations)()")
    ok('ride:start', (await where(pg))['code'] == 'xmhc')
    await pg.evaluate('__caps.length=0')
    for i in range(1, len(L3)):
        tag = f'L3+:{L3[i-1]}>{L3[i]}'
        if not await board(pg, 3, 1, tag): return
        if not await ride_to(pg, 3, 1, L3[i], tag, 1): return
    caps = await pg.evaluate('__caps'); R['capsOut'] = caps
    ok('ann:next zh/nan/en', caps_has(caps, 'next.rczx.zh', 'next.rczx.nan', 'next.rczx.en', 'next.hbd3.nan', 'next.wyw3.en'))
    ok('ann:arrive', caps_has(caps, 'arrive.hlgy.zh', 'arrive.hlgy.nan', 'arrive.hlgy.en'))
    ok('ann:terminal', caps_has(caps, 'terminal.xmccuo.zh', 'terminal.xmccuo.nan', 'terminal.xmccuo.en'))
    ok('ann:noYue', not any(c.endswith('.yue') for c in caps))
    # 回程：蔡厝 → 五缘湾 连续坐（中途不下车）
    await pg.evaluate('__caps.length=0')
    if await board(pg, 3, -1, 'L3-:ccuo>wyw'): await ride_to(pg, 3, -1, 'wyw', 'L3-:ccuo>wyw', 9)
    caps = await pg.evaluate('__caps'); R['capsBack'] = caps
    ok('ann:destination xmhc', caps_has(caps, 'destination.xmxmhc.zh', 'destination.xmxmhc.nan', 'destination.xmxmhc.en'))
async def part_xfer(pg):
    ok('xfer:start', (await where(pg))['code'] == 'xmhc')
    # 湖滨东路 3 → 1 → 3
    if await board(pg, 3, 1, 'x:xmhc>hbd'): await ride_to(pg, 3, 1, 'hbd', 'x:xmhc>hbd', 1)
    await walk_xfer(pg, 'hbd', 1, False, 'hbd:3to1')
    if await board(pg, 1, 1, 'x:hbd>wza'): await ride_to(pg, 1, 1, 'wza', 'x:hbd>wza', 1)
    if await board(pg, 1, -1, 'x:wza>hbd'): await ride_to(pg, 1, -1, 'hbd', 'x:wza>hbd', 1)
    await walk_xfer(pg, 'hbd', 3, True, 'hbd:1to3')
    # 体育中心 3 → 2 → 3
    if await board(pg, 3, 1, 'x:hbd>tyz'): await ride_to(pg, 3, 1, 'tyz', 'x:hbd>tyz', 1)
    await walk_xfer(pg, 'tyz', 2, False, 'tyz:3to2')
    if await board(pg, 2, 1, 'x:tyz>yxd'): await ride_to(pg, 2, 1, 'yxd', 'x:tyz>yxd', 1)
    if await board(pg, 2, -1, 'x:yxd>tyz'): await ride_to(pg, 2, -1, 'tyz', 'x:yxd>tyz', 1)
    await walk_xfer(pg, 'tyz', 3, True, 'tyz:2to3')
    # 火炬园 3 → 1 → 3
    if await board(pg, 3, 1, 'x:tyz>hjy'): await ride_to(pg, 3, 1, 'hjy', 'x:tyz>hjy', 4)
    await walk_xfer(pg, 'hjy', 1, False, 'hjy:3to1')
    if await board(pg, 1, 1, 'x:hjy>tbn'): await ride_to(pg, 1, 1, 'tbn', 'x:hjy>tbn', 1)
    if await board(pg, 1, -1, 'x:tbn>hjy'): await ride_to(pg, 1, -1, 'hjy', 'x:tbn>hjy', 1)
    await walk_xfer(pg, 'hjy', 3, True, 'hjy:1to3')
    # 五缘湾 3 → 2 → 3（2 号线在这里是终点站）
    if await board(pg, 3, 1, 'x:hjy>wyw'): await ride_to(pg, 3, 1, 'wyw', 'x:hjy>wyw', 5)
    await walk_xfer(pg, 'wyw', 2, False, 'wyw:3to2')
    if await board(pg, 2, -1, 'x:wyw>zzh'): await ride_to(pg, 2, -1, 'zzh', 'x:wyw>zzh', 1)
    if await board(pg, 2, 1, 'x:zzh>wyw'): await ride_to(pg, 2, 1, 'wyw', 'x:zzh>wyw', 1)
    await walk_xfer(pg, 'wyw', 3, True, 'wyw:2to3')
    if await board(pg, 3, 1, 'x:wyw>gjbl'): await ride_to(pg, 3, 1, 'gjbl', 'x:wyw>gjbl', 1)
async def view(pg, v):
    if await pg.evaluate('__game.player.view') != v: await pg.evaluate('__game.toggleView()')
async def shot(pg, name, x, z, yaw, pitch, line=None, y=None):
    await view(pg, 'first')
    await pg.evaluate(f"(() => {{ const st=__game.xmMetro.station, P={'st.platformFor(%d)' % line if line else 'st.platforms[0]'}; __game.player.spawn({XO}+{x}, {'P.y' if y is None else y}+0.05, P.zc+{z}, {yaw}); __game.player.pitch={pitch}; }})()")
    await asyncio.sleep(2.0); d = await perf(pg, 3, 0.25); R['perf'][name] = d
    ok('budget:' + name, d['draws'] <= BUDGET and d['tris'] <= 186754, d)
    await safe_shot(pg, path=OUT + name + '.png', timeout=180000)
async def tap_hit(pg, sel, tag):
    hit = await pg.evaluate("s => { const b=document.querySelector(s); if(!b) return false; const r=b.getBoundingClientRect(), h=document.elementFromPoint(r.x+r.width/2, r.y+r.height/2); return !!h && b.contains(h); }", sel)
    ok(f'hit:{tag}', hit)
    try: await pg.locator(sel).first.tap(timeout=15000); return ok(f'tap:{tag}', True)
    except Exception as ex: print('tap fail', tag, str(ex)[:200], flush=True); return ok(f'tap:{tag}', False)
async def part_look(pg):
    m = pg.evaluate
    await m("void __game.xmMetro.buildStation('xmhc')"); await asyncio.sleep(1.5)
    ok('look:xmhcTheme', await m("__game.xmMetro.station.themeKey==='timetravel' && __game.xmMetro.station.atlas.overflow===0"))
    await shot(pg, 'xmhc-platform', 20, 1.5, -1.5708, 0.02)
    await shot(pg, 'xmhc-wall', -8.5, 3.5, 0, 0.06)
    await shot(pg, 'xmhc-concourse', -5, -14.5, 0, 0.0, y=-6.5)
    await m("void __game.xmMetro.buildStation('rczx')"); await asyncio.sleep(1.5)
    ok('look:rczxTheme', await m("__game.xmMetro.station.themeKey==='xm3'"))
    await shot(pg, 'rczx-platform', 20, 1.5, -1.5708, 0.02)
    await m("void __game.xmMetro.buildStation('hbd')"); await asyncio.sleep(1.5)
    ok('look:hbdTwoLevels', await m("JSON.stringify(__game.xmMetro.station.platforms.map(p=>[p.line,p.y,p.themeKey]))==='[[1,-13,\"minnan\"],[3,-22,\"xm3\"]]'"))
    await shot(pg, 'hbd-l3-foot', -6, -1.0, 1.5708, 0.25, line=3)
    await shot(pg, 'hbd-l1-hole', -4, 2.6, 1.5708, 0.15, line=1)
    await m("void __game.xmMetro.buildStation('wyw')"); await asyncio.sleep(1.5)
    ok('look:wywThemes', await m("JSON.stringify(__game.xmMetro.station.platforms.map(p=>[p.line,p.themeKey]))==='[[2,\"sail\"],[3,\"xm3\"]]'"))
    await shot(pg, 'wyw-l3', -20, 1.5, 1.5708, 0.02, line=3)
    # 线路图：真 tap「地图」按钮
    if await tap_hit(pg, '#bMap', 'map'):
        ok('map:open', await wait(pg, '__game.state().mapOpen && !document.getElementById("netmap").hidden', 10)); await asyncio.sleep(0.6)
        mp = await m("""(async () => { const X=(await import('/js/data/xm-lines.js')); const svg=document.querySelector('#netmap .mapbox svg'); const t=[...svg.querySelectorAll('text')].map(e=>e.textContent);
          const want=X.XM_LINES[3].stations.map(c=>{ const z=X.XM_STATIONS[c].zh; return z.length>4?z.slice(0,4):z; });
          return { missing: want.filter(w=>!t.includes(w)), l3: [...svg.querySelectorAll('polyline')].some(p=>p.getAttribute('stroke')===X.XM_L3) }; })()""")
        R['map'] = mp; ok('map:line3', mp['l3'] and not mp['missing'], mp)
        await safe_shot(pg, path=OUT + 'netmap.png', timeout=180000)
        await tap_hit(pg, '#netmap .x', 'mapClose'); ok('map:closed', await wait(pg, '!__game.state().mapOpen', 6))
async def main():
    os.makedirs(OUT, exist_ok=True)
    async with async_playwright() as p:
        for part in PARTS:
            b = await p.chromium.launch(args=ARGS)
            ctx = await b.new_context(viewport={'width': 1112, 'height': 834}, device_scale_factor=2, has_touch=True, is_mobile=True)
            await ctx.add_init_script("localStorage.setItem('gzmb.save', JSON.stringify({v:1,city:'xm',code:'xmhc',line:3,platform:true,t:Date.now()}))")
            pg = await ctx.new_page(); logs = []
            pg.on('pageerror', lambda e: logs.append(('pageerror', str(e)))); pg.on('console', lambda m: logs.append((m.type, m.text)) if m.type == 'error' else None)
            await pg.goto(BASE + '?q=1'); await pg.wait_for_function('window.__game', timeout=300000)
            await pg.evaluate(GCLOCK); await pg.evaluate('__game.setDtMax(0.25)'); await pg.evaluate(HOOKS); await asyncio.sleep(1.5)
            ok(part + ':resumeXmhc', await wait(pg, '__game.xmMetro && __game.xmMetro.code==="xmhc"', 20))
            await view(pg, 'third')
            async def heartbeat():   # 只读心跳：每 60 s 打一行游戏钟 / fps / 列车状态，卡住时好查
                while True:
                    await asyncio.sleep(60)
                    try: log('hb', await pg.evaluate("JSON.stringify({gt:+(window.__gt||0).toFixed(1), fps:Math.round(__game.engine.getFps()), code:__game.xmMetro.code, ride:__game.xmMetro.ride?__game.xmMetro.ride.phase:null, slots:__game.xmMetro.slots.map(s=>s.line+':'+s.step+':'+s.state)})"))
                    except Exception: pass
            hbt = asyncio.create_task(heartbeat())
            try: await {'ride': part_ride, 'xfer': part_xfer, 'look': part_look}[part](pg)
            except Exception as ex: ok(part + ':exception', False, repr(ex)[:300])
            hbt.cancel()
            R.setdefault('errors', []).extend(errs(logs)); R['gameSeconds:' + part] = round(await gt(pg), 1)
            await b.close()
    print(json.dumps(R, ensure_ascii=False, indent=1, default=str))
    good = all(R['checks'].values()) and not R['errors']
    print('XM_LINE3', ','.join(PARTS), 'PASS' if good else 'FAIL', [k for k, v in R['checks'].items() if not v], flush=True)
    if not good: sys.exit(1)
if __name__ == "__main__": asyncio.run(main())
