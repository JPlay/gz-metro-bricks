# 福州地铁下车出口广播不被关门切断（同 #17 visit_dwell.py 的思路，作用在“下车后的停站”上）：
#   南门兜（L1）、东街口（L1）、鼓山（L2）、东岭（L5）：上一站上车 → 坐一站 → 开门后走出车门 → 出口广播（“前往××的乘客，请从×出口出站”）开始播
#   检查：出口广播各片段都播完、没被“车门即将关闭”（interrupt）掐掉；车门开始关闭的时刻 ≥ 广播播完 + 1.5 s（墙钟，和音频同一个钟）；
#         车停在上一站时已预载这一站的出口广播（preload.exitIds）。
#   普通站（无出口广播）：exitWait 为空，下车后到关门 = 3.5 s 游戏时间（停站时长不变）。
# 用法：python tests/e2e/fz_exit_dwell.py [base-url] [站代码,逗号分隔（可选）]
import asyncio, sys, json, os, time
sys.path.insert(0, os.path.dirname(__file__))
from common import *
from journey import GCLOCK, gt, auto, wait, log
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8123/'
ONLY = [c for c in (sys.argv[2].split(',') if len(sys.argv) > 2 else []) if c]
OUT = os.environ.get('OUT', '/workspace/fzlogs/fix1/fz_exit_dwell.json')
FO = 5000
R = {'checks': {}, 'stations': {}}
def ok(name, v, info=None):
    R['checks'][name] = bool(v); log('check', name, bool(v), '' if info is None else json.dumps(info, ensure_ascii=False, default=str)[:400]); return v
CASES = [('fznmd', 1), ('fzdjk', 1), ('fzgs', 2), ('fzdl', 5), ('NORMAL', 1)]
SLOT = "__game.fzMetro.slots.find(o=>o.line===%d&&o.step===%d)"
PLAN = """(async (code, line) => {
  const L = await import('/js/data/fz-lines.js'), P = await import('/js/data/phrases.js');
  const st = L.FZ_LINES[line].stations;
  if (code === 'NORMAL') { // 1 号线上第一个前后两站都没有出口广播的中间站
    for (let i = 1; i < st.length - 1; i++) if (!P.fzExitSegs(st[i]).length && !P.fzExitSegs(st[i - 1]).length && st[i - 1] !== 'fzfzn') return { prev: st[i - 1], code: st[i], step: L.fzNext(line, st[i - 1], 1) === st[i] ? 1 : -1, segs: [] };
  }
  const i = st.indexOf(code);
  for (const step of [1, -1]) { const prev = st[i - step]; if (prev && L.fzNext(line, prev, step) === code && L.fzNext(line, code, step)) return { prev, code, step, segs: P.fzExitSegs(code).map(s => s.id).filter(id => /\\.(zh|en)$/.test(id)) }; }
  return null;
})"""
async def geo(pg, line, step):
    return await pg.evaluate(f"(() => {{ const s={SLOT % (line, step)}; return s ? {{trackZ:s.side.trackZ, zc:s.P.zc, y:s.P.y}} : null; }})()")
