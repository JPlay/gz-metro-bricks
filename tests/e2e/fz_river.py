# 福州内河 1A（白马河 + 安泰河 + 东西河首段；游船 A 线 西湖码头—西水关码头—黎明湖码头）e2e：全程真走（autopilot 走路 + 真点按钮），不传送。
# 只有开头一次：跟 fz_attr.py 一样把人放到西门站台（进站这段别的测试已经测过）。之后：
# 1. 站台 → 站厅 → 西门 C 出口 → 河边街区（出口亭）
# 2. 21 座桥每座来回各走一遍（桥两头之间直线走过桥面；拱桥 / 驼峰桥量最高点），桥与桥之间沿河边步道走（A* 按真实碰撞体找路）
# 3. 三处水埠头：走下台阶 → 从敞开的一侧走进水里 → 「回到岸上」按钮真点 → 回到岸上
# 4. 游船：西水关上船坐下（真点「坐下」）→ 黎明湖（正向）下船（真点「起身」）→ 走到西洋 A 出口亭进站 → 再从 A 口出来回河边
#    → 黎明湖上船 → 西水关（反向）下船 → 再上 → 西湖码头下船 → 再上 → 西水关（正向）下船 → 走回西门 C 出口亭进站
#    行船中每帧检查：船篷四角在桥下的净空（按真实船位 + 起伏）≥ 0.25 m；人和船每帧位移（不跳）；
# 5. 性能：每座桥头 / 码头 / 船上采样 draws / 三角形，报最差的视角；截图：河边、安泰河拱桥 + 白墙黛瓦、码头牌、船上座位视角、船过桥
# 用法：python tests/e2e/fz_river.py [base-url] [截图目录或 -] [阶段（可选，逗号分隔：bridges,steps,boat,xihu,… / 1B：e_bridges,e_steps,e_boat1,e_boat2,e_boat3,e_probe）]
import asyncio, sys, json, os, time, math
sys.path.insert(0, os.path.dirname(__file__))
from common import *
from journey import GCLOCK, auto, wait, log
from perfhud import perf
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8123/'
OUT = (sys.argv[2].rstrip('/') + '/') if len(sys.argv) > 2 and sys.argv[2] != '-' else None
STAGES = set((sys.argv[3] if len(sys.argv) > 3 else 'bridges,steps,boat').split(','))
FO = 5000; TELEPORT = 2.5
E1B = any(x.startswith('e_') for x in STAGES)
E2B = any(x.startswith('b_') for x in STAGES)   # 2B 东西河东段（水部 C、市民服务中心码头、桥下步道）   # 1B 东线（晋安河 + 光明港，B 线）
BUDGET = {'draws': 50, 'tris': 90000}
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
    return await pg.evaluate("""(async () => { const M = await import('/js/data/fz-river.js'); return { bridges: M.BRIDGES, piers: M.PIERS, steps: M.FZR.steps, unders: M.FZR.unders || [], sbwWalk: M.FZR.sbwWalk, kiosks: M.KIOSKS, stops: M.STOPS.map(s => ({ id: s.id, s: s.s })), clr: M.CLEAR_MIN, wy: M.WY, clrRep: M.clearanceReport(0.5).per }; })()""")
def pf(p, a, b): return [p['x'] + p['t'][0] * a - p['n'][0] * b, p['z'] + p['t'][1] * a - p['n'][1] * b]   # 码头 / 水埠头局部坐标 → W
def bf(b, v): return [b['x'] + b['n'][0] * v, b['z'] + b['n'][1] * v]
async def plate(pg): return await pg.evaluate("document.getElementById('whereName').textContent")
def canopy_frac(path):
    """截图里船篷（红篷）从屏幕顶往下连续占了多少高度"""
    from PIL import Image
    # 列取 34.5%–43% 宽：避开左上站牌、顶部“开启声音”提示条、右上按钮；红篷色（g、b < 0.3 r，不算深色篷柱）
    im = Image.open(path).convert('RGB'); Wd, H = im.size; px = im.load(); xs = range(int(Wd * 0.345), int(Wd * 0.43), 2); last, miss = -1, 0
    for y in range(H):
        n = sum(1 for x in xs if (lambda r, g, b: r > 70 and g < 0.3 * r and b < 0.3 * r)(*px[x, y]))
        if n / len(xs) >= 0.5: last, miss = y, 0
        else:
            miss += 1
            if miss > H * 0.01: break
    return round((last + 1) / H, 3)
async def seated_shots(pg, tag):
    """船上坐着：第一人称、第三人称各拍一张，量篷占屏高"""
    out = {}
    for v in ('first', 'third'):
        if await pg.evaluate("__game.player.view") != v: await pg.evaluate("__game.toggleView()")
        await pg.evaluate("(() => { const s = __game.player.seat.seat; __game.player.pitch = __game.player.view === 'first' ? s.pitchFirst : s.pitch; })()"); await asyncio.sleep(0.8)   # 坐下时的默认俯仰
        name = f'boat_seated_{v}_{tag}'; await shot(pg, name)
        if OUT: out[v] = canopy_frac(OUT + name + '.jpg'); log('canopy', name, out[v])
    if await pg.evaluate("__game.player.view") != 'third': await pg.evaluate("__game.toggleView()")
    return out
async def street_info(pg): return await pg.evaluate('__game.fzMetro.street ? __game.fzMetro.street.info() : null')
async def boat(pg): return await pg.evaluate('__game.fzMetro.street && __game.fzMetro.street.boat ? __game.fzMetro.street.boat.info() : null')

async def enter_kiosk(pg, D, code):
    K = D['kiosks'][code]; a = await W(pg, K['x'], K['z'] + 3.2); b1 = await W(pg, K['x'], K['z'] + 0.6); b2 = await W(pg, K['x'], K['z'] - 4.4)
    await go(pg, *a, 'to kiosk ' + code); await legs(pg, [b1, b2], False)
    await wait(pg, '!__game.fzMetro.street', 8)
    s = await st(pg); m = await pg.evaluate('({ code: __game.fzMetro.code, street: !!__game.fzMetro.street })')
    return m['code'] == code and not m['street'], s, m

