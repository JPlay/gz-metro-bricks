# iPhone 竖屏 HUD：右上角按钮（换人 / 美食 / 地图 / 视角 / 声音）不能盖住左上角站名牌；iPad 横屏不变
#   python3 tests/e2e/portrait_hud.py 'http://localhost:8123/' [截图目录] [后缀]
import asyncio, json, os, sys
from playwright.async_api import async_playwright
sys.path.insert(0, os.path.dirname(__file__))
from common import ARGS
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8123/'
OUT = sys.argv[2] if len(sys.argv) > 2 else '/workspace/gz-shots-polish/portrait-hud'
SUF = sys.argv[3] if len(sys.argv) > 3 else ''
IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 27_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.0 Mobile/15E148 Safari/604.1'
SIZES = [('iphone390', 390, 844, 3, IPHONE_UA), ('iphone430', 430, 932, 3, IPHONE_UA), ('ipad_land', 1112, 834, 2, None)]
MEASURE = """(() => { const r = el => { if (!el || el.hidden || getComputedStyle(el).display === 'none') return null; const b = el.getBoundingClientRect(); return { x: Math.round(b.left), y: Math.round(b.top), r: Math.round(b.right), b: Math.round(b.bottom) }; };
  const btns = [...document.querySelectorAll('#btns > .btn')].filter(b => !b.hidden && getComputedStyle(b).display !== 'none');
  return { vw: innerWidth, where: r(document.getElementById('where')), next: r(document.getElementById('next')), inv: r(document.getElementById('inv')), btns: btns.map(b => ({ id: b.id, ...r(b) })) }; })()"""
def hit(a, b): return a and b and a['x'] < b['r'] and b['x'] < a['r'] and a['y'] < b['b'] and b['y'] < a['b']
async def main():
    os.makedirs(OUT, exist_ok=True); ok = True; R = {}
    async with async_playwright() as p:
        b = await p.chromium.launch(args=ARGS)
        for name, w, h, dpr, ua in SIZES:
            kw = dict(viewport={'width': w, 'height': h}, device_scale_factor=dpr, has_touch=True, is_mobile=True)
            if ua: kw['user_agent'] = ua
            ctx = await b.new_context(**kw); pg = await ctx.new_page()
            await pg.goto(URL); await pg.wait_for_function('window.__game', timeout=180000); await pg.wait_for_timeout(1500)
            out = {}
            for state in ('street', 'next'):
                if state == 'next':  # 显示“下一站”条，确认也不被按钮压住
                    await pg.evaluate("(() => { const n = document.getElementById('next'); n.hidden = false; if (!n.innerHTML.trim()) n.innerHTML = '<span class=\"tag\">下一站<small>Next</small></span><span class=\"nm\">农讲所<small>Nongjiangsuo</small></span>'; const v = document.getElementById('inv'); v.hidden = false; if (!v.innerHTML.trim()) v.innerHTML = '<span style=\"padding:6px 12px\">🎫 单程票</span>'; })()")
                m = await pg.evaluate(MEASURE)
                bad = [x['id'] for x in m['btns'] if hit(x, m['where']) or hit(x, m['next']) or hit(x, m['inv']) or x['x'] < 0 or x['r'] > m['vw']]
                if hit(m['next'], m['inv']): bad.append('next/inv')
                out[state] = dict(m, overlap=bad); ok &= not bad
                path = f"{OUT}/{name}_{state}{SUF}.png"
                try: await pg.screenshot(path=path, timeout=120000); out[state]['shot'] = path
                except Exception as e: out[state]['shot'] = 'FAILED ' + str(e)[:60]
            R[name] = out; await ctx.close()
        await b.close()
    print(json.dumps(R, ensure_ascii=False, indent=1)); print('PASS' if ok else 'FAIL')
asyncio.run(main())
