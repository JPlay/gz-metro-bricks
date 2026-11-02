# 终点站回归（厦门 1 号线镇海路卡在“进站中”）：
# 1. 静态：广州 1/2 号线、厦门 1/2 号线每个站、每个能开进来的方向，站台上都有接这班车的槽位；
#    没有同方向槽位的（只有侧式单边终点站镇海路）由 attach() 借本线槽位终到 —— 列出来，确认只有这种站。
# 2. 真坐车：厦门 1 号线中山公园（zsp）上车，自然开到终点镇海路（zhl）：进站 → 停稳 → 开门（≥0.99）；
#    玩家走下车 → 侧式站台 → 楼梯上站厅 → 1 号出口 → 街区（和平码头）。
# 3. 下车后列车清客开走，下一班按这一侧本来的方向（往岩内）进站、开门。
# 用法：python tests/e2e/xm_terminus.py [base-url]
import asyncio, sys, json, os
sys.path.insert(0, os.path.dirname(__file__))
from common import *
from journey import GCLOCK, auto, wait, log
from xiamen import xm_board
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8123/'
XO = 3000
R = {'checks': {}, 'info': {}}
def ok(name, v, info=None):
    R['checks'][name] = bool(v); log('check', name, bool(v), '' if info is None else info)
    if info is not None: R['info'][name] = info
    return v

STATIC = """(async () => {
  const XL = await import('/js/data/xm-lines.js'), GL = await import('/js/data/lines.js');
  const XM = await import('/js/world/xmMetro.js'), GS = await import('/js/world/station.js');
  const out = { xm: [], gz: [], borrowed: [], missing: [], termini: [] };
  for (const [line, L] of Object.entries(XL.XM_LINES)) for (const code of L.stations) {
    const fake = { s: XL.XM_STATIONS[code], code };
    const sides = XM.XmStation.prototype.frames.call(fake).filter(f => f.line === +line).flatMap(f => Object.values(XM.XmStation.prototype.sidesFor.call(fake, f)));
    for (const step of [1, -1]) {
      const from = XL.xmNext(+line, code, -step); if (!from) continue;   // 从 from 开过来，行车方向 step
      const has = sides.some(s => s.step === step), terminal = XL.xmIsTerminal(+line, code, step);
      const row = { net: 'xm', line: +line, code, step, from, terminal, slot: has ? 'same-dir' : (sides.length ? 'borrow' : 'NONE') };
      out.xm.push(row); if (!has) (sides.length ? out.borrowed : out.missing).push(row); if (terminal) out.termini.push(row);
    }
  }
  for (const [line, L] of Object.entries(GL.LINES)) for (const code of L.stations) {
    const fr = GS.framesFor(code).filter(f => f.line === +line);
    for (const step of [1, -1]) {
      const from = GL.nextStation(+line, code, -step); if (!from) continue;
      const terminal = GL.isTerminal(+line, code, step);
      const row = { net: 'gz', line: +line, code, step, from, terminal, slot: fr.length ? 'same-dir' : 'NONE' };   // 广州每个站台都有 A(+1)/B(-1) 两侧
      out.gz.push(row); if (!fr.length) out.missing.push(row); if (terminal) out.termini.push(row);
    }
  }
  return out; })()"""

