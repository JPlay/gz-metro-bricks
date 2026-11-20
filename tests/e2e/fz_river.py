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
from perfhud import perf as _perf
# 小美（11-17）：走路 / 坐船这些段用半尺寸视口 640×400（省渲染，无头 2–3 fps 快一点）；验收截图和性能采样点切回原尺寸（1112×834，和以前的数字可比）。
# FZHALF=0 关掉（全程原尺寸）。只改测试，不改产品代码。
FULL_VP = {'width': 1112, 'height': 834}; HALF_VP = {'width': 640, 'height': 400}; HALF = os.environ.get('FZHALF', '1') != '0'; _VP = {'depth': 0}
async def _vp(pg, size):
    await pg.set_viewport_size(size)
    await pg.evaluate("new Promise(r => { __game.engine.resize(); requestAnimationFrame(() => requestAnimationFrame(r)); })")
class FullVP:
    """async with FullVP(pg): 里面截图 / 采样按原尺寸；可嵌套，最外层出来才切回半尺寸"""
    def __init__(self, pg): self.pg = pg
    async def __aenter__(self):
        _VP['depth'] += 1
        if HALF and _VP['depth'] == 1: await _vp(self.pg, FULL_VP); await asyncio.sleep(0.4)
    async def __aexit__(self, *a):
        _VP['depth'] -= 1
        if HALF and _VP['depth'] == 0: await _vp(self.pg, HALF_VP)
async def perf(pg, *a, **k):
    async with FullVP(pg): return await _perf(pg, *a, **k)
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8123/'
OUT = (sys.argv[2].rstrip('/') + '/') if len(sys.argv) > 2 and sys.argv[2] != '-' else None
STAGES = set((sys.argv[3] if len(sys.argv) > 3 else 'bridges,steps,boat').split(','))
FO = 5000; TELEPORT = 2.5
E1B = any(x.startswith('e_') for x in STAGES)
E2B = any(x.startswith('b_') for x in STAGES)
E2C = any(x.startswith('c_') for x in STAGES)
E3A = any(x.startswith('g_') for x in STAGES)   # 3A 光明港东段 + 魁岐九门闸 + D 线（g_gm_east）
E3B = any(x.startswith('h_') for x in STAGES)   # 3B 晋安河北段 → 琴亭湖 + 凤坂河（h_ja_north，只走路）
E4A = any(x.startswith('i_') for x in STAGES)   # 4A 光明港西段 + 新港闸（i_gm_west，只走路）
E5 = any(x.startswith('j_') for x in STAGES)   # 5 瀛洲河 + 江四水闸（j_yz_south，只走路，两岸三桥双向圈）
E6B = any(x.startswith('k_hq_west') for x in STAGES)   # 6B 湖前河西段（k_hq_west，只走路，西段两岸四桥双向圈）
E6A = (not E6B) and any(x.startswith('k_') for x in STAGES)   # 6A 湖前河东段（k_hq_east，只走路，两岸两桥双向圈）
E2D = any(x.startswith('d_') for x in STAGES)   # 2D 安泰河东段 + 东街口 C 南后街 ⇄ 三坊七巷南口牌坊 + 津门桥 + 朱紫坊 + 琼东河口（d_walk / d_east）；d_dadao = 上下杭三捷河（达道 C 景点街）   # 2C 白马河下段（宁化 A、上海西码头、C 线、工业路 / 江滨西大道桥下步道、彬德水闸）   # 2B 东西河东段（水部 C、市民服务中心码头、桥下步道）   # 1B 东线（晋安河 + 光明港，B 线）
BUDGET = {'draws': 50, 'tris': 90000}
# 3C 夜景：FZQS='&t=night' 整套在夜里跑（同一预算 ≤ 90k / 50）；默认 '&t=day'（固定白天，不随跑测试时的本地时间变）
QS = os.environ.get('FZQS', '&t=day'); NIGHT = 't=night' in QS
NSTATE = """(async () => { const { Render } = await import('/js/core/render.js'); const g = __game, s = g.scene, S = g.fzMetro.street, Rn = Render.active, M = s.getMaterialByName('glow'), sea = s.getMaterialByName('paint@sea'), /* 河网没建过时 paint@sea 还不存在：拿它的克隆源 paint 的白天值作基准（bucketMat 克隆出来就是这个值） */
  L = s.getMeshByName('fzNightLights'), sky = s.getMeshByName('sky');
  return { info: S ? S.info().night : null, street: !!S, render: !!(Rn && Rn.night), fog: [s.fogMode, s.fogStart, s.fogEnd, +s.fogColor.r.toFixed(4), +s.fogColor.g.toFixed(4), +s.fogColor.b.toFixed(4)],
    clear: [s.clearColor.r, s.clearColor.g, s.clearColor.b].map(v => +v.toFixed(4)), sky: sky && sky.material.emissiveTexture ? sky.material.emissiveTexture.name || sky.material.emissiveTexture.url : null,
    glow: M ? [M.emissiveColor.r, M.emissiveColor.g, M.emissiveColor.b] : null, sea: (W => W ? [W.emissiveColor.r, W.emissiveColor.g, W.emissiveColor.b, W.environmentIntensity] : null)(sea || s.getMaterialByName('paint')),
    lights: L ? (L.isEnabled() ? 'on' : 'off') : 'none', shadow: Rn ? Rn.sun.shadowEnabled : null, lightsTris: L ? L.getTotalIndices() / 3 : 0 }; })()"""
NB = {}
async def night_check(pg, tag):
    n = await pg.evaluate(NSTATE); R.setdefault('night', {})[tag] = n
    if NIGHT: ok(f'night:{tag}:on', n['info'] is True and n['render'] and n['fog'][2] == 220 and n['lights'] == 'on' and n['shadow'] is False and 'sky_night' in (n['sky'] or ''), n)
    else: ok(f'day:{tag}:no night (nothing built)', n['info'] is False and not n['render'] and n['lights'] == 'none' and 'sky_night' not in (n['sky'] or ''), n)
    return n
async def night_base(pg):
    NB['s'] = await pg.evaluate(NSTATE); return NB['s']
async def restore_check(pg, tag):
    """离开河网（进了车站）：灯光 / 雾 / clearColor / 天空 / glow / 水面全部回到进河网之前，夜灯网格已释放"""
    n = await pg.evaluate(NSTATE); b = NB.get('s'); R.setdefault('night', {})['leave:' + tag] = n
    keys = ('render', 'fog', 'clear', 'sky', 'glow', 'sea')
    ok(f'leave:{tag}:day restored exactly', b is not None and not n['street'] and n['lights'] == 'none' and all(n[k] == b[k] for k in keys), [{k: n[k] for k in keys}, {k: b[k] for k in keys} if b else None])
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
    async with FullVP(pg):
        if await safe_shot(pg, path=p, type='jpeg', quality=70): R['shots'].append(p); log('shot', p)
async def sample(pg, label):
    d = await perf(pg, 3, 0.3); R['perf'][label] = d; return d
async def sample4(pg, label):
    # 任意机位：四个正交朝向的峰值（和冒烟同一套），避免只采样「看向目标」的那一个角度漏掉超预算方向
    yaw0 = await pg.evaluate('__game.player.yaw')
    rows = []
    async with FullVP(pg):
        for k in range(4):
            await pg.evaluate(f'__game.player.yaw = {k} * Math.PI / 2; __game.player.pitch = 0.08')
            rows.append(await perf(pg, 3, 0.3))
    await pg.evaluate(f'__game.player.yaw = {yaw0}')
    d = {**max(rows, key=lambda r: r['tris']), 'draws': max(r['draws'] for r in rows), 'tris': max(r['tris'] for r in rows)}
    R['perf'][label] = d; return d
async def mod(pg):
    return await pg.evaluate("""(async () => { const M = await import('/js/data/fz-river.js'); return { bridges: M.BRIDGES, piers: M.PIERS, steps: M.FZR.steps, unders: [...(M.FZR.unders || []), ...(M.FZR.undersC || [])], c2: M.FZR.c2 || null, routes: Object.fromEntries(Object.entries(M.ROUTES).map(([r, c]) => [r, c.stops.map(s => ({ id: s.id, s: s.s }))])), clrRepC: M.ROUTES.C ? M.withRoute('C', () => M.clearanceReport(0.5).per) : {}, clrRepD: M.ROUTES.D ? M.withRoute('D', () => M.clearanceReport(0.5).per) : {}, a3: M.FZR.a3 ? { gate: M.FZR.a3.gate, mj: { o: M.FZR.a3.mj.o, t: M.FZR.a3.mj.t }, gmALen: M.FZR.a3.gmALen } : null, sbwWalk: M.FZR.sbwWalk, kiosks: M.KIOSKS, stops: M.STOPS.map(s => ({ id: s.id, s: s.s })), clr: M.CLEAR_MIN, wy: M.WY, clrRep: M.clearanceReport(0.5).per }; })()""")
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
    if (E1B or E2B or E2C or E3A) and not await near(pg, *land, 1.0):
        # 福新问渡：码头牌后面这块步行栅格没铺上（e2e 导航网格的问题，人能走）→ A* 先到最近能到的格子，再直线走过去
        await legs(pg, [land], False); r1 = await near(pg, *land, 1.0); log('board: last stretch to land straight', pid, r1)
    gap = await W(pg, *pf(P, -9.6, -0.9))   # 1B：岸墙缺口正中（a −10.2…−8.3）直下台阶顶，不贴着栏杆端柱斜穿
    await legs(pg, ([gap, top] if (E1B or E2B or E2C or E3A) else [head, top]) + [bot, pont], False)   # 2B 市民服务中心码头：同 1B 从岸墙缺口正中下（从 head 斜穿会被栏杆端柱挡住，18:12 那次 downStairsToPontoon:smc 就是这样）
    s = await st(pg); ok(f'{leg}:downStairsToPontoon:{pid}', abs(s['pos'][1] - (D['wy'] + 0.45)) < 0.3 and r1, s['pos'])
    if leg == 'leg1': await shot(pg, 'pier_pontoon_' + pid)
    # 船不在这个码头就会被“叫”过来（站在浮码头上）
    # 3A：等「这个码头那条线」的船。street.boat 不坐船时 = 出口亭那条线（光明港出来 = B），魁岐停靠点只有 D 线 → 看 boats.D（gleg2 以前误等 B 船 1500 s）
    b0 = await boat(pg); rid = b0['rid'] if b0 else None; ids = lambda r: [x['id'] for x in D['routes'].get(r, [])]
    BX = '__game.fzMetro.street.boat'
    if rid and pid not in ids(rid):
        rid = next((r for r in D['routes'] if pid in ids(r)), None)
        if rid: BX = f'__game.fzMetro.street.boats.{rid}'
    okb = await wait(pg, f"(() => {{ const b = {BX}.info(); return b.phase == 'dock' && b.at == '{pid}'; }})()", 400, 1500)
    ok(f'{leg}:boatAtPier:{pid}', okb, await pg.evaluate(f'{BX}.info()'))
    door = await W(pg, *pf(P, 2.4, 2.4)); inb = await W(pg, *pf(P, 2.4, 3.9))
    await legs(pg, [door, inb], False)
    aisle = await pg.evaluate("(() => { const ss = " + BX + ".seats.filter(s => s.free); const a = ss.filter(s => Math.abs(Math.abs(s.lz) - 1.3) < 0.01); const p = __game.player.position; a.sort((x, y) => Math.hypot(x.wx - p.x, x.wz - p.z) - Math.hypot(y.wx - p.x, y.wz - p.z)); const s = a[0]; return [(s.wx + s.stand.x) / 2, (s.wz + s.stand.z) / 2]; })()")
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
    CR = D['clrRepC'] if b0.get('rid') == 'C' else D.get('clrRepD', {}) if b0.get('rid') == 'D' else D['clrRep']   # 2C：C 线桥的里程按 C 线
    sbm5 = (CR.get('bm5') or {}).get('s') if b0.get('rid') != 'C' else None; took = set(); perfs = []
    t0 = time.monotonic(); g0 = await pg.evaluate('window.__gt'); a0 = await pg.evaluate('window.__acc ? window.__acc.goT : 0'); done = False
    while time.monotonic() - t0 < 2400:
        b = await boat(pg)
        if b['stats']['arrives'] > arr0 and b['phase'] == 'dock': done = True; break
        if await pg.evaluate('window.__gt') - g0 > 700: break
        if b['phase'] == 'go' and b['v'] > 1 and 'perf' not in took and abs(b['s'] - b0['s']) > 30:
            took.add('perf'); perfs.append(await sample(pg, f'{leg}:onBoat'))
            if b0.get('rid') == 'C': await hud_boat(pg, leg, 'C', '#2F7D4A')   # 小美 2C ④：只有坐在 C 线船上才绿
            if b0.get('rid') == 'D': await hud_boat(pg, leg, 'D', '#7A4E9C')   # 3A：坐在 D 线船上才紫
        if shots and b['phase'] == 'go' and 'seat3' not in took and abs(b['s'] - b0['s']) > 20:
            took.add('seat3'); await pg.evaluate("if (__game.player.view!=='third') __game.toggleView()"); await shot(pg, 'boat_seated_third')
            await pg.evaluate("__game.toggleView()"); await asyncio.sleep(0.6); await shot(pg, 'boat_seated_first'); await pg.evaluate("__game.toggleView()")
        if shots and sbm5 is not None and 'arch' not in took and abs(b['s'] - sbm5) < 4:
            took.add('arch'); await shot(pg, 'boat_under_bridge_bm5_guifang')
        if shots and sbm5 is not None and 'archA' not in took and 8 < abs(b['s'] - sbm5) < 16 and (sbm5 - b['s']) * b['dir'] > 0:
            took.add('archA'); await shot(pg, 'boat_approach_bridge_bm5_guifang')
        for bid, nm in (bshots or {}).items():
            sb = (CR.get(bid) or {}).get('s')
            if sb is None: continue
            if 'ap' + bid not in took and 9 < abs(b['s'] - sb) < 18 and (sb - b['s']) * b['dir'] > 0:
                took.add('ap' + bid); await shot(pg, f'boat_approach_{bid}_{nm}')
            if 'un' + bid not in took and abs(b['s'] - sb) < 2.5:
                took.add('un' + bid); await shot(pg, f'boat_under_{bid}_{nm}')
        await asyncio.sleep(0.25 if bshots else 0.5)
    b = await boat(pg); j = await jget(pg); c = await pg.evaluate('window.__clr')
    gs = round(await pg.evaluate('window.__gt') - g0, 1); goT = await pg.evaluate('window.__acc ? window.__acc.goT : null')
    R['legs'].append({'leg': leg, 'from': b0['at'], 'to': b['at'], 'dir': b['dir'], 'stats': b['stats'], 'jump': j['max'], 'clr': c, 'secs': round(time.monotonic() - t0), 'gameSecs': gs, 'goSecs': round(goT - a0, 1) if goT is not None else None, 'log': b['log']})
    ok(f'{leg}:arrived:{target}', done and b['at'] == target, b)
    ok(f'{leg}:smooth', j['max'] < TELEPORT and b['stats']['maxStep'] < (1.45 if E1B or E2B or E2C or E3A else 1.0) and b['stats']['maxYawStep'] < 0.12, {'jump': j['max'], 'stats': b['stats']})
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
    await legs(pg, [door, edge, pont], False); await legs(pg, [bot, top], False); s1 = await st(pg); await legs(pg, [await W(pg, *pf(P, -9.6, -0.9)) if (E1B or E3A) else head], False); s2 = await st(pg); await legs(pg, [land], False)
    if (E1B or E3A) and not await near(pg, *land, 1.2): log('alight: straight line to land blocked, A*', pid, (await st(pg))['pos']); await go(pg, *land, 'stair head → shore ' + pid)
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
    exx = ex['x']; await night_base(pg); await auto(pg, [[FO + exx, -16]], True); await auto(pg, [[FO + exx, -20], [FO + exx, -36]], True)
    if not await pg.evaluate('!!__game.fzMetro.street'): s = await st(pg); await auto(pg, [[FO + exx, s['pos'][2] - 6], [FO + exx, -36]], True)
    await wait(pg, '!!__game.fzMetro.street', 8); await asyncio.sleep(0.5); await night_check(pg, code + ':enter')
    si = await street_info(pg); ok(f'{code}:{ex["n"]}:riverStreet', si and si.get('river') and si.get('kiosk') == kiosk_code and si.get('atlasOverflow') == 0, si)
    return ex, si

