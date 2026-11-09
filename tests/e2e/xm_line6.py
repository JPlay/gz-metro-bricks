# 厦门地铁 6 号线：PART=look|xfer|ride，真实上下车、真实走楼梯、自然班次，不改 ride.t（不做快进）。
# xfer: 鼎美 6→2→6、马銮中心 2→6→2、官任 6→1→6，全部走楼梯（不传送）；XO=3000。
# DISPLAY=:27 flock /workspace/fzlogs/final2/q.lock /workspace/.pwvenv/bin/python tests/e2e/xm_line6.py BASE OUT
import asyncio, sys, json, os, time
sys.path.insert(0, os.path.dirname(__file__))
from common import *
from journey import GCLOCK, gt, auto, wait, log
from perfhud import perf
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8123/'
OUT = (sys.argv[2] if len(sys.argv) > 2 else '/tmp/xml6/').rstrip('/') + '/'
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
    zc = await pg.evaluate('__game.xmMetro.station.platforms[0].zc')
    await jreset(pg)
    for leg in (stairs_down(zc) if down else stairs_up(zc)): await auto(pg, leg, True)
    w = await where(pg); g = await pg.evaluate(f"__game.xmMetro.station.platformFor({to_line}).y")
    ok(f'{tag}:reached', w['code'] == code and w['zone'] == 'platform' and w['line'] == to_line and abs(w['y'] - g) < 0.5, w)
    await jcheck(pg, tag)
def caps_has(caps, *subs): return all(any(sb in c for c in caps) for sb in subs)

async def part_ride(pg):
    L6 = await pg.evaluate("(async () => (await import('/js/data/xm-lines.js')).XM_LINES[6].stations)()")
    ok('ride:start', (await where(pg))['code'] == 'ldai')
    i0 = L6.index('ldai')
    await pg.evaluate('__caps.length=0')
    for i in range(i0 + 1, len(L6)):
        tag = f'L6+:{L6[i-1]}>{L6[i]}'
        if not await board(pg, 6, 1, tag): return
        if not await ride_to(pg, 6, 1, L6[i], tag, 1): return
    caps = await pg.evaluate('__caps'); R['capsOut'] = caps
    ok('ann:next zh/nan/en', caps_has(caps, 'next.xbin.zh', 'next.xbin.nan', 'next.xbin.en', 'next.dme6.nan', 'next.mlz6.zh', 'next.grn6.en'))
    ok('ann:terminal', caps_has(caps, 'terminal.xmhqdx.zh', 'terminal.xmhqdx.nan', 'terminal.xmhqdx.en'))
    ok('ann:noYue', not any(c.endswith('.yue') for c in caps))
    await pg.evaluate('__caps.length=0')
    if await board(pg, 6, -1, 'L6-:hqdx>jjl'): await ride_to(pg, 6, -1, 'jjl', 'L6-:hqdx>jjl', 16)
    caps = await pg.evaluate('__caps'); R['capsBack'] = caps
    ok('ann:destination jjl', caps_has(caps, 'destination.xmjjl.zh', 'destination.xmjjl.nan', 'destination.xmjjl.en'))

