# 端到端：选明明 → 走进美食店 → 坐下 → 点菜（点图片菜单）→ 上菜 → 吃一口（头顶 😋）→ 菜卡 + 美食护照盖章。
#   python tests/e2e/brother_food.py [url] [--shots DIR] [--start CODE]
#   带 --shots 时顺便把点菜全过程截图（带 draws / tris 角标）存到 DIR。
import asyncio, sys, os, json, time
sys.path.insert(0, os.path.dirname(__file__))
from common import *
from perfhud import perf, overlay, overlay_off
args = sys.argv[1:]
URL = next((a for a in args if a.startswith('http')), 'http://localhost:8123/')
SHOTS = args[args.index('--shots') + 1] if '--shots' in args else None
START = args[args.index('--start') + 1] if '--start' in args else None
PERF = {}
async def wait(pg, js, t=90):
    t0 = time.time()
    while time.time() - t0 < t:
        if await pg.evaluate(js): return True
        await asyncio.sleep(0.3)
    raise AssertionError('timeout: ' + js)
async def shot(pg, name, label):
    if not SHOTS: return
    await asyncio.sleep(0.4); d = await perf(pg, n=4, gap=0.3); PERF[name] = d
    await overlay(pg, d, label); await pg.screenshot(path=os.path.join(SHOTS, name + '.png'), timeout=240000); await overlay_off(pg)
    print('shot', name, d, flush=True)
async def main():
    if SHOTS: os.makedirs(SHOTS, exist_ok=True)
    q = '&' if '?' in URL else '?'
    url = URL + q + 'q=1&char=mingming' + (f'&start={START}' if START else '')
    async with async_playwright() as p:
        b, pg, logs = await open_game(p, url)
        await pg.evaluate('__game.setDtMax(0.12)')
        F = '__game.brother.food'
        assert await pg.evaluate('__game.brother.info().char') == 'mingming', 'char not mingming'
        await pg.evaluate(F + '.resetPass()')
        await asyncio.sleep(1.5)
        info = await pg.evaluate(F + '.info()'); shops = info['shops']
        assert shops, 'no restaurant at this station'
        s = shops[0]; print('shop', s['id'], flush=True)
        # 站到店门外，朝店里走
        x, z = s['out']; await pg.evaluate(f"__game.teleport({x},0.05,{z},{s['yawIn']}); __game.player.yaw={s['yawIn']}")
        await asyncio.sleep(1.0); await pg.evaluate('__game.setMove(0,0.8)')
        await wait(pg, F + '.info().inside !== null', 120); await pg.evaluate('__game.setMove(0,0)')
        info = await pg.evaluate(F + '.info()'); assert info['inside'] == s['id']
        await asyncio.sleep(1.5)
        await pg.evaluate('__game.teleport(-600.6,-29.95,1.2,0.3); __game.player.yaw=0.3; __game.player.pitch=0.16; __game.player.dist=3.6')
        await asyncio.sleep(1.2); await shot(pg, f'interior_{s["id"]}', f'{s["id"]} 店内')
        # 走到第一张桌子的椅子边，坐下
        seat = info['interior']['seats'][0]
        await pg.evaluate(f"__game.teleport({seat['x']-0.25},{seat['y']+0.05},{seat['z']-0.55},0)"); await asyncio.sleep(1.2)
        await wait(pg, '(__game.seats.update()||{}).id === "sit"', 20); await asyncio.sleep(0.5)
        await pg.evaluate('__game.act()')
        await wait(pg, '__game.seats.info().seated', 20)
        await wait(pg, F + '.info().orderBtn', 20)
        await pg.evaluate(f"__game.player.yaw={seat['face']}+2.3; __game.player.pitch=0.25; __game.player.dist=3.2"); await asyncio.sleep(1.5)
        await shot(pg, '10-sit', '① 坐下 → 点菜')
        await pg.click('#bOrder', timeout=60000, force=True)
        await wait(pg, F + '.info().menuOpen', 20); await asyncio.sleep(0.8)
        await shot(pg, '11-menu', '② 图片菜单')
        await pg.evaluate(F + ".hold = 'served'")
        await pg.click('#foodMenu .item', timeout=60000)
        await wait(pg, F + '.info().meal && ' + F + '.info().meal.phase === "eat"', 30); await asyncio.sleep(1.0)
        await shot(pg, '12-served', '③ 上菜')
        await pg.evaluate(F + ".hold = 'bite'")
        await wait(pg, F + '.info().meal.bite', 30); await asyncio.sleep(1.2); await pg.evaluate('__game.setDtMax(0.0005)')
        await shot(pg, '13-bite', '④ 吃一口 😋')
        await pg.evaluate('__game.setDtMax(0.12); ' + F + '.hold = null')
        await wait(pg, F + '.info().cardOpen', 30); await asyncio.sleep(0.8)
        await shot(pg, '14-card', '⑤ 菜卡 + 盖章')
        info = await pg.evaluate(F + '.info()')
        assert s['id'] in info['pass'] and info['count']['stamp'] == 1, info
        stored = await pg.evaluate("JSON.parse(localStorage.getItem('gzmetro.foodPassport')||'[]')"); assert s['id'] in stored
        await pg.click('#foodCard .ok', timeout=60000); await asyncio.sleep(0.5)
        await pg.click('#bFood', timeout=60000); await wait(pg, F + '.info().passOpen', 10); await asyncio.sleep(0.8)
        await shot(pg, '15-passport', '美食护照')
        await pg.click('#foodPass .x', timeout=60000)
        # 起身，走出门
        await pg.evaluate('__game.act()'); await wait(pg, '!__game.seats.info().seated', 10)
        await pg.evaluate("__game.teleport(-600,-29.95,-3.7,Math.PI); __game.player.yaw=Math.PI"); await asyncio.sleep(0.6); await pg.evaluate('__game.setMove(0,0.8)'); await wait(pg, F + '.info().inside === null', 30)
        await pg.evaluate('__game.setMove(0,0)')
        assert await pg.evaluate('__game.state().pos[1]') > -2, 'not back on street'
        e = errs(logs); assert not e, e
        print('PERF', json.dumps(PERF)); print('PASS brother_food', s['id'], 'passport', info['pass'], flush=True)
        await b.close()
asyncio.run(main())