async def out_and_back(pg, D, code, n, net):
    """码头 → 走进出口亭进站 → 再从同一个口出来回河边（车站出口 ↔ 河）"""
    await jreset(pg)
    okk, s, m = await enter_kiosk(pg, D, code); ok(f'{code}:{n}:walkIntoStation', okk, [s['pos'], m])
    await asyncio.sleep(0.5); await restore_check(pg, f'{code}:{n}')
    await auto(pg, [[FO + 10, -30]], False); await auto(pg, [[FO + 10, -36]], False)
    await wait(pg, '!!__game.fzMetro.street', 8); await asyncio.sleep(0.5); await night_check(pg, f'{code}:{n}:backOut')
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
    a0 = await P(-e, -1.8); a1 = await P(e, -1.8); a2 = await P(e, -(U['fill'][1] or 0) - 1.6)   # a2：越过阶顶填块和岸墙线、真到岸上（r4：阶顶被栏杆封住时 a1 的 1.2 m 容差会误判通过）
    reached = await go(pg, *a0, 'to under ' + uid)
    await jreset(pg)
    await legs(pg, [await P(-e, 0.8), await P(-f - 0.4, 0.8)], False); s_bot = await st(pg)
    if OUT and uid == 'ubm19':   # 小美 2C ③：下穿北口（桥底步道这头）正对着看彬德桥（上游 28 m）
        b18 = [x for x in D['bridges'] if x['id'] == 'bm18'][0]; await look_s(pg, b18['s'], 0, 0.04); await shot(pg, 'bingde_bridge_front_from_underpass_exit')
    await legs(pg, [await P(0, 0.8)], False); s_mid = await st(pg)
    if OUT: await look(pg, *(await P(f + r, 0.8)), 0.02); await shot(pg, f'under_walkway_{uid}_{tag}')
    await legs(pg, [await P(f + 0.4, 0.8), await P(e, 0.8), a1, a2], False); s_end = await st(pg); j = await jget(pg)
    R.setdefault('unders', {})[uid] = {'name': U['name'], 'bot': s_bot['pos'], 'mid': s_mid['pos'], 'end': s_end['pos'], 'jump': j['max']}
    ok(f'under:{uid}:{U["name"]}:walkThrough', reached and abs(s_mid['pos'][1] - U['y']) < 0.35 and abs(s_end['pos'][1]) < 0.4 and await near(pg, *a2, 0.5) and j['max'] < TELEPORT, R['unders'][uid])
    if OUT and uid == 'udx2':
        await look(pg, *(await P(0, 1.2)), -0.35); await shot(pg, f'under_walkway_{uid}_from_bank')

# 2B：船速逐帧记录 → 最大加 / 减速度（m/s²，按游戏帧长）+ 相邻帧速度差
ACCW = """(() => { window.__acc = { aMax: 0, dMax: 0, dvMax: 0, n: 0, stepOver: -9, stepMax: 0, goT: 0 }; let lv = null, lp = null;
  __game.scene.onAfterRenderObservable.add(() => { const S = __game.fzMetro.street; if (!S || !S.boat) { lv = null; return; } const i = S.boat.info(), A = window.__acc; if (i.rid !== window.__accRid) { window.__accRid = i.rid; lv = null; lp = null; }
    const dt = S.boat.dtLast || 0, vr = S.boat.v; if (lv !== null && dt > 0.004 && i.phase === 'go') { const dv = vr - lv; A.n++; A.goT += dt;
      if (dv / dt > A.aMax) A.aMax = +(dv / dt).toFixed(3); if (-dv / dt > A.dMax) A.dMax = +(-dv / dt).toFixed(3); if (Math.abs(dv) > A.dvMax) A.dvMax = +Math.abs(dv).toFixed(3); }
    const q = S.boat.node.getAbsolutePosition(); if (lp !== null && lv !== null && dt > 0.004 && i.phase === 'go') { const d = Math.hypot(q.x - lp[0], q.z - lp[1]); if (d > A.stepMax) A.stepMax = +d.toFixed(3); const o = d - Math.max(vr, lv) * dt; if (o > A.stepOver) A.stepOver = +o.toFixed(3); }
    lp = [q.x, q.z]; lv = vr; }); return true; })()"""
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

# ---------- 2C：宁化 A → 上海西码头 → C 线 ⇄ 西水关（共用码头、各自泊位）→ 桥下步道 → 彬德水闸 / 闽江 ----------
CAPS = """(() => { window.__caps = []; window.addEventListener('gz-audio-caption', e => { if (e.detail && e.detail.id) window.__caps.push([e.detail.id, e.detail.text]); }); return true; })()"""
async def latw(pg, x, z):
    """W 点相对白马河中线的横向（+ = 西岸）"""
    return await pg.evaluate(f"(async () => {{ const M = await import('/js/data/fz-river.js'); return M.RIVERS.bm.line.project({x}, {z}).lat; }})()")
async def bmpt(pg, s_, lat):
    return await pg.evaluate(f"(async () => {{ const M = await import('/js/data/fz-river.js'); const a = M.RIVERS.bm.line.at({s_}, {lat}); const R = __game.fzMetro.street.kit.root.position; return [a.x + R.x, a.z + R.z]; }})()")
async def cboat(pg): return await pg.evaluate('__game.fzMetro.street.boats.C.info()')
async def sit_now(pg, leg, pid, rid='C'):
    aisle = await pg.evaluate("(() => { const b = __game.fzMetro.street.boat; const ss = b.seats.filter(s => s.free); const a = ss.filter(s => Math.abs(Math.abs(s.lz) - 1.3) < 0.01); const p = __game.player.position; a.sort((x, y) => Math.hypot(x.wx - p.x, x.wz - p.z) - Math.hypot(y.wx - p.x, y.wz - p.z)); const s = a[0]; return [(s.wx + s.stand.x) / 2, (s.wz + s.stand.z) / 2]; })()")
    await legs(pg, [aisle], False)
    sit = await wait(pg, "(__game.state().act||{}).id=='sit'", 20)
    if sit: await tap(pg, '#bAct')
    seated = await wait(pg, f"!!(__game.player.seat && __game.player.seat.seat.boat && __game.player.seat.seat.boat.rid === '{rid}')", 10)
    return ok(f'{leg}:seatedViaTap:{pid}', sit and seated, await st(pg))
async def deck_path(pg, D, toward_berth=True):
    """西水关：A 线浮码头下游端 → 栈道（离岸墙 1.0 m）→ C 线泊位门口"""
    X = [p for p in D['piers'] if p['id'] == 'xsg'][0]; C = [p for p in D['piers'] if p['id'] == 'xsgc'][0]; hw = 10.0
    pts = [await W(pg, *pf(X, 1.2, 1.2)), await W(pg, *pf(X, 7.6, 1.0))]
    # 1A 水埠头石阶（bm_e，离墙 0–1.4 m）旁边那段沿 lat 8.0 走（栈道在石阶外侧让开），过了石阶再回到离墙 1 m
    st_ = [q for q in D['steps'] if q['id'] == 'bm_e'][0]; s0, s1, sx = X['s'] + 8.5, C['s'], st_['s'] + 4.5; n = max(2, int((sx - s0) / 3))
    pts.append(await bmpt(pg, s0, hw - 2.0))
    for k in range(n + 1): pts.append(await bmpt(pg, s0 + (sx - s0) * k / n, hw - 2.0))
    pts.append(await bmpt(pg, sx + 0.8, hw - 1.0)); pts.append(await bmpt(pg, s1, hw - 1.0))
    return pts if toward_berth else pts[::-1]
async def board_xsgc(pg, D, leg):
    X = [p for p in D['piers'] if p['id'] == 'xsg'][0]; hw = 10.0; C = [p for p in D['piers'] if p['id'] == 'xsgc'][0]
    land = await landpt(pg, X); r1 = await go(pg, *land, 'to 西水关 sign')
    if not await near(pg, *land, 1.0): await legs(pg, [land], False)
    await legs(pg, [await W(pg, *pf(X, -9.6, -0.9)), await W(pg, *pf(X, -9.4, 0.75)), await W(pg, *pf(X, -4.0, 0.75))], False)
    await jreset(pg); await legs(pg, await deck_path(pg, D), False); s = await st(pg); j = await jget(pg)
    onDeck = abs(s['pos'][1] - (D['wy'] + 0.45)) < 0.3 and await near(pg, *(await bmpt(pg, C['s'], hw - 1.0)), 1.0)
    ok(f'{leg}:xsg→deck→C berth (shared pier, own berth)', r1 and onDeck and j['max'] < TELEPORT, {'pos': s['pos'], 'jump': j['max']})
    okb = await wait(pg, "(() => { const b = __game.fzMetro.street.boats.C.info(); return b.phase == 'dock' && b.at == 'xsgc'; })()", 400, 1500)
    ok(f'{leg}:boatC:atXsgc', okb, await cboat(pg))
    await legs(pg, [await bmpt(pg, C['s'], hw - 1.9), await bmpt(pg, C['s'], hw - 3.0)], False)
    return await sit_now(pg, leg, 'xsgc')
async def alight_xsgc(pg, D, leg):
    X = [p for p in D['piers'] if p['id'] == 'xsg'][0]; C = [p for p in D['piers'] if p['id'] == 'xsgc'][0]; hw = 10.0
    st_ok = await wait(pg, "(__game.state().act||{}).id=='stand'", 15)
    if st_ok: await tap(pg, '#bAct')
    up = await wait(pg, '!__game.player.seat', 8); ok(f'{leg}:standViaTap:xsgc', st_ok and up)
    await legs(pg, [await bmpt(pg, C['s'], hw - 3.0), await bmpt(pg, C['s'], hw - 1.9), await bmpt(pg, C['s'], hw - 1.0)], False)
    s0 = await st(pg); ok(f'{leg}:plankToDeck:xsgc', abs(s0['pos'][1] - (D['wy'] + 0.45)) < 0.3, s0['pos'])
    if OUT:   # 共用码头：站在 C 泊位旁的栈道上往上游看 —— C 船在自己的泊位，栈道沿岸墙接到 A 线浮码头（A 船停在那里）
        await look(pg, *(await W(pg, *X['berth'])), -0.12); await shot(pg, 'xsg_shared_pier_from_C_berth_deck')
        await look(pg, *(await bmpt(pg, C['s'], hw - 6.0)), -0.2); await shot(pg, 'xsgc_C_boat_at_own_berth')
    await legs(pg, await deck_path(pg, D, False), False)
    await legs(pg, [await W(pg, *pf(X, -4.0, 0.75)), await W(pg, *pf(X, -9.4, 0.75)), await W(pg, *pf(X, -9.6, -0.9)), await landpt(pg, X)], False)
    s = await st(pg); land = await landpt(pg, X)
    r = ok(f'{leg}:upToShore:xsg', abs(s['pos'][1]) < 0.4 and await near(pg, *land, 1.2), s['pos']); await hud_shore_red(pg, leg + ':xsg'); return r
async def look_s(pg, s_, lat, pitch=0.02): await look(pg, *(await bmpt(pg, s_, lat)), pitch)

# ---------- 3A：光明港 D 口 → 光明港码头（B 线浮码头 → 栈道 → D 泊位）→ D 线（白篷）→ 魁岐停靠点 → 看九门闸 / 闽江（试着走上闸：上不去）→ 坐回来 → 故意掉水「回到岸上」 ----------
async def gmpt(pg, s_, lat):
    return await pg.evaluate(f"(async () => {{ const M = await import('/js/data/fz-river.js'); const a = M.RIVERS.gm.line.at({s_}, {lat}); const R = __game.fzMetro.street.kit.root.position; return [a.x + R.x, a.z + R.z]; }})()")
async def dboat(pg): return await pg.evaluate('__game.fzMetro.street.boats.D.info()')
async def gm_deck_path(pg, D, toward_berth=True):
    """光明港：B 线浮码头下游端 → 栈道（离岸墙 1.0 m）→ D 泊位门口"""
    G = [p for p in D['piers'] if p['id'] == 'gmg'][0]; Dp = [p for p in D['piers'] if p['id'] == 'gmgD'][0]; hw = 21.0
    pts = [await W(pg, *pf(G, 1.2, 1.2)), await W(pg, *pf(G, 7.6, 1.0))]
    for k in range(4): pts.append(await gmpt(pg, G['s'] + 8.5 + (Dp['s'] - G['s'] - 8.5) * k / 3, hw - 1.0))
    return pts if toward_berth else pts[::-1]
async def board_gmgD(pg, D, leg):
    G = [p for p in D['piers'] if p['id'] == 'gmg'][0]; Dp = [p for p in D['piers'] if p['id'] == 'gmgD'][0]; hw = 21.0
    land = await landpt(pg, G); r1 = await go(pg, *land, 'to 光明港 sign')
    if not await near(pg, *land, 1.0): await legs(pg, [land], False)
    await legs(pg, [await W(pg, *pf(G, -9.6, -0.9)), await W(pg, *pf(G, -9.4, 0.75)), await W(pg, *pf(G, -4.0, 0.75))], False)
    await jreset(pg); await legs(pg, await gm_deck_path(pg, D), False); s = await st(pg); j = await jget(pg)
    onDeck = abs(s['pos'][1] - (D['wy'] + 0.45)) < 0.3 and await near(pg, *(await gmpt(pg, Dp['s'], hw - 1.0)), 1.0)
    ok(f'{leg}:gmg→deck→D berth (shared pier, own berth)', r1 and onDeck and j['max'] < TELEPORT, {'pos': s['pos'], 'jump': j['max']})
    if OUT: await look(pg, *(await W(pg, *Dp['berth'])), -0.15); await shot(pg, f'g_{leg}_D_boat_white_at_gmgD_from_deck')
    okb = await wait(pg, "(() => { const b = __game.fzMetro.street.boats.D.info(); return b.phase == 'dock' && b.at == 'gmgD'; })()", 400, 1500)
    ok(f'{leg}:boatD:atGmgD', okb, await dboat(pg))
    await legs(pg, [await gmpt(pg, Dp['s'], hw - 1.9), await gmpt(pg, Dp['s'], hw - 3.0)], False)
    return await sit_now(pg, leg, 'gmgD', 'D')
async def alight_gmgD(pg, D, leg):
    G = [p for p in D['piers'] if p['id'] == 'gmg'][0]; Dp = [p for p in D['piers'] if p['id'] == 'gmgD'][0]; hw = 21.0
    st_ok = await wait(pg, "(__game.state().act||{}).id=='stand'", 15)
    if st_ok: await tap(pg, '#bAct')
    up = await wait(pg, '!__game.player.seat', 8); ok(f'{leg}:standViaTap:gmgD', st_ok and up)
    await legs(pg, [await gmpt(pg, Dp['s'], hw - 3.0), await gmpt(pg, Dp['s'], hw - 1.9), await gmpt(pg, Dp['s'], hw - 1.0)], False)
    s0 = await st(pg); ok(f'{leg}:plankToDeck:gmgD', abs(s0['pos'][1] - (D['wy'] + 0.45)) < 0.3, s0['pos'])
    await legs(pg, await gm_deck_path(pg, D, False), False)
async def in_block(pg, D):
    """玩家（W 局部）是否在九门闸占地里"""
    blk = D['a3']['gate']['block']
    return await pg.evaluate(f"(async () => {{ const M = await import('/js/data/fz-river.js'); const R = __game.fzMetro.street.kit.root.position, p = __game.player.position; return M.inPoly(p.x - R.x, p.z - R.z, {json.dumps([v for q in blk for v in q])}); }})()")