async def landpt(pg, P):
    # 岸上落脚点：码头牌旁边
    return await W(pg, *pf(P, -9.6, -2.8))
async def board(pg, D, pid, leg):
    P = [p for p in D['piers'] if p['id'] == pid][0]
    # 岸上落脚点在码头牌旁边（不是牌子里面）→ 台阶顶平台 → 台阶 → 浮码头
    land = await landpt(pg, P); head = await W(pg, *pf(P, -10.5, 0.6)); top = await W(pg, *pf(P, -9.4, 0.75)); bot = await W(pg, *pf(P, -4.0, 0.75)); pont = await W(pg, *pf(P, 1.2, 1.5))
    r1 = await go(pg, *land, 'to pier ' + pid)
    if E1B and not await near(pg, *land, 1.0):
        # 福新问渡：码头牌后面这块步行栅格没铺上（e2e 导航网格的问题，人能走）→ A* 先到最近能到的格子，再直线走过去
        await legs(pg, [land], False); r1 = await near(pg, *land, 1.0); log('board: last stretch to land straight', pid, r1)
    gap = await W(pg, *pf(P, -9.6, -0.9))   # 1B：岸墙缺口正中（a −10.2…−8.3）直下台阶顶，不贴着栏杆端柱斜穿
    await legs(pg, ([gap, top] if E1B else [head, top]) + [bot, pont], False)
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
    r = ok(f'{leg}:seatedViaTap:{pid}', sit and seated, await st(pg))
    if E1B and seated: await seated_checks(pg, leg)
    return r

async def ride(pg, D, leg, target, shots=False, bshots=None):
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
        for bid, nm in (bshots or {}).items():
            sb = (D['clrRep'].get(bid) or {}).get('s')
            if sb is None: continue
            if 'ap' + bid not in took and 9 < abs(b['s'] - sb) < 18 and (sb - b['s']) * b['dir'] > 0:
                took.add('ap' + bid); await shot(pg, f'boat_approach_{bid}_{nm}')
            if 'un' + bid not in took and abs(b['s'] - sb) < 2.5:
                took.add('un' + bid); await shot(pg, f'boat_under_{bid}_{nm}')
        await asyncio.sleep(0.25 if bshots else 0.5)
    b = await boat(pg); j = await jget(pg); c = await pg.evaluate('window.__clr')
    R['legs'].append({'leg': leg, 'from': b0['at'], 'to': b['at'], 'dir': b['dir'], 'stats': b['stats'], 'jump': j['max'], 'clr': c, 'secs': round(time.time() - t0), 'log': b['log']})
    ok(f'{leg}:arrived:{target}', done and b['at'] == target, b)
    ok(f'{leg}:smooth', j['max'] < TELEPORT and b['stats']['maxStep'] < (1.45 if E1B or E2B else 1.0) and b['stats']['maxYawStep'] < 0.12, {'jump': j['max'], 'stats': b['stats']})
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
    bot = await W(pg, *pf(P, -4.0, 0.75)); top = await W(pg, *pf(P, -9.4, 0.75)); head = await W(pg, *pf(P, -10.5, 0.6)); land = await landpt(pg, P)
    await legs(pg, [door, edge, pont], False); await legs(pg, [bot, top], False); s1 = await st(pg); await legs(pg, [await W(pg, *pf(P, -9.6, -0.9)) if E1B else head], False); s2 = await st(pg); await legs(pg, [land], False)
    if E1B and not await near(pg, *land, 1.2): log('alight: straight line to land blocked, A*', pid, (await st(pg))['pos']); await go(pg, *land, 'stair head → shore ' + pid)
    s = await st(pg); log('alight path', pid, 'top', s1['pos'], 'head', s2['pos'], 'land', s['pos'])
    r = ok(f'{leg}:upToShore:{pid}', abs(s['pos'][1]) < 0.4 and await near(pg, *land, 1.2), s['pos'])
    if E1B:
        fell = (await street_info(pg) or {}).get('fellThrough', 0); ok(f'{leg}:noFallThrough:{pid}', fell == 0, fell)
        await hud_shore(pg, leg)
    return r

COVER = """(async () => { const M = await import('/js/data/fz-river.js'); const g = __game, b = g.fzMetro.street.boat, sc = g.scene, cv = sc.getEngine().getRenderingCanvas();
  const W = cv.clientWidth, H = cv.clientHeight, ms = new Set(b.kit.meshes), inv = BABYLON.Matrix.Invert(b.node.getWorldMatrix()), cols = [], NR = 80;
  for (let i = 0; i < 9; i++) { let n = 0; const x = W * (i + 0.5) / 9;
    for (let j = 0; j < NR; j++) { const h = sc.pick(x, H * (j + 0.5) / NR, m => ms.has(m)); if (h && h.hit) { const q = BABYLON.Vector3.TransformCoordinates(h.pickedPoint, inv); if (q.y >= M.BOAT.roofUnder - 0.1) n++; } }
    cols.push(+(n / NR).toFixed(3)); }
  const ss = g.player.seat.seat; return { view: g.player.view, pitch: +g.player.pitch.toFixed(3), lz: ss.lz, dir: b.dir, rear: ss.lz * b.dir < 0, cols, mean: +(cols.reduce((a, c) => a + c, 0) / cols.length).toFixed(3), max: Math.max(...cols) }; })()"""
