# 福州地铁 1、2、4、5、6 号线 + 滨海快线（F1，内部线号 20）：每个站都要能“站台 → 楼梯 → 站厅 → 出口 → 街面”走出去，再原路走回站台（同 xm_exits.py）。
# 1. 数据：每个站（福州火车南站除外：它的站厅就是国铁出站层）在 FZ_EXITS 里都有出口；站台有上站厅的楼梯。
# 2. 福州火车南站（fzfzn）：从地铁站厅走 F / A / B 出口通道上东广场、走 D2 上西广场，再走回出站层。
# 3. 逐站步行（autopilot，不传送）：站台 → 楼梯 → 站厅 → 出口通道 → 地面（进街区）→ 回出口亭 → 下楼梯回站厅 → 回站台。
# 用法：python tests/e2e/fz_exits.py [base-url] [站代码,逗号分隔（可选，默认全部；含 fzfzn 才测南站出口通道）]
import asyncio, sys, json, os
sys.path.insert(0, os.path.dirname(__file__))
from common import *
from journey import GCLOCK, auto, wait, log
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8123/'
ONLY = [c for c in (sys.argv[2].split(',') if len(sys.argv) > 2 else []) if c]
FO = 5000; FS = 6000; TELEPORT = 2.5; HY = -6.5
R = {'checks': {}, 'static': None, 'stations': {}, 'fzfzn': {}}
def ok(name, v): R['checks'][name] = bool(v); log('check', name, bool(v)); return v
JUMP = """window.__jmp===undefined && (window.__jmp={max:0, at:null, last:null}, __game.scene.onAfterRenderObservable.add(()=>{ const p=__game.player.position, J=window.__jmp;
  if (J.last) { const d=Math.hypot(p.x-J.last[0], p.y-J.last[1], p.z-J.last[2]); if (d>J.max) { J.max=d; J.at=[J.last, [p.x,p.y,p.z]]; } } J.last=[p.x,p.y,p.z]; }))"""