async def fall_and_back(pg, P, tag, a_off, b_off):
    """从浮码头一头走出去掉进水里 → 「回到岸上」：回到岸地（不是浮码头 / 台阶 / 站台）"""
    pont = await W(pg, *pf(P, 1.2, 1.5)); off = await W(pg, *pf(P, a_off, b_off))
    # 3A：gleg2 下了 D 船走栈道回来，人已经在浮码头上（水面 + 0.45）→ 直接走到浮码头这一头；
    # 以前不管在哪都先直线去岸墙缺口，从浮码头斜穿台阶栏杆卡在台阶上，后面掉水那一步从台阶上走不出去（07:01 那次 dry / street）
    s0 = await st(pg); wy = await pg.evaluate("(async () => (await import('/js/data/fz-river.js')).WY)()")
    if abs(s0['pos'][1] - (wy + 0.45)) < 0.3: await legs(pg, [pont], False)
    else: await legs(pg, [await W(pg, *pf(P, -9.6, -0.9)), await W(pg, *pf(P, -9.4, 0.75)), await W(pg, *pf(P, -4.0, 0.75)), pont], False)
    s1 = await st(pg); await legs(pg, [off], False); await asyncio.sleep(1.0)
    shown = await wait(pg, "(() => { const b = document.getElementById('bShore'); return !!b && !b.hidden; })()", 10)
    s_in = await st(pg)
    if OUT: await shot(pg, f'g_fall_in_water_{tag}')
    tapped = False
    if shown:
        try: await pg.locator('#bShore').tap(timeout=15000); tapped = True
        except Exception as e: log('shore tap', str(e)[:200])
    await asyncio.sleep(1.0); s2 = await st(pg)
    where = await pg.evaluate("(async () => { const M = await import('/js/data/fz-river.js'); const R = __game.fzMetro.street.kit.root.position, p = __game.player.position, x = p.x - R.x, z = p.z - R.z; return { land: M.isLand(x, z), dry: M.isDry(x, z), zone: __game.fzMetro.street ? 'street' : 'station' }; })()")
    R.setdefault('fall3a', {})[tag] = {'pontoon': s1['pos'], 'inWater': s_in['pos'], 'after': s2['pos'], 'shown': shown, 'tapped': tapped, 'where': where}
    return ok(f'g_fall:{tag}:intoWaterAndBackToBank (not pontoon / platform)', shown and s_in['pos'][1] < -0.5 and tapped and abs(s2['pos'][1]) < 0.4 and where['land'] and not where['dry'] and s2['zone'] == 'street', R['fall3a'][tag])
async def run_3a(pg):
    await pg.evaluate('window.__fzNavRes = 0.35')
    ex, si = await station_to_exit(pg, 'fzgmg', "x.attr === 'fzriver'", 'fzgmg')
    ok('fzgmg:D:net e, boats B + D, D at its own 光明港 berth', si and si.get('net') == 'e' and set((si.get('boats') or {}).keys()) == {'B', 'D'} and si['boats']['D']['at'] == 'gmgD', si and {'net': si.get('net'), 'boats': {k: v.get('at') for k, v in (si.get('boats') or {}).items()}})
    await pg.evaluate(CLEAR); await pg.evaluate(ACCW); await pg.evaluate(CAPS); D = await mod(pg); await nav(pg); await asyncio.sleep(1)
    R['perf']['g:kiosk:fzgmg'] = await sample4(pg, 'g:kiosk:fzgmg')
    G = [p for p in D['piers'] if p['id'] == 'gmg'][0]; KQ = [p for p in D['piers'] if p['id'] == 'kq'][0]; Gt = D['a3']['gate']; hw = 21.0
    # 光明港码头牌：B线 / D线 两行
    land = await landpt(pg, G); okw = await go(pg, *land, '光明港 D 口 → 光明港码头'); ok('g:walkToGmgPier', okw)
    if OUT: await look(pg, *(await W(pg, *G['sign'])), 0.1); await shot(pg, 'g_pier_sign_gmg_B_D_rows')
    rows = await pg.evaluate("(async () => { const M = await import('/js/data/fz-river.js'); return ['gmg', 'gmgD'].flatMap(id => M.routesOfPier(id).map(r => r + ':' + M.pierNext(id, r).map(p => p.zh).join('/'))); })()")
    ok('g:sign:gmg rows B线 下一站 河口码头 / D线 下一站 魁岐停靠点', rows == ['B:河口码头', 'D:魁岐停靠点'], rows)
    R['perf']['g:gmgSign'] = await sample4(pg, 'g:gmgSign')
    BS = {'gm4': 'fuguang'}
    if await board_gmgD(pg, D, 'gleg1'):
        await ride(pg, D, 'gleg1', 'kq', bshots=BS if OUT else None)
        for _ in range(16):
            caps = await pg.evaluate('window.__caps.slice(-16)')
            if any(c[0] == 'voice.fz.boat.arrive.kq.end.zh' for c in caps): break
            await asyncio.sleep(1)
        ok('gleg1:announce depart D线 开往魁岐停靠点 + arrive 魁岐停靠点 终点', any(c[0] == 'voice.fz.boat.d.depart.kq.zh' for c in caps) and any(c[0] == 'voice.fz.boat.arrive.kq.end.zh' for c in caps), caps)
        b = await dboat(pg); ok('gleg1:D turned around at the terminus (dir −1, next = 光明港)', b['at'] == 'kq' and b['dir'] == -1, b)
        await alight(pg, D, 'kq', 'gleg1')
    # 魁岐停靠点：木牌只写「魁岐停靠点 / Kuiqi Stop」
    if OUT: await look(pg, *(await W(pg, *KQ['sign'])), 0.1); await shot(pg, 'g_pier_sign_kq')
    ok('g:sign:kq stopOnly (no line / next rows)', KQ.get('stopOnly') is True and KQ['zh'] == '魁岐停靠点' and KQ['en'] == 'Kuiqi Stop')
    R['perf']['g:kqSign'] = await sample4(pg, 'g:kqSign')
    # 走到闸边观景处：看闸、看闽江
    vw = await W(pg, *Gt['view']); okv = await go(pg, *vw, '魁岐停靠点 → 九门闸观景处'); ok('g:walkToGateLookout', okv and await near(pg, *vw, 1.5), (await st(pg))['pos'])
    if OUT:
        await look(pg, *(await W(pg, Gt['x'], Gt['z'])), 0.03); await shot(pg, 'g_gate_from_lookout')
        mo = D['a3']['mj']; await look(pg, *(await W(pg, mo['o'][0] + mo['t'][0] * 150, mo['o'][1] + mo['t'][1] * 150)), 0.0); await shot(pg, 'g_minjiang_from_lookout')
    R['perf']['g:gateLookout'] = await sample4(pg, 'g:gateLookout')
    # 九门闸上不去：从观景处直着往闸上走（横跨河道），再沿岸往闸头挤 —— 人一直在闸占地外、没上到闸顶
    tries = []
    for (a, b) in [(0.0, 0.0), (0.0, -hw * 0.5), (-1.0, hw + 0.6), (2.0, hw + 0.4)]:
        tgt = await W(pg, Gt['x'] + Gt['t'][0] * a + Gt['n'][0] * b, Gt['z'] + Gt['t'][1] * a + Gt['n'][1] * b)
        await legs(pg, [vw], False); await legs(pg, [tgt], False); await asyncio.sleep(0.5)
        s = await st(pg); ib = await in_block(pg, D); tries.append({'to': [a, b], 'pos': s['pos'], 'inBlock': ib})
    R['gateBlock'] = tries
    ok('g:gate:cannot walk onto 九门闸 (always outside the gate footprint, never up on it)', all(not t['inBlock'] and t['pos'][1] < 1.0 for t in tries), tries)
    # 回停靠点，坐 D 线回光明港码头
    if await board(pg, D, 'kq', 'gleg2'):
        await ride(pg, D, 'gleg2', 'gmgD', bshots=BS if OUT else None)
        await alight_gmgD(pg, D, 'gleg2')
        b = await dboat(pg); ok('gleg2:D turned around at 光明港 (dir +1, next = 魁岐)', b['at'] == 'gmgD' and b['dir'] == 1, b)
    # 故意掉水：光明港码头 B 线浮码头上游端（台阶旁）走出去 → 「回到岸上」回到岸上
    await fall_and_back(pg, G, 'gmg', -5.6, 2.3)
    R['perf']['g:gmgAfter'] = await sample4(pg, 'g:gmgAfter')
    per = {}
    for l in R['legs']:
        for k_, v in (l['clr'].get('per') or {}).items(): per[k_] = min(per.get(k_, 99), v)
    R['clearanceD'] = per; R['legSecs'] = {l['leg']: {'boat': l['goSecs'], 'wall': l['secs']} for l in R['legs']}
    R['accel'] = await pg.evaluate('window.__acc')
    ok('dboat:smoothAccel', R['accel']['n'] > 100 and R['accel']['aMax'] <= 0.505 and R['accel']['dMax'] <= 1.005, R['accel'])
    ok('dboat:clearanceAllBridgesOnD (≥ 0.25)', per and all(v >= D['clr'] - 0.02 for v in per.values()) and set(D['clrRepD']).issubset(set(per)), {'per': per, 'want': list(D['clrRepD'])})
    ok('dboat:oneWay<=8min (boat clock)', R['legSecs'] and all(0 < (v['boat'] or 0) <= 480 for v in R['legSecs'].values()), R['legSecs'])

async def rpt(pg, rid, s_, lat):
    """3B：河 rid 中线 s、横向 lat（W 局部）→ 世界坐标"""
    q = await pg.evaluate(f"(async () => {{ const M = await import('/js/data/fz-river.js'); const a = M.RIVERS['{rid}'].line.at({s_}, {lat}); return [a.x, a.z]; }})()")
    return await W(pg, *q)
CLEARJS = """(async () => { const M = await import('/js/data/fz-river.js'), F = M.FZR, RV = M.RIVERS, rid = '%s', s0 = %s, lat = %s, tgt = %s;
  const TR = F.trees.filter(t => t[5] !== 'gone'), seg = (p, a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz, u = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / L2)); return Math.hypot(p[0] - a[0] - u * dx, p[1] - a[1] - u * dz); };
  const clear = (c, t) => { const d = Math.hypot(t[0] - c[0], t[1] - c[1]), ux = (t[0] - c[0]) / d, uz = (t[1] - c[1]) / d, e = [c[0] + ux * Math.min(30, d), c[1] + uz * Math.min(30, d)];
    return !TR.some(q => { const qx = q[0] - c[0], qz = q[1] - c[1], r = Math.hypot(qx, qz), f = (qx * ux + qz * uz) / (r || 1); return (r < 16 && f > Math.cos(0.8)) || seg(q, c, e) < 1.8; }); };
  const nearB = s => M.BRIDGES.some(b => b.river === rid && Math.abs(b.s - s) < b.w / 2 + 6);
  for (const k of [0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 6, -6, 7, -7, 8, -8]) { const s = s0 + k * 4; if (s < 2 || s > RV[rid].line.len - 2 || nearB(s)) continue; const a = RV[rid].line.at(s, lat), c = [a.x, a.z]; if (M.isLand(a.x, a.z) && clear(c, tgt)) return c; }
  const a = RV[rid].line.at(s0, lat); return [a.x, a.z]; })()"""
async def clear_bank(pg, rid, s_, lat, tgt_local):
    """3B 机位：岸边贴栏杆、16 m 内画面里没有树干（同 fz_3b_shots.py），返回世界坐标"""
    return await W(pg, *(await pg.evaluate(CLEARJS % (rid, s_, lat, json.dumps(list(tgt_local))))))
async def b3_fall(pg, rid, s_, tag):
    """3B 没有码头 / 台阶口（岸边全是栏杆）：直接放进河心水里 → 「回到岸上」→ 落在岸地上（不是水里 / 桥上）"""
    x, z = await rpt(pg, rid, s_, 0)
    await pg.evaluate(f"__game.player.spawn({x}, -2.5, {z}, 0)"); await asyncio.sleep(1.5)
    shown = await wait(pg, "(() => { const b = document.getElementById('bShore'); return !!b && !b.hidden; })()", 10); s_in = await st(pg)
    if OUT: await shot(pg, f'h_fall_in_water_{tag}')
    tapped = False
    if shown:
        try: await pg.locator('#bShore').tap(timeout=15000); tapped = True
        except Exception as e: log('shore tap', str(e)[:200])
    await asyncio.sleep(1.0); s2 = await st(pg)
    where = await pg.evaluate("(async () => { const M = await import('/js/data/fz-river.js'); const R = __game.fzMetro.street.kit.root.position, p = __game.player.position, x = p.x - R.x, z = p.z - R.z; return { land: M.isLand(x, z), water: M.isWater(x, z), zone: __game.fzMetro.street ? 'street' : 'station' }; })()")
    R.setdefault('fall3b', {})[tag] = {'inWater': s_in['pos'], 'after': s2['pos'], 'shown': shown, 'tapped': tapped, 'where': where}
    return ok(f'h_fall:{tag}:inWater → 回到岸上 → on the bank', shown and s_in['pos'][1] < -0.5 and tapped and abs(s2['pos'][1]) < 0.4 and where['land'] and where['zone'] == 'street', R['fall3b'][tag])
async def b3_rail(pg, rid, s_, lat, tag):
    """岸边栏杆挡人：从步道横着往河里走 —— 人一直在岸上"""
    a = await rpt(pg, rid, s_, lat); b = await rpt(pg, rid, s_, 0)
    await go(pg, *a, f'→ rail test {tag}'); await legs(pg, [b], False); await asyncio.sleep(0.6); s = await st(pg)
    return ok(f'h_rail:{tag}:bank railing keeps you on the promenade', s['pos'][1] > -0.3, s['pos'])
async def b3_spot(pg, label, tgt, pitch=0.04, name=None, cam=None):
    if cam: okc = await go(pg, *cam, '→ 机位 ' + label); ok(f'h:walk to view spot {label}', okc and await near(pg, *cam, 1.5), (await st(pg))['pos'])
    if OUT and name:
        if await pg.evaluate("__game.player.view") != 'first': await pg.evaluate('__game.toggleView()')
        await look(pg, *tgt, pitch); await shot(pg, name)
        await pg.evaluate("if (__game.player.view !== 'third') __game.toggleView()")
    return await sample4(pg, label)
