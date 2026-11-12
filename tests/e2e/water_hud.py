# 掉进福州上下杭星安河：不要被送回地铁站台；「回到岸上」必须真能点到（#hud pointer-events）。
# 用法：python tests/e2e/water_hud.py [base-url]
import asyncio, json, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from common import *
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8123/'
FS = 6000
R = {'checks': {}}
def log(*a): print(*a, flush=True)
def ok(k, v): R['checks'][k] = bool(v); log('check', k, bool(v)); return v

async def main():
    async with async_playwright() as p:
        b, pg, logs = await open_game(p, BASE + '?q=1&start=gzdz&line=1')
        await pg.evaluate('__game.setDtMax(0.25)')
        await asyncio.sleep(1.0)
        await pg.evaluate("""(() => {
          const g = __game;
          g.east.ensure(); g.east.side = 'fz';
          g.east.cur = { st: g.station, loc: 'fzmetro', area: 'metro' };
          g.station.kit.root.setEnabled(false);
          g.fzMetro.enterFromRailway(g.player);
        })()""")
        await asyncio.sleep(1.0)
        info = await pg.evaluate("""(() => {
          const m = __game.fzMetro;
          m.buildStation('fzdd');
          m.goStreet(m.N.EXITS.fzdd);
          return { code: m.code, key: m.street && m.street.key, street: !!m.street };
        })()""")
        log('street', info)
        await asyncio.sleep(1.2)
        s = await st(pg)
        ok('onStreet', info.get('key') == 'fzdd' and info.get('street'))
        # 先站在岸上（河在 z 44..56），记 lastSafe
        await pg.evaluate(f"__game.player.spawn({FS}, 0.05, 40, 0)")
        await asyncio.sleep(0.5)
        # 掉进星安河（三通桥旁，水面挖空）
        await pg.evaluate(f"__game.player.spawn({FS}, -1.0, 50, 0)")
        await asyncio.sleep(1.4)
        s = await st(pg)
        R['inRiver'] = {'pos': s['pos'], 'zone': s['zone'], 'inWater': s.get('inWater')}
        log('inRiver', R['inRiver'])
        ok('caughtOnWater', s['zone'] == 'street' and s['pos'][1] > -4 and s['pos'][1] < -0.3)
        ok('notSentToPlatform', s['pos'][1] > -8 and s['zone'] != 'platform')
        vis = await pg.evaluate("(() => { const b = document.getElementById('bShore'); return !!b && !b.hidden; })()")
        ok('shoreBtnShown', vis or s.get('inWater'))
        hit = await pg.evaluate("""(() => {
          const b = document.getElementById('bShore');
          if (!b || b.hidden) return false;
          const r = b.getBoundingClientRect();
          const h = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
          return getComputedStyle(b).pointerEvents !== 'none' && !!h && b.contains(h);
        })()""")
        ok('shoreBtnHit', hit)
        try:
            await pg.locator('#bShore').tap(timeout=15000)
            ok('shoreBtnTap', True)
        except Exception as ex:
            log('tap', str(ex)[:300])
            ok('shoreBtnTap', False)
        await asyncio.sleep(0.7)
        s = await st(pg)
        R['afterTap'] = {'pos': s['pos'], 'zone': s['zone'], 'inWater': s.get('inWater')}
        log('afterTap', R['afterTap'])
        ok('backOnShore', s['zone'] == 'street' and -0.2 < s['pos'][1] < 1.5 and abs(s['pos'][2] - 50) > 2)
        ok('stillNotPlatform', s['pos'][1] > -2 and s['zone'] != 'platform')
        css = await pg.evaluate("""(() => {
          const el = document.createElement('button');
          el.id = 'hudHitProbe'; el.textContent = 'probe';
          el.style.cssText = 'position:fixed;left:8px;top:8px;z-index:80;width:48px;height:48px';
          document.getElementById('hud').appendChild(el);
          const pe = getComputedStyle(el).pointerEvents;
          const r = el.getBoundingClientRect();
          const h = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
          const hit = !!h && el.contains(h) && pe !== 'none';
          el.remove();
          return { pe, hit };
        })()""")
        R['hudProbe'] = css
        ok('hudButtonRule', css['pe'] != 'none' and css['hit'])
        R['errors'] = [l for l in errs(logs) if l[0] in ('error', 'pageerror')]
        await b.close()
    good = all(R['checks'].values()) and not R['errors']
    print(json.dumps(R, ensure_ascii=False, indent=1, default=str))
    print('WATER_HUD', 'PASS' if good else 'FAIL', [k for k, v in R['checks'].items() if not v], flush=True)
    if not good: sys.exit(1)

if __name__ == '__main__':
    asyncio.run(main())
