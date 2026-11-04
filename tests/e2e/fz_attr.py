# 福州地铁景点（第二批：三坊七巷 / 于山白塔 / 上下杭 / 西湖公园；第三批：烟台山 / 鼓山 / 海峡奥体 / 乌山（南门兜 B，键 fznmd_B））：
# 1. 数据：景点出口（fz-visits.js）= 站出口表（fz-exits.js FZ_EXITS[c].n）；报站“下一站……附近有××，请从C出口出站”、下车后“前往××的乘客，请从C出口出站”都念同一个出口；
#    线路图上有景点小图标（g.attr）。
# 2. 逐站步行（autopilot，不传送）：站台 → 楼梯 → 站厅 → 景点出口通道 → 街面（景点街区）→ 沿路走到景点（FZ_ATTR_GOAL 半径内）→ 性能（≤50 draws、≤9 万三角形）
#    → 走回出口亭 → 回站厅。
# 用法：python tests/e2e/fz_attr.py [base-url] [截图目录（可选：给了就存 png + jpg；'-' = 不截图）] [只跑这些键，逗号分隔（可选）]
import asyncio, sys, json, os
sys.path.insert(0, os.path.dirname(__file__))
from common import *
from journey import GCLOCK, auto, wait, log
from perfhud import perf, overlay, overlay_off
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8123/'
OUT = (sys.argv[2].rstrip('/') + '/') if len(sys.argv) > 2 and sys.argv[2] != '-' else None
FO = 5000; FS = 6000; TELEPORT = 2.5
BUDGET = {'draws': 50, 'tris': 90000}
CODES = ['fzdjk', 'fznmd', 'fzdd', 'fzxm', 'fzst', 'fzgs', 'fzdl', 'fznmd_B']   # 景点键 = 站码，或 站码_出口（同站第二个景点出口，见 fz-exits.js more[].attr）
if len(sys.argv) > 3: CODES = sys.argv[3].split(',')
R = {'checks': {}, 'perf': {}, 'area': {}, 'meta': {}, 'info': {}, 'goal': {}}
def ok(k, v): R['checks'][k] = bool(v); log('check', k, bool(v)); return v
JUMP = """window.__jmp===undefined && (window.__jmp={max:0, last:null}, __game.scene.onAfterRenderObservable.add(()=>{ const p=__game.player.position, J=window.__jmp;
  if (J.last) { const d=Math.hypot(p.x-J.last[0], p.y-J.last[1], p.z-J.last[2]); if (d>J.max) J.max=d; } J.last=[p.x,p.y,p.z]; }))"""
