# 厦门地铁 1、2 号线：每个站都要能“站台 → 楼梯 → 站厅 → 出口 → 街面”走出去，再原路走回站台。
# 1. 数据：每个站（厦门北站除外：它是走换乘通道去国铁站房）在 XM_EXITS 里都有出口；站台有上站厅的楼梯。
#    有任何一站出口表空 / 没有上去的楼梯 → FAIL（岩内曾经出口表空，站厅南墙是死墙）。
# 2. 逐站步行（autopilot，不传送）：站台 → 楼梯 → 站厅 → 出口通道 → 地面（进街区）→ 回出口亭 → 回到出口楼梯顶
#    → 走下去回站厅 → 走回站台。
# 用法：python tests/e2e/xm_exits.py [base-url] [站代码,逗号分隔（可选，默认全部）]
import asyncio, sys, json, os
sys.path.insert(0, os.path.dirname(__file__))
from common import *
from journey import GCLOCK, auto, wait, log
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8123/'
ONLY = [c for c in (sys.argv[2].split(',') if len(sys.argv) > 2 else []) if c]
XO = 3000; XS = 4000; TELEPORT = 2.5
R = {'checks': {}, 'static': None, 'stations': {}}
def ok(name, v): R['checks'][name] = bool(v); log('check', name, bool(v)); return v
JUMP = """window.__jmp===undefined && (window.__jmp={max:0, at:null, last:null}, __game.scene.onAfterRenderObservable.add(()=>{ const p=__game.player.position, J=window.__jmp;
  if (J.last) { const d=Math.hypot(p.x-J.last[0], p.y-J.last[1], p.z-J.last[2]); if (d>J.max) { J.max=d; J.at=[J.last, [p.x,p.y,p.z]]; } } J.last=[p.x,p.y,p.z]; }))"""
async def jreset(pg): await pg.evaluate('window.__jmp.max=0; window.__jmp.at=null; window.__jmp.last=null')
async def jmax(pg): return (await pg.evaluate('window.__jmp'))['max']
STATIC = """(async () => {
  const S = await import('/js/world/xmStreet.js'), L = await import('/js/data/xm-lines.js');
  const all = [...new Set([...L.XM_LINES[1].stations, ...L.XM_LINES[2].stations])];
  return all.map(c => { const e = S.XM_EXITS[c], s = L.XM_STATIONS[c];
    return { code: c, zh: s.zh, lines: s.lines, ex: e ? { n: e.n, x: e.x, line: e.line, road: e.road, to: e.to } : null }; });
})()"""
async def station(pg, code, zh):
    r = {'zh': zh}
    info = await pg.evaluate(f"""(() => {{ const e=__game.east; e.cur.loc='xmmetro'; e.cur.area='metro'; const st=__game.xmMetro.buildStation('{code}');
      const P=st.platforms.find(p=>p.up); const ex=st.constructor && null;
      return P ? {{ zm:(P.up.z0+P.up.z1)/2, y:P.y }} : null; }})()""")
    r['up'] = info
    if not ok(f'{code}:stairsUp', info): return r
    ex = await pg.evaluate(f"(async () => {{ const S = await import('/js/world/xmStreet.js'); const e=S.XM_EXITS['{code}']; return e ? {{x:e.x, n:e.n}} : null; }})()")
    if not ok(f'{code}:exitEntry', ex): return r
    zm, ex_x = info['zm'], ex['x']
    await pg.evaluate(f"__game.player.spawn({XO}+2, -12.95, {zm}, -Math.PI/2)"); await asyncio.sleep(1); await jreset(pg)
    # 站台 → 楼梯 → 站厅
    await auto(pg, [[XO - 3, zm], [XO - 12, zm]], True); await auto(pg, [[XO - 21.5, zm]], True); await auto(pg, [[XO - 22, -6], [XO - 15, -12]], True)
    s = await st(pg); r['concourse'] = s['pos']
    ok(f'{code}:platformToConcourse', s['zone'] == 'concourse' and abs(s['pos'][1] + 6.5) < 0.3 and await jmax(pg) < TELEPORT)
    # 站厅 → 出口通道 → 楼梯上地面 → 街区
    await jreset(pg)
    await auto(pg, [[XO + ex_x, -16]], True); await auto(pg, [[XO + ex_x, -20], [XO + ex_x, -36]], True)
    s = await st(pg); street = await pg.evaluate("__game.xmMetro.street ? __game.xmMetro.street.info() : null"); r['street'] = street
    ok(f'{code}:concourseToStreet', bool(street) and street['code'] == code and s['zone'] == 'street' and abs(s['pos'][1]) < 0.5)
    if not street: return r
    # 街区 → 回出口亭 → 车站出口楼梯顶
    await auto(pg, [[XS, -4]], True); await asyncio.sleep(0.5)
    s = await st(pg); back = not await pg.evaluate("!!__game.xmMetro.street")
    ok(f'{code}:streetBack', back and abs(s['pos'][0] - XO - ex_x) < 2.5 and abs(s['pos'][1]) < 0.5 and s['pos'][2] < -33)
    # 出口楼梯 → 站厅 → 站台（原路走回去）
    await jreset(pg)
    await auto(pg, [[XO + ex_x, -20], [XO + ex_x, -15]], True)
    s = await st(pg); ok(f'{code}:exitToConcourse', s['zone'] == 'concourse' and abs(s['pos'][1] + 6.5) < 0.3)
    await auto(pg, [[XO - 15, -12], [XO - 22, -6], [XO - 22, zm]], True); await auto(pg, [[XO - 10, zm]], True); await auto(pg, [[XO + 2, zm]], True)
    s = await st(pg); r['platform'] = s['pos']
    ok(f'{code}:concourseToPlatform', s['zone'] == 'platform' and abs(s['pos'][1] + 13) < 0.3 and await jmax(pg) < TELEPORT)
    return r
