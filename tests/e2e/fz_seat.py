# 福州地铁车厢坐下 / 起身（1 号线、5 号线各一次）：python3 tests/e2e/fz_seat.py <url> [截图目录]
# 检查：福州火车南站进车厢 → 靠近空座出现「坐下」→ 坐下髋部贴座垫、第一人称眼高降低
# → 关门开车到下一站仍坐着 → 「起身」站起来。与厦门 xm_seat.py 同一套 SeatCtl。G3028 动车上坐下在 fz.py 里测。
import asyncio, sys, os, json, time
sys.path.insert(0, os.path.dirname(__file__))
from common import *
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8231/?q=2'
OUT = (sys.argv[2] if len(sys.argv) > 2 else '/workspace/fzlogs/sit/').rstrip('/') + '/'
os.makedirs(OUT, exist_ok=True)
R = {}
T0 = time.time()
def log(*a): print(f'[{time.time() - T0:6.1f}s]', *a, flush=True)
async def shot(pg, name):
    await safe_shot(pg, path=OUT + name + '.png', timeout=180000); log('shot', name)
async def tap(pg, sel):
    box = await pg.locator(sel).first.bounding_box()
    await pg.touchscreen.tap(box['x'] + box['width'] / 2, box['y'] + box['height'] / 2)
async def gwait(pg, js, game=90, wall=2400):
    g0 = await pg.evaluate('window.__gt||0'); t0 = time.time()
    while time.time() - t0 < wall:
        if await pg.evaluate(js): return True
        if await pg.evaluate('window.__gt||0') - g0 > game: return False
        await asyncio.sleep(0.5)
    return False
async def until(pg, js, t=120):
    for _ in range(int(t / 0.25)):
        if await pg.evaluate(js): return True
        await asyncio.sleep(0.25)
    return False
FO = 5000
async def ride(pg, line, step):
    SLOT = f"__game.fzMetro.slots.find(s=>s.line=={line}&&s.step=={step})"; r = {}; tag = f'L{line}'
    await pg.evaluate(f"""(() => {{
      const e=__game.east; e.ensure(); e.side='fz'; e.cur={{st:__game.station, loc:'fzmetro', area:'metro'}};
      __game.station.kit.root.setEnabled(false);
      __game.fzMetro.buildStation('fzfzn');
      const P=__game.fzMetro.station.platforms.find(p=>p.line=={line});
      __game.player.spawn({FO}+10, P.y+0.05, P.zc+({step}>0?2:-2), Math.PI/2);
    }})()""")
    await asyncio.sleep(1.5)
    r['code'] = await pg.evaluate('__game.fzMetro.code')
    for _ in range(600):
        await pg.evaluate(f'__game.call({line},{step})')
        if await pg.evaluate(SLOT + " && " + SLOT + ".state=='dwell'"): break
        await asyncio.sleep(0.5)
    log(tag, 'train dwell', await pg.evaluate(SLOT + ' && ' + SLOT + '.state'))
    await pg.evaluate(SLOT + '.t = 1e4')
    seat = await pg.evaluate(f"""(()=>{{const t={SLOT}.train, r=t.root.position;
      const s=t.seats.filter(s=>s.free&&s.sd<0).sort((a,b)=>Math.abs(a.x-1.2)-Math.abs(b.x-1.2))[0];
      if(!s) return null;
      __game.teleport(r.x+s.x, r.y+0.02, r.z+s.sd*0.62, Math.PI);
      return {{x:s.x, sd:s.sd, n:t.seats.length}};}})()""")
    r['seat'] = seat; await asyncio.sleep(0.8)
    r['actSit'] = await until(pg, "(__game.state().act||{}).id=='sit'", 20)
    if r['actSit']:
        await tap(pg, '#bAct'); await until(pg, '__game.state().seat.seated', 10)
    g = await pg.evaluate(f"""(()=>{{const pl=__game.player, t={SLOT}.train, r=t.root.position, s=pl.seat&&pl.seat.seat;
      if(!s) return null;
      return {{hipAboveFloor: +(pl.position.y + pl.hipH() - r.y).toFixed(3), dz: +(pl.position.z-r.z).toFixed(3)}};}})()""")
    r['hip'] = g
    r['hipOnCushion'] = bool(g) and abs(g['hipAboveFloor'] - 0.55) < 0.02 and abs(abs(g['dz']) - 1.2) < 0.05
    await pg.evaluate('__game.player.yaw=Math.PI/2+0.5; __game.player.pitch=0.22; __game.player.dist=3.0'); await asyncio.sleep(1.2)
    await shot(pg, f'fz-seat-{tag}-sitting')
    await pg.evaluate('__game.toggleView()'); await pg.evaluate('__game.player.yaw=__game.player.facing-0.2; __game.player.pitch=-0.24'); await asyncio.sleep(1.2)
    s = await st(pg); ty = await pg.evaluate(SLOT + '.train.root.position.y')
    r['eyeFirst'] = round(s['camPos'][1] - ty, 2) if s.get('camPos') else None
    await shot(pg, f'fz-seat-{tag}-fp')
    await pg.evaluate(SLOT + '.t = 1')
    r['departed'] = await gwait(pg, "__game.state().fzMetro && __game.state().fzMetro.ride!==null", 40)
    r['seatedWhileMoving'] = await pg.evaluate('__game.state().seat.seated')
    r['arrived'] = await gwait(pg, f"(()=>{{const x=__game.state().fzMetro; return x && x.code!='fzfzn' && !__game.state().inTunnel && (x.slots||[]).some(o=>o.line=={line}&&o.step=={step}&&o.state=='dwell')}})()", 120)
    s = await st(pg); r['arrivedAt'] = (s.get('fzMetro') or {}).get('code'); r['seatedAfterArrive'] = s['seat']['seated']
    log(tag, 'arrived', r['arrived'], r['arrivedAt'])
    if await pg.evaluate('__game.player.view') != 'third': await pg.evaluate('__game.toggleView()')
    r['actStand'] = (await st(pg))['act']
    if r['actStand'] and r['actStand'].get('id') == 'stand':
        await tap(pg, '#bAct'); await asyncio.sleep(0.8)
    s = await st(pg); r['stood'] = not s['seat']['seated'] and s['aboard']
    chk = {f'{tag}:{k}': bool(r.get(k)) for k in ['actSit', 'hipOnCushion', 'departed', 'seatedWhileMoving', 'arrived', 'seatedAfterArrive', 'stood']}
    chk[f'{tag}:eyeLower'] = r.get('eyeFirst') is not None and r['eyeFirst'] < 1.3
    return r, chk
async def main():
  async with async_playwright() as p:
    b, pg, logs = await open_game(p, URL)
    await asyncio.sleep(1.5); await pg.touchscreen.tap(1112 * 0.7, 834 * 0.4)
    await pg.evaluate("window.__gt===undefined && (window.__gt=0, __game.scene.onBeforeRenderObservable.add(()=>{ window.__gt += Math.min(0.25, __game.engine.getDeltaTime()/1000); }))")
    await pg.evaluate('__game.setDtMax(0.25)'); log('loaded')
    chk = {}
    for line, step in [(1, 1), (5, -1)]:
        r, c = await ride(pg, line, step); R[f'L{line}'] = r; chk.update(c)
    R['errors'] = errs(logs)
    print(json.dumps(R, ensure_ascii=False, indent=1, default=str))
    chk['noErrors'] = not R['errors']
    print('CHECKS', chk, 'PASS' if all(chk.values()) else 'FAIL', flush=True)
    await b.close()
    if not all(chk.values()): sys.exit(1)
asyncio.run(main())
