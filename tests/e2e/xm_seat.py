# 厦门地铁车厢坐下 / 起身：python3 tests/e2e/xm_seat.py <url> [截图目录]
# 检查：厦门北 1 号线进车厢 → 靠近空座出现「坐下」→ 坐下髋部贴座垫、第一人称眼高降低
# → 关门开车到下一站仍坐着 → 「起身」站起来。与广州 seat.py 同一套 SeatCtl。
import asyncio, sys, os, json, time
sys.path.insert(0, os.path.dirname(__file__))
from common import *
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8191/?q=2'
OUT = (sys.argv[2] if len(sys.argv) > 2 else '/workspace/xmlogs/sit/').rstrip('/') + '/'
os.makedirs(OUT, exist_ok=True)
R = {}
T0 = time.time()
def log(*a): print(f'[{time.time() - T0:6.1f}s]', *a, flush=True)
async def shot(pg, name):
    await pg.screenshot(path=OUT + name + '.png', timeout=180000); log('shot', name)
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
SLOT = "__game.xmMetro.slots.find(s=>s.line==1&&s.step==1)"
async def main():
  async with async_playwright() as p:
    b, pg, logs = await open_game(p, URL)
    await asyncio.sleep(1.5); await pg.touchscreen.tap(1112 * 0.7, 834 * 0.4)
    await pg.evaluate("window.__gt===undefined && (window.__gt=0, __game.scene.onBeforeRenderObservable.add(()=>{ window.__gt += Math.min(0.25, __game.engine.getDeltaTime()/1000); }))")
    await pg.evaluate('__game.setDtMax(0.25)'); log('loaded')
    # 直达厦门北地铁站台（跳过国铁）
    await pg.evaluate("""(() => {
      const e=__game.east; e.ensure(); e.side='xm'; e.cur={st:__game.station, loc:'xmmetro', area:'metro'};
      __game.station.kit.root.setEnabled(false);
      __game.xmMetro.buildStation('xmnb');
      const P=__game.xmMetro.station.platforms[0];
      __game.player.spawn(3000+10, P.y+0.05, P.zc+2, Math.PI/2);
    })()""")
    await asyncio.sleep(1.5)
    R['code'] = await pg.evaluate('__game.xmMetro.code')
    log('at', R['code'])
    # 叫 1 号线车，等开门
    for _ in range(600):
        await pg.evaluate('__game.call(1,1)')
        if await pg.evaluate(SLOT + " && " + SLOT + ".state=='dwell'"): break
        await asyncio.sleep(0.5)
    log('train dwell', await pg.evaluate(SLOT + ' && ' + SLOT + '.state'))
    await pg.evaluate(SLOT + '.t = 1e4')
    # 站到空座位前的过道
    seat = await pg.evaluate(f"""(()=>{{const t={SLOT}.train, r=t.root.position;
      const s=t.seats.filter(s=>s.free&&s.sd<0).sort((a,b)=>Math.abs(a.x-1.2)-Math.abs(b.x-1.2))[0];
      if(!s) return null;
      __game.teleport(r.x+s.x, r.y+0.02, r.z+s.sd*0.62, Math.PI);
      return {{x:s.x, sd:s.sd, free:t.seats.filter(s=>s.free).length, taken:t.seats.filter(s=>!s.free).length, n:t.seats.length}};}})()""")
    R['seat'] = seat; log('near seat', seat); await asyncio.sleep(0.8)
    R['actSit'] = await until(pg, "(__game.state().act||{}).id=='sit'", 20)
    R['actLabel'] = await pg.evaluate('(__game.state().act||{}).label')
    log('actSit', R['actSit'], R['actLabel'])
    await pg.evaluate('__game.player.yaw=Math.PI/2+0.5; __game.player.pitch=0.22; __game.player.dist=3.0'); await asyncio.sleep(1.2)
    await shot(pg, 'xm-seat-before')
    if R['actSit']:
        await tap(pg, '#bAct'); await until(pg, '__game.state().seat.seated', 10)
    g = await pg.evaluate(f"""(()=>{{const pl=__game.player, t={SLOT}.train, r=t.root.position, s=pl.seat&&pl.seat.seat;
      if(!s) return null;
      return {{hipAboveFloor: +(pl.position.y + pl.hipH() - r.y).toFixed(3), dx: +(pl.position.x-r.x-s.x).toFixed(3), dz: +(pl.position.z-r.z).toFixed(3)}};}})()""")
    R['hip'] = g
    R['hipOnCushion'] = bool(g) and abs(g['hipAboveFloor'] - 0.55) < 0.02 and abs(g['dz'] + 1.2) < 0.05
    await pg.evaluate('__game.player.yaw=Math.PI/2+0.5; __game.player.pitch=0.22; __game.player.dist=3.0'); await asyncio.sleep(1.2)
    await shot(pg, 'xm-seat-sitting')
    # 第一人称眼高
    await pg.evaluate('__game.toggleView()'); await pg.evaluate('__game.player.yaw=__game.player.facing-0.2; __game.player.pitch=-0.24'); await asyncio.sleep(1.2)
    s = await st(pg); ty = await pg.evaluate(SLOT + '.train.root.position.y')
    R['eyeFirst'] = round(s['camPos'][1] - ty, 2) if s.get('camPos') else None
    await shot(pg, 'xm-seat-fp')
    # 一直坐着：放车走 → 到下一站
    await pg.evaluate(SLOT + '.t = 1')
    R['departed'] = await gwait(pg, "__game.state().xmMetro && __game.state().xmMetro.ride!==null", 40)
    log('departed', R['departed'])
    R['seatedWhileMoving'] = await pg.evaluate('__game.state().seat.seated')
    R['arrived'] = await gwait(pg, "(()=>{const x=__game.state().xmMetro; return x && x.code!='xmnb' && !__game.state().inTunnel && (x.slots||[]).some(o=>o.line==1&&o.step==1&&o.state=='dwell')})()", 120)
    log('arrived', R['arrived'], await pg.evaluate('(__game.state().xmMetro||{}).code'))
    s = await st(pg); R['arrivedAt'] = (s.get('xmMetro') or {}).get('code'); R['seatedAfterArrive'] = s['seat']['seated']
    # 起身
    if await pg.evaluate('__game.player.view') != 'third': await pg.evaluate('__game.toggleView()')
    R['actStand'] = (await st(pg))['act']
    if R['actStand'] and R['actStand'].get('id') == 'stand':
        await tap(pg, '#bAct'); await asyncio.sleep(0.8)
    s = await st(pg); R['stood'] = not s['seat']['seated'] and s['aboard']
    R['errors'] = errs(logs)
    print(json.dumps(R, ensure_ascii=False, indent=1, default=str))
    chk = {k: bool(R.get(k)) for k in ['actSit', 'hipOnCushion', 'departed', 'seatedWhileMoving', 'arrived', 'seatedAfterArrive', 'stood']}
    chk['eyeLower'] = R.get('eyeFirst') is not None and R['eyeFirst'] < 1.3
    chk['noErrors'] = not R['errors']
    print('CHECKS', chk, 'PASS' if all(chk.values()) else 'FAIL', flush=True)
    await b.close()
asyncio.run(main())
