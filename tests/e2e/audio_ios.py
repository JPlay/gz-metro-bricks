# iOS 音频加固检查（无头 Chromium；可选 WEBKIT=1 用 Playwright WebKit 做冒烟，WebKit ≠ iOS）
#   python3 tests/e2e/audio_ios.py 'http://localhost:8123/' [截图目录]
# 1) 默认采样率（不再强制 24k）、点一下后 running、诊断面板 ?debug=audio、提示不出现
# 2) 模拟 iOS“resume() 永不返回”：点一下 → 1.5 秒后出现“点一下开启声音” → 恢复后再点 → 关掉重建 → running、提示消失
# 3) iPhone UA：静音 <audio> 循环播放（静音键兜底），iPad/桌面 UA 不循环
import asyncio, json, os, sys
from playwright.async_api import async_playwright
sys.path.insert(0, os.path.dirname(__file__))
from common import ARGS
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8123/'
OUT = sys.argv[2] if len(sys.argv) > 2 else '/workspace/gz-shots-audio'
SEP = '&' if '?' in URL else '?'
IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 27_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.0 Mobile/15E148 Safari/604.1'
HANG = """(() => { const C = window.AudioContext; const orig = C.prototype.resume; window.__hang = true;
  C.prototype.resume = function () { return window.__hang ? new Promise(() => {}) : orig.call(this); };
  // 无头 Chromium 不需要手势就会 running；挂起期间把 state 报成 iOS 那样的 'interrupted'
  const d = Object.getOwnPropertyDescriptor(BaseAudioContext.prototype, 'state');
  Object.defineProperty(BaseAudioContext.prototype, 'state', { get() { const s = d.get.call(this); return window.__hang && s !== 'closed' ? 'interrupted' : s; } }); })();"""

async def diag(pg): return await pg.evaluate('window.__game ? __game.state().audio.diag : null')
async def tap(pg, x=556, y=300):
    await pg.touchscreen.tap(x, y); await pg.wait_for_timeout(250)
async def shot(pg, path):
    try: await pg.screenshot(path=path, timeout=90000)
    except Exception as e: print('screenshot failed', path, str(e)[:80])
async def hint_visible(pg): return await pg.evaluate('(() => { const h = document.getElementById("audioHint"); return !!h && !h.hidden; })()')

async def page(b, ua=None, init=None, q='debug=audio'):
    kw = dict(viewport={'width': 1112, 'height': 834}, has_touch=True)
    if b.browser_type.name == 'chromium': kw.update(device_scale_factor=2, is_mobile=True)
    if ua: kw['user_agent'] = ua
    ctx = await b.new_context(**kw); pg = await ctx.new_page(); logs = []
    pg.on('pageerror', lambda e: logs.append(str(e)))
    if init: await pg.add_init_script(init)
    await pg.goto(URL + SEP + q)
    await pg.wait_for_function('window.__game', timeout=120000)
    return pg, logs

async def main():
    os.makedirs(OUT, exist_ok=True); R = {}; ok = True
    async with async_playwright() as p:
        if os.environ.get('WEBKIT'):
            b = await p.webkit.launch()
            pg, logs = await page(b)
            await tap(pg); await pg.wait_for_timeout(1800); d = await diag(pg)
            R['webkit'] = {k: d[k] for k in ('state', 'sampleRate', 'audioSession', 'html', 'everUnlocked', 'errors')}
            R['webkit']['panel'] = await pg.evaluate('!!document.getElementById("audioDebug")'); R['webkit']['pageErrors'] = logs
            await shot(pg, OUT + '/webkit_debug.png'); await b.close()
            print(json.dumps(R, ensure_ascii=False, indent=1)); return
        b = await p.chromium.launch(args=[a for a in ARGS if 'autoplay' not in a])
        # 1
        pg, logs = await page(b)
        hw = await pg.evaluate('new AudioContext().sampleRate')
        await tap(pg); await pg.wait_for_timeout(600); d = await diag(pg)
        R['1'] = dict(state=d['state'], rate=d['sampleRate'], hw=hw, panel=await pg.evaluate('document.getElementById("audioDebug").innerText'), hint=await hint_visible(pg), html=d['html'], errors=d['errors'] + logs)
        ok &= d['state'] == 'running' and d['sampleRate'] == hw and d['sampleRate'] != 24000 and not R['1']['hint'] and not d['html']['keep'] and 'ctx running' in R['1']['panel']
        await pg.evaluate("__game.state && 0"); await shot(pg, OUT + '/1_debug_panel.png')
        await pg.context.close()
        # 2
        pg, logs = await page(b, init=HANG)
        await tap(pg)
        try: await pg.wait_for_function('__game.state().audio.diag.recreateNext', timeout=8000)
        except Exception: pass
        await pg.wait_for_timeout(200); d = await diag(pg)
        R['2a'] = dict(state=d['state'], hint=await hint_visible(pg), recreateNext=d['recreateNext'], errors=d['errors'])
        await shot(pg, OUT + '/2_hint.png')
        await pg.evaluate('window.__hang = false')
        await tap(pg); await pg.wait_for_timeout(800); d = await diag(pg)
        R['2b'] = dict(state=d['state'], hint=await hint_visible(pg), recreates=d['recreates'], recreateNext=d['recreateNext'], everUnlocked=d['everUnlocked'], pageErrors=logs)
        ok &= R['2a']['hint'] and R['2a']['recreateNext'] and R['2a']['state'] != 'running'
        ok &= R['2b']['state'] == 'running' and not R['2b']['hint'] and R['2b']['recreates'] == 1 and R['2b']['everUnlocked'] and not logs
        # blip 能在重建后的上下文上跑
        R['2c'] = await pg.evaluate('(() => { try { return __game.state().audio.unlocked; } catch (e) { return String(e); } })()')
        await pg.context.close()
        # 3
        pg, logs = await page(b, ua=IPHONE_UA)
        await tap(pg); await pg.wait_for_timeout(600); d = await diag(pg)
        R['3'] = dict(iphone=d['iphone'], html=d['html'], state=d['state'], pageErrors=logs)
        ok &= d['iphone'] and d['html']['keep'] and d['html']['paused'] is False and d['state'] == 'running'
        await b.close()
    print(json.dumps(R, ensure_ascii=False, indent=1)); print('PASS' if ok else 'FAIL')
if __name__ == "__main__": asyncio.run(main())