async def jreset(pg): await pg.evaluate('window.__jmp.max=0; window.__jmp.at=null; window.__jmp.last=null')
async def jmax(pg): return (await pg.evaluate('window.__jmp'))['max']
async def walk(pg, pts, leg=18.0, run=True):
    """autopilot 每段只给 12 秒游戏时间：长段切成 ≤ leg 米的小段"""
    s = await st(pg); x, z = s['pos'][0], s['pos'][2]; out = []
    for tx, tz in pts:
        d = ((tx - x) ** 2 + (tz - z) ** 2) ** 0.5; n = max(1, int(d // leg) + 1)
        out += [[x + (tx - x) * k / n, z + (tz - z) * k / n] for k in range(1, n + 1)]; x, z = tx, tz
    return await auto(pg, out, run)
STATIC = """(async () => {
  const E = await import('/js/data/fz-exits.js'), L = await import('/js/data/fz-lines.js');
  const all = [...new Set(Object.values(L.FZ_LINES).flatMap(l => l.stations))];
  return { n: Object.fromEntries(Object.entries(L.FZ_LINES).map(([k, l]) => [k, l.stations.length])), n1: L.FZ_LINES[1].stations.length, n5: L.FZ_LINES[5].stations.length, n4: L.FZ_LINES[4] ? L.FZ_LINES[4].stations.length : 0, rail: E.FZS_EXITS,
    all: all.map(c => { const e = E.FZ_EXITS[c], s = L.FZ_STATIONS[c];
      return { code: c, zh: s.zh, lines: s.lines, ex: e ? { n: e.n, x: e.x, line: e.line, road: e.road, to: e.to } : null,
        more: e && e.more ? e.more.map(m => ({ n: m.n, x: m.x, line: m.line, to: m.to, attr: m.attr || null })) : [] }; }) };
})()"""
async def area(pg): return await pg.evaluate('__game.east.area')
async def railway_exits(pg, rail):
    """福州火车南站：地铁站厅 → 换乘通道 → F / A / B 上东广场；站厅 → D2 上西广场"""
    await pg.evaluate("""(() => { const g=__game; g.east.ensure(); g.east.side='fz'; const P=g.east.rails.fz.plat(true); P.show('solo');
      g.east.cur={st:g.station, loc:'fzs', area:'hall'}; g.station.kit.root.setEnabled(false); g.player.spawn(5000-92, -6.45, -80, Math.PI/2); })()""")
    await asyncio.sleep(1.5)
    ok('fzfzn:metroHall', await area(pg) in ('passage', 'hall'))
    for e in rail:
        n, x = e['n'], FO + e['x']; r = R['fzfzn'][n] = {}
        await jreset(pg)
        if e['side'] == 'S':
            await walk(pg, [[FO - 86, -80], [x, -80], [x, -70], [x, -64], [x, -49], [x, -44]])
            s = await st(pg); a = await area(pg); r['top'] = [s['pos'], a]
            ok(f'fzfzn:{n}:upToEastSquare', a == 'plaza' and abs(s['pos'][1]) < 0.4 and s['pos'][2] > -50 and await jmax(pg) < TELEPORT)
            await walk(pg, [[x, -49], [x, -64], [x, -70], [x, -80]])
        else:
            await walk(pg, [[FO - 92, -80], [x, -88], [x, -93], [x, -150], [x, -164], [x, -168]])
            s = await st(pg); a = await area(pg); r['top'] = [s['pos'], a]
            ok(f'fzfzn:{n}:upToWestSquare', a == 'square' and abs(s['pos'][1]) < 0.4 and s['pos'][2] < -163 and await jmax(pg) < TELEPORT)
            await walk(pg, [[x, -164], [x, -150], [x, -93], [x, -86], [FO - 92, -80]])
        s = await st(pg); r['back'] = s['pos']
        ok(f'fzfzn:{n}:backDown', abs(s['pos'][1] - HY) < 0.4 and await area(pg) in ('passage', 'hall'))
async def station(pg, code, zh, exd=None):
    r = {'zh': zh}
    info = await pg.evaluate(f"""(() => {{ const e=__game.east; e.cur.loc='fzmetro'; e.cur.area='metro'; const st=__game.fzMetro.buildStation('{code}');
      const P=st.platforms.find(p=>p.up); return P ? {{ zm:(P.up.z0+P.up.z1)/2, y:P.y }} : null; }})()""")
    r['up'] = info
    if not ok(f'{code}:stairsUp', info): return r
    ex = exd or await pg.evaluate(f"(async () => {{ const S = await import('/js/data/fz-exits.js'); const e=S.FZ_EXITS['{code}']; return e ? {{x:e.x, n:e.n}} : null; }})()")
    tag = code if not exd else f"{code}.{exd['n']}"
    code_ = code; code = tag
    if not ok(f'{code}:exitEntry', ex): return r
    zm, ex_x = info['zm'], ex['x']
    await pg.evaluate(f"__game.player.spawn({FO}+2, -12.95, {zm}, -Math.PI/2)"); await asyncio.sleep(1); await jreset(pg)
    await auto(pg, [[FO - 3, zm], [FO - 12, zm]], True); await auto(pg, [[FO - 21.5, zm]], True); await auto(pg, [[FO - 22, -6], [FO - 15, -12]], True)
    s = await st(pg); r['concourse'] = s['pos']
    ok(f'{code}:platformToConcourse', s['zone'] == 'concourse' and abs(s['pos'][1] + 6.5) < 0.3 and await jmax(pg) < TELEPORT)
    await jreset(pg)
    await auto(pg, [[FO + ex_x, -16]], True); await auto(pg, [[FO + ex_x, -20], [FO + ex_x, -36]], True)
    s = await st(pg); street = await pg.evaluate("__game.fzMetro.street ? __game.fzMetro.street.info() : null"); r['street'] = street
    ok(f'{code}:concourseToStreet', bool(street) and street['code'] == code_ and s['zone'] == 'street' and abs(s['pos'][1]) < 0.5)
    if not street: return r
    await auto(pg, [[FS, -4]], True); await asyncio.sleep(0.5)
    s = await st(pg); back = not await pg.evaluate("!!__game.fzMetro.street")
    ok(f'{code}:streetBack', back and abs(s['pos'][0] - FO - ex_x) < 2.5 and abs(s['pos'][1]) < 0.5 and s['pos'][2] < -33)
    await jreset(pg)
    await auto(pg, [[FO + ex_x, -20], [FO + ex_x, -15]], True)
    s = await st(pg); ok(f'{code}:exitToConcourse', s['zone'] == 'concourse' and abs(s['pos'][1] + 6.5) < 0.3)
    await auto(pg, [[FO - 15, -12], [FO - 22, -6], [FO - 22, zm]], True); await auto(pg, [[FO - 10, zm]], True); await auto(pg, [[FO + 2, zm]], True)
    s = await st(pg); r['platform'] = s['pos']
    ok(f'{code}:concourseToPlatform', s['zone'] == 'platform' and abs(s['pos'][1] + 13) < 0.3 and await jmax(pg) < TELEPORT)
    return r
async def main():
    async with async_playwright() as p:
        b, pg, logs = await open_game(p, BASE + '?q=1')
        await pg.evaluate(GCLOCK); await pg.evaluate(JUMP); await pg.evaluate('__game.setDtMax(0.25)'); await asyncio.sleep(1)
        S = await pg.evaluate(STATIC); R['static'] = S
        ok('static:L1=25,L2=22,L4=23,L5=20,L6=14,F1=12', S['n'] == {'1': 25, '2': 22, '4': 23, '5': 20, '6': 14, '20': 12})
        missing = [f"{s['code']} {s['zh']}" for s in S['all'] if s['code'] != 'fzfzn' and not s['ex']]
        R['missingExits'] = missing; log('missing exits', missing)
        ok('static:everyStationHasExit', not missing)
        bad = [s['code'] + ':' + str(e['n']) for s in S['all'] for e in ([s['ex']] + s['more'] if s['ex'] else []) if (not isinstance(e['n'], str) or e['line'] not in s['lines'] or not isinstance(e['to'], list) or not -20 < e['x'] < 16)]
        bad += [s['code'] + ':overlap' for s in S['all'] for e in s['more'] if abs(e['x'] - s['ex']['x']) < 8]
        R['badExits'] = bad; ok('static:exitEntriesWellFormed', not bad)
        ok('static:fzfznExits', sorted(e['n'] for e in S['rail']) == ['A', 'B', 'D2', 'F'])
        if not ONLY or 'fzfzn' in ONLY: await railway_exits(pg, S['rail'])
        await pg.evaluate("""(() => { const g=__game; g.east.ensure(); g.east.side='fz'; g.east.cur={st:g.station, loc:'fzmetro', area:'metro'}; g.station.kit.root.setEnabled(false); g.fzMetro.enterFromRailway(g.player); })()""")
        await asyncio.sleep(1.5)
        ok('fzfzn:railwayLink', await pg.evaluate("__game.fzMetro.code==='fzfzn' && !__game.fzMetro.station.platforms.some(p=>p.up)"))
        for s in S['all']:
            if s['code'] == 'fzfzn' or (ONLY and s['code'] not in ONLY): continue
            log('=== station', s['code'], s['zh'])
            R['stations'][s['code']] = await station(pg, s['code'], s['zh'])
            for e in s['more']:   # 同站的第二个出口（走到对应街区，如南门兜 B → 乌山）
                log('=== exit', s['code'], e['n']); R['stations'][s['code'] + '.' + e['n']] = await station(pg, s['code'], s['zh'], e)
        R['errors'] = errs(logs); await b.close()
    print(json.dumps({k: v for k, v in R.items() if k != 'static'}, ensure_ascii=False, indent=1, default=str))
    good = all(R['checks'].values()) and not R['errors']
    print('FZ_EXITS', 'PASS' if good else 'FAIL', [k for k, v in R['checks'].items() if not v], flush=True)
    if not good: sys.exit(1)
if __name__ == "__main__": asyncio.run(main())