async def run_3b(pg):
    await pg.evaluate('window.__fzNavRes = 0.45')   # 3B 河网包围盒约 1.5 × 2.3 km：0.45 m 栅格（1650 万格）
    ex, si = await station_to_exit(pg, 'fzdm', "x.attr === 'fzriver'", 'fzdm')
    ok('fzdm:C:net e, walk-only 3B (routes B + D unchanged)', si and si.get('net') == 'e' and set((si.get('boats') or {}).keys()) == {'B', 'D'}, si and {'net': si.get('net'), 'boats': list((si.get('boats') or {}).keys())})
    D = await mod(pg); await nav(pg); await asyncio.sleep(1)
    B3 = await pg.evaluate("(async () => { const M = await import('/js/data/fz-river.js'); const F = M.FZR, b3 = F.b3; return { jn: M.RIVERS.jn.line.len, fb: M.RIVERS.fb.line.len, hj: F.rivers.jn.hw, hf: F.rivers.fb.hw, hg: F.rivers.gm.hw, br: Object.fromEntries(M.BRIDGES.filter(b => b.b3 || b.name === '前横南路' || b.id === 'ja1').map(b => [b.id, { s: b.s, x: b.x, z: b.z, n: b.n, w: b.w, half: b.half, name: b.name }])), signs: b3.signs, lake: { c: b3.lake.c, mouthS: b3.lake.mouthS, ring: b3.lake.ring }, fbMouth: b3.fbMouth }; })()")
    BR = B3['br']; J = B3['jn']; hj = B3['hj']; hf = B3['hf']
    R['perf']['h:kiosk:fzdm'] = await sample4(pg, 'h:kiosk:fzdm')
    # ---- 晋安河北段：斗门 C 口 → 温泉公园路桥北头 → 沿西岸往北（过华林路 / 北二环 / 农信路桥头）→ 琴亭湖口 ----
    p0 = await rpt(pg, 'jn', J - 40, hj + 2.5); okw = await go(pg, *p0, '斗门 C → 晋安河北段（温泉公园路桥北）'); ok('h:walk fzdm C → jn south end', okw and await near(pg, *p0, 1.5), (await st(pg))['pos'])
    jt = await pg.evaluate(f"(async () => {{ const M = await import('/js/data/fz-river.js'); const a = M.RIVERS.jn.line.at({J} - 140, 0); return [a.x, a.z]; }})()")
    await b3_spot(pg, 'h:jn_south', await W(pg, *jt), 0.03, 'h_jn_south_looking_north', cam=await clear_bank(pg, 'jn', J - 50, hj + 1.3, jt))
    for bid in ('jn3', 'jn2', 'jn1'):
        b = BR[bid]; q = await clear_bank(pg, 'jn', b['s'] + b['w'] / 2 + 28, hj + 1.3, (b['x'], b['z']))
        okw = await go(pg, *q, f'→ {b["name"]} 桥南岸边'); ok(f'h:walk to {b["name"]} ({bid})', okw and await near(pg, *q, 1.5), (await st(pg))['pos'])
        await b3_spot(pg, f'h:{bid}:bank', await W(pg, b['x'], b['z']), 0.04, f'h_{bid}_bridge_from_bank')
    # 华林路桥（jn3）上过河、对岸往回看
    b = BR['jn3']; e1 = await W(pg, b['x'] + b['n'][0] * (b['half'] + 3), b['z'] + b['n'][1] * (b['half'] + 3)); e2 = await W(pg, b['x'] - b['n'][0] * (b['half'] + 3), b['z'] - b['n'][1] * (b['half'] + 3))
    okc = await go(pg, *e1, '→ 华林路桥一头') and await legs(pg, [await W(pg, b['x'], b['z']), e2], True)
    ok('h:cross 华林路 bridge on foot (deck walkable, no fall)', okc and await near(pg, *e2, 2.0) and (await st(pg))['pos'][1] > -0.3, (await st(pg))['pos'])
    R['perf']['h:jn3:deck'] = await sample4(pg, 'h:jn3:deck')
    ms = B3['lake']['mouthS']; qm = await rpt(pg, 'jn', ms + 12, hj + 2.5); okw = await go(pg, *qm, '→ 琴亭湖口'); ok('h:walk to 琴亭湖 mouth', okw and await near(pg, *qm, 1.5), (await st(pg))['pos'])
    sg = [q for q in B3['signs'] if q['id'] == 'qth'][0]; sp = await W(pg, sg['x'] - sg['f'][0] * 5, sg['z'] - sg['f'][1] * 5); await go(pg, *sp, '→ 琴亭湖牌')
    await b3_spot(pg, 'h:qth_sign', await W(pg, sg['x'], sg['z']), 0.08, 'h_qth_sign')
    await b3_spot(pg, 'h:qth_mouth', await W(pg, *B3['lake']['c']), 0.03, 'h_qth_lake_from_mouth', cam=await clear_bank(pg, 'jn', ms + 6, hj + 1.3, B3['lake']['c']))
    # 湖岸步道走一段（离湖口最远的那段湖岸），看湖
    rg = B3['lake']['ring']; pts = [(rg[i], rg[i + 1]) for i in range(0, len(rg), 2)]; c = B3['lake']['c']; m0 = await rpt(pg, 'jn', ms, 0)
    sx, sz = await W(pg, 0, 0); far = max(pts, key=lambda q: math.hypot(q[0] + sx - m0[0], q[1] + sz - m0[1])); dd = math.hypot(far[0] - c[0], far[1] - c[1])
    fp = await W(pg, far[0] + (far[0] - c[0]) / dd * 4.5, far[1] + (far[1] - c[1]) / dd * 4.5)
    okw = await go(pg, *fp, '琴亭湖口 → 湖对岸步道'); ok('h:walk round 琴亭湖 to the far shore', okw and await near(pg, *fp, 2.0), (await st(pg))['pos'])
    await b3_spot(pg, 'h:qth_far', await W(pg, *c), 0.03, 'h_qth_lake_from_far_shore')
    await b3_rail(pg, 'jn', 160, -(hj + 2.5), 'jn')
    await b3_fall(pg, 'jn', 200, 'jn')
    # 回斗门 C 口进站
    okk, s_, m = await enter_kiosk(pg, D, 'fzdm'); ok('h:walk back to fzdm C kiosk and in', okk, [s_['pos'], m])
    await restore_check(pg, 'fzdm')
    # ---- 凤坂河：光明港 D 口 → 前横南路桥过光明港 → 凤坂河口（牌）→ 东岸往北到北头（暗涵封口）→ 福马路桥过河 → 西岸回来 ----
    ex, si = await station_to_exit(pg, 'fzgmg', "x.attr === 'fzriver'", 'fzgmg')
    D = await mod(pg); await nav(pg); await asyncio.sleep(1)
    g3 = [v for v in BR.values() if v['name'] == '前横南路'][0]; F_ = B3['fb']
    e1 = await W(pg, g3['x'] + g3['n'][0] * (g3['half'] + 3), g3['z'] + g3['n'][1] * (g3['half'] + 3)); e2 = await W(pg, g3['x'] - g3['n'][0] * (g3['half'] + 3), g3['z'] - g3['n'][1] * (g3['half'] + 3))
    fbm = await rpt(pg, 'fb', F_ - 10, 0); a_, b_ = (e1, e2) if math.hypot(e1[0] - fbm[0], e1[1] - fbm[1]) > math.hypot(e2[0] - fbm[0], e2[1] - fbm[1]) else (e2, e1)
    okc = await go(pg, *a_, '光明港 D 口 → 前横南路桥南头') and await legs(pg, [await W(pg, g3['x'], g3['z']), b_], True)
    ok('h:cross 前横南路 over 光明港 to the north bank', okc and await near(pg, *b_, 2.0), (await st(pg))['pos'])
    sg = [q for q in B3['signs'] if q['id'] == 'fbh'][0]; sp = await W(pg, sg['x'] + sg['f'][0] * 5, sg['z'] + sg['f'][1] * 5); okw = await go(pg, *sp, '→ 凤坂河牌')
    ok('h:walk to 凤坂河 mouth sign', okw and await near(pg, *sp, 1.5), (await st(pg))['pos'])
    await b3_spot(pg, 'h:fb_sign', await W(pg, sg['x'], sg['z']), 0.08, 'h_fb_sign')
    ft = await pg.evaluate(f"(async () => {{ const M = await import('/js/data/fz-river.js'); const a = M.RIVERS.fb.line.at({F_} - 90, 0); return [a.x, a.z]; }})()")
    await b3_spot(pg, 'h:fb_mouth', await W(pg, *ft), 0.03, 'h_fb_mouth_looking_north', cam=await clear_bank(pg, 'fb', F_ - 22, -(hf + 1.3), ft))
    for bid in ('fb4', 'fb3', 'fb2', 'fb1'):
        b = BR[bid]; q = await clear_bank(pg, 'fb', b['s'] + b['w'] / 2 + 28, hf + 1.3, (b['x'], b['z']))
        okw = await go(pg, *q, f'→ {b["name"]} 桥南岸边'); ok(f'h:walk to {b["name"]} ({bid})', okw and await near(pg, *q, 1.5), (await st(pg))['pos'])
        await b3_spot(pg, f'h:{bid}:bank', await W(pg, b['x'], b['z']), 0.04, f'h_{bid}_bridge_from_bank')
    nt = await pg.evaluate("(async () => { const M = await import('/js/data/fz-river.js'); const a = M.RIVERS.fb.line.at(0, 0); return [a.x, a.z]; })()")
    qn = await clear_bank(pg, 'fb', 34, hf + 1.3, nt); okw = await go(pg, *qn, '→ 凤坂河北头'); ok('h:walk to 凤坂河 north end', okw and await near(pg, *qn, 1.5), (await st(pg))['pos'])
    await b3_spot(pg, 'h:fb_north_end', await rpt(pg, 'fb', 0, 0), 0.1, 'h_fb_north_end_cap')
    b = BR['fb1']; e1 = await W(pg, b['x'] + b['n'][0] * (b['half'] + 3), b['z'] + b['n'][1] * (b['half'] + 3)); e2 = await W(pg, b['x'] - b['n'][0] * (b['half'] + 3), b['z'] - b['n'][1] * (b['half'] + 3))
    okc = await go(pg, *e1, '→ 福马路桥一头') and await legs(pg, [await W(pg, b['x'], b['z']), e2], True)
    ok('h:cross 福马路 bridge on foot', okc and await near(pg, *e2, 2.0) and (await st(pg))['pos'][1] > -0.3, (await st(pg))['pos'])
    R['perf']['h:fb1:deck'] = await sample4(pg, 'h:fb1:deck')
    qb = await clear_bank(pg, 'fb', BR['fb5']['s'] - BR['fb5']['w'] / 2 - 30, -(hf + 1.3), (BR['fb5']['x'], BR['fb5']['z'])); okw = await go(pg, *qb, '凤坂河西岸 → 远洋路桥北头'); ok('h:walk back down the 凤坂河 west bank', okw and await near(pg, *qb, 1.5), (await st(pg))['pos'])
    await b3_spot(pg, 'h:fb5:bank', await W(pg, BR['fb5']['x'], BR['fb5']['z']), 0.04, 'h_fb5_bridge_from_bank')
    await b3_rail(pg, 'fb', 260, -(hf + 2.5), 'fb')
    await b3_fall(pg, 'fb', 300, 'fb')
    okk, s_, m = await enter_kiosk(pg, D, 'fzgmg'); ok('h:walk back to fzgmg D kiosk and in', okk, [s_['pos'], m])
    await restore_check(pg, 'fzgmg')


async def run_4a(pg):
    """4A：光明港 D 口 → 沿南岸往西到接缝 / 瀛洲河口 → 过六一中路 → 新港闸观景处（正面三孔、闸西远水）→ 上不去闸 → 落水回岸 → 回 D 口进站。只走路。"""
    await pg.evaluate('window.__fzNavRes = 0.35')
    ex, si = await station_to_exit(pg, 'fzgmg', "x.attr === 'fzriver'", 'fzgmg')
    ok('fzgmg:4A:net e, walk-only (routes B + D unchanged)', si and si.get('net') == 'e' and set((si.get('boats') or {}).keys()) == {'B', 'D'}, si and {'net': si.get('net'), 'boats': list((si.get('boats') or {}).keys())})
    D = await mod(pg); await nav(pg); await asyncio.sleep(1)
    A4 = await pg.evaluate("""(async () => { const M = await import('/js/data/fz-river.js'); const F = M.FZR, a4 = F.a4, b = M.BRIDGES.find(q => q.id === 'gw1');
      return { hw: F.rivers.gw.hw, gw: M.RIVERS.gw.line.len, gm: M.RIVERS.gm.line.len, gate: a4.gate, sign: a4.sign, yz: a4.yz, signs: a4.signs, br: b && { id: b.id, s: b.s, x: b.x, z: b.z, n: b.n, w: b.w, half: b.half, name: b.name } }; })()""")
    hw, G, br = A4['hw'], A4['gate'], A4['br']
    R['perf']['i:kiosk:fzgmg'] = await sample4(pg, 'i:kiosk:fzgmg')
    # 沿光明港南岸往西（gm s 递减到 0；gm 的 n 朝南，南岸 = +lat）
    p0 = await rpt(pg, 'gm', 40, hw + 2.5)
    # 先走到西头附近再细走 4A
    for s_ in (400, 280, 160, 80, 40):
        q = await rpt(pg, 'gm', s_, hw + 2.5)
        okw = await go(pg, *q, f'光明港 D → gm s={s_} 南岸'); ok(f'i:walk gm s={s_}', okw and await near(pg, *q, 2.0), (await st(pg))['pos'])
    ok('i:reached 1B west end', await near(pg, *p0, 2.5), (await st(pg))['pos'])
    # 瀛洲河口在接缝南岸（gw s=2，-n 为南）
    Y, ys = A4['yz'], [q for q in A4['signs'] if q['id'] == 'yzh'][0]
    sp = await W(pg, ys['x'] + ys['f'][0] * 5, ys['z'] + ys['f'][1] * 5)
    okw = await go(pg, *sp, '→ 瀛洲河牌'); ok('i:walk to 瀛洲河 mouth sign', okw and await near(pg, *sp, 2.0), (await st(pg))['pos'])
    tip = [Y['c'][0] + Y['d'][0] * (Y['len'] * 0.7), Y['c'][1] + Y['d'][1] * (Y['len'] * 0.7)]
    await b3_spot(pg, 'i:yz_sign', await W(pg, ys['x'], ys['z']), 0.08, 'i_yz_sign')
    await b3_spot(pg, 'i:yz_mouth', await W(pg, *tip), 0.04, 'i_yz_mouth', cam=sp)
    # 六一中路：南头上桥、过河到北头
    e1 = await W(pg, br['x'] + br['n'][0] * (br['half'] + 3), br['z'] + br['n'][1] * (br['half'] + 3))
    e2 = await W(pg, br['x'] - br['n'][0] * (br['half'] + 3), br['z'] - br['n'][1] * (br['half'] + 3))
    # e1/e2：n 朝北，+n 是北头，-n 是南头。人现在在南岸，先到南头。
    a_, b_ = (e2, e1) if math.hypot(e2[0] - sp[0], e2[1] - sp[1]) < math.hypot(e1[0] - sp[0], e1[1] - sp[1]) else (e1, e2)
    okc = await go(pg, *a_, '→ 六一中路桥南头') and await legs(pg, [await W(pg, br['x'], br['z']), b_], True)
    ok('i:cross 六一中路 on foot (deck walkable, no fall)', okc and await near(pg, *b_, 2.5) and (await st(pg))['pos'][1] > -0.3, (await st(pg))['pos'])
    R['perf']['i:gw1:deck'] = await sample4(pg, 'i:gw1:deck')
    await b3_spot(pg, 'i:gw1:bank', await W(pg, G['x'], G['z']), 0.03, 'i_liuyi_looking_west_at_gate', cam=await W(pg, br['x'], br['z']))
    # 观景处在南岸桥头，走回南头再去观景
    vw = await W(pg, *G['view']); okv = await go(pg, *a_, '→ 回南桥头') and await go(pg, *vw, '→ 新港闸观景处')
    ok('i:walkToGateLookout', okv and await near(pg, *vw, 2.0), (await st(pg))['pos'])
    if OUT:
        await look(pg, *(await W(pg, G['x'], G['z'])), 0.03); await shot(pg, 'i_gate_from_lookout')
        xo, zo = G['x'] + G['t'][0] * 28, G['z'] + G['t'][1] * 28
        await look(pg, *(await W(pg, xo, zo)), 0.0); await shot(pg, 'i_xingang_west_far_water')
        sg = A4['sign']; await look(pg, *(await W(pg, sg['x'], sg['z'])), 0.1); await shot(pg, 'i_sign_xingang')
    R['perf']['i:gateLookout'] = await sample4(pg, 'i:gateLookout')
    # 新港闸上不去
    tries = []
    for (a, b) in [(0.0, 0.0), (0.0, -hw * 0.5), (-1.0, hw + 0.6), (2.0, hw + 0.4)]:
        tgt = await W(pg, G['x'] + G['t'][0] * a + G['n'][0] * b, G['z'] + G['t'][1] * a + G['n'][1] * b)
        await legs(pg, [vw], False); await legs(pg, [tgt], False); await asyncio.sleep(0.5)
        s = await st(pg); blk = await pg.evaluate(f"(async () => {{ const M = await import('/js/data/fz-river.js'); const B = M.FZR.a4.gate.block; const R = __game.fzMetro.street.kit.root.position, p=__game.player.position, x=p.x-R.x, z=p.z-R.z; const inside = (function(){{ let c=false; for(let i=0,j=B.length-1;i<B.length;j=i++){{ const xi=B[i][0],zi=B[i][1],xj=B[j][0],zj=B[j][1]; if(((zi>z)!=(zj>z))&&(x<(xj-xi)*(z-zi)/(zj-zi)+xi)) c=!c; }} return c; }})(); return {{pos:[+x.toFixed(2),+p.y.toFixed(2),+z.toFixed(2)], inside}}; }})()")
        tries.append(blk); ok(f'i:cannot walk onto 新港闸 (try {a},{b})', (not blk['inside']) and blk['pos'][1] > -0.3, blk)
    R['gateTries'] = tries
    await b3_rail(pg, 'gw', 12, -(hw + 2.5), 'gw')
    await b3_fall(pg, 'gw', 10, 'gw')
    okk, s_, m = await enter_kiosk(pg, D, 'fzgmg'); ok('i:walk back to fzgmg D kiosk and in', okk, [s_['pos'], m])
    await restore_check(pg, 'fzgmg')