async def case(pg, code, line):
    plan = await pg.evaluate(f"({PLAN})({json.dumps(code)}, {line})"); r = R['stations'][code] = {'plan': plan}
    if not ok(f'{code}:plan', plan): return
    tgt, step = plan['code'], plan['step']
    await pg.evaluate(f"void __game.fzMetro.buildStation('{plan['prev']}')"); await asyncio.sleep(1)
    g = await geo(pg, line, step)
    if not ok(f'{code}:slot', g): return
    sg = 1 if g['zc'] > g['trackZ'] else -1
    await pg.evaluate(f"void __game.player.spawn({FO}, {g['y']}+0.05, {g['trackZ'] + sg * 2.2}, 0)"); await asyncio.sleep(0.5)
    await pg.evaluate(f"void __game.fzMetro.call({line},{step})")
    ok(f'{code}:trainCame', await wait(pg, f"(({SLOT % (line, step)})||{{}}).state==='dwell'", 120))
    await pg.evaluate(f"(() => {{ const s={SLOT % (line, step)}; s.t=20; s.ann=true; }})()")
    await auto(pg, [[FO, g['trackZ'] + sg * 0.4]])
    ok(f'{code}:aboard', await wait(pg, '__game.state().aboard', 8))
    await asyncio.sleep(1)
    pre = await pg.evaluate('__game.fzMetro.info().preload')
    r['preload'] = pre
    if plan['segs']: ok(f'{code}:exitPreloadedAtPrev', pre and pre.get('next') == tgt and all(i in (pre.get('exitIds') or []) for i in plan['segs']), pre)
    await pg.evaluate(f"(() => {{ const s={SLOT % (line, step)}; s.t=0.3; }})()")   # 上一站：照常关门开车（只把这一站的停站计时提前，行车 / 目标站停站不动）
    ok(f'{code}:arrived', await wait(pg, f"(() => {{ const m=__game.fzMetro, s={SLOT % (line, step)}; return m.code==='{tgt}' && s && s.state==='dwell' && __game.state().aboard; }})()", 200))
    # 走出车门：记录下车那一刻（游戏钟 + 墙钟）和之后每个状态切换
    await pg.evaluate(f"""(() => {{ const m=__game.fzMetro, s={SLOT % (line, step)}; window.__ed={{offG:null, offW:null, closeG:null, closeW:null, annW:null, st:[]}};
      const E=window.__ed; let last=null, lastAnn=!!s.ann; window.__gt3=window.__gt3||0;
      window.__edObs=__game.scene.onAfterRenderObservable.add(() => {{ window.__gt3 += Math.min(0.25, __game.engine.getDeltaTime()/1000); const ab=__game.state().aboard;
        if (E.offG===null && !ab) {{ E.offG=window.__gt3; E.offW=performance.now(); }}
        if (s.ann && !lastAnn && E.offG!==null) {{ E.annW=performance.now(); E.annG=window.__gt3; }} lastAnn=!!s.ann;
        if (s.state!==last) {{ last=s.state; E.st.push([s.state, +window.__gt3.toFixed(2), Math.round(performance.now())]); if (s.state==='closing' && E.closeG===null) {{ E.closeG=window.__gt3; E.closeW=performance.now(); }} }} }}); }})()""")
    await auto(pg, [[FO, g['trackZ'] + sg * 0.4], [FO, g['trackZ'] + sg * 3.6]])
    ok(f'{code}:alighted', await wait(pg, '!__game.state().aboard && !__game.fzMetro.ride', 10))
    ok(f'{code}:doorsClosed', await wait(pg, "window.__ed.closeG!==null", 60))
    e = await pg.evaluate('window.__ed'); info = await pg.evaluate('__game.fzMetro.info()'); a = await pg.evaluate('__game.Audio.getState().log')
    await pg.evaluate('void __game.scene.onAfterRenderObservable.remove(window.__edObs)')
    lx = info.get('lastExit'); r.update({'timing': e, 'lastExit': lx, 'done': [i for i in a['done'] if '.fzexit.' in i], 'cut': a['cut'][-10:], 'doneTail': a['done'][-12:]})
    gapG = round(e['closeG'] - e['offG'], 2)
    if plan['segs']:
        done_all = all(i in a['done'] for i in plan['segs']) and not any(i in a['cut'] for i in plan['segs'])
        ok(f'{code}:exitLineDoneNotCut', done_all, {'done': r['done'], 'cut': a['cut'][-6:]})
        ok(f'{code}:closeAfterDonePlus1.5', bool(lx) and lx.get('doneAt') is not None and lx['closeAt'] >= lx['doneAt'] + 1500, lx)
        # 关门提示（interrupt）若播了，必须在出口广播播完之后（没播也算过：不会掐掉出口广播）
        ok(f'{code}:closingChimeNotBeforeDone', bool(lx) and (e['annW'] is None or (e['annW'] - (e['offW'])) >= lx['doneAt'] - 50), {'annAfterOffMs': None if e['annW'] is None else round(e['annW'] - e['offW']), 'doneAt': lx and lx.get('doneAt')})
        r['summary'] = {'dur_s': lx and lx['dur'], 'doneAt_ms': lx and lx['doneAt'], 'closeAt_ms': lx and lx['closeAt'], 'offToCloseGame_s': gapG}
    else:
        ok(f'{code}:noExitWait', not lx or lx.get('code') != tgt, lx)
        ok(f'{code}:dwellUnchanged3.5', 3.2 <= gapG <= 3.5 + 0.3, gapG)
        r['summary'] = {'offToCloseGame_s': gapG}
    log('SUMMARY', code, tgt, json.dumps(r['summary'], ensure_ascii=False))
async def main():
    async with async_playwright() as p:
        b, pg, logs = await open_game(p, BASE + '?q=1')
        try:
            await pg.evaluate(GCLOCK); await pg.evaluate('__game.setDtMax(0.25)'); await asyncio.sleep(1)
            await pg.evaluate("""(() => { const g=__game; g.east.ensure(); g.east.side='fz'; g.east.cur={st:g.station, loc:'fzmetro', area:'metro'}; g.station.kit.root.setEnabled(false); g.fzMetro.enterFromRailway(g.player); })()""")  # 返回 undefined
            await asyncio.sleep(1.5)
            for code, line in CASES:
                if ONLY and code not in ONLY: continue
                log('=== case', code, line); await case(pg, code, line)
            R['errors'] = errs(logs)[:10]; ok('noErrors', not R['errors'], R['errors'])
        finally:
            await b.close()
    json.dump(R, open(OUT, 'w'), ensure_ascii=False, indent=1, default=str)
    good = all(R['checks'].values())
    print('FZ_EXIT_DWELL', 'PASS' if good else 'FAIL', [k for k, v in R['checks'].items() if not v], flush=True); sys.exit(0 if good else 1)
asyncio.run(main())