async def seated_checks(pg, leg):
    # 左上角：坐船 =「B线 · 下一站码头」
    want = await pg.evaluate("(() => { const h = __game.fzMetro.street.riverHud(__game.player); return h && h.boat ? h.line + '线 · ' + h.next.zh : null; })()")
    ok(f'{leg}:hud:lineB', (want or '').startswith('B线 · '), want)
    col = await pg.evaluate("getComputedStyle(document.getElementById('where')).getPropertyValue('--line').trim()")
    ok(f'{leg}:hud:colourB', col.upper() == '#2E5E8C', col)
    hud = await wait(pg, f"document.getElementById('whereName').textContent === {json.dumps(want)}", 6)
    ok(f'{leg}:hud:onBoat', hud and want is not None, {'want': want, 'got': await pg.evaluate("[document.getElementById('whereLine').textContent, document.getElementById('whereName').textContent, document.getElementById('whereEn').textContent]")})
    # 两种视角各量一次篷顶占屏（坐下时的默认俯角）
    res = []
    for _ in range(2):
        await pg.evaluate("(() => { const s = __game.player.seat.seat; __game.player.pitch = __game.player.view === 'first' ? s.pitchFirst : s.pitch; })()")   # 坐下时的默认俯仰
        await asyncio.sleep(0.8); c = await pg.evaluate(COVER); res.append(c)
        if OUT and leg in ('eleg1', 'eleg3', 'eleg5', 'eleg7', 'eleg8'): await shot(pg, f"boat_seated_{c['view']}_{leg}{'_rear' if c['rear'] else '_front'}")
        await pg.evaluate('__game.toggleView()')
    R.setdefault('canopy', []).append({'leg': leg, 'res': res})
    ok(f'{leg}:canopy<=20%', all(c['mean'] <= 0.2 and c['cols'][4] <= 0.2 for c in res), res)
async def hud_shore(pg, leg):
    okh = await wait(pg, "document.getElementById('whereName').textContent === '福州内河'", 6)
    return ok(f'{leg}:hud:shore', okh, await pg.evaluate("[document.getElementById('whereLine').textContent, document.getElementById('whereName').textContent, document.getElementById('whereEn').textContent]"))

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
    if STAGES & {'e_boat2', 'e_boat3'} and not STAGES & {'e_bridges', 'e_steps', 'e_boat', 'e_boat1'}:
        # 后段 / 反向：从东门 C 出来（船停在东门停靠点）
        ex, si = await station_to_exit(pg, 'fzdmn', "x.attr === 'fzriver'", 'fzdmn')
        ok('fzdmn:C:net e / route B', si and si.get('net') == 'e' and si.get('route') == 'B', si)
        await pg.evaluate(CLEAR); D = await mod(pg); await nav(pg); await asyncio.sleep(1)
        R['perf']['kiosk:fzdmn'] = await sample(pg, 'kiosk:fzdmn')
        await hud_shore(pg, 'fzdmn:C')
        return await boat_stages(pg)
    ex, si = await station_to_exit(pg, 'fzdm', "x.attr === 'fzriver'", 'fzdm')
    ok('fzdm:C:net e / route B', si and si.get('net') == 'e' and si.get('route') == 'B', si)
    await pg.evaluate(CLEAR)
    D = await mod(pg); await nav(pg); await asyncio.sleep(1)
    await hud_shore(pg, 'fzdm:C')
    R['perf']['kiosk:fzdm'] = await sample(pg, 'kiosk:fzdm')
    if OUT: await shot(pg, 'kiosk_fzdm_C')
    wq = [p for p in D['piers'] if p['id'] == 'wq'][0]; sg = await W(pg, *wq['sign'])
    lp = await landpt(pg, wq)   # 码头牌旁边的岸上落脚点（同 board()）
    await jreset(pg); ok('fzdm:C:walkToPier', await go(pg, *lp, 'kiosk C → 温泉公园码头牌') and (await jget(pg))['max'] < TELEPORT)
    if OUT:
        s = await st(pg); await pg.evaluate(f"__game.player.yaw = Math.atan2({sg[0] - s['pos'][0]}, {sg[1] - s['pos'][2]}); __game.player.pitch = 0.05"); await asyncio.sleep(0.8); await shot(pg, 'pier_sign_wenquan')
    if 'e_bridges' in STAGES:
        # ---------- 2. 13 座桥每座来回（晋安河由北往南，再光明港由西往东） ----------
        order = [b['id'] for b in D['bridges'] if b['river'] == 'ja'] + [b['id'] for b in D['bridges'] if b['river'] == 'gm']
        await bridges_stage(pg, D, order, perf_at=('ja2', 'ja6', 'ja10', 'gm2'), shots={'ja2': 'jinan_from_ja2_liuyi', 'gm2': 'guangminggang_from_gm2'})
    if 'e_steps' in STAGES:
        # ---------- 3. 三处水埠头：落水 → 「回到岸上」 ----------
        await steps_stage(pg, D, 'ja_e')
    if 'e_probe' in STAGES: await probe_stage(pg, D)
    await boat_stages(pg)