async def run_5(pg):
    """5：光明港 D 口 → 瀛洲河口 → 两岸可走，老药洲街 / 瀛洲桥 / 台江路双向都过成圈 → 江四水闸观景处（只看不过）→ 落水回岸。只走路。小美按这个圈验收。"""
    await pg.evaluate('window.__fzNavRes = 0.35')
    ex, si = await station_to_exit(pg, 'fzgmg', "x.attr === 'fzriver'", 'fzgmg')
    ok('fzgmg:5:net e, walk-only (routes B + D unchanged)', si and si.get('net') == 'e' and set((si.get('boats') or {}).keys()) == {'B', 'D'}, si and {'net': si.get('net'), 'boats': list((si.get('boats') or {}).keys())})
    D = await mod(pg); await nav(pg); await asyncio.sleep(1)
    A = await pg.evaluate("""(async () => { const M = await import('/js/data/fz-river.js'); const F = M.FZR, a5 = F.a5, a4 = F.a4, yz = M.RIVERS.yz, hw = F.rivers.yz.hw;
      const bs = (a5.bridges || []).map(id => M.BRIDGES.find(q => q.id === id));
      const at = (s, l) => { const a = yz.at(s, l); return [a.x, a.z]; };
      return { hw, len: yz.line.len, gate: a5.gate, sign: a5.sign, signs: a5.signs, yzMouth: a4.yz, mouthSign: (a4.signs || []).find(s => s.id === 'yzh'),
        bridges: bs.map(b => b && { id: b.id, s: b.s, x: b.x, z: b.z, n: b.n, w: b.w, half: b.half, name: b.name, kind: b.kind }),
        loop: a5.loop }; })()""")
    hw, G, brs = A['hw'], A['gate'], A['bridges']
    R['perf']['j:kiosk:fzgmg'] = await sample4(pg, 'j:kiosk:fzgmg')
    # 先到汇入口（沿光明港南岸往西，步子比 4A 疏）
    for s_ in (400, 120, 40):
        q = await rpt(pg, 'gm', s_, 21 + 2.5)
        okw = await go(pg, *q, f'光明港 D → gm s={s_} 南岸'); ok(f'j:walk gm s={s_}', okw and await near(pg, *q, 2.5), (await st(pg))['pos'])
    ys = A['mouthSign']
    sp = await W(pg, ys['x'] + ys['f'][0] * 5, ys['z'] + ys['f'][1] * 5)
    okw = await go(pg, *sp, '→ 瀛洲河牌'); ok('j:walk to 瀛洲河 mouth sign', okw and await near(pg, *sp, 2.2), (await st(pg))['pos'])
    R['perf']['j:yz_mouth'] = await sample4(pg, 'j:yz_mouth')

    async def bank(s, side, off=None):
        off = hw + 2.8 if off is None else off
        return await rpt(pg, 'yz', s, side * off)

    async def cross(b, from_side, label):
        a = await W(pg, b['x'] + b['n'][0] * from_side * (b['half'] + 3), b['z'] + b['n'][1] * from_side * (b['half'] + 3))
        mid = await W(pg, b['x'], b['z'])
        dest = await W(pg, b['x'] - b['n'][0] * from_side * (b['half'] + 3), b['z'] - b['n'][1] * from_side * (b['half'] + 3))
        okc = await go(pg, *a, f'→ {b["name"]} 桥头') and await legs(pg, [mid, dest], True)
        ok(f'j:cross {b["name"]} {label}', okc and await near(pg, *dest, 2.5) and (await st(pg))['pos'][1] > -0.3, (await st(pg))['pos'])
        return dest

    # n 在汇入口朝西：-n = 东岸，+n = 西岸。沿河 n 会转，但侧号保持，过桥用桥自己的 n。
    EAST, WEST = -1, 1
    # 东岸向南走到老药洲街，西向过桥
    p = await bank(18, EAST)
    okw = await go(pg, *p, '东岸向南'); ok('j:east bank start', okw and await near(pg, *p, 2.5), (await st(pg))['pos'])
    # 三座桥：南向 东→西 / 西→东 / 东→西，到闸后再北向原路对向再过一遍
    # 南向
    p = await bank(max(20, brs[0]['s'] - brs[0]['w'] / 2 - 8), EAST)
    okw = await go(pg, *p, '东岸 → 老药洲街'); ok('j:east to 老药洲街', okw and await near(pg, *p, 2.8), (await st(pg))['pos'])
    await cross(brs[0], EAST, 'south 东→西')
    R['perf']['j:yz1:deck'] = await sample4(pg, 'j:yz1:deck')
    p = await bank(brs[1]['s'] - brs[1]['w'] / 2 - 8, WEST)
    okw = await go(pg, *p, '西岸 → 瀛洲桥'); ok('j:west to 瀛洲桥', okw and await near(pg, *p, 2.8), (await st(pg))['pos'])
    await cross(brs[1], WEST, 'south 西→东')
    R['perf']['j:yz2:deck'] = await sample4(pg, 'j:yz2:deck')
    p = await bank(brs[2]['s'] - brs[2]['w'] / 2 - 8, EAST)
    okw = await go(pg, *p, '东岸 → 台江路'); ok('j:east to 台江路', okw and await near(pg, *p, 2.8), (await st(pg))['pos'])
    await cross(brs[2], EAST, 'south 东→西')
    R['perf']['j:yz3:deck'] = await sample4(pg, 'j:yz3:deck')

    # 江四观景处
    vw = await W(pg, *G['view'])
    okv = await go(pg, *vw, '→ 江四水闸观景处')
    ok('j:walkToJiangsiLookout', okv and await near(pg, *vw, 2.2), (await st(pg))['pos'])
    if OUT:
        await look(pg, *(await W(pg, G['x'], G['z'])), 0.04); await shot(pg, 'j_gate_from_lookout')
        mj = [G['x'] + G['t'][0] * 40, G['z'] + G['t'][1] * 40]
        await look(pg, *(await W(pg, *mj)), 0.06); await shot(pg, 'j_minjiang_from_lookout')
        sg = A['sign']; await look(pg, *(await W(pg, sg['x'], sg['z'])), 0.1); await shot(pg, 'j_sign_jiangsi')
    R['perf']['j:gateLookout'] = await sample4(pg, 'j:gateLookout')
    # 上不去闸
    tries = []
    for (a, b) in [(0.0, 0.0), (0.0, -hw * 0.5), (1.5, hw + 0.4), (-1.0, 0.0)]:
        tgt = await W(pg, G['x'] + G['t'][0] * a + G['n'][0] * b, G['z'] + G['t'][1] * a + G['n'][1] * b)
        await legs(pg, [vw], False); await legs(pg, [tgt], False); await asyncio.sleep(0.5)
        s = await st(pg)
        blk = await pg.evaluate("""(async () => { const M = await import('/js/data/fz-river.js'); const B = M.FZR.a5.gate.block; const R = __game.fzMetro.street.kit.root.position, p=__game.player.position, x=p.x-R.x, z=p.z-R.z; const inside = (function(){ let c=false; for(let i=0,j=B.length-1;i<B.length;j=i++){ const xi=B[i][0],zi=B[i][1],xj=B[j][0],zj=B[j][1]; if(((zi>z)!=(zj>z))&&(x<(xj-xi)*(z-zi)/(zj-zi)+xi)) c=!c; } return c; })(); return {pos:[+x.toFixed(2),+p.y.toFixed(2),+z.toFixed(2)], inside}; })()""")
        tries.append(blk); ok(f'j:cannot walk onto 江四水闸 (try {a},{b})', (not blk['inside']) and blk['pos'][1] > -0.3, blk)
    R['gateTries5'] = tries

    # 北向回圈：西岸过台江、东岸过瀛洲、西岸过老药洲，回到东岸汇入口
    p = await bank(brs[2]['s'] + brs[2]['w'] / 2 + 8, WEST)
    okw = await go(pg, *p, '西岸回 台江路'); ok('j:west back to 台江路', okw and await near(pg, *p, 2.8), (await st(pg))['pos'])
    await cross(brs[2], WEST, 'north 西→东')
    p = await bank(brs[1]['s'] + brs[1]['w'] / 2 + 8, EAST)
    okw = await go(pg, *p, '东岸回 瀛洲桥'); ok('j:east back to 瀛洲桥', okw and await near(pg, *p, 2.8), (await st(pg))['pos'])
    await cross(brs[1], EAST, 'north 东→西')
    p = await bank(brs[0]['s'] + brs[0]['w'] / 2 + 8, WEST)
    okw = await go(pg, *p, '西岸回 老药洲街'); ok('j:west back to 老药洲街', okw and await near(pg, *p, 2.8), (await st(pg))['pos'])
    await cross(brs[0], WEST, 'north 西→东')
    p = await bank(18, EAST)
    okw = await go(pg, *p, '东岸回到汇入口'); ok('j:loop back to mouth east bank', okw and await near(pg, *p, 2.8), (await st(pg))['pos'])
    ok('j:loop complete (three bridges both ways, both banks)', True)

    await b3_rail(pg, 'yz', 40, -(hw + 2.5), 'yz')
    await b3_fall(pg, 'yz', 36, 'yz')
    # 走回 D 口（可选：回到汇入口牌再沿光明港回去）
    okw = await go(pg, *sp, '回瀛洲河牌')
    p0 = await rpt(pg, 'gm', 40, 21 + 2.5)
    okw = okw and await go(pg, *p0, '回光明港南岸')
    okk, s_, m = await enter_kiosk(pg, D, 'fzgmg'); ok('j:walk back to fzgmg D kiosk and in', okk, [s_['pos'], m])
    await restore_check(pg, 'fzgmg')

async def hud_shore_red(pg, label):
    """小美 2C ④：岸上左上角「河」牌永远红（a 网 A 线色 #B3261E），不管出口亭那边停的是哪条线的船"""
    await asyncio.sleep(1.0)
    col = await pg.evaluate("getComputedStyle(document.getElementById('where')).getPropertyValue('--line').trim()")
    nm = await plate(pg); ln = await pg.evaluate("document.getElementById('whereLine').textContent")
    return ok(f'hud:shoreRed:{label}', col.upper() == '#B3261E' and nm == '福州内河' and ln.startswith('河'), [col, nm, ln])
async def hud_boat(pg, label, rid, color):
    col = await pg.evaluate("getComputedStyle(document.getElementById('where')).getPropertyValue('--line').trim()")
    nm = await plate(pg); return ok(f'hud:onBoat:{label}', col.upper() == color and nm.startswith(rid + '线'), [col, nm])
async def cleg2(pg, D, BS):
    """C线 回程：西水关（A 线浮码头 → 栈道 → C 泊位）→ 上海西码头；终点播报 + 换乘句；下船上岸"""
    await pg.evaluate('window.__caps.length = 0')
    if await board_xsgc(pg, D, 'cleg2'):
        await ride(pg, D, 'cleg2', 'shw', bshots=BS if OUT else None)
        await wait(pg, "window.__caps.some(c => c[0] === 'voice.fz.boat.xfer.shw.en')", 1e6, 120)
        caps = await pg.evaluate('window.__caps.slice(-12)')
        xf = [c for c in caps if c[0] == 'voice.fz.boat.xfer.shw.zh']
        ok('cleg2:announce arrive 上海西码头 终点 + 换乘地铁宁化站，请从 A 口出站', any(c[0] == 'voice.fz.boat.arrive.shw.end.zh' for c in caps) and xf and xf[0][1] == '换乘地铁宁化站，请从 A 口出站。' and any(c[0] == 'voice.fz.boat.xfer.shw.en' for c in caps), caps)
        R['capsCleg2'] = caps
        await alight(pg, D, 'shw', 'cleg2')
        if OUT:
            P = [p for p in D['piers'] if p['id'] == 'shw'][0]; K = D['kiosks']['fznh']
            await look(pg, *(await W(pg, K['x'], K['z'])), 0.0); await shot(pg, 'shw_after_alight_toward_ninghua_A')
        # 下船后走回宁化 A 口（换乘句说的那条路：不过桥）
        K = D['kiosks']['fznh']; tgt = await W(pg, K['x'], K['z'] + 3); okw = await go(pg, *tgt, '上海西码头 → 宁化 A 口')
        ok('cleg2:walkBackToNinghuaA', okw and await near(pg, *tgt, 1.5), (await st(pg))['pos']); await hud_shore_red(pg, 'cleg2:fznh')
async def c_boat_summary(pg, D):
    per = {}
    for l in R['legs']:
        for k_, v in (l['clr'].get('per') or {}).items(): per[k_] = min(per.get(k_, 99), v)
    # 单程时间 = 船自己的时钟（每帧 dt，上限 0.25 s）在 'go' 阶段的累计（离岸 → 靠稳）；无头 1–2 fps 下墙钟时间没意义，另记 wall
    R['clearanceC'] = per; R['legSecs'] = {l['leg']: {'boat': l['goSecs'], 'wall': l['secs']} for l in R['legs']}
    R['accel'] = await pg.evaluate('window.__acc')
    ok('cboat:smoothAccel', R['accel']['n'] > 100 and R['accel']['aMax'] <= 0.505 and R['accel']['dMax'] <= 1.005, R['accel'])
    ok('cboat:maxStep<=v*dt', R['accel']['stepOver'] <= 0.05, R['accel'])
    ok('cboat:clearanceAllBridgesOnC', per and all(v >= D['clr'] - 0.02 for v in per.values()) and set(D['clrRepC']).issubset(set(per)), {'per': per, 'want': list(D['clrRepC'])})
    ok('cboat:oneWay<=8min (boat clock, depart → docked)', R['legSecs'] and all(0 < (v['boat'] or 0) <= 480 for v in R['legSecs'].values()), R['legSecs'])
async def run_2c_from_xsg(pg):
    """c_boat2 单独跑（一次 3600 s 内跑不完两程）：西门 C 口出来 → 西水关（C 船停在 C 泊位）→ 回程到上海西码头"""
    await pg.evaluate('window.__fzNavRes = 0.35')
    ex, si = await station_to_exit(pg, 'fzxm', "x.attr === 'fzriver'", 'fzxm')
    ok('fzxm:C:boats A + C, C at its own 西水关 berth', si and set((si.get('boats') or {}).keys()) == {'A', 'C'} and si['boats']['C']['at'] == 'xsgc', si and {k: v.get('at') for k, v in (si.get('boats') or {}).items()})
    await pg.evaluate(CLEAR); await pg.evaluate(ACCW); await pg.evaluate(CAPS); D = await mod(pg); await nav(pg); await asyncio.sleep(1)
    X = [p for p in D['piers'] if p['id'] == 'xsg'][0]; Cp = [p for p in D['piers'] if p['id'] == 'xsgc'][0]
    land = await landpt(pg, X); okw = await go(pg, *land, '西门 C → 西水关码头'); ok('fzxm:C:walkToXsg', okw); await hud_shore_red(pg, 'fzxm:xsg')
    if OUT:
        await look(pg, *(await W(pg, *X['sign'])), 0.0); await shot(pg, 'pier_sign_xsg_A_C_from_ximen')
        await look(pg, *(await W(pg, (X['berth'][0] + Cp['berth'][0]) / 2, (X['berth'][1] + Cp['berth'][1]) / 2)), -0.25); await shot(pg, 'xsg_shared_pier_A_and_C_berths')
    R['perf']['xsgShared'] = await sample(pg, 'xsgShared')
    await cleg2(pg, D, {'bm12': 'douchi', 'bm13': 'jiaotongxi'})
    await c_boat_summary(pg, D)
