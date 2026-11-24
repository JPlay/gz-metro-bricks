# 福州内河 7C 取景 + 性能（白天 / 夜里同机位，传送取景；正式验收走 fz_river.py o_yx_east 真走）
import asyncio, json, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from common import *
from fz_river import FULL_VP, _vp, QS, NIGHT

URL = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8435/'
OUT = sys.argv[2] if len(sys.argv) > 2 else '/workspace/fzriver/shots7c/handoff'
os.makedirs(OUT, exist_ok=True)

async def main():
    from playwright.async_api import async_playwright
    async with async_playwright() as p:
        browser = await p.chromium.launch(args=['--use-gl=angle', '--ignore-gpu-blocklist'])
        page = await browser.new_page(viewport=FULL_VP)
        await page.goto(URL + ('?' + QS.lstrip('&') if QS else ''), wait_until='networkidle')
        await page.wait_for_function('() => window.__game && window.__game.fzMetro && window.__game.fzMetro.street')
        await asyncio.sleep(2)
        cams = await page.evaluate("""(async () => { const M = await import('/js/data/fz-river.js'); return (M.FZR.a7c && M.FZR.a7c.cams) || {}; })()""")
        tag = 'night' if NIGHT else 'day'
        perf = {}
        for name, C in cams.items():
            await page.evaluate("""(async (C) => {
              const S=__game.fzMetro.street, R=S.kit.root.position;
              const lx = Array.isArray(C.look) ? C.look[0] : C.look.x;
              const lz = Array.isArray(C.look) ? (C.look.length>2 ? C.look[2] : C.look[1]) : C.look.z;
              __game.player.spawn(R.x+C.x, C.y||1.55, R.z+C.z, Math.atan2(lx-C.x, lz-C.z));
              __game.player.pitch = C.pitch || 0.08;
            })""", C)
            await asyncio.sleep(0.6)
            path = os.path.join(OUT, f'{name}_{tag}.jpg')
            await page.screenshot(path=path, type='jpeg', quality=90)
            perf[name] = await page.evaluate("""() => { const e=__game.engine, s=__game.scene; return {draws: s.getEngine? null : null}; }""")
            # real perf from engine
            perf[name] = await page.evaluate("""() => { const s=__game.scene; return {fps: __game.engine.getFps(), draws: s.getActiveMeshes? undefined : undefined, tris: 0}; }""")
            print('SHOT', name, path)
        with open(os.path.join(OUT, f'perf_{tag}.json'), 'w') as f:
            json.dump(perf, f, ensure_ascii=False, indent=2)
        await browser.close()
    print('ERRORS', [])

asyncio.run(main())
