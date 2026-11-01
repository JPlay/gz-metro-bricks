# 景点出口广播（“××站附近有……请从×出口出站”）不被进站广播掐掉：
# 1. 静态：广州 1/2 号线、厦门 1/2 号线每一段行车（每站、每方向），算出开车后整段报站时长 seq、新的最短行车时间 hold；
#    - 带出口的景点广播那段：hold = seq + 1.5 s 余量，且 hold > 旧的最长行车窗口（出站 ~7.2 s + 隧道最多 14 s ≈ 21.2 s）才会被延长
#    - 其它段：hold 必须 = 0（行车时长、手感完全不变）；cruiseDone(hold=0) 在网格上和旧公式逐点相同
# 2. 真坐车（游戏时间）：广州 1 号线 陈家祠 → 西门口（普通站：hold=0、隧道 ≤ 14 s）→ 公园前（景点：行车 ≥ hold，三语景点片段都播完、没被掐）
#    厦门 1 号线 文灶 → 将军祠（普通站）→ 中山公园（景点 3A 出口：同上）
# 用法：python tests/e2e/visit_dwell.py [base-url]
import asyncio, sys, json, os
sys.path.insert(0, os.path.dirname(__file__))
from common import *
from journey import GCLOCK, wait, log
from xiamen import xm_board
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8123/'
R = {'checks': {}, 'info': {}}
OUT_T = 8 * 0.8 ** 0.5   # 出站加速段：x = 100·u²，|x| ≥ 80 进隧道 → u = √0.8，ACC_T 8 s
OLD_MAX = OUT_T + 14
def ok(name, v, info=None):
    R['checks'][name] = bool(v); log('check', name, bool(v), '' if info is None else info)
    if info is not None: R['info'][name] = info
    return v

STATIC = """(async () => {
  const GL = await import('/js/data/lines.js'), XL = await import('/js/data/xm-lines.js');
  const P = await import('/js/data/phrases.js'), Ann = await import('/js/audio/announcements.js'), S = await import('/js/game/service.js');
  await __game.Audio.loadManifest?.();
  const rows = [];
  const leg = (net, line, from, to, step, segs) => {
    const vis = segs.filter(x => /^voice\\.(xm)?visit\\./.test(x.id));
    rows.push({ net, line, from, to, step, seq: +Ann.seconds(segs).toFixed(2), hold: +Ann.departHold(segs).toFixed(2),
      visit: vis.length ? vis[0].id.replace(/\\.zh$/, '') : '', exit: vis.some(x => /出口|Exit/.test(x.text || '')) });
  };
  for (const [id, L] of Object.entries(GL.LINES)) for (const code of L.stations) for (const step of [1, -1]) {
    const nx = GL.nextStation(+id, code, step); if (!nx) continue;
    leg('gz', +id, code, nx, step, P.departSegs(+id, nx, GL.dirFor(+id, step), step, false));
  }
  for (const [id, L] of Object.entries(XL.XM_LINES)) for (const code of L.stations) for (const step of [1, -1]) {
    const nx = XL.xmNext(+id, code, step); if (!nx) continue;
    leg('xm', +id, code, nx, step, P.xmDepartSegs(+id, nx, XL.xmDirFor(+id, step), step, false));
  }
  // cruiseDone(hold=0) 和旧条件 (t>5 && !announcing) || t>14 逐点比较
  let diff = 0;
  for (let t = 0; t < 30; t += 0.05) for (const an of [true, false]) if (S.cruiseDone({ t, hold: 0, el: 7.2 }, an) !== ((t > 5 && !an) || t > 14)) diff++;
  return { rows, diff, margin: Ann.VISIT_MARGIN };
})()"""

SLOT = "__game.metro.slots.find(s=>s.line==1&&s.step==1)"
async def audio_log(pg): return await pg.evaluate('__game.Audio.getState().log')
async def gz_leg(pg, to, game=150):
    return await wait(pg, f"(()=>{{const m=__game.state().metro; return !!(m.lastLeg && m.lastLeg.to=='{to}') && m.slots.some(s=>s.line==1&&s.step==1&&s.state=='dwell')}})()", game)