async def run_2c(pg):
    C1 = bool(STAGES & {'c_boat', 'c_boat1'}); C2 = bool(STAGES & {'c_boat', 'c_boat2'}); CU = 'c_under' in STAGES
    if C2 and not C1 and not CU: return await run_2c_from_xsg(pg)
    await pg.evaluate('window.__fzNavRes = 0.35')
    ex, si = await station_to_exit(pg, 'fznh', "x.attr === 'fzriver'", 'fznh')
    ok('fznh:A:net a, boats A + C', si and si.get('net') == 'a' and set((si.get('boats') or {}).keys()) == {'A', 'C'} and si['boats']['C']['at'] == 'shw' and si['boats']['A']['at'] == 'xsg', si and {'net': si.get('net'), 'boats': {k: v.get('at') for k, v in (si.get('boats') or {}).items()}})
    await pg.evaluate(CLEAR); await pg.evaluate(ACCW); await pg.evaluate(CAPS); D = await mod(pg); await nav(pg); await asyncio.sleep(1)
    R['perf']['kiosk:fznh'] = await sample(pg, 'kiosk:fznh')
    await asyncio.sleep(0.6); ok('plate:shore:fznh', await plate(pg) == '福州内河', await plate(pg)); await hud_shore_red(pg, 'fznh:kiosk')
    K = D['kiosks']['fznh']; P = [p for p in D['piers'] if p['id'] == 'shw'][0]; c2 = D['c2']
    if OUT: await look(pg, *(await W(pg, *P['sign'])), 0.02); await shot(pg, 'nh_walk_from_kiosk_A')
    # ⑤ 宁化 A → 上海西码头：不过桥（全程西岸），步道 ≤ 125 m
    land = await landpt(pg, P); await jreset(pg); okw = await go(pg, *land, '宁化 A → 上海西码头'); j = await jget(pg)
    wl = R['walk'][-1][1] if R['walk'] else None
    pts = (await pg.evaluate(f'__fzNav.path(...{json.dumps(await W(pg, K["x"], K["z"] + 3))}, ...{json.dumps(land)})')).get('pts') or []
    lats = [await latw(pg, x - (await W(pg, 0, 0))[0], z - (await W(pg, 0, 0))[1]) for x, z in pts]
    ok('fznh:A:walkToShwPier (no bridge, west bank all the way)', okw and j['max'] < TELEPORT and wl is not None and wl <= 125 and lats and min(lats) > 0, {'walk': wl, 'nhWalk': c2['nhWalk'], 'jump': j['max'], 'latMin': min(lats) if lats else None})
    if OUT:
        await look(pg, *(await W(pg, *P['sign'])), 0.0); await shot(pg, 'pier_sign_shw')
        await look(pg, *(await W(pg, K['x'], K['z'])), 0.0); await shot(pg, 'nh_walk_kiosk_from_pier')
    ok('sign:shw: C线 / next 西水关码头', await pg.evaluate("(async () => { const M = await import('/js/data/fz-river.js'); return M.routesOfPier('shw').join() === 'C' && M.pierNext('shw').map(p => p.zh).join() === '西水关码头'; })()"))
    R['perf']['shwPier'] = await sample(pg, 'shwPier')
    BS = {'bm12': 'douchi', 'bm13': 'jiaotongxi'}
    if C1:
        if await board(pg, D, 'shw', 'cleg1'):
            if OUT:   # 上海西码头往下游看：工业路桥（桥下步道）
                await pg.evaluate("if (__game.player.view!=='first') __game.toggleView()"); await look_s(pg, P['s'] + 40, 0, 0.0); await shot(pg, 'boat_at_shw_looking_gongye_bm14'); await pg.evaluate("__game.toggleView()")
            await ride(pg, D, 'cleg1', 'xsgc', bshots=BS if OUT else None)
            for _ in range(16):   # 到站广播在靠稳那一帧之后才出：低帧率（2–3 fps）下多等几秒
                caps = await pg.evaluate('window.__caps.slice(-12)')
                if any(c[0] == 'voice.fz.boat.arrive.xsgc.end.zh' for c in caps): break
                await asyncio.sleep(0.5)
            ok('cleg1:announce depart C线 开往西水关 + arrive 西水关 终点', any(c[0] == 'voice.fz.boat.c.depart.xsgc.zh' for c in caps) and any(c[0] == 'voice.fz.boat.arrive.xsgc.end.zh' for c in caps), caps)
            hud = await pg.evaluate("(() => { const h = __game.fzMetro.street.riverHud(__game.player); return h; })()")
            col = await pg.evaluate("getComputedStyle(document.getElementById('where')).getPropertyValue('--line').trim()")
            ok('cleg1:hud C线 green', hud and hud.get('line') == 'C' and col.upper() == '#2F7D4A', [hud, col])
            if OUT:   # 共用码头：A 线船（西水关泊位）+ C 线船（栈道尽头泊位）
                await pg.evaluate("if (__game.player.view!=='third') __game.toggleView()")
            await alight_xsgc(pg, D, 'cleg1')
            X = [p for p in D['piers'] if p['id'] == 'xsg'][0]
            if OUT:
                await look(pg, *(await W(pg, *X['sign'])), 0.0); await shot(pg, 'pier_sign_xsg_A_C')
                Cp = [p for p in D['piers'] if p['id'] == 'xsgc'][0]
                await look(pg, *(await W(pg, (X['berth'][0] + Cp['berth'][0]) / 2, (X['berth'][1] + Cp['berth'][1]) / 2)), -0.25); await shot(pg, 'xsg_shared_pier_A_and_C_berths')
            bA, bC = await pg.evaluate('__game.fzMetro.street.boats.A.info()'), await cboat(pg)
            ok('xsg:shared pier: A boat at A berth, C boat at its own berth', bA['at'] == 'xsg' and bC['at'] == 'xsgc' and math.hypot(bA['x'] - bC['x'], bA['z'] - bC['z']) > 12, [bA['at'], bC['at'], bA['x'], bA['z'], bC['x'], bC['z']])
            ok('sign:xsg: two rows A线 (西湖 / 黎明湖) + C线 (上海西)', await pg.evaluate("(async () => { const M = await import('/js/data/fz-river.js'); return M.pierNext('xsg', 'A').map(p => p.id).join() === 'xihu,lmh' && M.pierNext('xsgc', 'C').map(p => p.id).join() === 'shw' && M.PIERS.filter(q => q.shared === 'xsg').length === 1; })()"))
            R['perf']['xsgShared'] = await sample(pg, 'xsgShared')
    if C2:
        await cleg2(pg, D, BS)
    if C1 or C2:
        await c_boat_summary(pg, D)
    if 'c_under' in STAGES:
        await under_walk(pg, D, 'ubm14', 'gongye')
        R['perf']['under:ubm14'] = await sample(pg, 'under:ubm14')
        # 沿西岸往下游：沿途从岸上看每座新桥（单拱平桥 / 无名路桥 / 同德路 / 彬德桥），再到江滨西大道桥下步道
        for bid, nm in (('bm15', 'single_arch_flat'), ('bm16', 'nameless_road'), ('bm17', 'tongde'), ('bm18', 'bingde')):
            br = [x for x in D['bridges'] if x['id'] == bid][0]
            if bid == 'bm18':   # 小美 2C ③：彬德桥上游西岸栏杆边（这一段不种榕树）斜对着桥正面看
                pf_ = await bmpt(pg, br['s'] - 20.5, 11.0); okf = await go(pg, *pf_, 'west bank → 彬德桥 upstream front'); ok('c_under:walkTo:bm18:upstreamFront', okf, (await st(pg))['pos'])
                if OUT: await look(pg, *(await W(pg, br['x'], br['z'])), 0.0); await shot(pg, 'bingde_bridge_front_from_upstream_bank')
            pt = await bmpt(pg, br['s'] - br['w'] / 2 - 9, 10.0 + 4.6)   # 桥头前 9 m（22 m 太远：广角下桥只剩地平线上一道）
            okg = await go(pg, *pt, 'west bank → ' + bid); ok(f'c_under:walkTo:{bid}', okg, (await st(pg))['pos'])
            if OUT: await look_s(pg, br['s'], 0, -0.06); await shot(pg, f'bridge_{bid}_{nm}_from_bank')
        R['perf']['bridge:bm18'] = await sample(pg, 'bridge:bm18')
        await under_walk(pg, D, 'ubm19', 'jiangbinxi')
        R['perf']['under:ubm19'] = await sample(pg, 'under:ubm19')
        S_ = c2['sluice']; vw = await W(pg, *S_['view']); await jreset(pg)
        okv = await go(pg, *vw, '江滨西大道下穿 → 彬德水闸观景处'); j = await jget(pg)
        ok('c_under:sluiceViewpoint reached on foot (≤ 0.5 m)', okv and await near(pg, *vw, 0.5) and j['max'] < TELEPORT, (await st(pg))['pos']); await hud_shore_red(pg, 'sluiceView')
        if OUT:
            await look(pg, *(await W(pg, S_['x'] - S_['n'][0] * 4 + S_['t'][0] * 0.4, S_['z'] - S_['n'][1] * 4 + S_['t'][1] * 0.4)), 0.0); await shot(pg, 'bingde_sluice_from_viewpoint')   # 看中孔偏东：三扇闸门 + 启闭房正面
            await look(pg, *(await W(pg, S_['x'] + S_['t'][0] * 120, S_['z'] + S_['t'][1] * 120)), 0.02); await shot(pg, 'minjiang_view_from_viewpoint')
            await look_s(pg, S_['s'] - 30, 0, -0.05); await shot(pg, 'river_end_sluice_upstream_view')
            b18 = [x for x in D['bridges'] if x['id'] == 'bm18'][0]; await look_s(pg, b18['s'], 0, 0.0); await shot(pg, 'bingde_bridge_front_from_viewpoint')   # 小美 2C ③
        R['perf']['sluiceView'] = await sample(pg, 'sluiceView')

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


# ======================= 2D =======================
D2INFO = """(async () => { const M = await import('/js/data/fz-river.js'); const F = M.FZR, L = M.RIVERS.at.line, D = F.d2;
  const n = L.at(D.atALen + 20, 9).z > L.at(D.atALen + 20, -9).z ? 1 : -1;   // 北岸（z 大）那一侧的横向符号
  const P = (s, lat) => { const a = L.at(s, lat); return [a.x, a.z]; };
  const north = []; for (let s = D.atALen + 6; s < L.len - 4; s += 40) north.push(P(s, n * 9));
  return { d2: D, gate: F.sfqx, len: L.len, n, north, south: [P(L.len - 6, -n * 9), P(D.atALen + 30, -n * 9)], mEnd: P(L.len - 3, n * 9), mEndS: P(L.len - 3, -n * 9),
    jm: M.BRIDGES.find(b => b.id === D.jm), mouthView: P(L.len - 16, 0), kiosk: M.KIOSKS.fzdjk,
    zzfView: P(D.zzf.s, -n * 9), zzfNear: P(D.zzf.s + 4, L.project(...D.zzf.sign).lat), zzfFronts: P(D.zzf.s + 60, -n * 9), zzfFrontsT: P(D.zzf.s + 60, n * 14) }; })()"""
async def plain(pg, pts, label):
    """直线真走（不用 A*）：每段走到才算；返回 (走到, 最大单帧位移)"""
    await jreset(pg); r = await legs(pg, pts, True, 8.0); j = await jget(pg); s = await st(pg)
    good = r and math.hypot(s['pos'][0] - pts[-1][0], s['pos'][2] - pts[-1][1]) < 1.2
    R['walk'].append([label, good, round(j['max'], 2)]); return good, j['max'], s
