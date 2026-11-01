# 换乘楼梯中间扶手（以及两侧扶手）顶上不能站人：福州所有换乘站（含帝封江三层的两段楼梯）+ 厦门吕厝。
# 每段楼梯做几种“想爬上扶手”的尝试（真实输入：摇杆 + 跳，不传送到扶手上）：
#   top   ：从上层站台沿楼梯中线（扶手正上方）往下走，一路跳（所有换乘站）
#   side  ：站在步行梯半边中段，朝中间扶手推摇杆 + 连跳（东街口 / 帝封江两段 / 吕厝）
#   sideE ：站在扶梯半边中段，朝中间扶手推摇杆 + 连跳（帝封江 / 吕厝）
#   bottom：从下层站台沿中线往上走 + 连跳（帝封江 / 吕厝）
# 断言：全程玩家中心从未进入扶手正上方（|z−zc|<0.3 且在楼梯 x 范围内）；尝试结束后站在楼梯面（或上下层地面）上。
# 修复前（旋转的 1.4 m 扶手碰撞盒，上端面是斜坡）：fzdjk top 尝试直接沿中间扶手顶走到楼下（onRail 63 帧）。
# 等待全部按游戏时间计（低帧率 box 上照样成立）。用法：python fz_rail.py [base-url] [codes 逗号分隔，可选]
import asyncio, sys, json, os, time
sys.path.insert(0, os.path.dirname(__file__))
from common import *
from journey import GCLOCK, gt, log
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8123/'
ONLY = [c for c in (sys.argv[2].split(',') if len(sys.argv) > 2 else []) if c]
R = {'checks': {}, 'tries': {}}
def ok(name, v): R['checks'][name] = bool(v); log('check', name, bool(v)); return v
# 楼梯几何（xmMetro.js XF / XF2，局部 x；脚在 x0，顶在 x1）
LV = [{'x0': 4, 'x1': 20, 'lo': -22, 'hi': -13}, {'x0': -18, 'x1': -2, 'lo': -31, 'hi': -22}]
MON = """window.__rail===undefined && (window.__rail={on:null, n:0}, __game.scene.onAfterRenderObservable.add(()=>{ const R=window.__rail, S=R.s; if (!S) return;
  const p=__game.player.position; if (p.x>S.x0-0.3 && p.x<S.x1+0.3 && Math.abs(p.z-S.zc)<0.3) { R.n++; if (!R.on) R.on=[+p.x.toFixed(2),+p.y.toFixed(2),+p.z.toFixed(2)]; } }))"""
async def game_sleep(pg, secs, wall=900):
    g0 = await gt(pg); t0 = time.time(); last = (g0, t0)
    while time.time() - t0 < wall:
        g = await gt(pg)
        if g - g0 >= secs: return True
        if g != last[0]: last = (g, time.time())
        elif time.time() - last[1] > 120: return False
        await asyncio.sleep(0.25)
    return False
def stair_y(L, lx): f = min(1, max(0, (lx - L['x0']) / (L['x1'] - L['x0']))); return L['lo'] + (L['hi'] - L['lo']) * f
async def attempt(pg, tag, O, zc, L, kind):
    X0, X1 = O + L['x0'], O + L['x1']; xm = (X0 + X1) / 2; ym = stair_y(L, L['x0'] + (L['x1'] - L['x0']) / 2)
    start = {'top': (X1 + 2.5, L['hi'] + 0.05, zc, -1.5708), 'bottom': (X0 - 2.5, L['lo'] + 0.05, zc, 1.5708),
             'side': (xm, ym + 0.1, zc - 0.9, 0.0), 'sideE': (xm, ym + 0.1, zc + 0.9, 3.1416)}[kind]
    await pg.evaluate(f"__game.setMove(0,0); window.__rail.s={{x0:{X0},x1:{X1},zc:{zc}}}; window.__rail.on=null; window.__rail.n=0; __game.player.spawn({start[0]},{start[1]},{start[2]},{start[3]})")
    await game_sleep(pg, 0.6)
    await pg.evaluate("__game.setMove(0,1,false)")
    for _ in range(7):   # ~5.6 s 游戏时间：一路推摇杆，每 0.8 s 跳一下
        await pg.evaluate('__game.jump()'); await game_sleep(pg, 0.8)
    await pg.evaluate("__game.setMove(0,0)"); await game_sleep(pg, 1.5)
    s = await st(pg); mon = await pg.evaluate('({on:window.__rail.on, n:window.__rail.n})')
    await pg.evaluate('window.__rail.s=null')
    x, y, z = s['pos']; lx = x - O
    floor = stair_y(L, lx) if L['x0'] <= lx <= L['x1'] else (L['hi'] if lx > L['x1'] else L['lo'])
    rec = {'pos': s['pos'], 'grounded': s['grounded'], 'floor': round(floor, 2), 'onRail': mon['on'], 'railFrames': mon['n']}; R['tries'][f'{tag}:{kind}'] = rec
    log(tag, kind, rec)
    ok(f'{tag}:{kind}:neverOnRail', not mon['on'])
    inx = X0 - 0.3 < x < X1 + 0.3
    ok(f'{tag}:{kind}:onStair', s['grounded'] and (not inx or 0.3 <= abs(z - zc) <= 2.0) and -0.35 < y - floor < 0.35)