async def part_xfer(pg):
    # 从存档站台（林埭 6 号线）开始，真坐到鼎美；三个换乘站都上下两个方向走同一条楼梯，不改 ride 时钟。
    # 换乘站上层 = 1 / 2 号线（-13），下层 = 6 号线（-22）：6→2 / 6→1 往上走，2→6 / 1→6 往下走。
    ok('xfer:start', (await where(pg))['code'] == 'ldai')
    await pg.evaluate('__caps.length=0')
    if not await board(pg,6,1,'x:ldai>dme'): return
    if not await ride_to(pg,6,1,'dme','x:ldai>dme',1): return
    await walk_xfer(pg,'dme',2,False,'dme:6to2')
    if not await board(pg,2,1,'x:dme>mlz'): return
    if not await ride_to(pg,2,1,'mlz','x:dme>mlz',1): return
    await walk_xfer(pg,'mlz',6,True,'mlz:2to6')
    await walk_xfer(pg,'mlz',2,False,'mlz:6to2')
    if not await board(pg,2,-1,'x:mlz>dme'): return
    if not await ride_to(pg,2,-1,'dme','x:mlz>dme',1): return
    await walk_xfer(pg,'dme',6,True,'dme:2to6')
    if not await board(pg,6,1,'x:dme>grn'): return
    if not await ride_to(pg,6,1,'grn','x:dme>grn',7): return
    await walk_xfer(pg,'grn',1,False,'grn:6to1')
    if not await board(pg,1,1,'x:grn>xjl'): return
    if not await ride_to(pg,1,1,'xjl','x:grn>xjl',1): return
    if not await board(pg,1,-1,'x:xjl>grn'): return
    if not await ride_to(pg,1,-1,'grn','x:xjl>grn',1): return
    await walk_xfer(pg,'grn',6,True,'grn:1to6')
    if await board(pg,6,1,'x:grn>xlw'): await ride_to(pg,6,1,'xlw','x:grn>xlw',1)
    caps = await pg.evaluate('__caps'); R['capsXfer'] = caps
    ok('xfer:ann transfers', caps_has(caps, 'next.dme6.zh', 'next.mlz2.zh', 'next.dme2.zh', 'next.grn6.zh', 'next.grn1.zh'))
    ok('xfer:noYue', not any(c.endswith('.yue') for c in caps))

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
    await m("void __game.xmMetro.buildStation('btou')"); await asyncio.sleep(1.5)
    ok('look:btouTemplate', await m("__game.xmMetro.station.themeKey==='xm6' && __game.xmMetro.station.themeOf('xm6').badge==='bougainvillea' && __game.xmMetro.station.atlas.overflow===0"))
    await shot(pg,'btou-platform',20,1.5,-1.5708,0.02)
    await shot(pg,'btou-wall',-8.5,3.5,0,0.06)
    await shot(pg,'btou-concourse',-5,-14.5,0,0,y=-6.5)
    for code, other in [('dme',2),('mlz',2),('grn',1)]:
        await m(f"void __game.xmMetro.buildStation('{code}')"); await asyncio.sleep(1.5)
        pl = await m("JSON.stringify(__game.xmMetro.station.platforms.map(p=>[p.line,p.y,p.themeKey]))")
        R.setdefault('platforms', {})[code] = pl
        P = json.loads(pl)
        ok(f'look:{code}TwoLevels', len(P) == 2 and [P[0][0], P[1][0]] == [other, 6] and P[0][1] == -13 and P[1][1] == -22 and P[1][2] == 'xm6' and await m("__game.xmMetro.station.atlas.overflow===0"), pl)
        await shot(pg,code+'-l6',-6,-1.0,1.5708,0.25,line=6)
        await shot(pg,code+f'-l{other}',-4,2.6,1.5708,0.15,line=other)
    if await tap_hit(pg,'#bMap','map'):
        ok('map:open',await wait(pg,'__game.state().mapOpen && !document.getElementById("netmap").hidden',10)); await asyncio.sleep(0.6)
        mp=await m("""(async()=>{const X=await import('/js/data/xm-lines.js');const svg=document.querySelector('#netmap .mapbox svg'), t=[...svg.querySelectorAll('text')].map(e=>e.textContent);
        const want=X.XM_LINES[6].stations.map(c=>{const z=X.XM_STATIONS[c].zh;return z.length>4?z.slice(0,4):z});
        return {missing:want.filter(w=>!t.includes(w)),l6:[...svg.querySelectorAll('polyline')].some(p=>p.getAttribute('stroke')===X.XM_L6),title:t.some(x=>x.includes('6号线 紫色')),nan:svg.outerHTML.includes('NaN')};})()""")
        R['map']=mp; ok('map:line6',mp['l6'] and mp['title'] and not mp['missing'] and not mp['nan'],mp)
        await safe_shot(pg,path=OUT+'netmap.png',timeout=180000)
        await tap_hit(pg,'#netmap .x','mapClose'); ok('map:closed',await wait(pg,'!__game.state().mapOpen',6))
async def main():
    os.makedirs(OUT, exist_ok=True)
    async with async_playwright() as p:
        for part in PARTS:
            b = await p.chromium.launch(args=ARGS)
            ctx = await b.new_context(viewport={'width': 1112, 'height': 834}, device_scale_factor=2, has_touch=True, is_mobile=True)
            await ctx.add_init_script("localStorage.setItem('gzmb.save', JSON.stringify({v:1,city:'xm',code:'ldai',line:6,platform:true,t:Date.now()}))")
            pg = await ctx.new_page(); logs = []
            pg.on('pageerror', lambda e: logs.append(('pageerror', str(e)))); pg.on('console', lambda m: logs.append((m.type, m.text)) if m.type == 'error' else None)
            await pg.goto(BASE + '?q=1'); await pg.wait_for_function('window.__game', timeout=300000)
            await pg.evaluate(GCLOCK); await pg.evaluate('__game.setDtMax(0.25)'); await pg.evaluate(HOOKS); await asyncio.sleep(1.5)
            ok(part + ':resumeLdai', await wait(pg, '__game.xmMetro && __game.xmMetro.code==="ldai"', 20))
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
    print('XM_LINE6', ','.join(PARTS), 'PASS' if good else 'FAIL', [k for k, v in R['checks'].items() if not v], flush=True)
    if not good: sys.exit(1)
if __name__ == "__main__": asyncio.run(main())
