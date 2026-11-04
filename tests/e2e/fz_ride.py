# 福州「真坐车」测试（不快进、不跳时间：不改 ride.t / slot.t / s.u，动车 1 倍速，地铁按自然班次进站、走进车门、坐到站、走出车门）。
#   part xm：广州东地铁站台 → 走到复兴号 → 选厦门 → 1 倍速坐到厦门北 → 下车 → 再上车 → 选福州南 → G3028（1 倍速全程）→ 福州南站台
#            → 楼梯下出站层 → 出站口 5 → 换乘通道 → 地铁 1 号线站台 → 1 号线 福州火车南站 → 安平 → 回福州火车南站
#            → 换乘楼梯下 5 号线 → 5 号线 → 林浦 → 回福州火车南站 → 换乘楼梯上 1 号线 → 1 号线一站一站坐到 达道（报站说 C 出口）
#            → 楼梯上站厅 → C 出口 → 上下杭（走到三通桥）→ 回站 → 1 号线 → 东街口 → 换乘楼梯下 4 号线 → 4 号线 → 西门 → B 出口 → 西湖公园
#            → 回西门站台 → 4 号线到帝封江（L4↔L5 换乘）→ 4 号线回前屿 → 换乘 2 号线 → 鼓山（报站 A 出口）→ A 出口 → 鼓山（第三批）
#   part gz：广州东 → 复兴号 → 选福州 → D3309（07:47 → 厦门北 11:56/12:00 → 13:29 福州南）1 倍速全程（途经厦门北提示、九龙江 + 泉州湾两座桥播报）
#            → 福州南站台下车 → 回车上 → G3027 开往厦门北：坐下、关门、开车（走出一段）
# 断言（动车）：ride.s 一直在涨；车窗外景物（道床贴图偏移）走过的距离 ≈ ride.s（车厢本身不动，是景物在动）；玩家一直在车厢里坐着；
#   区段（远/中/近景）按顺序推进；速度一直是 1 倍；到站在福州南站台。
# 用法：python tests/e2e/fz_ride.py BASE part(xm|gz) [日志 json]
import asyncio, sys, json, os, time
sys.path.insert(0, os.path.dirname(__file__))
from common import *
from journey import GCLOCK, gt, auto, wait, log
from perfhud import perf
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8123/'
PART = sys.argv[2] if len(sys.argv) > 2 else 'xm'
EO, XO, FO, FS = 2200, 3000, 5000, 6000
DTMAX = 0.25   # main() 给整套测试设的每帧 dt 上限；动车 1 倍速段临时改 0.2，结束后恢复成这个值
R = {'part': PART, 'checks': {}, 'emu': {}, 'hops': [], 'perf': {}, 'times': {}}
T0 = time.time()
def ok(name, v): R['checks'][name] = bool(v); log('check', name, bool(v), f'{time.time() - T0:.0f}s'); return v
async def E(pg): return await pg.evaluate('__game.east.info()')
async def view(pg, v):
    if await pg.evaluate('__game.player.view') != v: await pg.evaluate('__game.toggleView()')
