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
# 截图统一入口（小美：不能再出现一张截图卡三小时）：每次都限时 —— playwright 自己的 timeout，外面再套一层 asyncio 硬超时
#（CDP 卡住时 playwright 的 timeout 不一定生效）；失败重试一次，再失败只记录（SHOT_FAILS + 日志 SHOT_FAIL）并继续，返回 None。
# 成功返回截图字节（真值）。用法同 page.screenshot：await safe_shot(pg, path=..., type='jpeg', quality=60)
SHOT_TIMEOUT = 180000
SHOT_FAILS = []
async def safe_shot(pg, path=None, timeout=SHOT_TIMEOUT, tries=2, **kw):
    for i in range(tries):
        try:
            return await asyncio.wait_for(pg.screenshot(path=path, timeout=timeout, **kw), timeout / 1000 + 30)
        except Exception as e:
            print(time.strftime('%H:%M:%S'), 'SHOT_FAIL', path, f'{i + 1}/{tries}', type(e).__name__, str(e).splitlines()[0][:160] if str(e) else '', flush=True)
    SHOT_FAILS.append(path); return None
def errs(logs): return [l for l in logs if l[0] in ('error','pageerror','reqfail')]