async def main():
    async with async_playwright() as p:
        b, pg, logs = await open_game(p, BASE + '?q=1')
        await pg.evaluate(GCLOCK); await pg.evaluate(MON); await pg.evaluate('__game.setDtMax(0.1)'); await asyncio.sleep(1)
        codes = await pg.evaluate("(async () => { const L = await import('/js/data/fz-lines.js'); return [...new Set(Object.values(L.FZ_LINES).flatMap(l => l.stations))].filter(c => L.FZ_STATIONS[c].lines.length > 1).map(c => [c, L.FZ_STATIONS[c].lines.length]); })()")
        R['fzTransfers'] = codes; log('fz transfer stations', codes)
        await pg.evaluate("""(() => { const g=__game; g.east.ensure(); g.east.side='fz'; g.east.cur={st:g.station, loc:'fzmetro', area:'metro'}; g.station.kit.root.setEnabled(false); g.fzMetro.enterFromRailway(g.player); })()""")
        await asyncio.sleep(1.5)
        for code, n in codes:
            if ONLY and code not in ONLY: continue
            zc = await pg.evaluate(f"(() => {{ const e=__game.east; e.cur.loc='fzmetro'; e.cur.area='metro'; const st=__game.fzMetro.buildStation('{code}'); return st.platforms[0].zc; }})()")
            await asyncio.sleep(1)
            full = code == 'fzdfj' or code == (ONLY[0] if ONLY else 'fzdjk')
            for lv in range(n - 1):
                for kind in (['top', 'side', 'sideE', 'bottom'] if full else ['top']):   # 各换乘站楼梯是同一个 buildTransfer，其余站只做最关键的 top
                    await attempt(pg, f'{code}.L{lv}', 5000, zc, LV[lv], kind)
        if not ONLY or 'lcu' in ONLY:
            await pg.evaluate("""(() => { const g=__game; g.east.side='xm'; g.east.cur={st:g.station, loc:'xmmetro', area:'metro'}; g.xmMetro.enterFromRailway(g.player); })()""")
            await asyncio.sleep(1.5)
            zc = await pg.evaluate("(() => { const e=__game.east; e.cur.loc='xmmetro'; e.cur.area='metro'; const st=__game.xmMetro.buildStation('lcu'); return st.platforms[0].zc; })()")
            await asyncio.sleep(1)
            for kind in ['top', 'side', 'sideE', 'bottom']: await attempt(pg, 'lcu.L0', 3000, zc, LV[0], kind)
        R['errors'] = errs(logs); await b.close()
    print(json.dumps(R, ensure_ascii=False, indent=1, default=str))
    good = all(R['checks'].values()) and not R['errors']
    print('FZ_RAIL', 'PASS' if good else 'FAIL', len(R['checks']), 'checks', [k for k, v in R['checks'].items() if not v], flush=True)
    if not good: sys.exit(1)
if __name__ == "__main__": asyncio.run(main())
