# 2D d_dadao：达道 C 口 → 上下杭老街（景点街区，走路不传送）→ 三捷河边 → 三通桥 → 对岸：河名牌「三捷河 / Sanjie River」、码头牌「三捷河码头 / Sanjie River Pier」正面拍、
# 展示船（缆绳系在系船桩上，靠近也没有上船提示）、三通桥；性能 ≤ 50 draws / 9 万三角形；无页面错误；再走回出口亭进站。
# 用法：python tests/e2e/fz_dadao.py [base-url] [截图目录 | -]
import asyncio, sys, json, os, time, math
sys.path.insert(0, os.path.dirname(__file__))
from common import *
from journey import GCLOCK, auto, wait, log
from perfhud import perf
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8123/'
OUT = (sys.argv[2].rstrip('/') + '/') if len(sys.argv) > 2 and sys.argv[2] != '-' else None
FO = 5000; FS = 6000; TELEPORT = 2.5; BUDGET = {'draws': 50, 'tris': 90000}
R = {'checks': {}, 'perf': {}, 'shots': [], 'walk': []}
def ok(k, v, info=None): R['checks'][k] = bool(v); log('check', k, bool(v), '' if v or info is None else json.dumps(info, ensure_ascii=False, default=str)[:300]); return v
JUMP = """window.__jmp===undefined && (window.__jmp={max:0, last:null}, __game.scene.onAfterRenderObservable.add(()=>{ const p=__game.player.position, J=window.__jmp;
  if (J.last) { const d=Math.hypot(p.x-J.last[0], p.y-J.last[1], p.z-J.last[2]); if (d>J.max) J.max=d; } J.last=[p.x,p.y,p.z]; }))"""
