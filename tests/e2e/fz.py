# 福州第一批：厦门北 → 选「福州南」→ G3028 13:25→14:35 → 福州南站台 → 楼梯下出站层 → 出站口 5（免安检）→ 换乘通道
# → 楼梯上东广场（站房外观：船帆屋面、波浪玻璃幕墙、金色榕树柱）→ 4 号进站口进候车室 → 回换乘通道 → 地铁闸机 → 福州火车南站
# → 1 号线乘一站（福州南 → 安平）再乘回来 → 下到 5 号线站台 → 5 号线乘一站（→ 林浦? 螺洲古镇方向）。
# 断言：每一段走得到；广播只有普通话 + 英语（福州话 fzh 没有录音 → 跳过，不用 Web Speech、不拿闽南语代替），
# 进福州地铁时上一个城市（厦门 / 国铁）排队的站内广播被清掉；每个新镜头 ≤50 draws、≤90k 三角形；没有报错。
# 截图（png + jpg）：fz-exterior / fz-waiting / fz-transfer / fz-metro-platform / fz-l1-train / fz-l5-train / fz-arrive。
# 用法：python tests/e2e/fz.py [base-url] [截图目录] [q]
import asyncio, sys, json, os
sys.path.insert(0, os.path.dirname(__file__))
from common import *
from journey import GCLOCK, auto, wait, log
from perfhud import perf
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8123/'
OUT = (sys.argv[2] if len(sys.argv) > 2 else '/workspace/fzlogs/shots/').rstrip('/') + '/'
Q = sys.argv[3] if len(sys.argv) > 3 else '1'
EO, XO, FO = 2200, 3000, 5000
BUDGET = {'draws': 50, 'tris': 90000}
R = {'perf': {}, 'checks': {}}
def ok(name, v): R['checks'][name] = bool(v); log('check', name, bool(v)); return v
async def walk(pg, pts, leg=20.0):
    """autopilot 每段只给 12 秒游戏时间（约 30 m）：长段切成 ≤ leg 米的小段"""
    s = await st(pg); x, z = s['pos'][0], s['pos'][2]; out = []
    for tx, tz in pts:
        d = ((tx - x) ** 2 + (tz - z) ** 2) ** 0.5; n = max(1, int(d // leg) + 1)
        out += [[x + (tx - x) * k / n, z + (tz - z) * k / n] for k in range(1, n + 1)]; x, z = tx, tz
    return await auto(pg, out)
async def E(pg): return await pg.evaluate('__game.east.info()')
async def view(pg, v):
    if await pg.evaluate('__game.player.view') != v: await pg.evaluate('__game.toggleView()')
async def measure(pg, name, budget=True):
    d = await perf(pg, 4, 0.25); R['perf'][name] = d; log('perf', name, d)
    if budget: ok('budget:' + name, d['draws'] <= BUDGET['draws'] and d['tris'] <= BUDGET['tris'])
    return d
async def shot(pg, name, settle=1.2, budget=True):
    await asyncio.sleep(settle); await measure(pg, name, budget)
    await pg.screenshot(path=OUT + name + '.png', timeout=180000)
    try:
        from PIL import Image
        Image.open(OUT + name + '.png').convert('RGB').save(OUT + name + '.jpg', quality=88)
    except Exception as e: log('jpg', name, e)
async def until_rt(pg, rt, speed=10):
    await pg.evaluate(f'__game.east.setSpeed({speed})')
    r = await wait(pg, f'(__game.east.info().ride||{{rt:1e9}}).rt > {rt}', 400)
    await pg.evaluate('__game.east.setSpeed(1)'); return r
async def sit_row14(pg):
    await auto(pg, [[EO + 10.6, 0.25], [EO + 9.0, 0.3], [EO + 4.2, 0.3]])
    await pg.evaluate('__game.act()'); await asyncio.sleep(0.8)
    return (await st(pg))['seat'].get('seated')
async def fz_board(pg, line, step, inside_shot=None):
    await pg.evaluate(f'__game.call({line},{step})')
    if not await wait(pg, f'(__game.fzMetro.info().slots.find(s=>s.line==={line}&&s.step==={step})||{{}}).state==="dwell"', 90): return False
    await pg.evaluate(f"""(() => {{
      const s=__game.fzMetro.slots.find(o=>o.line==={line}&&o.step==={step});
      if(!s) return; s.t=20; s.ann=true;
      const tr=s.train, P=s.P, lz = s.side.trackZ + (s.side.doorSg>0 ? -0.9 : 0.9);
      __game.player.spawn(tr.root.position.x, P.y+0.55, lz, 0); __game.player.yaw=0; __game.player.pitch=0;
    }})()""")
    return await wait(pg, '__game.state().aboard', 4)
async def fz_skip_to(pg, code, max_hops=6):
    for _ in range(max_hops * 40):
        r = await pg.evaluate("""(() => {
          const m=__game.fzMetro; if(!m||!m.station) return null;
          const ab=__game.state().aboard, ride=m.ride;
          const s=(ride&&ride.slot) || m.slots.find(o=>o.train.root.isEnabled() && o.train.contains(__game.player.position));
          if (!s) return ab ? 'wait' : 'noride';
          if (m.code===%r && s.state==='dwell') return 'done';
          if (!ride) { if (s.state==='dwell') { s.t=0; s.ann=true; } else if (s.state==='closing') s.t=Math.min(s.t,0.05); return 'boarding'; }
          if (ride.phase==='cruise') ride.t=99;
          else if (s.state==='arriving') s.u=Math.max(s.u,0.98);
          else if (s.state==='dwell' && m.code!==%r) { s.t=0; s.ann=true; }
          else if (s.state==='closing') s.t=Math.min(s.t,0.05);
          else if (s.state==='departing') s.u=Math.max(s.u,0.93);
          return m.code+':'+ride.phase+':'+s.state;
        })()""" % (code, code))
        if r == 'done': return True
        if r is None or r == 'noride': log('skip', r); return False
        await asyncio.sleep(0.3)
    return False
OFF = """(() => { const m=__game.fzMetro, P=m.station.platforms.find(p=>p.line===%d)||m.station.platforms[0]; __game.player.spawn(%d, P.y+0.05, P.zc+(P.sideOnly==='A'?-2.2:P.sideOnly==='B'?2.2:1.5), 0); })()"""
async def main():
  os.makedirs(OUT, exist_ok=True)
  async with async_playwright() as p:
    b, pg, logs = await open_game(p, BASE + f'?q={Q}&start=gzdz&line=1')
    await pg.evaluate(GCLOCK); await pg.evaluate('__game.setDtMax(0.25)')
    await pg.evaluate("window.__caps=[]; addEventListener('gz-audio-caption', e => { if (e.detail && e.detail.id && __caps[__caps.length-1] !== e.detail.id) __caps.push(e.detail.id); })")
    await asyncio.sleep(1.0)
    # 1. 直接站到厦门北站台（广州 → 厦门那一段 xiamen.py 已测）→ 车门 → 坐下 → 卡片选福州
    await pg.evaluate("""(() => { const g=__game; g.east.ensure(); g.east.side='xm'; g.east.xmn.show('solo'); g.east.cur={st:g.station, loc:'xmn', area:'platform'}; g.station.kit.root.setEnabled(false); g.player.spawn(3000-5.8, 0.05, -126.2, Math.PI); })()""")
    await asyncio.sleep(0.8)
    await auto(pg, [[XO - 5.8, -127.3], [XO - 5.8, -128.6]])
    ok('inCar', await wait(pg, '__game.east.info().inside', 4))
    e = await E(pg); ok('destsXm', e['dests'] == ['gz', 'fz'])
    ok('seated', await sit_row14(pg))
    ok('picker', await wait(pg, '__game.east.info().picker', 6))
    ok('pickerCards', await pg.evaluate("[...document.querySelectorAll('#destPick .dp-card')].map(b=>b.dataset.dest).join()==='gz,fz'"))
    await pg.evaluate("document.querySelector('#destPick .dp-card[data-dest=fz]').dispatchEvent(new PointerEvent('pointerup', {bubbles:true}))")
    ok('pickedFz', await wait(pg, '!__game.east.info().picker && __game.east.info().dest==="fz"', 3))
    ok('rideFz', await wait(pg, '!!__game.east.info().ride && __game.east.info().ride.dest==="fz"', 6))
    T = await pg.evaluate('(() => { const t=__game.east.interior.trip; return {train:t.train, dep:t.dep, arr:t.arr, to:t.to}; })()'); R['trip'] = T
    ok('G3028', T['train'] == 'G3028' and T['dep'] == '13:25' and T['arr'] == '14:35' and T['to'].startswith('福州南'))
    await wait(pg, '__game.east.info().ride.phase === "run"', 12)
    segs = []
    for rt in [30, 70, 110, 150]:
        await until_rt(pg, rt); e = await E(pg); segs.append(e['ride']['seg'])
    R['segs'] = segs
    await pg.evaluate('__game.east.setSpeed(10)')
    ok('arrived', await wait(pg, '__game.east.info().count.arrived.length >= 1', 240))
    await pg.evaluate('__game.east.setSpeed(1)')
    e = await E(pg); ok('sideFz', e['side'] == 'fz' and e['fzs'] and e['fzs']['mode'] == 'car')
    ok('doorOpen', await wait(pg, '__game.east.info().door <= 0', 4))
    if (await st(pg))['seat'].get('seated'): await pg.evaluate('__game.act()'); await asyncio.sleep(0.4)
    await view(pg, 'third')
    await auto(pg, [[EO + 10.6, 0.25], [EO + 11.2, 0.9], [EO + 11.2, 2.0]])
    ok('atFzs', await wait(pg, '__game.east.info().loc === "fzs"', 4))
    s = await st(pg); ok('fzsPos', abs(s['pos'][0] - FO) < 100 and abs(s['pos'][2] + 127.1) < 0.6)
    await pg.evaluate('__game.player.yaw=1.78; __game.player.pitch=0.06'); await auto(pg, [[FO - 4.6, -126.6]])
    await pg.evaluate('__game.player.yaw=1.78; __game.player.pitch=0.06')
    await shot(pg, 'fz-arrive', 1.2, budget=False); await measure(pg, 'fz-arrive-b')
    ok('hudFzs', '福州南' in await pg.evaluate("document.body.innerText"))
    # 2. 站台 → 楼梯 → 出站层 → 出站口 5 → 换乘通道
    e = await E(pg); ok('stationOn', e['fzs']['station'] and e['fzs']['stationOn'] and e['area'] == 'platform')
    await auto(pg, [[FO - 8, -123.3], [FO - 12, -123.3]]); await auto(pg, [[FO - 30, -123.3]])
    s = await st(pg); e = await E(pg); ok('hallDown', s['pos'][1] < -6 and e['area'] == 'hall')
    await view(pg, 'first'); await pg.evaluate('__game.player.yaw=0.6; __game.player.pitch=0'); await measure(pg, 'fz-hall'); await view(pg, 'third')
    await auto(pg, [[FO - 24, -112], [FO - 20, -104]]); await auto(pg, [[FO - 20, -96], [FO - 20, -88]])
    s = await st(pg); ok('throughExit5', s['pos'][2] > -99)
    await auto(pg, [[FO - 30, -80], [FO - 42, -80]])
    e = await E(pg); ok('passage', e['area'] in ('hall', 'passage'))
    await view(pg, 'first'); await pg.evaluate('__game.player.yaw=-Math.PI/2; __game.player.pitch=0.02')
    await shot(pg, 'fz-transfer'); await view(pg, 'third')
    # 3. 楼梯上东广场 → 站房外观 → 4 号进站口 → 候车室
    await walk(pg, [[FO - 30, -80], [FO - 20, -70]]); await walk(pg, [[FO - 20, -62], [FO - 20, -50]]); await walk(pg, [[FO - 20, -36]])
    s = await st(pg); e = await E(pg); ok('upToPlaza', s['pos'][1] > -0.3 and e['area'] == 'plaza')
    await walk(pg, [[FO - 5, -20], [FO - 5, 5]]); await walk(pg, [[FO - 5, 30]])
    # 站房外观：从广场东南斜着看（船头大屋檐两端上翘 + 波浪玻璃幕墙 + 大红「福州南站」）
    await pg.evaluate(f"__game.player.spawn({FO}+98, 0.05, 38.6, -2.3)"); await asyncio.sleep(1.5)
    await view(pg, 'first'); await pg.evaluate('__game.player.yaw=-2.3; __game.player.pitch=-0.12')
    await shot(pg, 'fz-exterior-v3'); await view(pg, 'third')
    await pg.evaluate(f"__game.player.spawn({FO}-5, 0.05, 30, Math.PI)"); await asyncio.sleep(1)
    await walk(pg, [[FO + 20, 0], [FO + 20, -50]]); await walk(pg, [[FO + 20, -62], [FO + 20, -72]])
    s = await st(pg); e = await E(pg); ok('enterWaiting', e['area'] == 'wait' and abs(s['pos'][1]) < 0.4)
    await walk(pg, [[FO + 22, -69]])
    # 候车室镜头：从东头往西看（左边检票口 A1…，右边玻璃幕墙 + 小店，前景蓝色座椅坐满旅客）
    await pg.evaluate(f"__game.player.spawn({FO}+33, 0.05, -71, -2.18)"); await asyncio.sleep(1.5)
    await view(pg, 'first'); await pg.evaluate('__game.player.yaw=-2.18; __game.player.pitch=0.0')
    await shot(pg, 'fz-waiting-v3'); await view(pg, 'third')
    await pg.evaluate(f"__game.player.spawn({FO}+22, 0.05, -69, Math.PI)"); await asyncio.sleep(1)
    # 4. 回到东广场 → 楼梯下换乘通道 → 地铁闸机 → 福州火车南站
    await walk(pg, [[FO + 20, -72], [FO + 20, -50]]); await walk(pg, [[FO - 20, -36]])
    await walk(pg, [[FO - 20, -50], [FO - 20, -62]]); await walk(pg, [[FO - 20, -70], [FO - 30, -80]])
    s = await st(pg); ok('downToPassage', s['pos'][1] < -6)
    await auto(pg, [[FO - 42, -80], [FO - 64, -80]]); await auto(pg, [[FO - 86, -80], [FO - 94, -80]])
    await auto(pg, [[FO - 99, -79.4], [FO - 99, -75.8]]); await auto(pg, [[FO - 108.5, -75.8], [FO - 108.5, -80]])
    # 上一个城市还在排队的站内广播（厦门地铁出口 / 闽南语）：进福州地铁要清掉。
    # 文字放长（无录音时按字数估时长，约 75 秒），慢机器上走到闸机前也还没播完。
    R['locBeforeSwitch'] = await pg.evaluate('__game.east.info().loc')
    await pg.evaluate("""(async () => { const A = await import('/js/audio/announcements.js');
      A.say([{id:'test.xm.exit.zh', lang:'zh', text:'测试厦门出口广播'.repeat(40)}], {key:'xmexit'});
      A.say([{id:'test.xm.next.nan', lang:'nan', text:'测试闽南语'.repeat(8)}], {key:'next'}); })()""")
    await asyncio.sleep(0.3)
    ok('queuedXm', R['locBeforeSwitch'] != 'fzmetro' and 'xmexit' in await pg.evaluate("__game.Audio.pendingKeys()"))
    await auto(pg, [[FO - 101, -80], [FO - 93, -80]])
    ok('walkDownToMetro', await wait(pg, '__game.east.info().loc==="fzmetro" && !!(__game.fzMetro && __game.fzMetro.station)', 8))
    await asyncio.sleep(0.6)
    pk = await pg.evaluate("__game.Audio.pendingKeys()"); R['pendingAfterSwitch'] = pk
    ok('xmQueueCleared', 'xmexit' not in pk and await pg.evaluate("!__caps.some((c,i)=>i>=__caps.lastIndexOf('test.xm.exit.zh') && c==='test.xm.next.nan')"))
    await auto(pg, [[FO - 64, -80]]); await auto(pg, [[FO - 36, -80], [FO - 20, -78.5]])
    s = await st(pg); ok('ontoFzfznPlatform', s['zone'] == 'platform' and abs(s['pos'][1] + 13) < 0.3)
    ok('enteredFzMetro', await wait(pg, '__game.fzMetro && __game.fzMetro.code==="fzfzn"', 6))
    await view(pg, 'first'); await pg.evaluate('__game.player.yaw=Math.PI/2; __game.player.pitch=0.02')
    await shot(pg, 'fz-metro-platform'); await view(pg, 'third')
    await pg.evaluate("__caps.length=0")
    # 5. 1 号线：福州火车南站 → 安平 → 回来
    ok('boardL1', await fz_board(pg, 1, 1))
    await view(pg, 'first'); await pg.evaluate('__game.player.yaw=Math.PI/2; __game.player.pitch=0.0')
    await shot(pg, 'fz-l1-train'); await view(pg, 'third')
    await pg.evaluate("(() => { const s=__game.fzMetro.slots.find(o=>o.line===1&&o.step===1); if(s){ s.t=0; s.ann=true; } })()")
    ok('rideToFzap', await fz_skip_to(pg, 'fzap'))
    await pg.evaluate(OFF % (1, FO)); ok('offFzap', await wait(pg, '__game.fzMetro.code==="fzap" && !__game.state().aboard', 4))
    await measure(pg, 'fz-fzap-platform')
    ok('boardL1back', await fz_board(pg, 1, -1))
    await pg.evaluate("(() => { const s=__game.fzMetro.slots.find(o=>o.line===1&&o.step===-1); if(s){ s.t=0; s.ann=true; } })()")
    ok('backFzfzn', await fz_skip_to(pg, 'fzfzn'))
    # 6. 5 号线（换乘：同站另一层站台）
    await pg.evaluate(OFF % (5, FO)); ok('offAtFzfznL5', await wait(pg, '__game.fzMetro.code==="fzfzn" && !__game.state().aboard', 4))
    ok('boardL5', await fz_board(pg, 5, -1))
    await view(pg, 'first'); await pg.evaluate('__game.player.yaw=Math.PI/2; __game.player.pitch=0.0')
    await shot(pg, 'fz-l5-train'); await view(pg, 'third')
    await pg.evaluate("(() => { const s=__game.fzMetro.slots.find(o=>o.line===5&&o.step===-1); if(s){ s.t=0; s.ann=true; } })()")
    ok('rideL5', await fz_skip_to(pg, 'fzlj'))
    await asyncio.sleep(8)
    caps = await pg.evaluate('__caps'); R['caps'] = caps
    ok('capsFzOnly', caps and all(c.startswith('voice.fz.') or c.startswith('voice.emu') or c.startswith('sfx') for c in caps))
    ok('noFzhNoNan', not any(c.endswith('.fzh') or c.endswith('.nan') or c.endswith('.yue') for c in caps))
    ok('zhAndEn', any(c.endswith('.zh') for c in caps) and any(c.endswith('.en') for c in caps))
    diag = await pg.evaluate('__game.Audio.diagnostics ? __game.Audio.diagnostics() : null')
    R['fallbacks'] = [f for f in (diag or {}).get('fallbacks', []) if 'voice.fz' in f]
    ok('noFzFallback', not [f for f in R['fallbacks'] if f.endswith('.fzh')])
    # 7. 下车 → 站厅 → 出口楼梯 → 街面（小美要看的「出站口外面的街景」）
    await pg.evaluate(OFF % (5, FO)); await asyncio.sleep(1)
    zm = await pg.evaluate("(()=>{const P=__game.fzMetro.station.platforms.find(p=>p.up); return P?(P.up.z0+P.up.z1)/2:null})()")
    exx = await pg.evaluate("(async()=>{const S=await import('/js/data/fz-exits.js'); const e=S.FZ_EXITS[__game.fzMetro.code]; return e?e.x:null})()")
    if zm is not None and exx is not None:
        await pg.evaluate(f"__game.player.spawn({FO}+2, -12.95, {zm}, -Math.PI/2)"); await asyncio.sleep(1)
        await auto(pg, [[FO - 3, zm], [FO - 12, zm]]); await auto(pg, [[FO - 21.5, zm]]); await auto(pg, [[FO - 22, -6], [FO - 15, -12]])
        await auto(pg, [[FO + exx, -16]]); await auto(pg, [[FO + exx, -20], [FO + exx, -36]])
    s = await st(pg); ok('streetExit', s['zone'] == 'street' and abs(s['pos'][1]) < 0.5)
    await asyncio.sleep(1.5); await view(pg, 'first'); await pg.evaluate('__game.player.yaw=0.65; __game.player.pitch=0.05')
    await shot(pg, 'fz-street-exit-v2'); await view(pg, 'third')
    R['errors'] = errs(logs); await b.close()
  print(json.dumps(R, ensure_ascii=False, indent=1, default=str))
  good = all(R['checks'].values()) and not R['errors']
  print('FZ', 'PASS' if good else 'FAIL', [k for k, v in R['checks'].items() if not v], flush=True)
  if not good: sys.exit(1)
if __name__ == "__main__": asyncio.run(main())
