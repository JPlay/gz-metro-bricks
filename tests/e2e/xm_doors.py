# 厦门地铁车门朝向 + 楼梯回归：
# 1. 厦门北：从国铁出站层地铁闸机步行（不传送）→ 楼梯 → 换乘通道 → 1 号线站台；
#    两侧自然进站的列车，开的是朝站台那侧的门（外侧门关着），从开着的门走进车厢。
# 2. 原路步行回国铁地铁站厅（不传送），地铁站拆掉、回到国铁出站层。
# 3. 普通站（江头，岛式）：站台 ↔ 站厅楼梯步行上下；镇海路（侧式）、吕厝 2 号线：开门朝站台。
# 4. 存档恢复在厦门北站台：开门仍朝站台。
# “不传送”：每帧记录玩家位置的最大跳变，> 2.5 m 算传送（2–4 fps 下走路一帧 < 1 m）。
# 用法：python tests/e2e/xm_doors.py [base-url] [截图目录]
import asyncio, sys, json, os
sys.path.insert(0, os.path.dirname(__file__))
from common import *
from journey import GCLOCK, auto, wait, log
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8123/'
OUT = (sys.argv[2] if len(sys.argv) > 2 else '/tmp/xm_doors/').rstrip('/') + '/'
os.makedirs(OUT, exist_ok=True)
XO = 3000; TELEPORT = 2.5
R = {'checks': {}, 'doors': {}, 'jumps': {}}
def ok(name, v): R['checks'][name] = bool(v); log('check', name, bool(v)); return v
JUMP = """window.__jmp===undefined && (window.__jmp={max:0, at:null, last:null}, __game.scene.onAfterRenderObservable.add(()=>{ const p=__game.player.position, J=window.__jmp;
  if (J.last) { const d=Math.hypot(p.x-J.last[0], p.y-J.last[1], p.z-J.last[2]); if (d>J.max) { J.max=d; J.at=[J.last, [p.x,p.y,p.z]]; } } J.last=[p.x,p.y,p.z]; }))"""
async def jreset(pg): await pg.evaluate('window.__jmp.max=0; window.__jmp.at=null; window.__jmp.last=null')
async def jcheck(pg, name):
    j = await pg.evaluate('window.__jmp'); R['jumps'][name] = j; return ok('noTeleport:' + name, j['max'] < TELEPORT)
DOORS = """(key => { const m=__game.xmMetro, sl=m.slots.find(s=>s.side.key===key && (%s)); if(!sl) return null; const tr=sl.train;
  const platSg = Math.sign(sl.P.zc - sl.side.trackZ);   // 列车局部哪一侧（±z）朝站台
  return {line:sl.line, state:sl.state, platSg, doorSg:sl.side.doorSg, openPlat: tr.open[platSg], openOuter: tr.open[-platSg],
    x: tr.root.position.x, trackZ: sl.side.trackZ, psdZ: sl.side.psdZ, zc: sl.P.zc}; })"""
async def door_check(pg, name, key, line=None, walk_in=True):
    cond = 'true' if line is None else f's.line==={line}'
    await pg.evaluate(f"__game.xmMetro.slots.forEach(s=>{{ if(s.side.key==='{key}' && ({cond}) && s.state==='away') s.t=0; }})")
    got = await wait(pg, f"(__game.xmMetro.slots.some(s=>s.side.key==='{key}' && ({cond}) && s.state==='dwell' && s.f>=0.99))", 120)
    r = await pg.evaluate((DOORS % cond) + f"('{key}')") if got else None
    R['doors'][name] = r; log('doors', name, r)
    ok('dwell:' + name, got and r)
    if not r: return False
    ok('platformDoorsOpen:' + name, r['openPlat'] >= 0.99 and r['doorSg'] == r['platSg'])
    ok('outerDoorsClosed:' + name, r['openOuter'] == 0)
    if not walk_in: return True
    # 机器 2–4 fps，停站 3.5 s 游戏时间只有几帧：测试期间每帧把这班车的停站倒计时按住（门一直开着），走完再放
    await pg.evaluate(f"""(() => {{ const s=__game.xmMetro.slots.find(s=>s.side.key==='{key}' && ({cond}) && s.state==='dwell'); window.__holdSlot=s;
      if (!window.__holdObs) window.__holdObs=__game.scene.onBeforeRenderObservable.add(()=>{{ const h=window.__holdSlot; if (h && h.state==='dwell') h.t=Math.max(h.t, 3.4); }}); }})()""")
    sg = 1 if r['psdZ'] > r['trackZ'] else -1          # 站台在轨道的哪一侧
    zPlat = r['psdZ'] + sg * 0.8; zCar = r['trackZ']
    await auto(pg, [[r['x'] + 6, zPlat]]); await jreset(pg); await auto(pg, [[r['x'] + 6, zCar]])
    ab = await wait(pg, '__game.state().aboard', 3); ok('walkAboard:' + name, ab); await jcheck(pg, 'board:' + name)
    await pg.screenshot(path=f'{OUT}doors-{name}.png', timeout=180000)
    await auto(pg, [[r['x'] + 6, zPlat]]); ok('walkOff:' + name, not (await st(pg))['aboard'])
    await pg.evaluate('window.__holdSlot=null')
    return ab