async def run_2d(pg):
    await pg.evaluate('window.__fzNavRes = 0.35')
    ex, si = await station_to_exit(pg, 'fzdjk', "x.attr === 'fzriver'", 'fzdjk')
    ok('fzdjk:C:net a (river world)', si and si.get('net') == 'a', si and si.get('net'))
    D = await mod(pg); I = await pg.evaluate(D2INFO); await nav(pg); await asyncio.sleep(1)
    N, G = I['d2']['nhj'], I['gate']; K = I['kiosk']
    WP = lambda x, z: W(pg, x, z)
    lk = lambda t: [G['x'] + G['dir'][0] * t, G['z'] + G['dir'][1] * t]
    await hud_shore_red(pg, 'fzdjk:kiosk')
    R['perf']['d2:kiosk'] = await sample(pg, 'd2:kiosk')
    if OUT:
        await look(pg, *(await WP(N['X0'], N['Z0'] - 40)), 0.02); await shot(pg, 'd2_kiosk_out_toward_nanhoujie')
        await look(pg, *(await WP(N['X0'] + 9.5, N['Z0'] + 6.6)), 0.12); await shot(pg, 'd2_junction_street_name_signs')
    if 'd_walk' in STAGES:
        # 东街口 C → 杨桥东路口 → 南后街（北口 → 南口）→ 石板步道 → 三坊七巷南口牌坊 → 牌坊外（安泰河边）；再原路走回出口亭进站、出站
        pz = await WP(N['X0'] - 6, N['Z0'] - 8); await jreset(pg); okp = await go(pg, *pz, '出口亭 → 杨桥东路口（南后街北口）'); jp = (await jget(pg))['max']
        ok('d_walk:kiosk → 南后街北口 plaza (A*)', okp and await near(pg, *pz, 1.2) and jp < TELEPORT, [okp, (await st(pg))['pos'], pz, jp])
        there = [[N['X0'], N['Z0'] - 16]] + [[N['X0'], N['Z0'] - z] for z in (40, 80, 120, 160, 188)] + [lk(31), lk(20), lk(10), lk(2.5)]
        there = [await WP(*p) for p in there]
        g1, j1, s1 = await plain(pg, there, '东街口 C → 南后街 → 牌坊')
        ok('d_walk:kiosk → 南后街 → 三坊七巷南口牌坊 (straight walk, no jump)', g1 and j1 < TELEPORT, [s1['pos'], j1])
        await hud_shore_red(pg, 'd_walk:gate')
        through = [await WP(*lk(-6))]   # 穿过牌坊到河边
        g2, j2, s2 = await plain(pg, through, '穿过牌坊 → 安泰河')
        ok('d_walk:through the 牌坊 to the river side', g2 and j2 < TELEPORT, [s2['pos'], j2])
        R['perf']['d2:gate'] = await sample(pg, 'd2:gate')
        await look(pg, *(await WP(*lk(10))), 0.1); R['perf']['d2:gate_view'] = await sample(pg, 'd2:gate_view')
        if OUT: await shot(pg, 'd2_gate_front_from_river')
        for k_, a_ in (('east', 0.0), ('west', math.pi)):   # 牌坊外河边：顺河往东（东段）/ 往西各测一次
            await pg.evaluate(f"__game.player.yaw = Math.atan2({I['north'][1][0] - I['north'][0][0]}, {I['north'][1][1] - I['north'][0][1]}) + {a_}; __game.player.pitch = 0.05"); await asyncio.sleep(0.8)
            R['perf']['d2:gate_' + k_] = await sample(pg, 'd2:gate_' + k_)
        await plain(pg, [await WP(*lk(16))], '牌坊 → 步道中段'); await look(pg, *(await WP(N['X0'], N['Z0'] - 120)), 0.03); R['perf']['d2:link'] = await sample(pg, 'd2:link')
        if OUT: await shot(pg, 'd2_link_walk_toward_nanhoujie')
        back = [await WP(*lk(2.5))] + list(reversed(there[:-1])) + [pz]
        g3, j3, s3 = await plain(pg, back, '牌坊 → 南后街 → 东街口 C')
        ok('d_walk:back 牌坊 → 南后街 → kiosk (round trip)', g3 and j3 < TELEPORT, [s3['pos'], j3])
        if OUT:
            await look(pg, *(await WP(N['X0'] + 9.5, N['Z0'] + 6.6)), 0.12); await shot(pg, 'd2_back_at_junction_signs')
        await jreset(pg)
        D = await out_and_back(pg, D, 'fzdjk', 'C', 'a'); await hud_shore_red(pg, 'd_walk:backOut')
        # 再走一次南后街中段测性能 + 拍
        await go(pg, *pz, '出口亭 → 南后街北口 (2)'); await plain(pg, [await WP(N['X0'], N['Z0'] - 16), await WP(N['X0'], N['Z0'] - 100)], '南后街北口 → 南后街中段')
        R['perf']['d2:street_mid'] = await sample(pg, 'd2:street_mid')
        if OUT:
            await look(pg, *(await WP(N['X0'], N['Z0'] - 180)), 0.03); await shot(pg, 'd2_nanhoujie_mid_toward_gate')
            await look(pg, *(await WP(N['X0'], N['Z0'])), 0.03); await shot(pg, 'd2_nanhoujie_mid_toward_kiosk')
    if 'd_east' in STAGES:
        # 牌坊 → 安泰河东段北岸（朱紫坊）→ 津门桥来回 → 琼东河口（矮墙 + 远景水面）
        okg = await go(pg, *(await WP(*lk(-6))), '→ 三坊七巷南口牌坊外')
        ok('d_east:reach gate river side', okg)
        Z = I['d2']['zzf']; sg = Z['sign']
        zo = await WP(*I['zzfView']); okv = await go(pg, *zo, '→ 朱紫坊对岸（看石牌正面）'); ok('d_east:walk to the south bank across from 朱紫坊', okv and await near(pg, *zo, 1.5))
        if OUT:
            await pg.evaluate("if (__game.player.view !== 'first') __game.toggleView()")
            await look(pg, *(await WP(*sg)), 0.02); await shot(pg, 'd2_zhuzifang_stone_sign_front')
            await go(pg, *(await WP(*I['zzfFronts'])), '→ 朱紫坊沿河立面对岸'); await look(pg, *(await WP(*I['zzfFrontsT'])), 0.06); await shot(pg, 'd2_zhuzifang_north_bank_fronts_closed_doors')
            await pg.evaluate("if (__game.player.view !== 'third') __game.toggleView()")
        R['perf']['d2:zzf'] = await sample(pg, 'd2:zzf'); await sample4(pg, 'd2:zzf_4yaw')
        zv = await WP(*I['zzfNear']); okz = await go(pg, *zv, '→ 朱紫坊石牌旁（北岸）'); ok('d_east:walk to 朱紫坊 sign (north bank)', okz and await near(pg, *zv, 1.5))
        if OUT: await look(pg, *(await WP(*sg)), 0.1); await shot(pg, 'd2_zhuzifang_sign_from_north_bank')
        jm = I['jm']
        if OUT:
            await pg.evaluate("if (__game.player.view !== 'first') __game.toggleView()")
            for tag, sv in (('w', -1), ('e', 1)):
                # 视线上不能有树干（树离视线 < 2.2 m 就换个距离）
                vp = await pg.evaluate(f"""(async () => {{ const M = await import('/js/data/fz-river.js'); const L = M.RIVERS.at.line, bx = {jm['x']}, bz = {jm['z']};
                  const segD = (px, pz, ax, az, cx, cz) => {{ const dx = cx - ax, dz = cz - az, t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz))); return Math.hypot(px - ax - t * dx, pz - az - t * dz); }};
                  for (const d of [18, 22, 26, 30, 34, 16, 38]) for (const lat of [7.6, 8.4]) {{ const a = L.at({jm['s']} + {sv} * d, {I['n']} * lat);
                    if (!M.FZR.trees.some(t => segD(t[0], t[1], a.x, a.z, bx, bz) < 2.2) && M.isLand(a.x, a.z)) return [a.x, a.z]; }}
                  const a = L.at({jm['s']} + {sv} * 24, {I['n']} * 7.6); return [a.x, a.z]; }})()""")
                if await go(pg, *(await WP(*vp)), f'→ 津门桥 front {tag}'):
                    await look(pg, *(await WP(jm['x'], jm['z'])), -0.02); await shot(pg, f'd2_jinmen_bridge_front_{tag}')
            await pg.evaluate("if (__game.player.view !== 'third') __game.toggleView()")
        await bridges_stage(pg, D, [jm['id']], perf_at=(jm['id'],), shots={jm['id']: 'd2_jinmen_bridge_on_deck'})
        await sample4(pg, 'd2:jinmen_4yaw')
        await hud_shore_red(pg, 'd_east:jinmen')
        e1 = await WP(*I['mEnd']); oke = await go(pg, *e1, '→ 琼东河口（北岸尽头）')
        ok('d_east:walk to the 琼东河 mouth (north bank end)', oke and await near(pg, *e1, 1.5))
        R['perf']['d2:mouth'] = await sample(pg, 'd2:mouth')
        if OUT:
            await look(pg, *(await WP(I['d2']['mouth']['x'] + I['d2']['mouth']['t'][0] * 30, I['d2']['mouth']['z'] + I['d2']['mouth']['t'][1] * 30)), 0.0); await shot(pg, 'd2_mouth_low_wall_far_water')
        # 回程：北岸走回朱紫坊（东段沿岸双向都通）
        okb = await go(pg, *zv, '琼东河口 → 朱紫坊'); ok('d_east:walk back mouth → 朱紫坊', okb and await near(pg, *zv, 1.2))
        await hud_shore_red(pg, 'd_east:back')


async def run_6a(pg):
    """6A：斗门 C 口 → 晋安河东岸到湖前东口 → 两岸可走，北二环 / 北浪路双向都过成圈 → 茶园水闸观景处（只看不过）→ 落水回岸。只走路。"""
    await pg.evaluate('window.__fzNavRes = 0.45')
    ex, si = await station_to_exit(pg, 'fzdm', "x.attr === 'fzriver'", 'fzdm')
    ok('fzdm:6A:net e, walk-only (routes B + D unchanged)', si and si.get('net') == 'e' and set((si.get('boats') or {}).keys()) == {'B', 'D'}, si and {'net': si.get('net'), 'boats': list((si.get('boats') or {}).keys())})
    D = await mod(pg); await nav(pg); await asyncio.sleep(1)
    A = await pg.evaluate("""(async () => { const M = await import('/js/data/fz-river.js'); const F = M.FZR, a6 = F.a6, hq = M.RIVERS.hq, hw = F.rivers.hq.hw, jn = M.RIVERS.jn;
      const bs = (a6.bridges || []).map(id => M.BRIDGES.find(q => q.id === id));
      return { hw, len: hq.line.len, jnS: a6.jnS, jnHw: F.rivers.jn.hw, gate: a6.gate, sign: a6.sign, signs: a6.signs, cam: a6.camMouth, under: a6.under,
        bridges: bs.map(b => b && { id: b.id, s: b.s, x: b.x, z: b.z, n: b.n, t: b.t, w: b.w, half: b.half, name: b.name, kind: b.kind, tall: b.tall, deckY: b.deckY, rampL: b.rampL }),
        loop: a6.loop }; })()""")
    hw, G, brs = A['hw'], A['gate'], A['bridges']
    R['perf']['k:kiosk:fzdm'] = await sample4(pg, 'k:kiosk:fzdm')
    # 斗门 C → 晋安河北上到湖前东口（jn s 递减）
    p0 = await rpt(pg, 'jn', A['jnS'] + 80, A['jnHw'] + 2.5)
    okw = await go(pg, *p0, '斗门 C → 晋安河东口南'); ok('k:walk fzdm C toward 湖前', okw and await near(pg, *p0, 2.5), (await st(pg))['pos'])
    cam = A['cam']
    sp = await W(pg, cam['x'], cam['z'])
    okw = await go(pg, *sp, '→ 晋安河东岸东口机位'); ok('k:walk to east-mouth camera', okw and await near(pg, *sp, 2.5), (await st(pg))['pos'])
    if OUT:
        await look(pg, *(await W(pg, *cam['look'][::2] if False else [cam['look'][0], cam['look'][2]])), 0.06); await shot(pg, 'k_mouth_east')
    R['perf']['k:mouth'] = await sample4(pg, 'k:mouth')

    SOUTH, NORTH = -1, 1   # hq.n 朝北：-n 南岸，+n 北岸
    async def bank(s, side, off=None):
        off = hw + 2.8 if off is None else off
        return await rpt(pg, 'hq', s, side * off)

    async def cross(b, from_side, label):
        off = b['half'] + 3 + ((b.get('rampL') or 0) if (b.get('tall') or b.get('deckY')) else 0)
        def xz(tu, nv):
            return (b['x'] + b['t'][0] * tu + b['n'][0] * nv, b['z'] + b['t'][1] * tu + b['n'][1] * nv)
        mid = await W(pg, b['x'], b['z'])
        dest = await W(pg, *xz(0, -from_side * off))
        if (b.get('tall') or 0) and (b.get('rampL') or 0):
            # 抬高匝道：先绕到坡底再沿中线上桥。colFlyRamp 让 A* 把斜板当障碍，不会从桥底下穿。
            pos, origin = (await st(pg))['pos'], await W(pg, b['x'], b['z'])
            cur_t = (pos[0] - origin[0]) * b['t'][0] + (pos[2] - origin[1]) * b['t'][1]
            travel = 1 if 'west' in label else -1
            side_in = math.copysign(b['w'] / 2 + 3.0, cur_t if abs(cur_t) > 1 else -travel)
            around = await W(pg, *xz(side_in, from_side * off))
            start = await W(pg, *xz(0, from_side * off))
            okc = (await go(pg, *around, f'→ {b["name"]} 绕行')
                   and await go(pg, *start, f'→ {b["name"]} 桥头')
                   and await legs(pg, [mid, dest], True))
            arrived = okc and await near(pg, *dest, 2.5) and (await st(pg))['pos'][1] > -0.3
            if arrived:
                await go(pg, *await W(pg, *xz(travel * (b['w'] / 2 + 3.0), -from_side * off)), f'→ {b["name"]} 绕出')
        else:
            a = await W(pg, *xz(0, from_side * off))
            okc = await go(pg, *a, f'→ {b["name"]} 桥头') and await legs(pg, [mid, dest], True)
            arrived = okc and await near(pg, *dest, 2.5) and (await st(pg))['pos'][1] > -0.3
        ok(f'k:cross {b["name"]} {label}', arrived, (await st(pg))['pos'])
        return dest

    p = await bank(28, SOUTH)
    okw = await go(pg, *p, '南岸向西'); ok('k:south bank start', okw and await near(pg, *p, 2.5), (await st(pg))['pos'])
    p = await bank(max(30, brs[0]['s'] - brs[0]['w'] / 2 - 8), SOUTH)
    okw = await go(pg, *p, '南岸 → 北二环'); ok('k:south to 北二环', okw and await near(pg, *p, 2.8), (await st(pg))['pos'])
    await cross(brs[0], SOUTH, 'west 南→北')
    R['perf']['k:hq1:deck'] = await sample4(pg, 'k:hq1:deck')
    if OUT:
        await look(pg, *(await W(pg, brs[0]['x'], brs[0]['z'])), 0.06); await shot(pg, 'k_beierhuan_from_bank')
    p = await bank(brs[1]['s'] - brs[1]['w'] / 2 - 8, NORTH)
    okw = await go(pg, *p, '北岸 → 北浪路'); ok('k:north to 北浪路', okw and await near(pg, *p, 2.8), (await st(pg))['pos'])
    await cross(brs[1], NORTH, 'west 北→南')
    R['perf']['k:hq2:deck'] = await sample4(pg, 'k:hq2:deck')
    if OUT:
        await look(pg, *(await W(pg, brs[1]['x'], brs[1]['z'])), 0.06); await shot(pg, 'k_beilang_from_bank')

    # 茶园水闸观景处（回到东口附近）—— 先走回南岸东口再去观景，或从西头南岸一路向东到闸
    vw = await W(pg, *G['view'])
    okv = await go(pg, *vw, '→ 茶园水闸观景处')
    ok('k:walkToChayuanLookout', okv and await near(pg, *vw, 2.4), (await st(pg))['pos'])
    if OUT:
        await look(pg, *(await W(pg, G['x'], G['z'])), 0.04); await shot(pg, 'k_chayuan_from_lookout')
        sg = A['sign']; await look(pg, *(await W(pg, sg['x'], sg['z'])), 0.1); await shot(pg, 'k_sign_chayuan')
    R['perf']['k:gateLookout'] = await sample4(pg, 'k:gateLookout')
    tries = []
    for (a, b) in [(0.0, 0.0), (0.0, -hw * 0.5), (1.5, hw + 0.4), (-1.0, 0.0)]:
        tgt = await W(pg, G['x'] + G['t'][0] * a + G['n'][0] * b, G['z'] + G['t'][1] * a + G['n'][1] * b)
        await legs(pg, [vw], False); await legs(pg, [tgt], False); await asyncio.sleep(0.5)
        s = await st(pg)
        blk = await pg.evaluate("""(async () => { const M = await import('/js/data/fz-river.js'); const B = M.FZR.a6.gate.block; const R = __game.fzMetro.street.kit.root.position, p=__game.player.position, x=p.x-R.x, z=p.z-R.z; const inside = (function(){ let c=false; for(let i=0,j=B.length-1;i<B.length;j=i++){ const xi=B[i][0],zi=B[i][1],xj=B[j][0],zj=B[j][1]; if(((zi>z)!=(zj>z))&&(x<(xj-xi)*(z-zi)/(zj-zi)+xi)) c=!c; } return c; })(); return {pos:[+x.toFixed(2),+p.y.toFixed(2),+z.toFixed(2)], inside}; })()""")
        tries.append(blk); ok(f'k:cannot walk onto 茶园水闸 (try {a},{b})', (not blk['inside']) and blk['pos'][1] > -0.3, blk)
    R['gateTries6'] = tries

    # 东向回圈：南岸过北浪路、北岸过北二环，回到南岸东口
    p = await bank(brs[1]['s'] + brs[1]['w'] / 2 + 8, SOUTH)
    okw = await go(pg, *p, '南岸回 北浪路'); ok('k:south back to 北浪路', okw and await near(pg, *p, 2.8), (await st(pg))['pos'])
    await cross(brs[1], SOUTH, 'east 南→北')
    p = await bank(brs[0]['s'] + brs[0]['w'] / 2 + 8, NORTH)
    okw = await go(pg, *p, '北岸回 北二环'); ok('k:north back to 北二环', okw and await near(pg, *p, 2.8), (await st(pg))['pos'])
    await cross(brs[0], NORTH, 'east 北→南')
    p = await bank(28, SOUTH)
    okw = await go(pg, *p, '南岸回到东口'); ok('k:loop back to mouth south bank', okw and await near(pg, *p, 2.8), (await st(pg))['pos'])
    ok('k:loop complete (both bridges both ways, both banks)', True)

    await b3_rail(pg, 'hq', 80, -(hw + 2.5), 'hq')
    await b3_fall(pg, 'hq', 90, 'hq')
    okw = await go(pg, *sp, '回东口机位')
    p0 = await rpt(pg, 'jn', A['jnS'] + 80, A['jnHw'] + 2.5)
    okw = okw and await go(pg, *p0, '回晋安河南段')
    okk, s_, m = await enter_kiosk(pg, D, 'fzdm'); ok('k:walk back to fzdm C kiosk and in', okk, [s_['pos'], m])
    await restore_check(pg, 'fzdm')