async def main():
    async with async_playwright() as p:
        b, pg, logs = await open_game(p, BASE + '?q=1')
        await pg.evaluate(GCLOCK); await pg.evaluate(JUMP); await pg.evaluate('__game.setDtMax(0.25)'); await asyncio.sleep(1)
        S = await pg.evaluate(STATIC); R['static'] = S
        ok('static:55stations', len(S) == 55)
        missing = [f"{s['code']} {s['zh']}" for s in S if s['code'] != 'xmnb' and not s['ex']]
        R['missingExits'] = missing; log('missing exits', missing)
        ok('static:everyStationHasExit', not missing)
        bad = [s['code'] for s in S if s['ex'] and (not isinstance(s['ex']['n'], str) or s['ex']['line'] not in s['lines'] or not isinstance(s['ex']['to'], list) or not -20 < s['ex']['x'] < 16)]
        R['badExits'] = bad; ok('static:exitEntriesWellFormed', not bad)
        # 进厦门地铁（厦门北，走国铁换乘那条路的站已有 xm_doors 测），然后逐站搭
        await pg.evaluate("""(() => { const g=__game; g.east.ensure(); g.east.side='xm'; g.east.cur={st:g.station, loc:'xmmetro', area:'metro'}; g.station.kit.root.setEnabled(false); g.xmMetro.enterFromRailway(g.player); })()""")
        await asyncio.sleep(1.5)
        ok('xmnb:railwayLink', await pg.evaluate("__game.xmMetro.code==='xmnb' && !__game.xmMetro.station.platforms[0].up"))
        for s in S:
            if s['code'] == 'xmnb' or (ONLY and s['code'] not in ONLY): continue
            log('=== station', s['code'], s['zh'])
            R['stations'][s['code']] = await station(pg, s['code'], s['zh'])
        R['errors'] = errs(logs); await b.close()
    print(json.dumps({k: v for k, v in R.items() if k != 'static'}, ensure_ascii=False, indent=1, default=str))
    good = all(R['checks'].values()) and not R['errors']
    print('XM_EXITS', 'PASS' if good else 'FAIL', [k for k, v in R['checks'].items() if not v], flush=True)
    if not good: sys.exit(1)
if __name__ == "__main__": asyncio.run(main())