async def main():
  async with async_playwright() as p:
    b, pg, logs = await open_game(p, BASE + '?q=1')
    await pg.evaluate(GCLOCK); await pg.evaluate('__game.setDtMax(0.25)'); await asyncio.sleep(1)
    # 起点：国铁出站层的地铁 1 号线闸机外（动车 → 厦门北 → 出站 → 换乘通道走到这里由 xiamen.py 覆盖）
    await pg.evaluate("""(() => { const e=__game.east; e.ensure(); e.side='xm'; e.xmn.show('solo'); __game.station.kit.root.setEnabled(false);
      e.cur={st:__game.station, loc:'xmn', area:'passage'}; __game.player.spawn(2906, -6.45, -79.4, -Math.PI/2); })()""")
    await pg.evaluate(JUMP); await asyncio.sleep(1); await jreset(pg)
    # —— 1. 厦门北：走下去 ——
    await auto(pg, [[XO - 99, -79.4], [XO - 99, -75.8]]); await auto(pg, [[XO - 108.5, -75.8], [XO - 108.5, -80]])
    ok('gatesAndStairTop', (await pg.evaluate('__game.east.info().loc')) == 'xmn')
    await auto(pg, [[XO - 101, -80], [XO - 93, -80]])
    ok('enteredMetroByWalking', await wait(pg, '__game.east.info().loc==="xmmetro" && __game.xmMetro.code==="xmnb"', 6))
    await auto(pg, [[XO - 64, -80]]); await auto(pg, [[XO - 36, -80], [XO - 20, -78.5]])
    s = await st(pg); ok('xmnbPlatformByWalking', s['zone'] == 'platform' and abs(s['pos'][1] + 13) < 0.3)
    await jcheck(pg, 'xmnbDown')
    for key in ('B', 'A'): await door_check(pg, 'xmnb-' + key, key)
    # —— 2. 走回国铁 ——
    # 岛中立柱在 x=-22.5、z=-80（站台中线）上：从 z=-78.5 绕过去再回中线进端墙开口
    await auto(pg, [[XO - 20, -78.5], [XO - 31, -78.5]]); await auto(pg, [[XO - 36, -80]]); await jreset(pg)
    await auto(pg, [[XO - 64, -80]]); await auto(pg, [[XO - 93, -80], [XO - 101, -80]]); await auto(pg, [[XO - 108.5, -80]])
    ok('backToRailwayByWalking', await wait(pg, '__game.east.info().loc==="xmn" && !__game.xmMetro.station', 6))
    s = await st(pg); ok('onRailwayConcourse', s['pos'][1] > -6.8 and s['zone'] == 'xmn')
    await auto(pg, [[XO - 108.5, -75.8], [XO - 99, -75.8]]); await auto(pg, [[XO - 99, -79.4], [XO - 92, -79.4]])
    s = await st(pg); ok('outThroughGates', s['pos'][0] > XO - 95 and s['pos'][1] > -6.8 and (await pg.evaluate('__game.east.info().loc')) == 'xmn')
    await jcheck(pg, 'xmnbUp')
    # —— 3. 江头（岛式）：站台 ↔ 站厅；开门方向 ——
    await pg.evaluate("""(() => { const e=__game.east; e.cur.loc='xmmetro'; e.cur.area='metro'; __game.xmMetro.buildStation('jtou');
      __game.player.spawn(3004, -12.95, 3.2, -Math.PI/2); })()""")
    await asyncio.sleep(1.5); await jreset(pg)
    await auto(pg, [[XO - 3, 0], [XO - 12, 0]]); await auto(pg, [[XO - 21.5, 0]]); await auto(pg, [[XO - 22, -6], [XO - 15, -12]])
    s = await st(pg); ok('jtouConcourseByWalking', s['zone'] == 'concourse' and abs(s['pos'][1] + 6.5) < 0.3)
    await auto(pg, [[XO - 22, -6], [XO - 22, 0]]); await auto(pg, [[XO - 10, 0]]); await auto(pg, [[XO + 2, 0], [XO + 2, 3]])
    s = await st(pg); ok('jtouPlatformByWalking', s['zone'] == 'platform' and abs(s['pos'][1] + 13) < 0.3)
    await jcheck(pg, 'jtouUpDown')
    for key in ('A', 'B'): await door_check(pg, 'jtou-' + key, key, walk_in=(key == 'A'))
    # —— 镇海路（侧式，轨在 +z）——
    await pg.evaluate("""(() => { __game.xmMetro.buildStation('zhl'); __game.player.spawn(3004, -12.95, 2, -Math.PI/2); })()""")
    await asyncio.sleep(1.5)
    ok('zhlSideB', await pg.evaluate("Object.keys(__game.xmMetro.station.platforms[0].sides).join()==='B'"))
    await door_check(pg, 'zhl-B', 'B')
    # 侧式站台上楼梯：站台 → 站厅
    await auto(pg, [[XO - 3, 1.7], [XO - 12, 1.7]]); await auto(pg, [[XO - 21.5, 1.7]]); await auto(pg, [[XO - 22, -6], [XO - 15, -12]])
    s = await st(pg); ok('zhlConcourseByWalking', s['zone'] == 'concourse')
    # —— 吕厝 2 号线（下层）——
    await pg.evaluate("""(() => { __game.xmMetro.buildStation('lcu'); const P=__game.xmMetro.station.platformFor(2); __game.player.spawn(3004, P.y+0.05, P.zc+2, -Math.PI/2); })()""")
    await asyncio.sleep(1.5)
    for key in ('A', 'B'): await door_check(pg, 'lcu-L2-' + key, key, line=2, walk_in=False)
    for key in ('A', 'B'): await door_check(pg, 'lcu-L1-' + key, key, line=1, walk_in=False)
    R['errors'] = errs(logs); await b.close()
    # —— 4. 存档恢复在厦门北站台 ——
    b2 = await p.chromium.launch(args=ARGS)
    ctx = await b2.new_context(viewport={'width': 1112, 'height': 834}, device_scale_factor=2, has_touch=True, is_mobile=True)
    await ctx.add_init_script("localStorage.setItem('gzmb.save', JSON.stringify({v:1,city:'xm',code:'xmnb',line:1,platform:true,t:Date.now()}))")
    pg2 = await ctx.new_page(); logs2 = []
    pg2.on('pageerror', lambda e: logs2.append(('pageerror', str(e))))
    await pg2.goto(BASE + '?q=1'); await pg2.wait_for_function('window.__game', timeout=120000)
    await pg2.evaluate(GCLOCK); await pg2.evaluate(JUMP); await pg2.evaluate('__game.setDtMax(0.25)'); await asyncio.sleep(1)
    ok('resumeXmnb', await wait(pg2, '__game.xmMetro && __game.xmMetro.code==="xmnb"', 10))
    await door_check(pg2, 'resume-xmnb-B', 'B')
    R['errors'] += logs2; await b2.close()
    print(json.dumps(R, ensure_ascii=False, indent=1, default=str))
    good = all(R['checks'].values()) and not R['errors']
    print('XM_DOORS', 'PASS' if good else 'FAIL', [k for k, v in R['checks'].items() if not v], flush=True)
    if not good: sys.exit(1)
if __name__ == "__main__": asyncio.run(main())