async def run_6b(pg):
    """6B：斗门 C → 经 6A 到北浪路 → 西段两岸都走，福飞 / 江厝 / 湖景 / 大井都来回过成圈；上不去铁路和福飞中央车道，走不进西头以外；落水回岸。只走路。"""
    await pg.evaluate('window.__fzNavRes = 0.45')
    ex, si = await station_to_exit(pg, 'fzdm', "x.attr === 'fzriver'", 'fzdm')
    ok('fzdm:6B:net e, walk-only (routes B + D unchanged)', si and si.get('net') == 'e' and set((si.get('boats') or {}).keys()) == {'B', 'D'}, si and {'net': si.get('net'), 'boats': list((si.get('boats') or {}).keys())})
    D = await mod(pg); await nav(pg); await asyncio.sleep(1)
    A = await pg.evaluate("""(async () => { const M = await import('/js/data/fz-river.js'); const F = M.FZR, a6 = F.a6, a6b = F.a6b, hq = M.RIVERS.hq, hw = F.rivers.hq.hw;
      const ids = (a6b.bridges || []);
      const bs = ids.map(id => M.BRIDGES.find(q => q.id === id));
      return { hw, len: hq.line.len, oldLen: a6.hqLen, jnS: a6.jnS, jnHw: F.rivers.jn.hw, cam: a6.camMouth, cap: a6b.cap || 10,
        rails: a6b.rails, cams: a6b.cams,
        bridges: bs.map(b => b && { id: b.id, s: b.s, x: b.x, z: b.z, n: b.n, t: b.t, w: b.w, half: b.half, name: b.name || b.style, kind: b.kind, tall: b.tall, deckY: b.deckY, rampL: b.rampL, style: b.style, walk: b.walk }),
        beilang: (() => { const b = M.BRIDGES.find(q => q.name === '北浪路' && q.river === 'hq'); return b && { s: b.s, x: b.x, z: b.z, n: b.n, t: b.t, w: b.w, half: b.half, name: b.name }; })()
      }; })()""")
    hw, brs = A['hw'], A['bridges']
    R['perf']['kw:kiosk:fzdm'] = await sample4(pg, 'kw:kiosk:fzdm')
    p0 = await rpt(pg, 'jn', A['jnS'] + 80, A['jnHw'] + 2.5)
    okw = await go(pg, *p0, '斗门 C → 晋安河东口南'); ok('kw:walk fzdm C toward 湖前', okw and await near(pg, *p0, 2.5), (await st(pg))['pos'])
    cam = A['cam']
    sp = await W(pg, cam['x'], cam['z'])
    okw = await go(pg, *sp, '→ 6A 东口机位'); ok('kw:walk through 6A mouth', okw and await near(pg, *sp, 2.5), (await st(pg))['pos'])
    SOUTH, NORTH = -1, 1
    async def bank(s, side, off=None):
        off = hw + 2.8 if off is None else off
        return await rpt(pg, 'hq', s, side * off)

    async def cross(b, from_side, label):
        off = b['half'] + 3 + ((b.get('rampL') or 0) if (b.get('tall') or b.get('deckY')) else 0)
        def xz(tu, nv):
            return (b['x'] + b['t'][0] * tu + b['n'][0] * nv, b['z'] + b['t'][1] * tu + b['n'][1] * nv)
        if b.get('style') == 'fufei':
            walk = b.get('walk') or 3.5
            pos, origin = (await st(pg))['pos'], await W(pg, b['x'], b['z'])
            cur_t = (pos[0] - origin[0]) * b['t'][0] + (pos[2] - origin[1]) * b['t'][1]
            u = math.copysign(b['w'] / 2 - walk / 2, cur_t if abs(cur_t) > 1 else 1)
            start = await W(pg, *xz(u, from_side * off))
            mid = await W(pg, *xz(u, 0))
            dest = await W(pg, *xz(u, -from_side * off))
            okc = await go(pg, *start, f'→ {b["name"]} 人行道桥头') and await legs(pg, [mid, dest], True)
            arrived = okc and await near(pg, *dest, 2.8) and (await st(pg))['pos'][1] > -0.3
        elif (b.get('tall') or 0) and (b.get('rampL') or 0):
            mid = await W(pg, b['x'], b['z'])
            dest = await W(pg, *xz(0, -from_side * off))
            pos, origin = (await st(pg))['pos'], await W(pg, b['x'], b['z'])
            cur_t = (pos[0] - origin[0]) * b['t'][0] + (pos[2] - origin[1]) * b['t'][1]
            travel = 1 if 'west' in label else -1
            side_in = math.copysign(b['w'] / 2 + 3.0, cur_t if abs(cur_t) > 1 else -travel)
            around = await W(pg, *xz(side_in, from_side * off))
            start = await W(pg, *xz(0, from_side * off))
            okc = (await go(pg, *around, f'→ {b["name"]} 绕行') and await go(pg, *start, f'→ {b["name"]} 桥头') and await legs(pg, [mid, dest], True))
            arrived = okc and await near(pg, *dest, 2.5) and (await st(pg))['pos'][1] > -0.3
            if arrived:
                await go(pg, *await W(pg, *xz(travel * (b['w'] / 2 + 3.0), -from_side * off)), f'→ {b["name"]} 绕出')
        else:
            mid = await W(pg, b['x'], b['z'])
            dest = await W(pg, *xz(0, -from_side * off))
            a = await W(pg, *xz(0, from_side * off))
            okc = await go(pg, *a, f'→ {b["name"]} 桥头') and await legs(pg, [mid, dest], True)
            arrived = okc and await near(pg, *dest, 2.5) and (await st(pg))['pos'][1] > -0.3
        ok(f'kw:cross {b["name"]} {label}', arrived, (await st(pg))['pos'])
        return dest

    # 经 6A 南岸走到北浪路以西
    p = await bank(A['beilang']['s'] + A['beilang']['w'] / 2 + 10, SOUTH)
    okw = await go(pg, *p, '经 6A 南岸 → 北浪路以西'); ok('kw:through 6A to west of 北浪路', okw and await near(pg, *p, 3.0), (await st(pg))['pos'])
    if OUT:
        C = A['cams']['seam']; await look(pg, *(await W(pg, C['look'][0], C['look'][2])), 0.08); await shot(pg, 'kw_seam')
    R['perf']['kw:seam'] = await sample4(pg, 'kw:seam')

    # 西向：福飞 南→北，江厝 北→南，湖景 南→北，大井 北→南，短桥 南→北
    named = [b for b in brs if b['style'] != 'short']
    short = next((b for b in brs if b['style'] == 'short'), None)
    sides = [SOUTH, NORTH, SOUTH, NORTH]
    labels = ['west 南→北', 'west 北→南', 'west 南→北', 'west 北→南']
    side = SOUTH
    for b, lab in zip(named, labels):
        from_side = SOUTH if '南→' in lab else NORTH
        p = await bank(b['s'] - b['w'] / 2 - 8, from_side)
        okw = await go(pg, *p, f'岸上 → {b["name"]}'); ok(f'kw:to {b["name"]} {lab}', okw and await near(pg, *p, 3.0), (await st(pg))['pos'])
        await cross(b, from_side, lab)
        R['perf'][f'kw:{b["id"]}:deck'] = await sample4(pg, f'kw:{b["id"]}:deck')
        if OUT:
            await look(pg, *(await W(pg, b['x'], b['z'])), 0.08); await shot(pg, f'kw_{b["id"]}_from_bank')
        side = -from_side
    if short:
        p = await bank(short['s'] - short['w'] / 2 - 6, side)
        okw = await go(pg, *p, '岸上 → 短桥'); ok('kw:to short bridge', okw and await near(pg, *p, 3.0), (await st(pg))['pos'])
        await cross(short, side, 'west 短桥')
        side = -side

    # 不能走出西头合拢
    end_s = A['len'] - 2
    cap_bank = await bank(end_s, side)
    okw = await go(pg, *cap_bank, '→ 西头岸边'); ok('kw:walk to west cap bank', okw and await near(pg, *cap_bank, 3.2), (await st(pg))['pos'])
    past = await pg.evaluate(f"""(async () => {{ const M = await import('/js/data/fz-river.js'); const e = M.RIVERS.hq.line.at(M.RIVERS.hq.line.len); const cap = {A['cap']} + 14;
      return [e.x + e.tx * cap, e.z + e.tz * cap]; }})()""")
    pastW = await W(pg, *past)
    await legs(pg, [pastW], False); await asyncio.sleep(0.6)
    s = await st(pg)
    root = await pg.evaluate("(() => { const R=__game.fzMetro.street.kit.root.position, p=__game.player.position; return [p.x-R.x, p.z-R.z]; })()")
    endL = await pg.evaluate("(async () => { const M = await import('/js/data/fz-river.js'); const e = M.RIVERS.hq.line.at(M.RIVERS.hq.line.len); return [e.x, e.z, e.tx, e.tz]; })()")
    along = (root[0] - endL[0]) * endL[2] + (root[1] - endL[1]) * endL[3]
    ok('kw:cannot walk past west cap', along < (A['cap'] + 6) and s['pos'][1] > -0.3, {'along': along, 'pos': s['pos']})
    R['perf']['kw:cap'] = await sample4(pg, 'kw:cap')
    if OUT:
        C = A['cams']['rail']; await look(pg, *(await W(pg, C['look'][0], C['look'][2])), 0.12); await shot(pg, 'kw_rail')

    # 上不去铁轨
    for i, r in enumerate(A['rails'] or []):
        tgt = await W(pg, r['x'], r['z'])
        await legs(pg, [tgt], False); await asyncio.sleep(0.5)
        s = await st(pg)
        d = await pg.evaluate(f"""(() => {{ const R=__game.fzMetro.street.kit.root.position, p=__game.player.position; const dx=p.x-R.x-({r['x']}), dz=p.z-R.z-({r['z']}); return Math.hypot(dx,dz); }})()""")
        ok(f'kw:cannot walk onto rail {r.get("name") or i}', d > (r['w'] / 2 + 0.4) or s['pos'][1] < r['deckY'] - 0.5, {'d': d, 'pos': s['pos']})

    # 福飞路中央车道禁走
    ff = next(b for b in brs if b['style'] == 'fufei')
    walk = ff.get('walk') or 3.5
    def xz(tu, nv):
        return (ff['x'] + ff['t'][0] * tu + ff['n'][0] * nv, ff['z'] + ff['t'][1] * tu + ff['n'][1] * nv)
    sidew = await W(pg, *xz(ff['w'] / 2 - walk / 2, 0))
    okw = await go(pg, *sidew, '→ 福飞路人行道'); ok('kw:walk onto 福飞路 sidewalk', okw and await near(pg, *sidew, 2.8) and (await st(pg))['pos'][1] > 0.6, (await st(pg))['pos'])
    mid = await W(pg, *xz(0, 0))
    await legs(pg, [mid], False); await asyncio.sleep(0.5)
    s = await st(pg)
    u = await pg.evaluate(f"""(() => {{ const R=__game.fzMetro.street.kit.root.position, p=__game.player.position; const dx=p.x-R.x-({ff['x']}), dz=p.z-R.z-({ff['z']}); return dx*({ff['t'][0]})+dz*({ff['t'][1]}); }})()""")
    ok('kw:cannot walk onto 福飞路 center lanes', abs(u) >= (ff['w'] / 2 - walk - 0.6), {'u': u, 'pos': s['pos']})
    if OUT:
        C = A['cams']['fufei']; await look(pg, *(await W(pg, C['look'][0], C['look'][2])), 0.1); await shot(pg, 'kw_fufei')

    # 东向回圈：短桥 + 大井 / 湖景 / 江厝 / 福飞 反向
    east_labs = ['east 北→南', 'east 南→北', 'east 北→南', 'east 南→北']
    # after sidewalk we are on 福飞; start return from short or 大井 depending on side
    ret = list(reversed(named))
    # determine current bank roughly from player vs 福飞 n
    pos = (await st(pg))['pos']; origin = await W(pg, ff['x'], ff['z'])
    cur_n = (pos[0] - origin[0]) * ff['n'][0] + (pos[2] - origin[1]) * ff['n'][1]
    side = NORTH if cur_n > 0 else SOUTH
    if short:
        p = await bank(short['s'] + short['w'] / 2 + 6, side)
        okw = await go(pg, *p, '回短桥'); ok('kw:back to short', okw and await near(pg, *p, 3.2), (await st(pg))['pos'])
        await cross(short, side, 'east 短桥')
        side = -side
    for b in ret:
        p = await bank(b['s'] + b['w'] / 2 + 8, side)
        okw = await go(pg, *p, f'回 {b["name"]}'); ok(f'kw:back to {b["name"]}', okw and await near(pg, *p, 3.2), (await st(pg))['pos'])
        await cross(b, side, 'east 回')
        side = -side
    p = await bank(A['beilang']['s'] + A['beilang']['w'] / 2 + 10, SOUTH)
    okw = await go(pg, *p, '回到北浪路以西'); ok('kw:loop back west of 北浪路', okw and await near(pg, *p, 3.5), (await st(pg))['pos'])
    ok('kw:loop complete (福飞/江厝/湖景/大井 both ways, both banks)', True)
    if OUT:
        C = A['cams']['triple']; await look(pg, *(await W(pg, C['look'][0], C['look'][2])), 0.2); await shot(pg, 'kw_triple')
    R['perf']['kw:triple'] = await sample4(pg, 'kw:triple')

    mid_s = (A['oldLen'] + A['len']) / 2
    await b3_rail(pg, 'hq', mid_s, -(hw + 2.5), 'hq6b')
    await b3_fall(pg, 'hq', mid_s, 'hq6b')
    okw = await go(pg, *sp, '回 6A 东口机位')
    p0 = await rpt(pg, 'jn', A['jnS'] + 80, A['jnHw'] + 2.5)
    okw = okw and await go(pg, *p0, '回晋安河南段')
    okk, s_, m = await enter_kiosk(pg, D, 'fzdm'); ok('kw:walk back to fzdm C kiosk and in', okk, [s_['pos'], m])
    await restore_check(pg, 'fzdm')


async def main():
  if OUT: os.makedirs(OUT, exist_ok=True)
  T0 = time.time()
  async with async_playwright() as p:
    b, pg, logs = await open_game(p, BASE + '?q=1' + QS)
    await pg.evaluate(GCLOCK); await pg.evaluate(JUMP); await pg.evaluate(f"__game.setDtMax({float(os.environ.get('FZDT', '0.25'))})"); await asyncio.sleep(1)
    if HALF: await _vp(pg, HALF_VP); log('viewport: walking / riding at', HALF_VP, '; shots + perf at', FULL_VP)
    await pg.evaluate("""(() => { const g=__game; g.east.ensure(); g.east.side='fz'; g.east.cur={st:g.station, loc:'fzmetro', area:'metro'}; g.station.kit.root.setEnabled(false); g.fzMetro.enterFromRailway(g.player); })()""")
    await asyncio.sleep(1.5)
    if E1B or E2B or E2C or E2D or E3A or E3B or E4A or E5 or E6A or E6B:
        await (run_6b(pg) if E6B else run_6a(pg) if E6A else run_5(pg) if E5 else run_4a(pg) if E4A else run_3b(pg) if E3B else run_3a(pg) if E3A else run_2d(pg) if E2D else run_2c(pg) if E2C else run_2b(pg) if E2B else run_1b(pg))
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
        sbm5 = D['clrRep']['bm5']['s']; took = set(); t0 = time.monotonic(); b0 = await boat(pg)
        # 船从西水关往黎明湖（s 增大）；船中心在桥前 9 / 5 / 2 m、桥下各拍一张，第一人称（拱在正前方 / 头顶）+ 第三人称
        marks = [(9, 'ahead9'), (5, 'ahead5'), (2, 'ahead2'), (-1, 'under')]
        while time.monotonic() - t0 < 600 and len(took) < len(marks):
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
