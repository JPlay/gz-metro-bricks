"""
.hdr（RGBE 浮点全景）→ Babylon .env（预滤波 IBL）。需要本地 http 服务（仓库根目录）和 Playwright：
  python3 -m http.server 8917 &   /workspace/.pwvenv/bin/python tools/textures/make_env.py http://localhost:8917/
"""
import asyncio, base64, json, os, sys
from playwright.async_api import async_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8917/'
HERE = os.path.dirname(os.path.abspath(__file__)); ENV = os.path.join(HERE, '..', '..', 'vendor', 'env')
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=ARGS); pg = await b.new_page(); logs = []
        pg.on('console', lambda m: logs.append((m.type, m.text))); pg.on('pageerror', lambda e: logs.append(('pageerror', str(e))))
        await pg.goto(BASE + 'tools/textures/env_bake.html'); await pg.wait_for_function('!!window.bake')
        for name in ['env_day', 'env_dusk', 'env_indoor']:
            data = await pg.evaluate(f'bake("hdr/{name}.hdr")', )
            raw = base64.b64decode(data); open(os.path.join(ENV, name + '.env'), 'wb').write(raw)
            print(name, len(raw), 'bytes', flush=True)
        for name in ['env_day', 'env_dusk', 'env_indoor', 'environmentSpecular']:
            r = await pg.evaluate(f'probe("../../vendor/env/{name}.env")')
            print('PROBE', name, json.dumps(r['faces']), flush=True)
        print('LOGS', [l for l in logs if l[0] in ('error', 'pageerror')])
        await b.close()
asyncio.run(main())
