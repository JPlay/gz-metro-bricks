import asyncio, json, sys, time
from playwright.async_api import async_playwright
ARGS=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--ignore-gpu-blocklist']
async def open_game(p, url, w=1112, h=834, bjs=None):
    b = await p.chromium.launch(args=ARGS)
    ctx = await b.new_context(viewport={'width':w,'height':h}, device_scale_factor=2, has_touch=True, is_mobile=True)
    pg = await ctx.new_page()
    logs=[]
    pg.on('console', lambda m: logs.append((m.type, m.text)))
    pg.on('pageerror', lambda e: logs.append(('pageerror', str(e))))
    pg.on('requestfailed', lambda r: logs.append(('reqfail', r.url, r.failure)))
    await pg.goto(url)
    # Under heavy box load (fps 0-1) boot can exceed 90s; keep waiting (up to 360s) as long as
    # the page has not reported a load error. A genuine load error still fails immediately.
    t0=time.time()
    while True:
        try:
            await pg.wait_for_function('window.__game || document.querySelector("#loading.err")', timeout=90000); break
        except Exception as e:
            print('TIMEOUT', e, round(time.time()-t0), 's', flush=True)
            if time.time()-t0 > 330: break
    if not await pg.evaluate('!!window.__game'):
        print('LOAD FAIL', await pg.evaluate('(document.getElementById("loadMsg")||{}).textContent'), await pg.evaluate('JSON.stringify(window.__babylonAttempts)'))
        print(logs[:30]); await b.close(); raise SystemExit(1)
    return b, pg, logs
async def st(pg): return await pg.evaluate('__game.state()')
def errs(logs): return [l for l in logs if l[0] in ('error','pageerror','reqfail')]