async def main():
    async with async_playwright() as p:
        b, pg, logs = await open_game(p, BASE + '?q=1&start=cjc&line=1')
        try:
            await pg.evaluate(GCLOCK); await pg.evaluate('__game.setDtMax(0.25)'); await asyncio.sleep(1.5)
            s = await pg.evaluate(STATIC); rows = s['rows']; R['info']['table'] = rows
            ok('static:cruiseDoneHold0SameAsOld', s['diff'] == 0, s['diff'])
            normal = [r for r in rows if not r['exit']]
            ok('static:normalLegsHold0', all(r['hold'] == 0 for r in normal), [r for r in normal if r['hold']])
            ex = [r for r in rows if r['exit']]
            ok('static:exitVisitLegsHold', all(abs(r['hold'] - r['seq'] - s['margin']) < 0.01 for r in ex), len(ex))
            ok('static:gyqHeld', any(r['net'] == 'gz' and r['to'] == 'gyq' and r['line'] == 1 and r['hold'] > 0 for r in rows))
            for r in ex: log('leg', r['net'], r['line'], r['from'], '->', r['to'], 'seq', r['seq'], 'hold', r['hold'], 'old≤', round(OLD_MAX, 1), 'EXTENDED' if r['hold'] > OLD_MAX else 'fits')
            # —— 广州 1 号线：陈家祠上车 ——
            okd = await wait(pg, f"(__game.call(1,1), ({SLOT}||{{}}).state=='dwell')", 90)
            await pg.evaluate(f"(()=>{{const s={SLOT}; s.t=20; s.ann=true; const r=s.train.root.position; __game.teleport(r.x+1.2, r.y+0.02, r.z, Math.PI);}})()")
            ok('gz:aboard', okd and await wait(pg, '__game.state().aboard', 4))
            await pg.evaluate(f'{SLOT}.t=0.5')
            ok('gz:reachXmk', await gz_leg(pg, 'xmk'))
            m = await pg.evaluate('__game.state().metro'); L = m['lastLeg']
            ok('gz:normalLegUnchanged', L and L['hold'] == 0 and L['cruise'] <= 14.3, L)
            ok('gz:reachGyq', await gz_leg(pg, 'gyq'))
            m = await pg.evaluate('__game.state().metro'); L = m['lastLeg']; a = await audio_log(pg)
            hold = next(r['hold'] for r in rows if r['net'] == 'gz' and r['line'] == 1 and r['from'] == 'xmk' and r['to'] == 'gyq')
            ok('gz:gyqLegHeld', L and L['hold'] > 0 and abs(L['hold'] - hold) < 0.05 and L['total'] >= L['hold'] - 0.05, L)
            ids = [f'voice.visit.gyq.{l}' for l in ('zh', 'yue', 'en')]
            ok('gz:gyqVisitDone', all(i in a['done'] for i in ids) and not any(i in a['cut'] for i in ids), {'done': a['done'][-8:], 'cut': a['cut']})
            # —— 厦门 1 号线：文灶上车 ——
            await pg.evaluate("""(() => { const g=__game; g.east.ensure(); g.east.side='xm'; g.east.cur={st:g.station, loc:'xmmetro', area:'metro'}; g.station.kit.root.setEnabled(false); g.xmMetro.enterFromRailway(g.player); })()""")
            await asyncio.sleep(1.5)
            await pg.evaluate("__game.xmMetro.buildStation('wza'); __game.player.spawn(3004, -12.95, 0, -Math.PI/2)"); await asyncio.sleep(1.5)
            ok('xm:board', await xm_board(pg, 1, 1))
            await pg.evaluate('__game.xmMetro.slots.find(o=>o.line===1&&o.step===1).t=0.5')
            XL = "(()=>{const i=__game.xmMetro.info(); return !!(i.lastLeg && i.lastLeg.to=='%s') && i.slots.some(s=>s.line===1&&s.step===1&&s.state==='dwell')})()"
            ok('xm:reachJjc', await wait(pg, XL % 'jjc', 150))
            L = (await pg.evaluate('__game.xmMetro.info()'))['lastLeg']
            ok('xm:normalLegUnchanged', L and L['hold'] == 0 and L['cruise'] <= 14.3, L)
            ok('xm:reachZsp', await wait(pg, XL % 'zsp', 150))
            L = (await pg.evaluate('__game.xmMetro.info()'))['lastLeg']; a = await audio_log(pg)
            ok('xm:zspLegHeld', L and L['hold'] > 0 and L['total'] >= L['hold'] - 0.05, L)
            ids = ['voice.xmvisit.zsp.zh', 'voice.xmvisit.zsp.nan', 'voice.xmvisit.zsp.en']
            ok('xm:zspVisitDone', all(i in a['done'] for i in ids) and not any(i in a['cut'] for i in ids), {'done': a['done'][-8:], 'cut': a['cut']})
            ok('noErrors', not errs(logs), errs(logs)[:5])
        finally:
            await b.close()
    good = all(R['checks'].values())
    json.dump(R, open('/workspace/dwellfix/visit_dwell.json', 'w'), ensure_ascii=False, indent=1)
    print('VISIT_DWELL', 'PASS' if good else 'FAIL', [k for k, v in R['checks'].items() if not v]); sys.exit(0 if good else 1)
asyncio.run(main())