async def jreset(pg): await pg.evaluate('window.__jmp.max=0; window.__jmp.last=null')
async def jmax(pg): return (await pg.evaluate('window.__jmp'))['max']
async def walk(pg, pts, label, leg=8.0):
    s = await st(pg); x, z = s['pos'][0], s['pos'][2]; out = []
    for tx, tz in pts:
        tx += FS; d = math.hypot(tx - x, tz - z); n = max(1, int(d // leg) + 1)
        out += [[x + (tx - x) * k / n, z + (tz - z) * k / n] for k in range(1, n + 1)]; x, z = tx, tz
    await jreset(pg); r = await auto(pg, out, True); s = await st(pg); j = await jmax(pg)
    good = r and math.hypot(s['pos'][0] - x, s['pos'][2] - z) < 1.2 and j < TELEPORT and abs(s['pos'][1]) < 1.5
    R['walk'].append([label, good, round(j, 2), s['pos']]); return ok('walk:' + label, good, [s['pos'], j])
async def look(pg, x, z, pitch=0.05):
    s = await st(pg); await pg.evaluate(f"__game.player.yaw = Math.atan2({FS + x - s['pos'][0]}, {z - s['pos'][2]}); __game.player.pitch = {pitch}"); await asyncio.sleep(0.9)
async def shot(pg, name):
    if not OUT: return
    p = OUT + name + '.jpg'
    if await safe_shot(pg, path=p, type='jpeg', quality=72): R['shots'].append(p); log('shot', p)
async def sample(pg, label): d = await perf(pg, 3, 0.3); R['perf'][label] = d; return d
PROMPT = """(() => { const vis = el => { const r = el.getBoundingClientRect(), c = getComputedStyle(el); return r.width > 0 && r.height > 0 && c.display !== 'none' && c.visibility !== 'hidden' && !el.hidden; };
  return [...document.querySelectorAll('button, .prompt, .tip, [role=button]')].filter(vis).map(e => e.textContent.trim()).filter(t => /上船|登船|Board|乘船/.test(t)); })()"""
async def main():
  if OUT: os.makedirs(OUT, exist_ok=True)
  T0 = time.time()
  async with async_playwright() as p:
    b, pg, logs = await open_game(p, BASE + '?q=1')
    await pg.evaluate(GCLOCK); await pg.evaluate(JUMP); await pg.evaluate('__game.setDtMax(0.25)'); await asyncio.sleep(1)
    await pg.evaluate("""(() => { const g=__game; g.east.ensure(); g.east.side='fz'; g.east.cur={st:g.station, loc:'fzmetro', area:'metro'}; g.station.kit.root.setEnabled(false); g.fzMetro.enterFromRailway(g.player); })()""")
    await asyncio.sleep(1.5)
    ex = await pg.evaluate("(async () => { const E = await import('/js/data/fz-exits.js'); return E.FZ_EXITS.fzdd; })()")
    info = await pg.evaluate("""(() => { const m=__game.fzMetro; __game.east.cur.loc='fzmetro'; __game.east.cur.area='metro'; const st=m.buildStation('fzdd'); const P=st.platforms.find(p=>p.up); return P ? { zm:(P.up.z0+P.up.z1)/2 } : null; })()""")
    zm = info['zm']; await pg.evaluate(f"__game.player.spawn({FO}+2, -12.95, {zm}, -Math.PI/2)"); await asyncio.sleep(1)
    await auto(pg, [[FO - 3, zm], [FO - 12, zm]], True); await auto(pg, [[FO - 21.5, zm]], True); await auto(pg, [[FO - 22, -6], [FO - 15, -12]], True)
    s = await st(pg); ok('fzdd:concourse', s['zone'] == 'concourse', s['zone'])
    exx = ex['x']; await auto(pg, [[FO + exx, -16]], True); await auto(pg, [[FO + exx, -20], [FO + exx, -36]], True)
    if not await pg.evaluate('!!__game.fzMetro.street'): s = await st(pg); await auto(pg, [[FO + exx, s['pos'][2] - 6], [FO + exx, -36]], True)
    key = await pg.evaluate('__game.fzMetro.street ? __game.fzMetro.street.key : null'); ok('fzdd:C:street 上下杭', key == 'fzdd', key)
    sp = (await st(pg))['pos']; R['spawn'] = sp; await asyncio.sleep(1.0)
    R['perf']['street'] = await sample(pg, 'street')
    # 老街 → 三捷河边（三通桥南头）
    await walk(pg, [[0, 14], [0, 30], [0, 41.5]], '出口 → 老街 → 三捷河边')
    R['perf']['river'] = await sample(pg, 'river')
    FP = "if (__game.player.view !== 'first') __game.toggleView()"; TP = "if (__game.player.view !== 'third') __game.toggleView()"
    if OUT: await pg.evaluate(FP)   # 截图都用第一人称（第三人称时角色 / 相机贴墙会挡住牌子）
    if OUT:
        await look(pg, -17.5, 43.05, 0.05); await shot(pg, 'dadao_river_name_board_from_street_end')
        await look(pg, 16, 43.05, 0.05); await shot(pg, 'dadao_pier_board_from_street_end')
        await look(pg, 0, 50, 0.1); await shot(pg, 'dadao_santong_bridge_front')
    # 上三通桥 → 对岸
    await walk(pg, [[0, 50], [0, 57.6]], '三通桥 → 对岸')
    if OUT:
        await look(pg, 0, 44, 0.0); await shot(pg, 'dadao_from_far_bank_back_to_street')
    await walk(pg, [[-17.5, 57.6]], '对岸 → 河名牌正对面')
    if OUT: await look(pg, -17.5, 43.05, -0.02); await shot(pg, 'dadao_river_name_board_front_sanjie')
    await walk(pg, [[0, 57.6], [16, 57.6]], '对岸 → 码头牌正对面')
    R['perf']['pier'] = await sample(pg, 'pier')
    pr = await pg.evaluate(PROMPT); ok('boats:no tap-to-board prompt near the moored boats', not pr, pr)
    if OUT:
        await look(pg, 16, 43.05, -0.02); await shot(pg, 'dadao_pier_board_front_sanjie_pier')
        await look(pg, 32.5, 46.2, 0.22); await shot(pg, 'dadao_moored_boats_ropes')
    await walk(pg, [[30, 57.6]], '对岸 → 展示船正对面')
    pr = await pg.evaluate(PROMPT); ok('boats:no prompt right across the boats', not pr, pr)
    if OUT: await look(pg, 32.5, 46.2, 0.32); await shot(pg, 'dadao_moored_boats_close')
    if OUT: await pg.evaluate(TP)
    # 回出口亭进站
    await walk(pg, [[0, 57.6], [0, 50], [0, 41.5], [0, 14]], '对岸 → 三通桥 → 老街')
    await jreset(pg); await auto(pg, [[FS, 4], [FS, -4]], True); await asyncio.sleep(0.5)
    s = await st(pg); ok('fzdd:walkBackIntoStation', not await pg.evaluate('!!__game.fzMetro.street') and abs(s['pos'][0] - FO - exx) < 2.5 and s['pos'][2] < -33, s['pos'])
    R['perfWorst'] = max(R['perf'].items(), key=lambda kv: kv[1]['tris']) if R['perf'] else None
    ok('perf:budget', all(v['draws'] <= BUDGET['draws'] and v['tris'] <= BUDGET['tris'] for v in R['perf'].values()), R['perf'])
    R['errors'] = [l for l in errs(logs) if l[0] in ('error', 'pageerror')]; ok('noPageErrors', not R['errors'], R['errors'][:5])
    await b.close()
  R['secs'] = round(time.time() - T0); good = all(R['checks'].values())
  print(json.dumps(R, ensure_ascii=False, indent=1, default=str)); print('FZ_DADAO', 'PASS' if good else 'FAIL', [k for k, v in R['checks'].items() if not v], flush=True)
  if not good: sys.exit(1)
asyncio.run(main())
