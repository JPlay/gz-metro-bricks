# 福州内河 1A（白马河 + 安泰河 + 东西河首段；游船 A 线 西湖码头—西水关码头—黎明湖码头）e2e：全程真走（autopilot 走路 + 真点按钮），不传送。
# 只有开头一次：跟 fz_attr.py 一样把人放到西门站台（进站这段别的测试已经测过）。之后：
# 1. 站台 → 站厅 → 西门 C 出口 → 河边街区（出口亭）
# 2. 21 座桥每座来回各走一遍（桥两头之间直线走过桥面；拱桥 / 驼峰桥量最高点），桥与桥之间沿河边步道走（A* 按真实碰撞体找路）
# 3. 三处水埠头：走下台阶 → 从敞开的一侧走进水里 → 「回到岸上」按钮真点 → 回到岸上
# 4. 游船：西水关上船坐下（真点「坐下」）→ 黎明湖（正向）下船（真点「起身」）→ 走到西洋 A 出口亭进站 → 再从 A 口出来回河边
#    → 黎明湖上船 → 西水关（反向）下船 → 再上 → 西湖码头下船 → 再上 → 西水关（正向）下船 → 走回西门 C 出口亭进站
#    行船中每帧检查：船篷四角在桥下的净空（按真实船位 + 起伏）≥ 0.25 m；人和船每帧位移（不跳）；
# 5. 性能：每座桥头 / 码头 / 船上采样 draws / 三角形，报最差的视角；截图：河边、安泰河拱桥 + 白墙黛瓦、码头牌、船上座位视角、船过桥
# 用法：python tests/e2e/fz_river.py [base-url] [截图目录或 -] [阶段（可选，逗号分隔：bridges,steps,boat / 1B：e_bridges,e_steps,e_boat）]
# 1B（阶段名 e_ 开头）：斗门站台 → 站厅 → C 出口 → 晋安河（温泉公园码头旁）；13 座桥来回；3 处水埠头落水回岸；
#   （1:4 / 1:5 后 13 座桥）B 线：温泉公园 → 福新问渡 → 东门停靠点（下船走进东门 C 出口亭进站、再出来）→ 河口 → 光明港（下船走进光明港 D 进站、再出来）
#   → 反向 光明港 → 河口 → 东门停靠点；每个码头都真点「起身」下船走上岸；行船每帧量篷顶净空 / 位移
import asyncio, sys, json, os, time, math
sys.path.insert(0, os.path.dirname(__file__))
from common import *
from journey import GCLOCK, auto, wait, log
from perfhud import perf
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8123/'
OUT = (sys.argv[2].rstrip('/') + '/') if len(sys.argv) > 2 and sys.argv[2] != '-' else None
STAGES = set((sys.argv[3] if len(sys.argv) > 3 else 'bridges,steps,boat').split(','))
FO = 5000; TELEPORT = 2.5
BUDGET = {'draws': 50, 'tris': 90000}
E1B = any(x.startswith('e_') for x in STAGES)   # 1B 东线（晋安河 + 光明港，B 线）：阶段 e_bridges,e_steps,e_boat
NAV = open(os.path.join(os.path.dirname(__file__), 'fz_river_nav.js')).read()
R = {'checks': {}, 'bridges': {}, 'steps': {}, 'legs': [], 'perf': {}, 'shots': [], 'walk': []}
def ok(k, v, info=None):
    R['checks'][k] = bool(v); log('check', k, bool(v), '' if v or info is None else json.dumps(info, ensure_ascii=False, default=str)[:400]); return v
JUMP = """window.__jmp===undefined && (window.__jmp={max:0, last:null, ymax:-99}, __game.scene.onAfterRenderObservable.add(()=>{ const p=__game.player.position, J=window.__jmp;
  if (J.last) { const d=Math.hypot(p.x-J.last[0], p.y-J.last[1], p.z-J.last[2]); if (d>J.max) J.max=d; } J.last=[p.x,p.y,p.z]; if (p.y>J.ymax) J.ymax=p.y; }))"""
# 船篷净空：每帧按船的真实世界矩阵算篷顶四角 + 两侧中点，落在桥面投影里就量 桥底 − 篷顶
CLEAR = """(async () => { const M = await import('/js/data/fz-river.js'); window.__fzR = M;
  window.__clr = { min: 99, per: {}, frames: 0 };
  __game.scene.onAfterRenderObservable.add(() => { const S = __game.fzMetro.street; if (!S || !S.boat) return; const b = S.boat, n = b.node, Rt = S.kit.root.position, C = window.__clr; C.frames++;
    const m = n.getWorldMatrix(), B = BABYLON, top = M.BOAT.top, L = M.BOAT.canopyHalfLen, Wd = M.BOAT.canopyHalfW;
    for (const [lx, lz] of [[-Wd, -L], [Wd, -L], [Wd, L], [-Wd, L], [-Wd, 0], [Wd, 0], [0, 0]]) {
      const q = B.Vector3.TransformCoordinates(new B.Vector3(lx, top, lz), m), x = q.x - Rt.x, z = q.z - Rt.z;
      for (const br of M.BRIDGES) { const { u, v } = M.bridgeLocal(br, x, z); if (Math.abs(u) > br.w / 2 || Math.abs(v) > br.half) continue;
        const gap = M.soffitAt(br, v) - q.y; if (!C.per[br.id] || gap < C.per[br.id]) C.per[br.id] = +gap.toFixed(3); if (gap < C.min) C.min = gap; } } });
  return true; })()"""
