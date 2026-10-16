# 哥哥明明 + 美食店截图 / 检查。python3 tests/e2e/brother_shots.py <base-url> [out] [parts]
#   parts（逗号分隔，默认全部）：select, ming, street, eat, passport
#   每张截图左下角贴绘制调用 / 活动三角形角标（无头 SwiftShader 的数字，不是 iPad 帧率），并打印 JSON 供和站厅基准比较。
import asyncio, sys, json, os, time
sys.path.insert(0, os.path.dirname(__file__))
from common import *
from perfhud import perf, overlay, overlay_off
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8131/'
OUT = (sys.argv[2] if len(sys.argv) > 2 else '/workspace/gz-shots-polish/brother-r1').rstrip('/') + '/'
PARTS = (sys.argv[3] if len(sys.argv) > 3 else 'select,ming,street,eat,passport').split(',')
os.makedirs(OUT, exist_ok=True)
PERF = {}
def log(*a): print(time.strftime('%H:%M:%S'), *a, flush=True)
async def shot(pg, name, settle=1.2, tag=True):
    await asyncio.sleep(settle)
    if tag:
        d = await perf(pg, n=4, gap=0.3); PERF[name] = d; await overlay(pg, d, name)
    await pg.screenshot(path=OUT + name + '.png', timeout=240000)
    if tag: await overlay_off(pg)
    log('shot', name, PERF.get(name))
async def main():
    async with async_playwright() as p:
        if 'select' in PARTS:
            b, pg, logs = await open_game(p, BASE + '?q=1&select=1')
            await pg.evaluate('__game.setDtMax(0.12)'); await asyncio.sleep(2)
            await shot(pg, '01-select', tag=True)
            await pg.evaluate("__game.brother.pick('mingming')"); await asyncio.sleep(2.5)
            await shot(pg, '02-select-mingming')
            await pg.evaluate("__game.brother.pick('xingxing')"); await asyncio.sleep(2.5)
            await shot(pg, '03-select-xingxing')
            await pg.evaluate("__game.brother.pick('mingming'); __game.brother.confirm()"); await asyncio.sleep(1)
            i = await pg.evaluate('__game.brother.info()'); log('after confirm', i)
            assert i['char'] == 'mingming' and not i['select']['open']
            e = errs(logs); log('errors', e); await b.close()
        if 'ming' in PARTS:
            b, pg, logs = await open_game(p, BASE + '?q=1&char=mingming')
            await pg.evaluate('__game.setDtMax(0.12)'); await asyncio.sleep(2)
            # 站口外街面：主角正面（镜头在前面）、侧面、背面
            for name, camyaw in [('04-ming-front', 3.14159), ('05-ming-side', 1.5708), ('06-ming-back', 0)]:
                await pg.evaluate(f'__game.teleport(0,0.05,-50,0); __game.player.facing=0; __game.player.yaw={camyaw}; __game.player.pitch=0.12; __game.player.dist=2.6')
                await shot(pg, name, settle=1.5)
            # 敬礼 + ✌️
            await pg.evaluate("__game.player.yaw=3.14159; __game.player.emote={mode:'salute',yaw:0,t:30}"); await shot(pg, '07-ming-salute', settle=1.5)
            await pg.evaluate("__game.player.emote={mode:'cheer',yaw:0,t:30}"); await shot(pg, '08-ming-cheer', settle=1.5)
            await pg.evaluate("__game.player.emote={mode:'wave',yaw:0,t:30}"); await shot(pg, '08b-ming-vsign', settle=1.5)
            await pg.evaluate("__game.player.emote={mode:'nuli',yaw:0,t:30}"); await shot(pg, '08c-ming-nuli', settle=1.5)
            await pg.evaluate("__game.player.emote=null")
            # 明明和星星并排（选角台上，正面，真实身高比例）
            await pg.evaluate("__game.brother.show()"); await asyncio.sleep(2)
            await shot(pg, '09-ming-and-xing')
            await pg.evaluate("__game.brother.pick('mingming'); __game.brother.confirm()")
            e = errs(logs); log('errors', e); await b.close()
    print('PERF', json.dumps(PERF, ensure_ascii=False))
asyncio.run(main())