# 性能 + 水汽远景探针（1B）：岸上每个码头 / 出口亭 4 个朝向各采一次；坐船（真走上船坐下）后把船按里程每 40 m 摆一次（双向、两种视角）采样；
# 光明港开阔段 / 晋安河拍 雾开 vs 雾关 对比（同一机位），差异图标出哪些像素被雾改了。船的“摆位”只为采样，不算行船测试。
HAZE_ST = "(() => { const s = __game.scene, c = s.activeCamera; return { mode: s.fogMode, start: s.fogStart, end: s.fogEnd, color: [s.fogColor.r, s.fogColor.g, s.fogColor.b].map(v => +v.toFixed(3)), maxZ: c.maxZ }; })()"
async def probe_stage(pg, D):
    R['probe'] = {'shore': {}, 'boat': [], 'haze': []}
    # 远处是什么（雾里的剪影）：四个朝向，在画面上半部打射线，记 > 150 m 的网格名 / 距离
    far = []
    for k in range(4):
        await pg.evaluate(f"__game.player.yaw = {k} * Math.PI / 2; __game.player.pitch = 0.05"); await asyncio.sleep(0.8)
        far.append(await pg.evaluate("""(() => { const sc = __game.scene, cv = sc.getEngine().getRenderingCanvas(), out = {};
          for (let i = 0; i < 12; i++) for (let j = 0; j < 8; j++) { const h = sc.pick(cv.clientWidth * (i + 0.5) / 12, cv.clientHeight * (0.12 + j * 0.05), m => m.isEnabled() && m.isVisible);
            if (h && h.hit && h.distance > 150) { const n = h.pickedMesh.name; out[n] = Math.max(out[n] || 0, Math.round(h.distance)); } }
          return out; })()"""))
    R['probe']['far'] = far; log('far meshes', far)
    hz = await pg.evaluate(HAZE_ST); ok('haze:onInRiverArea', hz['mode'] == 3 and hz['start'] == 200 and hz['end'] == 350 and hz['maxZ'] == 420, hz)
    async def views(label):
        best = None
        for k in range(4):
            await pg.evaluate(f"__game.player.yaw = {k} * Math.PI / 2; __game.player.pitch = 0.08"); d = await perf(pg, 3, 0.3)
            R['probe']['shore'].setdefault(label, []).append(d)
            if not best or d['tris'] > best['tris'] or d['draws'] > best['draws']: best = {**d, 'yaw': k}
        R['perf']['shore:' + label] = best
    for P in D['piers']:
        c = await pg.evaluate(f'__fzNav.snap(...{json.dumps(await W(pg, *pf(P, -11.6, -1.6)))})')
        if c: await pg.evaluate(f"__game.player.spawn({c[0]}, 0.05, {c[1]}, 0)"); await asyncio.sleep(1.2); await views('pier:' + P['id'])
    for code, K in D['kiosks'].items():
        c = await pg.evaluate(f'__fzNav.snap(...{json.dumps(await W(pg, K["x"], K["z"] + 4))})')
        if c: await pg.evaluate(f"__game.player.spawn({c[0]}, 0.05, {c[1]}, 0)"); await asyncio.sleep(1.2); await views('kiosk:' + code)
    # 回到温泉公园码头，真走上船坐下
    wq = [p for p in D['piers'] if p['id'] == 'wq'][0]; c = await pg.evaluate(f'__fzNav.snap(...{json.dumps(await W(pg, *pf(wq, -11.6, -1.6)))})')
    await pg.evaluate(f"__game.player.spawn({c[0]}, 0.05, {c[1]}, 0)"); await asyncio.sleep(1.2)
    if not await board(pg, D, 'wq', 'probe'): return
    L = await pg.evaluate("(async () => { const M = await import('/js/data/fz-river.js'); return [M.ROUTE.line.len, M.STOPS[0].s, M.STOPS[M.STOPS.length - 1].s, M.ROUTE.zones.fast]; })()")
    await pg.evaluate("(() => { const b = __game.fzMetro.street.boat; b._upd = b.update; b.update = function () { this.place(0); }; })()")
    s0, s1 = L[1], L[2]; pts = [s0 + k * 40 for k in range(int((s1 - s0) // 40) + 1)] + [s1]
    for dr in (1, -1):
        seq = pts if dr == 1 else pts[::-1]
        for sv in seq:
            await pg.evaluate(f"(() => {{ const b = __game.fzMetro.street.boat; b.s = {sv}; b.dir = {dr}; b.faceK = {dr}; b.place(0); }})()")
            await asyncio.sleep(0.25)   # 座位 follow：等玩家这一帧把船头转向吃掉，再按座位朝向摆视角（否则转向量会被加两次、看向岸边）
            for v in ('third', 'first'):
                if await pg.evaluate('__game.player.view') != v: await pg.evaluate('__game.toggleView()')
                await pg.evaluate(f"__game.player.yaw = __game.player.seat.seat.face; __game.player.pitch = '{v}' === 'first' ? __game.player.seat.seat.pitchFirst : __game.player.seat.seat.pitch")
                d = await perf(pg, 3, 0.3); d.update({'s': round(sv, 1), 'dir': dr, 'view': v}); R['probe']['boat'].append(d)
    for v in ('third', 'first'):
        rows = [d for d in R['probe']['boat'] if d['view'] == v]
        if rows: R['perf']['boat:' + v] = {**max(rows, key=lambda d: d['tris']), 'draws': max(d['draws'] for d in rows), 'tris': max(d['tris'] for d in rows)}
    # 雾开 / 雾关对比：光明港开阔段往下游（远处 ~300 m+）、晋安河桥前（近处榕树 / 桥）
    if OUT:
        if await pg.evaluate('__game.player.view') != 'first': await pg.evaluate('__game.toggleView()')
        fast = L[3]
        for name, sv, dr, pitch in (('gmg_open_downstream', fast[0] + 15, 1, 0.02), ('gmg_open_upstream', s1 - 10, -1, 0.02), ('jinan_bridge_banyans', s0 + 120, 1, 0.06), ('jinan_downstream_far', s0 + 300, 1, 0.03)):
            await pg.evaluate(f"(() => {{ const b = __game.fzMetro.street.boat; b.s = {sv}; b.dir = {dr}; b.faceK = {dr}; b.place(0); }})()"); await asyncio.sleep(0.6)
            await pg.evaluate(f"(() => {{ __game.player.yaw = __game.player.seat.seat.face; __game.player.pitch = {pitch}; }})()")   # 座位朝向 = 行进方向
            await asyncio.sleep(1.5); await shot(pg, f'haze_on_{name}')
            await pg.evaluate("(() => { const S = __game.fzMetro.street; S.haze._re = S.haze.reassert; S.haze.reassert = () => {}; S.haze.restore(); })()")
            await asyncio.sleep(1.5); await shot(pg, f'haze_off_{name}')
            await pg.evaluate("(() => { const S = __game.fzMetro.street; S.haze.reassert = S.haze._re; S.haze.apply(); })()")
            R['probe']['haze'].append(name)
        await asyncio.sleep(1.0); hz = await pg.evaluate(HAZE_ST); ok('haze:reappliedAfterComparison', hz['mode'] == 3 and hz['maxZ'] == 420, hz)
    await pg.evaluate("(() => { const b = __game.fzMetro.street.boat; b.s = b.s; b.update = b._upd; })()")
    # 把船摆回温泉公园码头停靠，起身上岸，走进斗门 C 出口亭 → 离开街区后雾和远裁剪还原
    await pg.evaluate("(() => { const b = __game.fzMetro.street.boat; b.i = 0; b.target = 0; b.s = b.s; })()")
    await pg.evaluate("(async () => { const M = await import('/js/data/fz-river.js'); const b = __game.fzMetro.street.boat; b.s = M.STOPS[0].s; b.dir = 1; b.faceK = 1; b.phase = 'dock'; b.v = 0; b.dwell = 0; b.departIn = 999; b.setPlank(true); b.place(0); })()")
    await asyncio.sleep(1.0)
    await alight(pg, D, 'wq', 'probe')
    okk, s_, m = await enter_kiosk(pg, D, 'fzdm'); ok('probe:walkIntoFzdmC', okk, [s_['pos'], m])
    hz = await pg.evaluate(HAZE_ST); ok('haze:restoredAfterLeaving', not (hz['mode'] == 3 and hz['start'] == 200) and hz['maxZ'] == 420, hz)

async def look(pg, x, z, pitch=0.05):
    s = await st(pg); await pg.evaluate(f"__game.player.yaw = Math.atan2({x - s['pos'][0]}, {z - s['pos'][2]}); __game.player.pitch = {pitch}"); await asyncio.sleep(0.8)
async def under_walk(pg, D, uid, tag):
    """桥下步道：岸上 → 栏杆缺口下台阶 → 桥底平台走过去 → 另一头台阶上岸（直线真走）"""
    U = [u for u in D['unders'] if u['id'] == uid][0]; f, r = U['flat'], U['run']; e = f + r - 1.05
    P = lambda a, b: W(pg, *pf(U, a, b))
    a0 = await P(-e, -1.8); a1 = await P(e, -1.8)
    reached = await go(pg, *a0, 'to under ' + uid)
    await jreset(pg)
    await legs(pg, [await P(-e, 0.8), await P(-f - 0.4, 0.8)], False); s_bot = await st(pg)
    await legs(pg, [await P(0, 0.8)], False); s_mid = await st(pg)
    if OUT: await look(pg, *(await P(f + r, 0.8)), 0.02); await shot(pg, f'under_walkway_{uid}_{tag}')
    await legs(pg, [await P(f + 0.4, 0.8), await P(e, 0.8), a1], False); s_end = await st(pg); j = await jget(pg)
    R.setdefault('unders', {})[uid] = {'name': U['name'], 'bot': s_bot['pos'], 'mid': s_mid['pos'], 'end': s_end['pos'], 'jump': j['max']}
    ok(f'under:{uid}:{U["name"]}:walkThrough', reached and abs(s_mid['pos'][1] - U['y']) < 0.35 and abs(s_end['pos'][1]) < 0.4 and await near(pg, *a1, 1.2) and j['max'] < TELEPORT, R['unders'][uid])
    if OUT and uid == 'udx2':
        await look(pg, *(await P(0, 1.2)), -0.35); await shot(pg, f'under_walkway_{uid}_from_bank')

# 2B：船速逐帧记录 → 最大加 / 减速度（m/s²，按游戏帧长）+ 相邻帧速度差
ACCW = """(() => { window.__acc = { aMax: 0, dMax: 0, dvMax: 0, n: 0, stepOver: -9, stepMax: 0 }; let lv = null, lp = null;
  __game.scene.onAfterRenderObservable.add(() => { const S = __game.fzMetro.street; if (!S || !S.boat) { lv = null; return; } const i = S.boat.info(), A = window.__acc;
    const dt = Math.min(0.25, __game.scene.getEngine().getDeltaTime() / 1000); if (lv !== null && dt > 0.004 && i.phase === 'go') { const dv = i.v - lv; A.n++;
      if (dv / dt > A.aMax) A.aMax = +(dv / dt).toFixed(3); if (-dv / dt > A.dMax) A.dMax = +(-dv / dt).toFixed(3); if (Math.abs(dv) > A.dvMax) A.dvMax = +Math.abs(dv).toFixed(3); }
    const q = S.boat.node.getAbsolutePosition(); if (lp !== null && lv !== null && dt > 0.004 && i.phase === 'go') { const d = Math.hypot(q.x - lp[0], q.z - lp[1]); if (d > A.stepMax) A.stepMax = +d.toFixed(3); const o = d - Math.max(i.v, lv) * dt; if (o > A.stepOver) A.stepOver = +o.toFixed(3); }
    lp = [q.x, q.z]; lv = i.v; }); return true; })()"""
async def run_2b(pg):
    await pg.evaluate('window.__fzNavRes = 0.35')
    ex, si = await station_to_exit(pg, 'fzsb', "x.attr === 'fzriver'", 'fzsb')
    ok('fzsb:C:net a / route A', si and si.get('net') == 'a', si)
    await pg.evaluate(CLEAR); await pg.evaluate(ACCW); D = await mod(pg); await nav(pg); await asyncio.sleep(1)
    R['perf']['kiosk:fzsb'] = await sample(pg, 'kiosk:fzsb')
    await asyncio.sleep(0.6); ok('plate:shore:fzsb', await plate(pg) == '福州内河', await plate(pg))
    K = D['kiosks']['fzsb']; P = [p for p in D['piers'] if p['id'] == 'smc'][0]
    if OUT:
        await look(pg, *(await W(pg, P['x'], P['z'])), 0.02); await shot(pg, 'sbw_path_from_kiosk')
    land = await landpt(pg, P); await jreset(pg)
    s0 = await st(pg); okw = await go(pg, *land, 'kiosk fzsb C → 市民服务中心码头'); j = await jget(pg)
    wl = R['walk'][-1][1] if R['walk'] else None
    ok('fzsb:C:walkToSmcPier', okw and j['max'] < TELEPORT and wl is not None and wl <= 125, {'walk': wl, 'sbwWalk': D.get('sbwWalk'), 'jump': j['max']})
    if OUT:
        sg = await W(pg, *P['sign']); await look(pg, *sg); await shot(pg, 'pier_sign_smc')
        kk = await W(pg, K['x'], K['z']); await look(pg, *kk, 0.0); await shot(pg, 'kiosk_fzsb_from_pier')
    R['perf']['smcPier'] = await sample(pg, 'smcPier')
    if 'b_fall' in STAGES:
        # 码头浮码头往下游一头走出去掉进水里 → 「回到岸上」
        pont = await W(pg, *pf(P, 1.2, 1.5)); off = await W(pg, *pf(P, 9.0, 1.5))
        await legs(pg, [await W(pg, *pf(P, -9.6, -0.9)), await W(pg, *pf(P, -9.4, 0.75)), await W(pg, *pf(P, -4.0, 0.75)), pont], False)
        s1 = await st(pg); await legs(pg, [off], False); await asyncio.sleep(1.0)
        shown = await wait(pg, "(() => { const b = document.getElementById('bShore'); return !!b && !b.hidden; })()", 10)
        s_in = await st(pg)
        if OUT: await shot(pg, 'fall_in_water_smc')
        tapped = False
        if shown:
            try: await pg.locator('#bShore').tap(timeout=15000); tapped = True
            except Exception as e: log('shore tap', str(e)[:200])
        await asyncio.sleep(1.0); s2 = await st(pg)
        onLand = await pg.evaluate("(async () => { const M = await import('/js/data/fz-river.js'); const R = __game.fzMetro.street.kit.root.position, p = __game.player.position; return M.isLand(p.x - R.x, p.z - R.z); })()")
        R['fall'] = {'pontoon': s1['pos'], 'inWater': s_in['pos'], 'after': s2['pos'], 'shown': shown, 'tapped': tapped, 'onLand': onLand}
        ok('fall:smc:intoWaterAndBack', shown and s_in['pos'][1] < -0.5 and tapped and abs(s2['pos'][1]) < 0.4 and onLand and s2['zone'] == 'street', R['fall'])
    if 'b_under' in STAGES:
        await under_walk(pg, D, 'udx2', 'wuyi')
        R['perf']['under:udx2'] = await sample(pg, 'under:udx2')
        await under_walk(pg, D, 'udx5', 'bayiqi')
        R['perf']['under:udx5'] = await sample(pg, 'under:udx5')
    if 'b_boat' in STAGES:
        BS = {'dx2': 'wuyizhong', 'dx3': 'haidizhi', 'dx4': 'guangda', 'dx5': 'bayiqizhong', 'dx6': 'wushanzhi'}
        if await board(pg, D, 'smc', 'bleg1'):
            await ride(pg, D, 'bleg1', 'lmh', shots=False, bshots=BS if OUT else None); await alight(pg, D, 'lmh', 'bleg1')
        D = await out_and_back(pg, D, 'fzxiy', 'A', 'a')
        if await board(pg, D, 'lmh', 'bleg2'):
            await ride(pg, D, 'bleg2', 'smc'); await alight(pg, D, 'smc', 'bleg2')
        okk, s, m = await enter_kiosk(pg, D, 'fzsb'); ok('smc:walkBackToShuibuC:intoStation', okk, [s['pos'], m])
        per = {}
        for l in R['legs']:
            for k, v in (l['clr'].get('per') or {}).items(): per[k] = min(per.get(k, 99), v)
        R['clearance2B'] = {k: per.get(k) for k in BS}; R['legSecs'] = {l['leg']: l['secs'] for l in R['legs']}
        R['accel'] = await pg.evaluate('window.__acc')
        ok('bboat:smoothAccel', R['accel']['n'] > 100 and R['accel']['aMax'] <= 0.505 and R['accel']['dMax'] <= 1.005, R['accel'])
        ok('bboat:maxStep<=v*dt', R['accel']['stepOver'] <= 0.05, R['accel'])
        ok('bboat:clearanceAllNewBridges', all(per.get(k) is not None and per[k] >= D['clr'] - 0.02 for k in BS), R['clearance2B'])

async def boat_stages(pg):
    B1 = 'e_boat' in STAGES or 'e_boat1' in STAGES
    B2 = 'e_boat' in STAGES or 'e_boat2' in STAGES
    B3 = 'e_boat' in STAGES or 'e_boat3' in STAGES
    if B1:
        # ---------- 4a. B 线前段（斗门 C 出来）：温泉公园 → 福新问渡 → 东门停靠点，每站下船上岸；东门 C 进站再出来 ----------
        D = await mod(pg)
        if await board(pg, D, 'wq', 'eleg1'):
            await ride(pg, D, 'eleg1', 'fx', shots=bool(OUT)); await alight(pg, D, 'fx', 'eleg1')
        if await board(pg, D, 'fx', 'eleg2'):
            await ride(pg, D, 'eleg2', 'dmn'); await alight(pg, D, 'dmn', 'eleg2')
        if OUT:
            dm = [p for p in D['piers'] if p['id'] == 'dmn'][0]; sg = await W(pg, *dm['sign']); s = await st(pg)
            await pg.evaluate(f"__game.player.yaw = Math.atan2({sg[0] - s['pos'][0]}, {sg[1] - s['pos'][2]}); __game.player.pitch = 0.05"); await asyncio.sleep(0.8); await shot(pg, 'pier_sign_dongmen_stop')
        D = await out_and_back(pg, D, 'fzdmn', 'C', 'e')
    if B2:
        # ---------- 4b. B 线后段（东门 C 出来，船停东门往光明港）：东门 → 河口 → 光明港（终点下船、上岸、光明港 D 进站再出来、走回浮码头重新上船）→ 河口 ----------
        D = await mod(pg)
        if await board(pg, D, 'dmn', 'eleg3'):
            await ride(pg, D, 'eleg3', 'hk'); await alight(pg, D, 'hk', 'eleg3')
        if await board(pg, D, 'hk', 'eleg4'):
            await ride(pg, D, 'eleg4', 'gmg'); await alight(pg, D, 'gmg', 'eleg4')
        D = await out_and_back(pg, D, 'fzgmg', 'D', 'e')
        if await board(pg, D, 'gmg', 'eleg5'):
            await ride(pg, D, 'eleg5', 'hk'); await alight(pg, D, 'hk', 'eleg5')
        ok('eboat2:terminalGmg:alightAndReboard', all(R['checks'].get(k) for k in ('eleg4:arrived:gmg', 'eleg4:standViaTap:gmg', 'eleg4:upToShore:gmg', 'eleg5:seatedViaTap:gmg', 'eleg5:arrived:hk')))
    if B3:
        # ---------- 4c. 反向到温泉公园（东门 C 出来）：走到福新问渡叫船 → 坐到温泉公园（终点下船上岸）→ 走回去重新上船 → 福新问渡 ----------
        D = await mod(pg)
        if await board(pg, D, 'fx', 'eleg6'):
            await ride(pg, D, 'eleg6', 'wq'); await alight(pg, D, 'wq', 'eleg6')
        if OUT:
            wq = [p for p in D['piers'] if p['id'] == 'wq'][0]; sg = await W(pg, *wq['sign']); s = await st(pg)
            await pg.evaluate(f"__game.player.yaw = Math.atan2({sg[0] - s['pos'][0]}, {sg[1] - s['pos'][2]}); __game.player.pitch = 0.05"); await asyncio.sleep(0.8); await shot(pg, 'pier_sign_wenquan_after_alight')
        if await board(pg, D, 'wq', 'eleg7'):
            await ride(pg, D, 'eleg7', 'fx'); await alight(pg, D, 'fx', 'eleg7')
        ok('eboat3:terminalWq:alightAndReboard', all(R['checks'].get(k) for k in ('eleg6:arrived:wq', 'eleg6:standViaTap:wq', 'eleg6:upToShore:wq', 'eleg7:seatedViaTap:wq', 'eleg7:arrived:fx')))
    if B1 or B2 or B3:
        ok('eboat:legsDirections', len(R['legs']) > 0, [(l['from'], l['to'], l['dir']) for l in R['legs']])


async def main():
  if OUT: os.makedirs(OUT, exist_ok=True)
  T0 = time.time()
  async with async_playwright() as p:
    b, pg, logs = await open_game(p, BASE + '?q=1')
    await pg.evaluate(GCLOCK); await pg.evaluate(JUMP); await pg.evaluate('__game.setDtMax(0.25)'); await asyncio.sleep(1)
    await pg.evaluate("""(() => { const g=__game; g.east.ensure(); g.east.side='fz'; g.east.cur={st:g.station, loc:'fzmetro', area:'metro'}; g.station.kit.root.setEnabled(false); g.fzMetro.enterFromRailway(g.player); })()""")
    await asyncio.sleep(1.5)
    if E1B or E2B:
        await (run_2b(pg) if E2B else run_1b(pg))
        R['perfWorst'] = {'tris': max(R['perf'].items(), key=lambda kv: kv[1]['tris']) if R['perf'] else None, 'draws': max(R['perf'].items(), key=lambda kv: kv[1]['draws']) if R['perf'] else None}
        ok('perf:budget', all(v['draws'] <= BUDGET['draws'] and v['tris'] <= BUDGET['tris'] for v in R['perf'].values()), R['perf'])
        R['errors'] = [l for l in errs(logs) if l[0] in ('error', 'pageerror')]; ok('noPageErrors', not R['errors'], R['errors'][:5])
        await b.close(); R['secs'] = round(time.time() - T0); good = all(R['checks'].values())
        print(json.dumps(R, ensure_ascii=False, indent=1, default=str)); print('FZ_RIVER', 'PASS' if good else 'FAIL', [k for k, v in R['checks'].items() if not v], flush=True)
        if not good: sys.exit(1)
        return
    # ---------- 1. 西门站台 → 站厅 → C 出口 → 河边 ----------
    C0 = 'fzxiy' if 'xihu' in STAGES else 'fzxm'   # xihu 阶段：从西洋 A 口进河网（船停在黎明湖、往西湖方向）
    ex = await pg.evaluate("(async () => { const E = await import('/js/data/fz-exits.js'); const X = E.FZ_EXITS['" + C0 + "']; return X.attr === 'fzriver' ? X : (X.more || []).find(e => e.attr === 'fzriver') || null; })()")
    ok(C0 + ':exit' + ('A' if C0 == 'fzxiy' else 'C'), ex and ex['n'] == ('A' if C0 == 'fzxiy' else 'C'), ex)
    info = await pg.evaluate("""(() => { const m=__game.fzMetro; __game.east.cur.loc='fzmetro'; __game.east.cur.area='metro'; const st=m.buildStation('""" + C0 + """'); const P=st.platforms.find(p=>p.up); return P ? { zm:(P.up.z0+P.up.z1)/2 } : null; })()""")
    zm = info['zm']; await pg.evaluate(f"__game.player.spawn({FO}+2, -12.95, {zm}, -Math.PI/2)"); await asyncio.sleep(1)
    await auto(pg, [[FO - 3, zm], [FO - 12, zm]], True); await auto(pg, [[FO - 21.5, zm]], True); await auto(pg, [[FO - 22, -6], [FO - 15, -12]], True)
    s = await st(pg); ok(C0 + ':concourse', s['zone'] == 'concourse', s['zone'])
    exx = ex['x']; await auto(pg, [[FO + exx, -16]], True); await auto(pg, [[FO + exx, -20], [FO + exx, -36]], True)
    if not await pg.evaluate('!!__game.fzMetro.street'): s = await st(pg); await auto(pg, [[FO + exx, s['pos'][2] - 6], [FO + exx, -36]], True)
    si = await street_info(pg); ok(C0 + ':riverStreet', si and si.get('river') and si.get('kiosk') == C0 and si.get('atlasOverflow') == 0, si)
    await pg.evaluate(CLEAR)
    D = await mod(pg); await nav(pg); await asyncio.sleep(1)
    R['perf']['kioskC'] = await sample(pg, 'kioskC')
    await asyncio.sleep(0.6); ok('plate:shore:' + C0, await plate(pg) == '福州内河', await plate(pg))
    if C0 == 'fzxm':
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
      for k, (da, db) in enumerate([(-4.5, 0), (-4.0, 2.5), (-4.0, -2.5), (-6.0, 1.5), (4.5, 0)]):
        c = await pg.evaluate(f'__fzNav.snap({sg[0] - nn[0] * da + tt[0] * db}, {sg[1] - nn[1] * da + tt[1] * db})')
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
    if 'probe' in STAGES:
      # 调试探针（不是验收）：直接放到浮码头上，按下船上岸的路线走，记录每段 y 和脚下碰撞体
      for pid in ('xsg', 'xihu'):
        P = [p for p in D['piers'] if p['id'] == pid][0]
        pts = {k: await W(pg, *pf(P, a, b)) for k, (a, b) in {'pont': (0.0, 1.4), 'bot': (-4.0, 0.75), 'mid': (-7.0, 0.75), 'top': (-9.4, 0.75), 'land': (-11.6, -1.6)}.items()}
        await pg.evaluate(f"__game.player.spawn({pts['pont'][0]}, {D['wy'] + 0.5}, {pts['pont'][1]}, 0)"); await asyncio.sleep(1.5)
        for k in ('bot', 'mid', 'top', 'land'):
          await legs(pg, [pts[k]], False); s = await st(pg)
          hits = await pg.evaluate(f"""(() => {{ const out = []; for (const [k, p] of Object.entries({json.dumps(pts)})) {{ const r = new BABYLON.Ray(new BABYLON.Vector3(p[0], 5, p[1]), new BABYLON.Vector3(0, -1, 0), 20); const h = __game.scene.multiPickWithRay(r, m => m.checkCollisions && m.isEnabled()); out.push(k + ':' + (h || []).sort((a, b) => a.distance - b.distance).slice(0, 3).map(x => x.pickedMesh.name + '@' + (5 - x.distance).toFixed(2)).join('|')); }} return out; }})()""")
          log('probe', pid, k, s['pos'], hits if k == 'bot' else '')
    if 'xihu' in STAGES:
      # ---------- 4c. 西湖终点站：坐到西湖 → 停着等起身 → 真点「起身」→ 上岸 → 走回浮码头再上船 ----------
      # 西洋 A 出来，船停在黎明湖（往西湖方向）：黎明湖上船 → 西水关（不起身，接着坐）→ 西湖
      lm = [p for p in D['piers'] if p['id'] == 'lmh'][0]; sg = await W(pg, *lm['sign'])
      c = await pg.evaluate(f"__fzNav.snap({sg[0] - lm['n'][0] * 4}, {sg[1] - lm['n'][1] * 4})")
      if c and await go(pg, *c, 'to 黎明湖码头牌') and OUT:
        s = await st(pg); await pg.evaluate(f"__game.player.yaw = Math.atan2({sg[0] - s['pos'][0]}, {sg[1] - s['pos'][2]}); __game.player.pitch = 0.12"); await asyncio.sleep(0.8); await shot(pg, 'pier_sign_liminghu_en')
      if await board(pg, D, 'lmh', 'legL'):
        await asyncio.sleep(1.5); ok('plate:boat:legL', await plate(pg) == 'A线 · 西水关码头', await plate(pg))
        await ride(pg, D, 'legL', 'xsg')
        R['canopy'] = await seated_shots(pg, 'xsg_dock')
        # 西水关不起身：10 秒后接着开往西湖
        gone = await wait(pg, "__game.fzMetro.street.boat.info().phase == 'go'", 60)
        ok('legX:continuesSeated', gone and await pg.evaluate("__game.fzMetro.street.boat.info().target") == 'xihu')
        await asyncio.sleep(1.0); ok('plate:boat:legX', await plate(pg) == 'A线 · 西湖码头', await plate(pg))
        await ride(pg, D, 'legX', 'xihu')
        R['canopyXihu'] = await seated_shots(pg, 'xihu_dock')
        ok('canopy:<=20%', all(v <= 0.20 for v in list(R['canopy'].values()) + list(R['canopyXihu'].values())) if OUT else True, [R['canopy'], R['canopyXihu']])
        # 终点站停着等：20 秒（游戏时间）后船还在西湖、「起身」还在
        g0 = await pg.evaluate('window.__gt'); await wait(pg, f'window.__gt - {g0} > 20', 120)
        bh = await boat(pg); ok('xihu:holdsAtTerminal', bh['phase'] == 'dock' and bh['at'] == 'xihu' and bh['holdTerm'], bh)
        if OUT: await shot(pg, 'plate_on_boat_xihu')
        await alight(pg, D, 'xihu', 'xihuEnd')
        await asyncio.sleep(0.8); ok('plate:shore:xihu', await plate(pg) == '福州内河', await plate(pg))
        if OUT: await shot(pg, 'plate_on_shore_xihu')
        # 岸上走一段（离开码头 15 m 以上），再走回浮码头上船
        P = [p for p in D['piers'] if p['id'] == 'xihu'][0]; away = await pg.evaluate(f"__fzNav.snap(...{json.dumps(await W(pg, *pf(P, -16, -7)))})")
        s0 = await st(pg); okw = bool(away) and await go(pg, *away, 'xihu pier → shore')
        s1 = await st(pg); ok('xihu:walkInland', okw and abs(s1['pos'][1]) < 0.4 and math.hypot(s1['pos'][0] - s0['pos'][0], s1['pos'][2] - s0['pos'][2]) > 5, [s0['pos'], s1['pos']])
        xs = await W(pg, *P['sign'])
        if OUT:
          await pg.evaluate(f"__game.player.yaw = Math.atan2({xs[0] - s1['pos'][0]}, {xs[1] - s1['pos'][2]}); __game.player.pitch = 0.1"); await asyncio.sleep(0.8); await shot(pg, 'pier_sign_xihu_en')
        if await board(pg, D, 'xihu', 'xihuRe'):
          dep = await wait(pg, "__game.fzMetro.street.boat.info().phase == 'go'", 60)
          ok('xihuRe:departsToXsg', dep and await pg.evaluate("__game.fzMetro.street.boat.info().target") == 'xsg')
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