async def jreset(pg): await pg.evaluate('window.__jmp.max=0; window.__jmp.last=null')
async def jmax(pg): return (await pg.evaluate('window.__jmp'))['max']
async def walk(pg, pts, leg=14.0):
    s = await st(pg); x, z = s['pos'][0], s['pos'][2]; out = []
    for tx, tz in pts:
        d = ((tx - x) ** 2 + (tz - z) ** 2) ** 0.5; n = max(1, int(d // leg) + 1)
        out += [[x + (tx - x) * k / n, z + (tz - z) * k / n] for k in range(1, n + 1)]; x, z = tx, tz
    return await auto(pg, out, True)
META = """async (codes) => { const V = await import('/js/data/fz-visits.js'), E = await import('/js/data/fz-exits.js'), P = await import('/js/data/phrases.js'),
    L = await import('/js/data/fz-lines.js'), A = await import('/js/world/fzAttr.js'), N = await import('/js/ui/netmap.js');
  const svg = N.fzNetworkSVG('fzfzn', {});
  return codes.map(key => { const c = key.split('_')[0], v = V.FZ_VISITS[c], e = [E.FZ_EXITS[c], ...(E.FZ_EXITS[c].more || [])].find(x => (x.attr || c) === key), s = L.FZ_STATIONS[c], line = s.lines[0], st = L.FZ_LINES[line].stations, i = st.indexOf(c);
    const prev = st[i - 1] || st[i + 1], step = st[i - 1] ? 1 : -1;
    const dep = P.fzDepartSegs(line, c, null, step, false).map(x => x.id + '|' + x.text);
    const vex = v.exits || [v.exit];
    return { key, code: c, visitExit: e && vex.includes(e.n) ? e.n : null, exitN: e && e.n, exitX: e && e.x, exitLine: e && e.line, lines: s.lines, goal: A.FZ_ATTR_GOAL[key] || null, build: !!A.FZ_ATTR_BUILD[key],
      exitSegs: P.fzExitSegs(c).map(x => x.id + '|' + x.text), depart: dep, icon: svg.includes('data-code="' + c + '"') }; }); }"""
async def main():
  if OUT: os.makedirs(OUT, exist_ok=True)
  async with async_playwright() as p:
    b, pg, logs = await open_game(p, BASE + '?q=1')
    await pg.evaluate(GCLOCK); await pg.evaluate(JUMP); await pg.evaluate('__game.setDtMax(0.25)'); await asyncio.sleep(1)
    meta = await pg.evaluate(META, CODES)
    for m in meta:
      c, n = m['key'], m['visitExit']; R['meta'][c] = m
      ok(c + ':exitTable', n and m['exitN'] == n and m['exitLine'] in m['lines'] and m['build'] and m['goal'])
      ok(c + ':exitAnn', any(f'.fzexit.{m["code"]}.zh|' in s and f'请从{n}出口出站' in s for s in m['exitSegs']) and any(f'.fzexit.{m["code"]}.en|' in s and f'Exit {n}' in s for s in m['exitSegs']))
      ok(c + ':nextAnn', any(f'.fzvisit.{m["code"]}.zh|' in s and f'请从{n}出口出站' in s for s in m['depart']) and any(f'.fzvisit.{m["code"]}.en|' in s and f'Exit {n}' in s for s in m['depart']))
      ok(c + ':mapIcon', m['icon'])
    await pg.evaluate("""(() => { const g=__game; g.east.ensure(); g.east.side='fz'; g.east.cur={st:g.station, loc:'fzmetro', area:'metro'}; g.station.kit.root.setEnabled(false); g.fzMetro.enterFromRailway(g.player); })()""")
    await asyncio.sleep(1.5)
    for m in meta:
      c, sc, G = m['key'], m['code'], m['goal']; log('=== attraction', c)
      info = await pg.evaluate(f"""(() => {{ const m=__game.fzMetro; if (m.street) m.backFromStreet(); __game.east.cur.loc='fzmetro'; __game.east.cur.area='metro'; const st=m.buildStation('{sc}');
        const P=st.platforms.find(p=>p.up); return P ? {{ zm:(P.up.z0+P.up.z1)/2 }} : null; }})()""")
      if not ok(c + ':stairsUp', info): continue
      zm = info['zm']; ex_x = m['exitX']
      await pg.evaluate(f"__game.player.spawn({FO}+2, -12.95, {zm}, -Math.PI/2)"); await asyncio.sleep(1); await jreset(pg)
      await auto(pg, [[FO - 3, zm], [FO - 12, zm]], True); await auto(pg, [[FO - 21.5, zm]], True); await auto(pg, [[FO - 22, -6], [FO - 15, -12]], True)
      s = await st(pg); ok(c + ':concourse', s['zone'] == 'concourse')
      await auto(pg, [[FO + ex_x, -16]], True); await auto(pg, [[FO + ex_x, -20], [FO + ex_x, -36]], True)
      if not await pg.evaluate("!!__game.fzMetro.street"):   # 慢机器上 autopilot 一段可能没走完：接着往出口外走
        s = await st(pg); log('retry exit walk', s['pos']); await auto(pg, [[FO + ex_x, s['pos'][2] - 6], [FO + ex_x, -36]], True)
      s = await st(pg); street = await pg.evaluate("__game.fzMetro.street ? __game.fzMetro.street.info() : null"); R['info'][c] = street
      skey = await pg.evaluate("__game.fzMetro.street ? __game.fzMetro.street.key : null")
      ok(c + ':street', street and street['code'] == sc and skey == c and s['zone'] == 'street')   # 出口亭上街 = 换区（FO → FS），本来就是一跳
      if not street: continue
      ok(c + ':atlas', street['atlasOverflow'] == 0)
      # 出口亭外：回头先看一眼街口（亭子 + 出口字母）
      await jreset(pg)
      path = [[FS + x, z] for x, z in (G.get('path') or [[G['x'], G['z']]])]
      await walk(pg, [[FS, 4]] + path)
      s = await st(pg); d = ((s['pos'][0] - FS - G['x']) ** 2 + (s['pos'][2] - G['z']) ** 2) ** 0.5; R['goal'][c] = {'pos': s['pos'], 'd': round(d, 2)}
      ok(c + ':reachedAttraction', d <= G['r'] and abs(s['pos'][1]) < 1.5 and await jmax(pg) < TELEPORT and await pg.evaluate("!!__game.fzMetro.street"))
      # 景点镜头：从景点前退几步看过去（第一人称）
      await pg.evaluate("if (__game.player.view!=='first') __game.toggleView()")
      V = G.get('view')   # 景点镜头：走到以后，换到能看全景点的机位拍（只为截图；到达判定在上面）
      if V and OUT: await pg.evaluate(f"__game.player.spawn({FS + V[0]}, 0.05, {V[1]}, {V[2]})"); await asyncio.sleep(0.6)
      await pg.evaluate(f"__game.player.yaw = {V[2] if V and OUT else 0}; __game.player.pitch = {V[3] if V and OUT else 0.06}")
      await asyncio.sleep(1.2)
      d = await perf(pg, 4, 0.25); R['perf'][c] = d; log('perf', c, d)
      R['area'][c] = await pg.evaluate("() => __game.scene.meshes.filter(m => m.isEnabled() && m.isVisible && m.getTotalIndices).reduce((t, m) => t + m.getTotalIndices() / 3 * (m.instances ? 1 + m.instances.length : 1), 0)")
      ok(c + ':budget', d['draws'] <= BUDGET['draws'] and d['tris'] <= BUDGET['tris'] and R['area'][c] <= BUDGET['tris'])
      if OUT:
        await overlay(pg, d, c); await safe_shot(pg, path=f'{OUT}fz-attr-{c}.png', timeout=180000); await overlay_off(pg)
        try:
          from PIL import Image
          Image.open(f'{OUT}fz-attr-{c}.png').convert('RGB').save(f'{OUT}fz-attr-{c}.jpg', quality=88)
        except Exception as e: log('jpg', e)
        # 回头看街区（从景点看回出口方向）
        if G.get('back'):   # 景点自定义的回头镜头（站在桥上 / 空地上看回街区）
          B = G['back']; await pg.evaluate(f"__game.player.spawn({FS + B[0]}, 0.2, {B[1]}, {B[2]})"); await asyncio.sleep(1.0)
          await pg.evaluate(f"__game.player.yaw = {B[2]}; __game.player.pitch = {B[3]}"); await asyncio.sleep(1.0)
        else:
          await pg.evaluate("__game.player.yaw = Math.PI; __game.player.pitch = 0.02"); await asyncio.sleep(1.0)
        d2 = await perf(pg, 3, 0.25); R['perf'][c + '-back'] = d2
        ok(c + ':budgetBack', d2['draws'] <= BUDGET['draws'] and d2['tris'] <= BUDGET['tris'])
        await overlay(pg, d2, c + ' (back)'); await safe_shot(pg, path=f'{OUT}fz-attr-{c}-back.png', timeout=180000); await overlay_off(pg)
        try:
          from PIL import Image
          Image.open(f'{OUT}fz-attr-{c}-back.png').convert('RGB').save(f'{OUT}fz-attr-{c}-back.jpg', quality=88)
        except Exception as e: log('jpg', e)
      await pg.evaluate("if (__game.player.view!=='third') __game.toggleView()")
      if V and OUT: await pg.evaluate(f"__game.player.spawn({FS + G['x']}, 0.05, {G['z']}, Math.PI)"); await asyncio.sleep(0.6); await jreset(pg)
      # 原路走回出口亭 → 回站厅
      await jreset(pg)
      await walk(pg, list(reversed(path[:-1])) + [[FS, 4], [FS, -4]]); await asyncio.sleep(0.5)
      s = await st(pg); back = not await pg.evaluate("!!__game.fzMetro.street")
      ok(c + ':back', back and abs(s['pos'][0] - FO - ex_x) < 2.5 and s['pos'][2] < -33)
      await jreset(pg)
      await auto(pg, [[FO + ex_x, -20], [FO + ex_x, -15]], True)
      s = await st(pg); ok(c + ':backConcourse', s['zone'] == 'concourse' and abs(s['pos'][1] + 6.5) < 0.3 and await jmax(pg) < TELEPORT)
    R['errors'] = errs(logs); await b.close()
  R['overBudget'] = [k for k, v in R['perf'].items() if v['draws'] > BUDGET['draws'] or v['tris'] > BUDGET['tris']]
  good = all(R['checks'].values()) and not R['errors'] and not R['overBudget']
  print(json.dumps(R, ensure_ascii=False, indent=1, default=str))
  print('FZ_ATTR', 'PASS' if good else 'FAIL', [k for k, v in R['checks'].items() if not v], R['overBudget'], flush=True)
  if not good: sys.exit(1)
if __name__ == "__main__": asyncio.run(main())