async def walk(pg, pts, leg=14.0):
    s = await st(pg); x, z = s['pos'][0], s['pos'][2]; out = []
    for tx, tz in pts:
        d = ((tx - x) ** 2 + (tz - z) ** 2) ** 0.5; n = max(1, int(d // leg) + 1)
        out += [[x + (tx - x) * k / n, z + (tz - z) * k / n] for k in range(1, n + 1)]; x, z = tx, tz
    return await auto(pg, out, True)
HOOKS = """(() => {
  window.__caps=[]; addEventListener('gz-audio-caption', e => { if (e.detail && e.detail.id && __caps[__caps.length-1] !== e.detail.id) __caps.push(e.detail.id); });
  window.__emu=[]; __game.events.on('emu', d => __emu.push(d));
  // 景物真的在往后跑：直接累计 scenery.advance(d) 的 d（低帧率下每帧 d 很大，量 uOffset 会绕圈失真）
  window.__scn={d:0, n:0}; __game.scene.onAfterRenderObservable.add(() => { const I=__game.east.interior, sc=I && I.scenery; if (!sc || sc.__scnHook) return;
    const orig=sc.advance.bind(sc); sc.advance=(d, seg) => { if (__game.east.ride && d > 0) { __scn.d+=d; __scn.n++; } return orig(d, seg); }; sc.__scnHook=true; });
})()"""

# ---------- 动车 ----------
async def to_emu_gz(pg):
    """广州东：地铁 1 号线站台 → 站厅 → 出口 → 过马路 → 候车大厅 → 检票 → 站台 → 5 号车厢车门（gze.py 同一条路）"""
    await pg.evaluate('__game.teleport(18.6,-11.95,12.6,0)'); await asyncio.sleep(0.8)
    await auto(pg, [[18.6, 13.1], [15.4, 13.1], [-1.6, 13.1], [-2.2, 13.1], [-2.2, 1.4], [2, 1.4], [2, -4.6], [8.6, -4.6]])
    # 站厅拐角 (10.77,-15.6) 低帧率易卡在柱边：先主路径，失败则改走 z=-18 走廊绕开
    ok1 = await auto(pg, [[10.5, -4.6], [10.5, -12.0], [10.5, -15.6], [6.0, -15.6], [1.2, -15.6], [1.2, -20], [1.2, -36], [1.2, -40.5]])
    if not ok1:
        s = await st(pg); log('toEmu:retry-via-z18', s['pos'])
        await auto(pg, [[10.5, s['pos'][2]], [10.5, -18.5], [8.0, -18.5], [4.0, -18.5], [1.2, -18.5], [1.2, -28], [1.2, -36], [1.2, -40.5]])
    await auto(pg, [[1.2, -50], [0, -62], [0, -80], [0, -86], [0, -92], [1.5, -100]])
    await auto(pg, [[1.5, -108], [1.5, -111.9], [1.5, -115], [1.5, -117.4], [9, -117.4], [9, -122.5]])
    await auto(pg, [[9, -124], [-5.8, -124], [-5.8, -127.3], [-5.8, -128.6]])
    return await wait(pg, '__game.east.info().inside', 6)
async def sit_row14(pg):
    await auto(pg, [[EO + 10.6, 0.25], [EO + 9.0, 0.3], [EO + 4.2, 0.3]])
    await pg.evaluate('__game.act()'); await asyncio.sleep(0.8)
    return (await st(pg))['seat'].get('seated')
async def pick_card(pg, dest, want):
    ok(f'picker:{dest}', await wait(pg, '__game.east.info().picker', 8))
    cards = await pg.evaluate("[...document.querySelectorAll('#destPick .dp-card')].map(b=>b.dataset.dest+'|'+b.textContent)")
    R.setdefault('cards', []).append(cards); ok(f'cards:{dest}', [c.split('|')[0] for c in cards] == want)
    await pg.evaluate(f"document.querySelector('#destPick .dp-card[data-dest={dest}]').dispatchEvent(new PointerEvent('pointerup', {{bubbles:true}}))")
    return await wait(pg, f'!__game.east.info().picker && __game.east.info().dest==="{dest}"', 4)
async def leave_car(pg):
    if (await st(pg))['seat'].get('seated'): await pg.evaluate('__game.act()'); await asyncio.sleep(0.6)
    await view(pg, 'third')
    await auto(pg, [[EO + 9.0, 0.25], [EO + 10.6, 0.25], [EO + 11.2, 0.9], [EO + 11.2, 2.0]])
async def emu_ride(pg, key, wall=1500):
    """1 倍速全程：每隔几秒采样一次，直到到站（count.arrived 增加）"""
    n0 = len((await E(pg))['count']['arrived'])
    ok(key + ':run', await wait(pg, '!!__game.east.info().ride && __game.east.info().ride.phase === "run"', 20))
    await pg.evaluate('window.__scn.d=0')
    # 低帧率（box 上并发浏览器多时 fps≈1）下 main.js 把每帧 dt 截到 0.05 s，游戏钟只走墙钟的 ~5%，5 分钟的 D3309 要跑一个多小时。
    # 乘车期间把 dt 上限放宽到 0.2 s（仍是 1 倍速，只是低帧率时少丢时间），并且只要 rt 还在走就继续等（停滞 180 s 或总 4500 s 才算失败）。
    await pg.evaluate('__game.setDtMax(0.2)')
    samples, t0 = [], time.time(); arrived = False; last_rt, last_prog = -1, time.time()
    while time.time() - t0 < wall or (time.time() - last_prog < 180 and time.time() - t0 < 3 * wall):
        e = await E(pg); s = await st(pg)
        if len(e['count']['arrived']) > n0: arrived = True; break
        r = e['ride']
        if r and r['rt'] > last_rt: last_rt, last_prog = r['rt'], time.time()
        if r: samples.append({'w': round(time.time() - t0), 'rt': r['rt'], 's': r['s'], 'v': r['v'], 'rem': r['rem'], 'phase': r['phase'], 'speed': e['speed'], 'inside': e['inside'],
                              'seated': bool(s['seat'].get('seated')), 'x': s['pos'][0], 'scn': round(await pg.evaluate('__scn.d')), 'far': r['seg']['far'], 'mid': r['seg']['mid'], 'near': r['seg']['near']})
        tb = time.time(); await asyncio.sleep(4); gap = time.time() - tb
        if gap > 60: t0 += gap - 4; last_prog += gap - 4   # box 整机挂起（没 agent 在跑时会冻结）恢复后墙钟一下跳几十分钟：冻结时段不算进 wall/停滞判定
    await pg.evaluate(f'__game.setDtMax({DTMAX})')   # 恢复全局上限（以前误设回 0.05，之后的地铁段游戏钟只走墙钟 ~5%，L1a 240 s 墙钟内车都没出站）
    R['emu'][key] = {'samples': samples, 'wall': round(time.time() - t0), 'scn': await pg.evaluate('__scn.d')}
    log(key, 'samples', len(samples), 'wall', R['emu'][key]['wall'])
    ok(key + ':arrived', arrived)
    ss = [x['s'] for x in samples]
    ok(key + ':moves', len(ss) >= 8 and all(b >= a for a, b in zip(ss, ss[1:])) and ss[-1] - ss[0] > 1000)
    ok(key + ':speed1x', all(x['speed'] == 1 for x in samples))
    ok(key + ':inCarSeated', all(x['inside'] and x['seated'] and abs(x['x'] - EO) < 30 for x in samples))
    scn = R['emu'][key]['scn']; ok(key + ':sceneryMoves', ss and scn > 0.8 * ss[-1])
    rts = [x['rt'] for x in samples]; ok(key + ':noJumps', all(0 <= b - a < 12 for a, b in zip(rts, rts[1:])))   # 采样间隔 4 秒墙钟：rt 每次最多走十来秒
    mids = [x['mid'] for x in samples]; order = [m for i, m in enumerate(mids) if i == 0 or mids[i - 1] != m]; R['emu'][key]['order'] = order
    ok(key + ':segsAdvance', len(order) >= 3)
    return samples

# ---------- 地铁（自然班次） ----------
SLOT = "__game.fzMetro.slots.find(o=>o.line===%d&&o.step===%d)"
async def geo(pg, line, step):
    return await pg.evaluate(f"(() => {{ const s={SLOT % (line, step)}; return s ? {{trackZ:s.side.trackZ, zc:s.P.zc, y:s.P.y, side:s.side.key}} : null; }})()")
async def board(pg, line, step, tag):
    g = await geo(pg, line, step)
    if not ok(f'{tag}:slot', g): return False
    sg = 1 if g['zc'] > g['trackZ'] else -1
    await auto(pg, [[FO + 1, g['trackZ'] + sg * 3.4], [FO, g['trackZ'] + sg * 3.4], [FO, g['trackZ'] + sg * 2.0]])   # 站到屏蔽门前（车门正对的位置）等车
    t0 = time.time()
    ok(f'{tag}:trainCame', await wait(pg, f"['opening','dwell'].includes(({SLOT % (line, step)}||{{}}).state)", 150))
    R['times'][tag + ':waitTrain'] = round(time.time() - t0)
    await auto(pg, [[FO, g['trackZ'] + sg * 0.4]])
    return ok(f'{tag}:aboard', await wait(pg, '__game.state().aboard', 6))
async def ride_to(pg, line, step, code, tag, hops):
    """坐着不动，一站一站自然开（关门 → 出站 → 隧道 → 进站 → 开门 → 停站 → 关门 ……）直到 code 站开门"""
    # 预算按游戏时间计（每站 120 s 游戏时间 + 120 s）：低帧率下墙钟会远超这个数；游戏钟 180 s 墙钟不动或总墙钟 2 h 才算卡死
    seen, phases, t0 = [], set(), time.time(); g0 = await gt(pg); last = (g0, t0)
    while await gt(pg) - g0 < 120 * hops + 120 and time.time() - t0 < 7200:
        g = await gt(pg)
        if g != last[0]: last = (g, time.time())
        elif time.time() - last[1] > 180: log(tag, 'game clock stalled 180s at', round(g, 1)); break
        i = await pg.evaluate(f"""(() => {{ const m=__game.fzMetro, s={SLOT % (line, step)}; return {{code:m.code, ride:m.ride?m.ride.phase:null, st:s?s.state:null, ab:__game.state().aboard}}; }})()""")
        if i['ride']: phases.add(i['ride'])
        if not seen or seen[-1] != i['code']: seen.append(i['code']); log(tag, 'at', i['code'], round(time.time() - t0))
        if not i['ab']: break
        if i['code'] == code and i['ride'] and i['st'] in ('opening', 'dwell') and len(seen) > 1: break
        await asyncio.sleep(0.4)
    R['hops'].append({'tag': tag, 'line': line, 'seen': seen, 'phases': sorted(phases), 'wall': round(time.time() - t0)})
    ok(f'{tag}:arrived', seen[-1] == code and len(seen) == hops + 1 and 'cruise' in phases and await pg.evaluate('__game.state().aboard'))
    g = await geo(pg, line, step); sg = 1 if g['zc'] > g['trackZ'] else -1
    await auto(pg, [[FO, g['trackZ'] + sg * 0.4], [FO, g['trackZ'] + sg * 3.6]])
    return ok(f'{tag}:alighted', await wait(pg, '!__game.state().aboard && !__game.fzMetro.ride', 8))
def stairs_down(zc): return [[[FO + 1, zc + 2.7], [FO + 21.6, zc + 2.7]], [[FO + 21.6, zc - 1.0], [FO + 19.5, zc - 1.0]], [[FO + 12, zc - 1.0], [FO + 3.5, zc - 1.0]], [[FO + 0, zc - 1.0], [FO + 0, zc]]]
def stairs_up(zc): return [[[FO + 0, zc - 1.0], [FO + 3.5, zc - 1.0]], [[FO + 12, zc - 1.0], [FO + 19.5, zc - 1.0]], [[FO + 21.6, zc - 1.0], [FO + 21.6, zc + 2.7]], [[FO + 1, zc + 2.7]]]
async def legs(pg, L):
    for l in L: await auto(pg, l, True)
async def plat_to_street(pg, code, tag):
    info = await pg.evaluate("(() => { const P=__game.fzMetro.station.platforms.find(p=>p.up); return P ? {zm:(P.up.z0+P.up.z1)/2} : null; })()")
    ex = await pg.evaluate(f"(async () => {{ const E=(await import('/js/data/fz-exits.js')).FZ_EXITS['{code}']; return {{x:E.x, n:E.n}}; }})()")
    zm = info['zm']
    await auto(pg, [[FO + 2, zm], [FO - 3, zm], [FO - 12, zm]], True); await auto(pg, [[FO - 21.5, zm]], True); await auto(pg, [[FO - 22, -6], [FO - 15, -12]], True)
    s = await st(pg); ok(tag + ':concourse', s['zone'] == 'concourse')
    await auto(pg, [[FO + ex['x'], -16]], True); await auto(pg, [[FO + ex['x'], -20], [FO + ex['x'], -36]], True)
    if not await pg.evaluate("!!__game.fzMetro.street"):
        s = await st(pg); await auto(pg, [[FO + ex['x'], s['pos'][2] - 6], [FO + ex['x'], -36]], True)
    street = await pg.evaluate("__game.fzMetro.street ? __game.fzMetro.street.info() : null")
    ok(tag + ':street', street and street['code'] == code)
    return ex, zm
async def to_attraction(pg, code, tag):
    G = await pg.evaluate(f"(async () => (await import('/js/world/fzAttr.js')).FZ_ATTR_GOAL['{code}'])()")
    path = [[FS + x, z] for x, z in (G.get('path') or [[G['x'], G['z']]])]
    await walk(pg, [[FS, 4]] + path)
    s = await st(pg); d = ((s['pos'][0] - FS - G['x']) ** 2 + (s['pos'][2] - G['z']) ** 2) ** 0.5
    R.setdefault('goal', {})[code] = {'pos': s['pos'], 'd': round(d, 2), 'name': G['name']}
    ok(tag + ':reachedAttraction', d <= G['r'] and await pg.evaluate("!!__game.fzMetro.street"))
    await view(pg, 'first'); await pg.evaluate('__game.player.pitch=0.04'); await asyncio.sleep(1)
    R['perf'][code] = await perf(pg, 3, 0.25); await view(pg, 'third')
    await walk(pg, list(reversed(path[:-1])) + [[FS, 4], [FS, -4]]); await asyncio.sleep(0.5)
    return ok(tag + ':backFromStreet', not await pg.evaluate("!!__game.fzMetro.street"))
async def street_to_plat(pg, ex, zm, tag):
    await auto(pg, [[FO + ex['x'], -20], [FO + ex['x'], -15]], True)
    await auto(pg, [[FO - 15, -12], [FO - 22, -6]], True); await auto(pg, [[FO - 21.5, zm], [FO - 12, zm]], True); await auto(pg, [[FO - 3, zm], [FO + 1, zm]], True)
    s = await st(pg); return ok(tag + ':backOnPlatform', s['zone'] == 'platform' and abs(s['pos'][1] + 13) < 0.4)
def caps_has(caps, *subs): return all(any(sb in c for c in caps) for sb in subs)

async def part_gz(pg):
    ok('gz:toEmu', await to_emu_gz(pg))
    ok('gz:seated', await sit_row14(pg))
    ok('gz:pickFz', await pick_card(pg, 'fz', ['xm', 'fz']))
    ok('gz:cardD3309', any(c.startswith('fz|') and 'D3309' in c for c in R['cards'][-1]))
    ok('gz:ride', await wait(pg, '!!__game.east.info().ride && __game.east.info().ride.dest==="fz"', 8))
    T = await pg.evaluate('(() => { const t=__game.east.ride.trip; return {train:t.train, dep:t.dep, arr:t.arr, from:t.from, to:t.to, via:t.via}; })()'); R['trip'] = T
    ok('gz:D3309', T['train'] == 'D3309' and T['dep'] == '07:47' and T['arr'] == '13:29' and T['from'].startswith('广州东') and T['to'].startswith('福州南') and T['via'] and T['via']['stn'].startswith('厦门北'))
    await pg.evaluate('__caps.length=0; __emu.length=0')
    await emu_ride(pg, 'D3309')
    toasts = [d.get('toast') for d in await pg.evaluate('__emu') if d and d.get('toast')]; R['toasts'] = toasts
    ok('D3309:passXiamenbei', any('厦门北' in t for t in toasts))
    caps = await pg.evaluate('__caps'); R['caps'] = caps
    ok('D3309:bridges', caps_has(caps, 'emu.bridge.zh', 'emu.qzw.zh'))
    ok('D3309:arriveAnn', caps_has(caps, 'emu.next.gzf', 'emu.arrive.gzf'))
    e = await E(pg); ok('D3309:atFzs', e['side'] == 'fz' and e['fzs'] and e['fzs']['mode'] == 'car')
    ok('D3309:doorOpen', await wait(pg, '__game.east.info().door <= 0', 6))
    await leave_car(pg)
    ok('D3309:onPlatform', await wait(pg, '__game.east.info().loc === "fzs"', 6))
    s = await st(pg); px = s['pos'][0]; R['fzsPos'] = s['pos']
    # G3027：回到车上 → 坐下（福州南只有一个目的地：不弹卡片）→ 关门开车
    await auto(pg, [[px, -126.2]]); await auto(pg, [[px, -127.3], [px, -128.6]])
    ok('G3027:inside', await wait(pg, '__game.east.info().inside', 6))
    e = await E(pg); ok('G3027:dests', e['dests'] == ['xm'])
    ok('G3027:seated', await sit_row14(pg))
    ok('G3027:ride', await wait(pg, '!!__game.east.info().ride && __game.east.info().ride.dest==="xm"', 10))
    ok('G3027:train', (await E(pg))['ride']['train'] == 'G3027')
    ok('G3027:departed', await wait(pg, '__game.east.info().ride.phase === "run" && __game.east.info().ride.s > 150 && __game.east.info().door >= 0.99', 90))
    e = await E(pg); R['G3027'] = e['ride']; ok('G3027:1x', e['speed'] == 1 and e['inside'])

async def part_xm(pg):
    # 广州东 → 厦门北（1 倍速）
    ok('xm:toEmu', await to_emu_gz(pg)); ok('xm:seated', await sit_row14(pg))
    ok('xm:pickXm', await pick_card(pg, 'xm', ['xm', 'fz']))
    await emu_ride(pg, 'gz2xm')
    ok('xm:doorOpen', await wait(pg, '__game.east.info().door <= 0', 6))
    await leave_car(pg)
    ok('xm:atXmn', await wait(pg, '__game.east.info().loc === "xmn"', 6))
    s = await st(pg); px = s['pos'][0]
    await auto(pg, [[px, -126.2]]); await auto(pg, [[px, -127.3], [px, -128.6]])
    ok('xm:reboard', await wait(pg, '__game.east.info().inside', 6))
    ok('xm:seated2', await sit_row14(pg))
    ok('xm:pickFz', await pick_card(pg, 'fz', ['gz', 'fz']))
    T = await pg.evaluate('(() => { const t=__game.east.ride ? __game.east.ride.trip : __game.east.interior.trip; return {train:t.train, dep:t.dep, arr:t.arr, to:t.to}; })()'); R['trip'] = T
    ok('G3028', T['train'] == 'G3028' and T['dep'] == '13:25' and T['arr'] == '14:35' and T['to'].startswith('福州南'))
    await pg.evaluate('__caps.length=0')
    await emu_ride(pg, 'G3028')
    e = await E(pg); ok('G3028:atFzs', e['side'] == 'fz' and e['fzs'] and e['fzs']['mode'] == 'car')
    ok('G3028:doorOpen', await wait(pg, '__game.east.info().door <= 0', 6))
    await leave_car(pg)
    ok('fzs:platform', await wait(pg, '__game.east.info().loc === "fzs"', 6))
    # 站台 → 楼梯 → 出站层 → 出站口 5 → 换乘通道 → 地铁站厅 → 1 号线站台
    await auto(pg, [[FO - 4.6, -126.6], [FO - 8, -123.3], [FO - 12, -123.3]]); await auto(pg, [[FO - 30, -123.3]])
    s = await st(pg); e = await E(pg); ok('fzs:arrivalsHall', s['pos'][1] < -6 and e['area'] == 'hall')
    await auto(pg, [[FO - 24, -112], [FO - 20, -104]]); await auto(pg, [[FO - 20, -96], [FO - 20, -88]])
    s = await st(pg); ok('fzs:throughExit5', s['pos'][2] > -99)
    await auto(pg, [[FO - 30, -80], [FO - 42, -80]]); await auto(pg, [[FO - 64, -80]]); await auto(pg, [[FO - 86, -80], [FO - 94, -80]])
    await auto(pg, [[FO - 99, -79.4], [FO - 99, -75.8]]); await auto(pg, [[FO - 108.5, -75.8], [FO - 108.5, -80]])
    await auto(pg, [[FO - 101, -80], [FO - 93, -80]])
    ok('fzs:toMetro', await wait(pg, '__game.east.info().loc==="fzmetro" && !!(__game.fzMetro && __game.fzMetro.station)', 8))
    await auto(pg, [[FO - 64, -80]]); await auto(pg, [[FO - 36, -80], [FO - 20, -78.5]])
    s = await st(pg); ok('fzfzn:L1platform', s['zone'] == 'platform' and abs(s['pos'][1] + 13) < 0.3 and await pg.evaluate('__game.fzMetro.code==="fzfzn"'))
    # 1 号线：福州火车南站 → 安平 → 回来
    if await board(pg, 1, 1, 'L1a'): await ride_to(pg, 1, 1, 'fzap', 'L1a', 1)
    if await board(pg, 1, -1, 'L1b'): await ride_to(pg, 1, -1, 'fzfzn', 'L1b', 1)
    # 换乘楼梯下 5 号线 → 林浦 → 回来 → 楼梯上 1 号线
    await legs(pg, stairs_down(-80)); s = await st(pg); ok('fzfzn:downToL5', s['pos'][1] < -21 and s['zone'] == 'platform')
    if await board(pg, 5, -1, 'L5a'): await ride_to(pg, 5, -1, 'fzlj', 'L5a', 1)
    if await board(pg, 5, 1, 'L5b'): await ride_to(pg, 5, 1, 'fzfzn', 'L5b', 1)
    await legs(pg, stairs_up(-80)); s = await st(pg); ok('fzfzn:upToL1', abs(s['pos'][1] + 13) < 0.4 and s['zone'] == 'platform')
    # 1 号线往北一站一站坐到 达道（下一站报“附近有上下杭，请从C出口出站”）
    await pg.evaluate('__caps.length=0')
    if await board(pg, 1, -1, 'L1dd'): await ride_to(pg, 1, -1, 'fzdd', 'L1dd', 10)
    await asyncio.sleep(3)
    caps = await pg.evaluate('__caps'); R['capsDd'] = caps
    ok('fzdd:visitAnn', caps_has(caps, 'fzvisit.fzdd.zh', 'fzvisit.fzdd.en'))
    ok('fzdd:exitAnn', caps_has(caps, 'fzexit.fzdd.zh'))
    ok('fzdd:noFzhNanYue', not any(c.endswith(('.fzh', '.nan', '.yue')) for c in caps))
    ex, zm = await plat_to_street(pg, 'fzdd', 'fzdd')
    ok('fzdd:exitC', ex['n'] == 'C')
    await to_attraction(pg, 'fzdd', 'fzdd')
    await street_to_plat(pg, ex, zm, 'fzdd')
    # 1 号线 → 东街口 → 换乘楼梯下 4 号线 → 西门 → B 出口 → 西湖公园
    if await board(pg, 1, -1, 'L1djk'): await ride_to(pg, 1, -1, 'fzdjk', 'L1djk', 3)
    await legs(pg, stairs_down(0)); s = await st(pg); ok('fzdjk:downToL4', s['pos'][1] < -21 and s['zone'] == 'platform')
    await pg.evaluate('__caps.length=0')
    if await board(pg, 4, -1, 'L4'): await ride_to(pg, 4, -1, 'fzxm', 'L4', 1)
    await asyncio.sleep(3); caps = await pg.evaluate('__caps'); R['capsXm'] = caps
    ok('fzxm:visitExitAnn', caps_has(caps, 'fzvisit.fzxm.zh', 'fzexit.fzxm.zh'))
    ex, zm = await plat_to_street(pg, 'fzxm', 'fzxm'); ok('fzxm:exitB', ex['n'] == 'B')
    await to_attraction(pg, 'fzxm', 'fzxm')
    await street_to_plat(pg, ex, zm, 'fzxm')
    await part_b3(pg)

async def part_b3(pg):
    """第三批线路：西门 → 4 号线到帝封江（16 站）→ L4↔L5 换乘楼梯 → 4 号线回前屿（8 站）→ 换乘 2 号线 → 鼓山（报站 A 出口）→ A 出口 → 鼓山"""
    if await board(pg, 4, 1, 'L4dfj'): await ride_to(pg, 4, 1, 'fzdfj', 'L4dfj', 16)
    zc = await pg.evaluate('__game.fzMetro.station.platforms[0].zc')
    await legs(pg, stairs_down(zc)); s = await st(pg)
    ok('fzdfj:downToL5', s['pos'][1] < -21 and s['zone'] == 'platform')
    await legs(pg, stairs_up(zc)); s = await st(pg)
    ok('fzdfj:upToL4', abs(s['pos'][1] + 13) < 0.5 and s['zone'] == 'platform')
    if await board(pg, 4, -1, 'L4qy'): await ride_to(pg, 4, -1, 'fzqy', 'L4qy', 8)
    zc = await pg.evaluate('__game.fzMetro.station.platforms[0].zc'); g2 = await geo(pg, 2, 1); s = await st(pg)
    R['fzqy'] = {'zc': zc, 'l2': g2, 'pos': s['pos']}
    if g2 and g2['y'] > s['pos'][1] + 4: await legs(pg, stairs_up(zc))
    elif g2 and g2['y'] < s['pos'][1] - 4: await legs(pg, stairs_down(zc))
    s = await st(pg); ok('fzqy:toL2', g2 and abs(s['pos'][1] - g2['y']) < 0.5 and s['zone'] == 'platform')
    await pg.evaluate('__caps.length=0')
    if await board(pg, 2, 1, 'L2gs'): await ride_to(pg, 2, 1, 'fzgs', 'L2gs', 2)
    await asyncio.sleep(3); caps = await pg.evaluate('__caps'); R['capsGs'] = caps
    ok('fzgs:visitExitAnn', caps_has(caps, 'fzvisit.fzgs.zh', 'fzvisit.fzgs.en', 'fzexit.fzgs.zh'))
    ok('fzgs:noFzhNanYue', not any(c.endswith(('.fzh', '.nan', '.yue')) for c in caps))
    ex, zm = await plat_to_street(pg, 'fzgs', 'fzgs'); ok('fzgs:exitA', ex['n'] == 'A')
    await to_attraction(pg, 'fzgs', 'fzgs')

async def part_b3dev(pg):
    """开发用：直接从西门 4 号线站台开始跑 part_b3（正式测试走 part xm 全程）"""
    await pg.evaluate("""(() => { const g=__game; g.east.ensure(); g.east.side='fz'; g.east.cur={st:g.station, loc:'fzmetro', area:'metro'}; g.station.kit.root.setEnabled(false); g.fzMetro.enterFromRailway(g.player);
      g.fzMetro.buildStation('fzxm'); g.player.spawn(5002, -12.95, g.fzMetro.station.platforms[0].zc, -Math.PI/2); })()""")
    await asyncio.sleep(1.5); await part_b3(pg)

async def main():
  async with async_playwright() as p:
    b, pg, logs = await open_game(p, BASE + '?q=1&start=gzdz&line=1')
    await pg.evaluate(GCLOCK); await pg.evaluate(f'__game.setDtMax({DTMAX})'); await pg.evaluate(HOOKS); await asyncio.sleep(1.5)
    await view(pg, 'third')
    try:
      await {'gz': part_gz, 'xm': part_xm, 'b3dev': part_b3dev}[PART](pg)
    except Exception as e:
      R['exception'] = repr(e); log('EXC', repr(e))
    R['errors'] = errs(logs); R['wall'] = round(time.time() - T0); await b.close()
  good = all(R['checks'].values()) and not R['errors'] and 'exception' not in R
  print(json.dumps(R, ensure_ascii=False, indent=1, default=str))
  print('FZ_RIDE', PART, 'PASS' if good else 'FAIL', [k for k, v in R['checks'].items() if not v], f"{R['wall']}s", flush=True)
  if not good: sys.exit(1)
if __name__ == "__main__": asyncio.run(main())