async def main():
    async with async_playwright() as p:
        b, pg, logs = await open_game(p, BASE + '?q=1')
        try:
            await pg.evaluate(GCLOCK); await pg.evaluate('__game.setDtMax(0.25)'); await asyncio.sleep(1)
            s = await pg.evaluate(STATIC)
            R['info']['termini'] = s['termini']; R['info']['borrowed'] = s['borrowed']
            ok('static:everyArrivalHasSlot', not s['missing'], s['missing'])
            ok('static:onlyZhlBorrows', [(r['code'], r['step']) for r in s['borrowed']] == [('zhl', 1)], s['borrowed'])
            log('termini', [(r['net'], r['line'], r['code'], r['step'], r['slot']) for r in s['termini']])
            # —— 进厦门地铁，中山公园上 1 号线往镇海路（step +1）——
            await pg.evaluate("""(() => { const g=__game; g.east.ensure(); g.east.side='xm'; g.east.cur={st:g.station, loc:'xmmetro', area:'metro'}; g.station.kit.root.setEnabled(false); g.xmMetro.enterFromRailway(g.player); if (g.player.view!=='third') g.toggleView(); })()""")
            await asyncio.sleep(1.5)
            await pg.evaluate("__game.xmMetro.buildStation('zsp'); __game.player.spawn(3004, -12.95, 0, -Math.PI/2)"); await asyncio.sleep(1.5)
            ok('boardZsp', await xm_board(pg, 1, 1))
            # 上车了：放车走（停站计时设短），之后不再动任何状态 —— 关门、出站、隧道、进站、开门全靠游戏自己
            await pg.evaluate("(() => { const s=__game.xmMetro.slots.find(o=>o.line===1&&o.step===1&&o.state==='dwell'); if (s) s.t=0.5; })()")
            ok('departZsp', await wait(pg, "!!(__game.xmMetro.ride && __game.xmMetro.ride.phase==='cruise')", 120))
            ok('reachZhl', await wait(pg, "__game.xmMetro.code==='zhl' && !!__game.xmMetro.ride && __game.xmMetro.ride.phase!=='cruise'", 120))
            # 以前：槽位还是中山公园的旧槽位，永远 arriving
            arrived = await wait(pg, "(() => { const m=__game.xmMetro, s=m.ride&&m.ride.slot; return !!s && m.slots.includes(s) && s.state==='dwell' && s.f>=0.99; })()", 60)
            info = await pg.evaluate("(() => { const m=__game.xmMetro, s=m.ride&&m.ride.slot; return { code:m.code, inSlots: !!s && m.slots.includes(s), state: s&&s.state, f: s&&+s.f.toFixed(2), u: s&&+s.u.toFixed(3), side: s&&s.side.key, step: s&&s.step, slots: m.info().slots, lastLeg: m.info().lastLeg }; })()")
            ok('zhl:doorsOpen', arrived, info)
            if not arrived: return
            ok('zhl:stillAboardAtDwell', (await st(pg))['aboard'])
            r = await pg.evaluate("(() => { const s=__game.xmMetro.ride.slot, tr=s.train; const platSg=Math.sign(s.P.zc - s.side.trackZ); return { x: tr.root.position.x, trackZ: s.side.trackZ, psdZ: s.side.psdZ, zc: s.P.zc, platSg, openPlat: tr.open[platSg], openOuter: tr.open[-platSg] }; })()")
            ok('zhl:platformSideDoorsOpen', r['openPlat'] >= 0.99 and r['openOuter'] == 0, r)
            # 走下车：车门 → 站台
            sg = 1 if r['psdZ'] > r['trackZ'] else -1
            await auto(pg, [[r['x'] + 6, r['trackZ']], [r['x'] + 6, r['psdZ'] + sg * 0.8], [r['x'] + 4, r['psdZ'] + sg * 2.4]])   # 走出车门区（inDoorway：离轨道中心 ≤ 2.3 m 会一直扶着门不关）
            s = await st(pg); ok('zhl:alighted', not s['aboard'] and s['zone'] == 'platform' and not await pg.evaluate('__game.xmMetro.slots.some(o=>o.train.inDoorway(__game.player.position))'), s['pos'])
            # 下车后列车清客开走（以前它永远停在 arriving）
            ok('zhl:trainLeaves', await wait(pg, "__game.xmMetro.slots.some(s=>s.line===1 && (s.state==='departing'||s.state==='away')) && !__game.xmMetro.ride", 60),
               await pg.evaluate('__game.xmMetro.info().slots'))
            # 借来的槽位开走后恢复本来方向：这一侧（B）下一班是往岩内（step -1）的车
            ok('zhl:slotStepRestored', await wait(pg, "__game.xmMetro.slots.every(s=>s.step===s.side.step) && __game.xmMetro.slots.some(s=>s.state==='away')", 60),
               await pg.evaluate("__game.xmMetro.slots.map(s=>({side:s.side.key, sideStep:s.side.step, step:s.step, state:s.state}))"))
            # 侧式站台 → 楼梯 → 站厅（同 xm_doors.py 的镇海路路线）
            await auto(pg, [[XO - 3, 1.7], [XO - 12, 1.7]]); await auto(pg, [[XO - 21.5, 1.7]]); await auto(pg, [[XO - 22, -6], [XO - 15, -12]])
            s = await st(pg); ok('zhl:concourse', s['zone'] == 'concourse', s['pos'])
            ex = await pg.evaluate("(async () => { const S = await import('/js/world/xmStreet.js'); const e=S.XM_EXITS['zhl']; return {x:e.x, n:e.n}; })()")
            ok('zhl:exitIs1', ex['n'] == '1', ex)
            await auto(pg, [[XO + ex['x'], -16]], True); await auto(pg, [[XO + ex['x'], -20], [XO + ex['x'], -36]], True)
            street = await pg.evaluate("__game.xmMetro.street ? __game.xmMetro.street.info().code : null")
            ok('zhl:exit1ToStreet', street == 'zhl', street)
            ok('noErrors', not errs(logs), errs(logs)[:5])
        finally:
            await b.close()
    print(json.dumps(R, ensure_ascii=False, indent=1, default=str))
    bad = [k for k, v in R['checks'].items() if not v]
    print('XM_TERMINUS', 'PASS' if not bad else 'FAIL', bad, flush=True)
    if bad: sys.exit(1)
if __name__ == '__main__': asyncio.run(main())