async def jreset(pg): await pg.evaluate('window.__jmp.max=0; window.__jmp.last=null; window.__jmp.ymax=-99')
async def jget(pg): return await pg.evaluate('window.__jmp')
async def tap(pg, sel):
    box = await pg.locator(sel).first.bounding_box()
    if not box: return False
    await pg.touchscreen.tap(box['x'] + box['width'] / 2, box['y'] + box['height'] / 2); return True
async def legs(pg, pts, run=True, leg=12.0):
    s = await st(pg); x, z = s['pos'][0], s['pos'][2]; out = []
    for tx, tz in pts:
        d = math.hypot(tx - x, tz - z); n = max(1, int(d // leg) + 1)
        out += [[x + (tx - x) * k / n, z + (tz - z) * k / n] for k in range(1, n + 1)]; x, z = tx, tz
    return await auto(pg, out, run)
async def W(pg, x, z):
    r = await pg.evaluate('(() => { const p = __game.fzMetro.street.kit.root.position; return [p.x, p.z]; })()'); return [r[0] + x, r[1] + z]
async def nav(pg):
    r = await pg.evaluate(NAV); log('nav grid', r); return r
async def go(pg, tx, tz, label, tries=3):
    """A* 找路 + autopilot 真走；卡住就从当前位置重新找路（最多 3 次）"""
    for k in range(tries):
        s = await st(pg); p = await pg.evaluate(f'__fzNav.path({s["pos"][0]}, {s["pos"][2]}, {tx}, {tz})')
        if not p.get('ok'): log('go: no path', label, p); return False
        if await legs(pg, p['pts'][1:] or [p['pts'][0]]): R['walk'].append([label, p['len']]); return True
        log('go: retry', label, k)
    return False
async def near(pg, x, z, r=1.0):
    s = await st(pg); return math.hypot(s['pos'][0] - x, s['pos'][2] - z) <= r
async def shot(pg, name):
    if not OUT: return
    p = OUT + name + '.jpg'
    if await safe_shot(pg, path=p, type='jpeg', quality=70): R['shots'].append(p); log('shot', p)
async def sample(pg, label):
    d = await perf(pg, 3, 0.3); R['perf'][label] = d; return d
async def mod(pg):
    return await pg.evaluate("""(async () => { const M = await import('/js/data/fz-river.js'); return { bridges: M.BRIDGES, piers: M.PIERS, steps: M.FZR.steps, kiosks: M.KIOSKS, stops: M.STOPS.map(s => ({ id: s.id, s: s.s })), clr: M.CLEAR_MIN, wy: M.WY, clrRep: M.clearanceReport(0.5).per }; })()""")
def pf(p, a, b): return [p['x'] + p['t'][0] * a - p['n'][0] * b, p['z'] + p['t'][1] * a - p['n'][1] * b]   # 码头 / 水埠头局部坐标 → W
def bf(b, v): return [b['x'] + b['n'][0] * v, b['z'] + b['n'][1] * v]
async def street_info(pg): return await pg.evaluate('__game.fzMetro.street ? __game.fzMetro.street.info() : null')
async def boat(pg): return await pg.evaluate('__game.fzMetro.street && __game.fzMetro.street.boat ? __game.fzMetro.street.boat.info() : null')

async def enter_kiosk(pg, D, code):
    K = D['kiosks'][code]; a = await W(pg, K['x'], K['z'] + 3.2); b1 = await W(pg, K['x'], K['z'] + 0.6); b2 = await W(pg, K['x'], K['z'] - 4.4)
    await go(pg, *a, 'to kiosk ' + code); await legs(pg, [b1, b2], False)
    await wait(pg, '!__game.fzMetro.street', 8)
    s = await st(pg); m = await pg.evaluate('({ code: __game.fzMetro.code, street: !!__game.fzMetro.street })')
    return m['code'] == code and not m['street'], s, m

async def board(pg, D, pid, leg):
    P = [p for p in D['piers'] if p['id'] == pid][0]
    land = await W(pg, *pf(P, -11.6, -1.6)); top = await W(pg, *pf(P, -9.4, 0.75)); bot = await W(pg, *pf(P, -4.0, 0.75)); pont = await W(pg, *pf(P, 1.2, 1.5))
    r1 = await go(pg, *land, 'to pier ' + pid)
    await legs(pg, [top, bot, pont], False)
    s = await st(pg); ok(f'{leg}:downStairsToPontoon:{pid}', abs(s['pos'][1] - (D['wy'] + 0.45)) < 0.3 and r1, s['pos'])
    if leg == 'leg1': await shot(pg, 'pier_pontoon_' + pid)
    # 船不在这个码头就会被“叫”过来（站在浮码头上）
    okb = await wait(pg, f"(() => {{ const b = __game.fzMetro.street.boat.info(); return b.phase == 'dock' && b.at == '{pid}'; }})()", 400, 1500)
    ok(f'{leg}:boatAtPier:{pid}', okb, await boat(pg))
    door = await W(pg, *pf(P, 2.4, 2.4)); inb = await W(pg, *pf(P, 2.4, 3.9))
    await legs(pg, [door, inb], False)
    aisle = await pg.evaluate("(() => { const ss = __game.fzMetro.street.boat.seats.filter(s => s.free); const a = ss.filter(s => Math.abs(Math.abs(s.lz) - 1.3) < 0.01); const p = __game.player.position; a.sort((x, y) => Math.hypot(x.wx - p.x, x.wz - p.z) - Math.hypot(y.wx - p.x, y.wz - p.z)); const s = a[0]; return [(s.wx + s.stand.x) / 2, (s.wz + s.stand.z) / 2]; })()")
    await legs(pg, [aisle], False)
    sit = await wait(pg, "(__game.state().act||{}).id=='sit'", 20)
    if sit: await tap(pg, '#bAct')
    seated = await wait(pg, "!!(__game.player.seat && __game.player.seat.seat.boat)", 10)
    return ok(f'{leg}:seatedViaTap:{pid}', sit and seated, await st(pg))

async def ride(pg, D, leg, target, shots=False):
    b0 = await boat(pg); arr0 = b0['stats']['arrives']; await jreset(pg)
    await pg.evaluate('window.__clr.min = 99; window.__clr.per = {}')
    sbm5 = (D['clrRep'].get('bm5') or {}).get('s'); took = set(); perfs = []
    t0 = time.time(); g0 = await pg.evaluate('window.__gt'); done = False
    while time.time() - t0 < 2400:
        b = await boat(pg)
        if b['stats']['arrives'] > arr0 and b['phase'] == 'dock': done = True; break
        if await pg.evaluate('window.__gt') - g0 > 700: break
        if b['phase'] == 'go' and b['v'] > 1 and 'perf' not in took and abs(b['s'] - b0['s']) > 30:
            took.add('perf'); perfs.append(await sample(pg, f'{leg}:onBoat'))
        if shots and b['phase'] == 'go' and 'seat3' not in took and abs(b['s'] - b0['s']) > 20:
            took.add('seat3'); await pg.evaluate("if (__game.player.view!=='third') __game.toggleView()"); await shot(pg, 'boat_seated_third')
            await pg.evaluate("__game.toggleView()"); await asyncio.sleep(0.6); await shot(pg, 'boat_seated_first'); await pg.evaluate("__game.toggleView()")
        if shots and sbm5 is not None and 'arch' not in took and abs(b['s'] - sbm5) < 4:
            took.add('arch'); await shot(pg, 'boat_under_bridge_bm5_guifang')
        if shots and sbm5 is not None and 'archA' not in took and 8 < abs(b['s'] - sbm5) < 16 and (sbm5 - b['s']) * b['dir'] > 0:
            took.add('archA'); await shot(pg, 'boat_approach_bridge_bm5_guifang')
        await asyncio.sleep(0.5)
    b = await boat(pg); j = await jget(pg); c = await pg.evaluate('window.__clr')
    R['legs'].append({'leg': leg, 'from': b0['at'], 'to': b['at'], 'dir': b['dir'], 'stats': b['stats'], 'jump': j['max'], 'clr': c, 'secs': round(time.time() - t0), 'log': b['log']})
    ok(f'{leg}:arrived:{target}', done and b['at'] == target, b)
    ok(f'{leg}:smooth', j['max'] < TELEPORT and b['stats']['maxStep'] < (1.45 if E1B else 1.0) and b['stats']['maxYawStep'] < 0.12, {'jump': j['max'], 'stats': b['stats']})
    ok(f'{leg}:canopyClearance', c['min'] >= D['clr'] - 0.02, c)
    ok(f'{leg}:stillSeated', await pg.evaluate("!!(__game.player.seat && __game.player.seat.seat.boat)"))
    return done

async def alight(pg, D, pid, leg):
    P = [p for p in D['piers'] if p['id'] == pid][0]
    st_ok = await wait(pg, "(__game.state().act||{}).id=='stand'", 15)
    if st_ok: await tap(pg, '#bAct')
    up = await wait(pg, '!__game.player.seat', 8)
    ok(f'{leg}:standViaTap:{pid}', st_ok and up)
    door = await W(pg, *pf(P, 2.4, 3.9)); edge = await W(pg, *pf(P, 2.4, 2.3)); pont = await W(pg, *pf(P, 0.0, 1.4))
    bot = await W(pg, *pf(P, -4.0, 0.75)); top = await W(pg, *pf(P, -9.4, 0.75)); land = await W(pg, *pf(P, -11.6, -1.6))
    await legs(pg, [door, edge, pont], False); await legs(pg, [bot, top, land], False)
    s = await st(pg); return ok(f'{leg}:upToShore:{pid}', abs(s['pos'][1]) < 0.4 and await near(pg, *land, 1.2), s['pos'])

async def steps_stage(pg, D, shot_id=None):
    """水埠头：走下去、走进水里、点「回到岸上」（1A / 1B 共用）"""
    for S_ in D['steps']:
        sid = S_['id']; land = await W(pg, *pf(S_, -5.6, -1.6)); top = await W(pg, *pf(S_, -3.0, 0.7)); low = await W(pg, *pf(S_, 2.0, 0.7)); ld = await W(pg, *pf(S_, 3.2, 0.7)); wet = await W(pg, *pf(S_, 3.2, 3.2))
        r = await go(pg, *land, 'to steps ' + sid) and await go(pg, *top, 'onto steps ' + sid); await legs(pg, [low, ld], False)
        s = await st(pg); downOk = r and s['pos'][1] < D['wy'] + 0.9
        await legs(pg, [wet], False); await asyncio.sleep(1.0)
        shown = await wait(pg, "(() => { const b = document.getElementById('bShore'); return !!b && !b.hidden; })()", 10)
        s_in = await st(pg)
        if OUT and sid == shot_id: await shot(pg, 'steps_in_water_' + sid)
        tapped = False
        if shown:
            try: await pg.locator('#bShore').tap(timeout=15000); tapped = True
            except Exception as e: log('shore tap', str(e)[:200])
        await asyncio.sleep(1.0); s2 = await st(pg)
        onLand = await pg.evaluate(f"(async () => {{ const M = await import('/js/data/fz-river.js'); const R = __game.fzMetro.street.kit.root.position, p = __game.player.position; return M.isLand(p.x - R.x, p.z - R.z); }})()")
        R['steps'][sid] = {'down': s['pos'], 'inWater': s_in['pos'], 'after': s2['pos'], 'shown': shown, 'tapped': tapped, 'onLand': onLand}
        ok(f'steps:{sid}:downIntoWaterAndBack', downOk and shown and s_in['pos'][1] < -0.5 and tapped and abs(s2['pos'][1]) < 0.4 and onLand and s2['zone'] == 'street', R['steps'][sid])

async def bridges_stage(pg, D, order, perf_at=(), shots=None):
    """每座桥来回各走一遍（1A / 1B 共用）"""
    for bid in order:
        br = [x for x in D['bridges'] if x['id'] == bid][0]
        async def end(sg):
            far = await W(pg, *bf(br, -sg * (br['half'] - 0.6)))
            for e in (2.8, 2.2, 1.6, 1.1, 0.7):
                c = await pg.evaluate(f'__fzNav.snap(...{json.dumps(await W(pg, *bf(br, sg * (br["half"] + e))))})')
                if c and await pg.evaluate(f'__fzNav.clear({far[0]}, {far[1]}, {c[0]}, {c[1]})'): return c
            return await pg.evaluate(f'__fzNav.snap(...{json.dumps(await W(pg, *bf(br, sg * (br["half"] + 2.8))))})')
        A = await end(-1); B_ = await end(1)
        reached = await go(pg, *A, 'promenade → ' + bid)
        if bid in perf_at: R['perf']['bridge:' + bid] = await sample(pg, 'bridge:' + bid)
        await jreset(pg); r1 = await legs(pg, [B_], True); j1 = await jget(pg); n1 = await near(pg, *B_, 0.8)
        await jreset(pg); r2 = await legs(pg, [A], True); j2 = await jget(pg); n2 = await near(pg, *A, 0.8)
        rise = {'hump': 0.7, 'arch': 0.85}.get(br['kind'], 0)
        R['bridges'][bid] = {'name': br.get('name'), 'kind': br['kind'], 'reachedEnd': reached, 'there': [r1, n1, round(j1['max'], 2), round(j1['ymax'], 2)], 'back': [r2, n2, round(j2['max'], 2), round(j2['ymax'], 2)]}
        ok(f'bridge:{bid}:{br.get("name") or "-"}:bothWays', reached and r1 and n1 and r2 and n2 and j1['max'] < TELEPORT and j2['max'] < TELEPORT and j1['ymax'] >= rise - 0.25 and j2['ymax'] >= rise - 0.25, R['bridges'][bid])
        if OUT and shots and bid in shots:
            await pg.evaluate(f"__game.player.yaw = Math.atan2({br['t'][0]}, {br['t'][1]}); __game.player.pitch = 0.12"); await asyncio.sleep(0.8); await shot(pg, shots[bid])

async def station_to_exit(pg, code, exit_pred, kiosk_code):
    """站台 → 楼梯 → 站厅 → 出口通道 → 出口亭（河边）。只有开头一次 spawn 到站台（同 1A / fz_attr.py）"""
    ex = await pg.evaluate(f"(async () => {{ const E = await import('/js/data/fz-exits.js'); const e = E.FZ_EXITS['{code}']; return [e, ...(e.more || [])].find(x => {exit_pred}) || null; }})()")
    ok(f'{code}:exit', bool(ex), ex)
    info = await pg.evaluate(f"""(() => {{ const m=__game.fzMetro; __game.east.cur.loc='fzmetro'; __game.east.cur.area='metro'; const st=m.buildStation('{code}'); const P=st.platforms.find(p=>p.up); return P ? {{ zm:(P.up.z0+P.up.z1)/2 }} : null; }})()""")
    zm = info['zm']; await pg.evaluate(f"__game.player.spawn({FO}+2, -12.95, {zm}, -Math.PI/2)"); await asyncio.sleep(1)
    await auto(pg, [[FO - 3, zm], [FO - 12, zm]], True); await auto(pg, [[FO - 21.5, zm]], True); await auto(pg, [[FO - 22, -6], [FO - 15, -12]], True)
    s = await st(pg); ok(f'{code}:concourse', s['zone'] == 'concourse', s['zone'])
    exx = ex['x']; await auto(pg, [[FO + exx, -16]], True); await auto(pg, [[FO + exx, -20], [FO + exx, -36]], True)
    if not await pg.evaluate('!!__game.fzMetro.street'): s = await st(pg); await auto(pg, [[FO + exx, s['pos'][2] - 6], [FO + exx, -36]], True)
    si = await street_info(pg); ok(f'{code}:{ex["n"]}:riverStreet', si and si.get('river') and si.get('kiosk') == kiosk_code and si.get('atlasOverflow') == 0, si)
    return ex, si

async def out_and_back(pg, D, code, n, net):
    """码头 → 走进出口亭进站 → 再从同一个口出来回河边（车站出口 ↔ 河）"""
    await jreset(pg)
    okk, s, m = await enter_kiosk(pg, D, code); ok(f'{code}:{n}:walkIntoStation', okk, [s['pos'], m])
    await auto(pg, [[FO + 10, -30]], False); await auto(pg, [[FO + 10, -36]], False)
    await wait(pg, '!!__game.fzMetro.street', 8)
    si = await street_info(pg); ok(f'{code}:{n}:backOutToRiver', si and si.get('kiosk') == code and si.get('river') and si.get('net') == net, si)
    D2 = await mod(pg); await nav(pg)
    if OUT: await shot(pg, f'kiosk_{code}_{n}')
    R['perf']['kiosk:' + code] = await sample(pg, 'kiosk:' + code)
    return D2

async def run_1b(pg):
    # ---------- 1. 斗门站台 → 站厅 → C 出口 → 晋安河（温泉公园码头旁） ----------
    await pg.evaluate('window.__fzNavRes = 0.35')
    ex, si = await station_to_exit(pg, 'fzdm', "x.attr === 'fzriver'", 'fzdm')
    ok('fzdm:C:net e / route B', si and si.get('net') == 'e' and si.get('route') == 'B', si)
    await pg.evaluate(CLEAR)
    D = await mod(pg); await nav(pg); await asyncio.sleep(1)
    R['perf']['kiosk:fzdm'] = await sample(pg, 'kiosk:fzdm')
    if OUT: await shot(pg, 'kiosk_fzdm_C')
    wq = [p for p in D['piers'] if p['id'] == 'wq'][0]; sg = await W(pg, *wq['sign'])
    await jreset(pg); ok('fzdm:C:walkToPier', await go(pg, sg[0] - wq['n'][0] * 4, sg[1] - wq['n'][1] * 4, 'kiosk C → 温泉公园码头牌') and (await jget(pg))['max'] < TELEPORT)
    if OUT:
        s = await st(pg); await pg.evaluate(f"__game.player.yaw = Math.atan2({sg[0] - s['pos'][0]}, {sg[1] - s['pos'][2]}); __game.player.pitch = 0.05"); await asyncio.sleep(0.8); await shot(pg, 'pier_sign_wenquan')
    if 'e_bridges' in STAGES:
        # ---------- 2. 13 座桥每座来回（晋安河由北往南，再光明港由西往东） ----------
        order = [b['id'] for b in D['bridges'] if b['river'] == 'ja'] + [b['id'] for b in D['bridges'] if b['river'] == 'gm']
        await bridges_stage(pg, D, order, perf_at=('ja2', 'ja6', 'ja10', 'gm2'), shots={'ja2': 'jinan_from_ja2_liuyi', 'gm2': 'guangminggang_from_gm2'})
    if 'e_steps' in STAGES:
        # ---------- 3. 三处水埠头：落水 → 「回到岸上」 ----------
        await steps_stage(pg, D, 'ja_e')
    if 'e_boat' in STAGES:
        # ---------- 4. B 线：每个码头都下船上岸 ----------
        D = await mod(pg)
        if await board(pg, D, 'wq', 'eleg1'):
            await ride(pg, D, 'eleg1', 'fx', shots=bool(OUT)); await alight(pg, D, 'fx', 'eleg1')
        if await board(pg, D, 'fx', 'eleg2'):
            await ride(pg, D, 'eleg2', 'dmn'); await alight(pg, D, 'dmn', 'eleg2')
        if OUT:
            dm = [p for p in D['piers'] if p['id'] == 'dmn'][0]; sg = await W(pg, *dm['sign']); s = await st(pg)
            await pg.evaluate(f"__game.player.yaw = Math.atan2({sg[0] - s['pos'][0]}, {sg[1] - s['pos'][2]}); __game.player.pitch = 0.05"); await asyncio.sleep(0.8); await shot(pg, 'pier_sign_dongmen_stop')
        D = await out_and_back(pg, D, 'fzdmn', 'C', 'e')
        if await board(pg, D, 'dmn', 'eleg3'):
            await ride(pg, D, 'eleg3', 'hk'); await alight(pg, D, 'hk', 'eleg3')
        if await board(pg, D, 'hk', 'eleg4'):
            await ride(pg, D, 'eleg4', 'gmg'); await alight(pg, D, 'gmg', 'eleg4')
        D = await out_and_back(pg, D, 'fzgmg', 'D', 'e')
        # 反向：光明港 → 河口 → 东门停靠点
        if await board(pg, D, 'gmg', 'eleg5'):
            await ride(pg, D, 'eleg5', 'hk'); await alight(pg, D, 'hk', 'eleg5')
        if await board(pg, D, 'hk', 'eleg6'):
            await ride(pg, D, 'eleg6', 'dmn'); await alight(pg, D, 'dmn', 'eleg6')
        okk, s, m = await enter_kiosk(pg, D, 'fzdmn'); ok('dmn:walkBackToDongmenC:intoStation', okk, [s['pos'], m])
        ok('eboat:bothDirections', {l['dir'] for l in R['legs']} == {-1, 1}, [(l['from'], l['to'], l['dir']) for l in R['legs']])
        ok('eboat:alightedAtEveryPier', all(R['checks'].get(f'{lg}:upToShore:{pid}') for lg, pid in [('eleg1', 'fx'), ('eleg2', 'dmn'), ('eleg3', 'hk'), ('eleg4', 'gmg')]) and R['checks'].get('fzdm:C:walkToPier'))

async def main():
  if OUT: os.makedirs(OUT, exist_ok=True)
  T0 = time.time()
  async with async_playwright() as p:
    b, pg, logs = await open_game(p, BASE + '?q=1')
    await pg.evaluate(GCLOCK); await pg.evaluate(JUMP); await pg.evaluate('__game.setDtMax(0.25)'); await asyncio.sleep(1)
    await pg.evaluate("""(() => { const g=__game; g.east.ensure(); g.east.side='fz'; g.east.cur={st:g.station, loc:'fzmetro', area:'metro'}; g.station.kit.root.setEnabled(false); g.fzMetro.enterFromRailway(g.player); })()""")
    await asyncio.sleep(1.5)
    if E1B: await run_1b(pg)
    else:
      # ---------- 1. 西门站台 → 站厅 → C 出口 → 河边 ----------
      ex = await pg.evaluate("(async () => { const E = await import('/js/data/fz-exits.js'); return (E.FZ_EXITS.fzxm.more || []).find(e => e.attr === 'fzriver') || null; })()")
      ok('fzxm:exitC', ex and ex['n'] == 'C', ex)
      info = await pg.evaluate("""(() => { const m=__game.fzMetro; __game.east.cur.loc='fzmetro'; __game.east.cur.area='metro'; const st=m.buildStation('fzxm'); const P=st.platforms.find(p=>p.up); return P ? { zm:(P.up.z0+P.up.z1)/2 } : null; })()""")
      zm = info['zm']; await pg.evaluate(f"__game.player.spawn({FO}+2, -12.95, {zm}, -Math.PI/2)"); await asyncio.sleep(1)
      await auto(pg, [[FO - 3, zm], [FO - 12, zm]], True); await auto(pg, [[FO - 21.5, zm]], True); await auto(pg, [[FO - 22, -6], [FO - 15, -12]], True)
      s = await st(pg); ok('fzxm:concourse', s['zone'] == 'concourse', s['zone'])
      exx = ex['x']; await auto(pg, [[FO + exx, -16]], True); await auto(pg, [[FO + exx, -20], [FO + exx, -36]], True)
      if not await pg.evaluate('!!__game.fzMetro.street'): s = await st(pg); await auto(pg, [[FO + exx, s['pos'][2] - 6], [FO + exx, -36]], True)
      si = await street_info(pg); ok('fzxm:C:riverStreet', si and si.get('river') and si.get('kiosk') == 'fzxm' and si.get('atlasOverflow') == 0, si)
      await pg.evaluate(CLEAR)
      D = await mod(pg); await nav(pg); await asyncio.sleep(1)
      R['perf']['kioskC'] = await sample(pg, 'kioskC')
      K = D['kiosks']['fzxm']
      # 出口亭 → 河边（白马河东岸步道）
      bm3 = [x for x in D['bridges'] if x['id'] == 'bm3'][0]
      rv = await W(pg, *bf(bm3, bm3['half'] + 3)); await jreset(pg)
      ok('fzxm:C:walkToRiver', await go(pg, *rv, 'kiosk C → 白马河') and (await jget(pg))['max'] < TELEPORT)
      if 'bridges' in STAGES:
        # ---------- 2. 桥：每座来回 ----------
        order = ['bm3', 'bm2', 'bm1', 'bm4', 'bm5', 'bm6', 'bm7', 'bm8', 'bm9', 'bm10', 'bm11', 'dx1', 'at1', 'at2', 'at3', 'at4', 'at5', 'at6', 'at7', 'at8', 'at9']
        for bid in order:
          br = [x for x in D['bridges'] if x['id'] == bid][0]
          # 桥两头的落脚点：桥面外 2.8 m；桥头紧挨着另一条河的栏杆（西关 白马北路桥南头）就往回收，保证从对面桥头直线走得到
          async def end(sg):
            far = await W(pg, *bf(br, -sg * (br['half'] - 0.6)))
            for e in (2.8, 2.2, 1.6, 1.1, 0.7):
              c = await pg.evaluate(f'__fzNav.snap(...{json.dumps(await W(pg, *bf(br, sg * (br["half"] + e))))})')
              if c and await pg.evaluate(f'__fzNav.clear({far[0]}, {far[1]}, {c[0]}, {c[1]})'): return c
            return await pg.evaluate(f'__fzNav.snap(...{json.dumps(await W(pg, *bf(br, sg * (br["half"] + 2.8))))})')
          A = await end(-1); B_ = await end(1)
          reached = await go(pg, *A, 'promenade → ' + bid)
          if bid in ('bm4', 'at3', 'at8', 'bm9'): R['perf']['bridge:' + bid] = await sample(pg, 'bridge:' + bid)
          await jreset(pg); r1 = await legs(pg, [B_], True); j1 = await jget(pg); n1 = await near(pg, *B_, 0.8)
          await jreset(pg); r2 = await legs(pg, [A], True); j2 = await jget(pg); n2 = await near(pg, *A, 0.8)
          rise = {'hump': 0.7, 'arch': 0.85}.get(br['kind'], 0)
          R['bridges'][bid] = {'name': br.get('name'), 'kind': br['kind'], 'reachedEnd': reached, 'there': [r1, n1, round(j1['max'], 2), round(j1['ymax'], 2)], 'back': [r2, n2, round(j2['max'], 2), round(j2['ymax'], 2)]}
          ok(f'bridge:{bid}:{br.get("name") or "-"}:bothWays', reached and r1 and n1 and r2 and n2 and j1['max'] < TELEPORT and j2['max'] < TELEPORT and j1['ymax'] >= rise - 0.25 and j2['ymax'] >= rise - 0.25, R['bridges'][bid])
          if OUT and bid == 'bm4':
            await pg.evaluate(f"__game.player.yaw = Math.atan2({br['t'][0]}, {br['t'][1]}); __game.player.pitch = 0.12"); await asyncio.sleep(0.8); await shot(pg, 'riverside_baima_from_bm4')
          if OUT and bid == 'at3':
            at2 = [x for x in D['bridges'] if x['id'] == 'at2'][0]; s = await st(pg); w2 = await W(pg, at2['x'], at2['z'])
            await pg.evaluate(f"__game.player.yaw = Math.atan2({w2[0] - s['pos'][0]}, {w2[1] - s['pos'][2]}); __game.player.pitch = 0.1"); await asyncio.sleep(0.8); await shot(pg, 'antai_hump_bridges_houses')
          if OUT and bid == 'at8':
            s = await st(pg); await pg.evaluate(f"__game.player.yaw = Math.atan2({-br['n'][0]}, {-br['n'][1]}) + 0.0; __game.player.pitch = 0.08"); await asyncio.sleep(0.8); await shot(pg, 'antai_aomen_bridge_sfqx')
        # 安泰河到三坊七巷：南后街口（牌坊）真走到
        sf = await pg.evaluate("(async () => { const M = await import('/js/data/fz-river.js'); return M.FZR.sfqx; })()")
        g = await W(pg, sf['x'] - sf['dir'][0] * 3, sf['z'] - sf['dir'][1] * 3)
        ok('antai:walkToSanfangGate', await go(pg, *g, 'to 三坊七巷 牌坊') and await near(pg, *g, 1.5))
        if OUT: await pg.evaluate(f"__game.player.yaw = Math.atan2({sf['dir'][0]}, {sf['dir'][1]}); __game.player.pitch = 0.1"); await asyncio.sleep(0.8); await shot(pg, 'antai_sanfang_gate')
      if 'steps' in STAGES:
        # ---------- 3. 水埠头：走下去、走进水里、点「回到岸上」 ----------
        for S_ in D['steps']:
          sid = S_['id']; land = await W(pg, *pf(S_, -5.6, -1.6)); top = await W(pg, *pf(S_, -3.0, 0.7)); low = await W(pg, *pf(S_, 2.0, 0.7)); ld = await W(pg, *pf(S_, 3.2, 0.7)); wet = await W(pg, *pf(S_, 3.2, 3.2))
          r = await go(pg, *land, 'to steps ' + sid) and await go(pg, *top, 'onto steps ' + sid); await legs(pg, [low, ld], False)
          s = await st(pg); downOk = r and s['pos'][1] < D['wy'] + 0.9
          await legs(pg, [wet], False); await asyncio.sleep(1.0)
          shown = await wait(pg, "(() => { const b = document.getElementById('bShore'); return !!b && !b.hidden; })()", 10)
          s_in = await st(pg)
          if OUT and sid == 'bm_e': await shot(pg, 'steps_in_water_bm_e')
          tapped = False
          if shown:
            try: await pg.locator('#bShore').tap(timeout=15000); tapped = True
            except Exception as e: log('shore tap', str(e)[:200])
          await asyncio.sleep(1.0); s2 = await st(pg)
          onLand = await pg.evaluate(f"(async () => {{ const M = await import('/js/data/fz-river.js'); const R = __game.fzMetro.street.kit.root.position, p = __game.player.position; return M.isLand(p.x - R.x, p.z - R.z); }})()")
          R['steps'][sid] = {'down': s['pos'], 'inWater': s_in['pos'], 'after': s2['pos'], 'shown': shown, 'tapped': tapped, 'onLand': onLand}
          ok(f'steps:{sid}:downIntoWaterAndBack', downOk and shown and s_in['pos'][1] < -0.5 and tapped and abs(s2['pos'][1]) < 0.4 and onLand and s2['zone'] == 'street', R['steps'][sid])
      if 'shots' in STAGES:
        # ---------- 补拍：西水关码头牌（看得到石底座）+ 船过桂芳桥（拱在头顶 / 正前方） ----------
        xsg = [p for p in D['piers'] if p['id'] == 'xsg'][0]; sg = await W(pg, *xsg['sign']); tt, nn = xsg['t'], xsg['n']
        if await pg.evaluate("__game.player.view") != 'first': await pg.evaluate("__game.toggleView()")
        for k, (a, b) in enumerate([(-4.5, 0), (-4.0, 2.5), (-4.0, -2.5), (-6.0, 1.5), (4.5, 0)]):
          c = await pg.evaluate(f'__fzNav.snap({sg[0] - nn[0] * a + tt[0] * b}, {sg[1] - nn[1] * a + tt[1] * b})')
          if not c or not await go(pg, *c, f'sign view {k}'): continue
          s = await st(pg); await pg.evaluate(f"__game.player.yaw = Math.atan2({sg[0] - s['pos'][0]}, {sg[1] - s['pos'][2]}); __game.player.pitch = 0.18"); await asyncio.sleep(0.8)
          await shot(pg, f'pier_sign_xishuiguan_base_{k}')
        await pg.evaluate("__game.toggleView()")
        if await board(pg, D, 'xsg', 'shotleg'):
          sbm5 = D['clrRep']['bm5']['s']; took = set(); t0 = time.time(); b0 = await boat(pg)
          # 船从西水关往黎明湖（s 增大）；船中心在桥前 9 / 5 / 2 m、桥下各拍一张，第一人称（拱在正前方 / 头顶）+ 第三人称
          marks = [(9, 'ahead9'), (5, 'ahead5'), (2, 'ahead2'), (-1, 'under')]
          while time.time() - t0 < 600 and len(took) < len(marks):
            bb = await boat(pg); d = sbm5 - bb['s']
            for m, name in marks:
              if name not in took and d <= m:
                took.add(name)
                v = await pg.evaluate("__game.player.view")
                if v != 'first': await pg.evaluate("__game.toggleView()")
                await pg.evaluate("__game.player.pitch = 0.25"); await shot(pg, f'boat_bridge_bm5_guifang_{name}_first')
                await pg.evaluate("__game.toggleView()"); await shot(pg, f'boat_bridge_bm5_guifang_{name}_third')
            await asyncio.sleep(0.15)
          ok('shots:bm5:taken', len(took) == len(marks), sorted(took))
          c = await pg.evaluate('window.__clr'); ok('shotleg:canopyClearance', c['min'] >= D['clr'] - 0.02, c)
      if 'boat34' in STAGES:
        # ---------- 4b. 只跑后半程 ----------
        # 新开的游戏里船停在西水关、往黎明湖方向（dir +1），没法直接从西水关坐到西湖；所以：
        # 沿河走到西湖码头 → 站上浮码头把船“叫”过来（西水关 → 西湖，空船）→ 上船坐下 → 真点「起身」在西湖下船上岸（= leg3 西湖下船）
        # → 再上船 → 西湖 → 西水关（leg4）下船 → 走回西门 C 出口亭进站。leg3（西水关 → 西湖，带人）在完整 boat 阶段已跑过。
        if await board(pg, D, 'xihu', 'leg3call'):
          await alight(pg, D, 'xihu', 'leg3')
        if OUT: await shot(pg, 'boat_at_xihu_pier_b')
        if await board(pg, D, 'xihu', 'leg4'):
          await ride(pg, D, 'leg4', 'xsg')
          await alight(pg, D, 'xsg', 'leg4')
        okk, s, m = await enter_kiosk(pg, D, 'fzxm'); ok('xsg:walkBackToXimenC:intoStation', okk, [s['pos'], m])
        ok('boat34:leg4:xihuToXsg:dirPlus', [(l['from'], l['to'], l['dir']) for l in R['legs']] == [('xihu', 'xsg', 1)], [(l['from'], l['to'], l['dir']) for l in R['legs']])
      if 'boat' in STAGES:
        # ---------- 4. 游船 ----------
        xsg = [p for p in D['piers'] if p['id'] == 'xsg'][0]
        sg = await W(pg, *xsg['sign']); await go(pg, *[sg[0] - xsg['n'][0] * 4, sg[1] - xsg['n'][1] * 4], 'to 西水关码头牌')
        if OUT:
          s = await st(pg); await pg.evaluate(f"__game.player.yaw = Math.atan2({sg[0] - s['pos'][0]}, {sg[1] - s['pos'][2]}); __game.player.pitch = 0.05"); await asyncio.sleep(0.8); await shot(pg, 'pier_sign_xishuiguan')
        if await board(pg, D, 'xsg', 'leg1'):
          await ride(pg, D, 'leg1', 'lmh', shots=bool(OUT)); await alight(pg, D, 'lmh', 'leg1')
        # 黎明湖 → 西洋 A 出口亭 → 进站 → 再从 A 口出来
        await jreset(pg)
        okk, s, m = await enter_kiosk(pg, D, 'fzxiy'); ok('lmh:walkToXiyangA:intoStation', okk, [s['pos'], m])
        await auto(pg, [[FO + 10, -30]], False); await auto(pg, [[FO + 10, -36]], False)
        await wait(pg, '!!__game.fzMetro.street', 8)
        si = await street_info(pg); ok('fzxiy:A:backOutToRiver', si and si.get('kiosk') == 'fzxiy' and si.get('river'), si)
        D = await mod(pg); await nav(pg)
        if OUT: await shot(pg, 'kiosk_xiyang_A')
        R['perf']['kioskA'] = await sample(pg, 'kioskA')
        lmhP = [p for p in D['piers'] if p['id'] == 'lmh'][0]
        if await board(pg, D, 'lmh', 'leg2'):
          await ride(pg, D, 'leg2', 'xsg'); await alight(pg, D, 'xsg', 'leg2')
        if await board(pg, D, 'xsg', 'leg3'):
          await ride(pg, D, 'leg3', 'xihu')
          R['perf']['xihuPier'] = await sample(pg, 'xihuPier')
          if OUT: await shot(pg, 'boat_at_xihu_pier')
          await alight(pg, D, 'xihu', 'leg3')
          if OUT:
            xh = [p for p in D['piers'] if p['id'] == 'xihu'][0]; sg = await W(pg, *xh['sign']); s = await st(pg)
            await pg.evaluate(f"__game.player.yaw = Math.atan2({sg[0] - s['pos'][0]}, {sg[1] - s['pos'][2]}); __game.player.pitch = 0.05"); await asyncio.sleep(0.8); await shot(pg, 'pier_sign_xihu')
        if await board(pg, D, 'xihu', 'leg4'):
          await ride(pg, D, 'leg4', 'xsg'); await alight(pg, D, 'xsg', 'leg4')
        # 西水关 → 走回西门 C 出口亭进站
        okk, s, m = await enter_kiosk(pg, D, 'fzxm'); ok('xsg:walkBackToXimenC:intoStation', okk, [s['pos'], m])
        dirs = sorted({l['dir'] for l in R['legs']}); ok('boat:bothDirections', dirs == [-1, 1] or (len(R['legs']) >= 4 and {(l['from'], l['to']) for l in R['legs']} >= {('xsg', 'lmh'), ('lmh', 'xsg')}), [(l['from'], l['to']) for l in R['legs']])
    # ---------- 5. 性能 ----------
    worst = max(R['perf'].items(), key=lambda kv: kv[1]['tris']) if R['perf'] else None
    worstD = max(R['perf'].items(), key=lambda kv: kv[1]['draws']) if R['perf'] else None
    R['perfWorst'] = {'tris': worst, 'draws': worstD}
    ok('perf:budget', all(v['draws'] <= BUDGET['draws'] and v['tris'] <= BUDGET['tris'] for v in R['perf'].values()), R['perf'])
    R['errors'] = [l for l in errs(logs) if l[0] in ('error', 'pageerror')]
    ok('noPageErrors', not R['errors'], R['errors'][:5])
    await b.close()
  R['secs'] = round(time.time() - T0)
  good = all(R['checks'].values())
  print(json.dumps(R, ensure_ascii=False, indent=1, default=str))
  print('FZ_RIVER', 'PASS' if good else 'FAIL', [k for k, v in R['checks'].items() if not v], flush=True)
  if not good: sys.exit(1)
asyncio.run(main())
