# 福州内河 8A 首件取景：入湖口（渠→湖、半岛）与 3号码头（栈桥+可读牌），白天/夜里同机位。
# 用法：FZQS='&t=day'|'&t=night' python tests/e2e/fz_8a_shots.py <base-url> <截图目录>
import asyncio, sys, json, os
sys.path.insert(0, os.path.dirname(__file__))
from common import *
from journey import GCLOCK
from perfhud import perf
BASE = sys.argv[1]; OUT = sys.argv[2].rstrip('/'); os.makedirs(OUT, exist_ok=True)
QS = os.environ.get('FZQS', '&t=day'); TAG = 'night' if 't=night' in QS else 'day'
SPOTS = """(async () => {
  const M = await import('/js/data/fz-river.js');
  const A = M.FZR.a8a;
  if (!A || !A.cams) return [];
  const cam = (name, c) => [name, c.x, c.z, c.look[0], c.look[2], (c.pitch != null ? c.pitch : 0.04), c.y || 1.6, 1];
  const out = [];
  if (A.cams.inlet) out.push(cam('inlet', A.cams.inlet));
  if (A.cams.pier3) out.push(cam('pier3', A.cams.pier3));
  return out;
})()"""

async def main():
  R = {'tag': TAG, 'cases': []}
  async with async_playwright() as p:
    b, pg, logs = await open_game(p, BASE + '?q=1' + QS)
    await pg.evaluate(GCLOCK)
    await pg.evaluate(f"__game.setDtMax({float(os.environ.get('FZDT', '0.25'))})")
    await asyncio.sleep(1)
    await pg.evaluate("""(() => { const g=__game; g.east.ensure(); g.east.side='fz'; g.east.cur={st:g.station, loc:'fzmetro', area:'metro'}; g.station.kit.root.setEnabled(false); g.fzMetro.enterFromRailway(g.player); })()""")
    await asyncio.sleep(1.5)
    code = os.environ.get('FZKIOSK', 'fzgmg')  # 光明港 D，与 3B 凤坂河同一入口
    await pg.evaluate(f"""(async () => {{ const E = await import('/js/data/fz-exits.js'); const X = E.FZ_EXITS['{code}']; const ex = X.attr === 'fzriver' ? X : (X.more || []).find(e => e.attr === 'fzriver'); const m=__game.fzMetro; m.buildStation('{code}'); m.goStreet(ex); }})()""")
    await asyncio.sleep(5)
    si = await pg.evaluate('__game.fzMetro.street ? __game.fzMetro.street.info() : null')
    R['street'] = si
    print('street', json.dumps({k: (si or {}).get(k) for k in ('kiosk', 'net', 'night')}), flush=True)
    if await pg.evaluate('__game.player.view') != 'first':
      await pg.evaluate('__game.toggleView()')
    async def put(x, y, z):
      await pg.evaluate(f"(() => {{ const S=__game.fzMetro.street, R=S.kit.root.position, pl=__game.player; pl.position.x=R.x+({x}); pl.position.y={y}; pl.position.z=R.z+({z}); pl.vy=0; }})()")
    async def st():
      return await pg.evaluate("""(async () => { const M = await import('/js/data/fz-river.js'); const S=__game.fzMetro.street, R=S.kit.root.position, p=__game.player.position, b=document.getElementById('bShore');
        const x=p.x-R.x, z=p.z-R.z; return {x:+x.toFixed(2), y:+p.y.toFixed(2), z:+z.toFixed(2), btn: b ? !b.hidden : null, land: M.isLand(x,z), water: M.isWater(x,z)}; })()""")
    cases = [('north', (1050, 0.05, -13.0), (1050, -1.6, -19.6), (1050, -2.0, -24.0)),
             ('tip', (967.0, 0.05, -75.5), (957.5, -1.6, -70.0), (951.0, -2.0, -61.5)),
             ('tipjump', (967.0, 0.05, -75.5), (960.0, 0.05, -71.0), (951.0, -2.0, -61.5)),
             ('west', (915.2, 0.05, -45.0), (921.6, -1.6, -45.0), (926.5, -2.0, -45.0))]
    ok = True
    for name, prom, bank, wet in cases:
      await put(*prom); await asyncio.sleep(1.2); s0 = await st()
      await put(*bank); await asyncio.sleep(1.2); s1 = await st()
      await put(*wet); await asyncio.sleep(2.5); s2 = await st()
      await pg.evaluate("(() => { const b=document.getElementById('bShore'); if (b && !b.hidden) { b.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true})); b.dispatchEvent(new PointerEvent('pointerup',{bubbles:true})); b.click(); } })()")
      await asyncio.sleep(1.5); s3 = await st()
      if os.environ.get('FZPICK'):
        pk = await pg.evaluate(f"(() => {{ const S=__game.fzMetro.street, R=S.kit.root.position, B=BABYLON; const out=[]; for (const [dx,dz] of [[0,0],[0.3,0],[-0.3,0],[0,0.3],[0,-0.3]]) {{ const o=new B.Vector3(R.x+{wet[0]}+dx, 5, R.z+{wet[2]}+dz); const hs=__game.scene.multiPickWithRay(new B.Ray(o,new B.Vector3(0,-1,0),12), m=>true)||[]; out.push(hs.slice(0,6).map(h=>h.pickedMesh.name+'@'+h.pickedPoint.y.toFixed(2)+(h.pickedMesh.isPickable?'':'(np)')+(h.pickedMesh.checkCollisions?'C':'')).join(' ')); }} return out; }})()")
        print('PICK', name, pk, flush=True)
      good = bool(s2['btn']) and s3['land'] and s3['y'] > -0.15 and not s3['water']   # 回到平步道（不是草坡）
      ok = ok and good
      print('FALL', name, 'prom', s0, 'bank', s1, 'wet', s2, 'after', s3, 'OK' if good else 'FAIL', flush=True)
      R['cases'].append([name, s0, s1, s2, s3, good])
    print('FALLRESULT', 'PASS' if ok else 'FAIL', flush=True)
    json.dump(R, open(OUT + '/fall.json', 'w'), indent=1)
    await b.close()

asyncio.run(main())
