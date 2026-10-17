# 哥哥明明 r3 复查截图：明明正面（白色短袖连着衣身）/ 两兄弟并排（明明高大半个头）/ 骑楼门口（出站后没有站台广播字幕）。
#   python3 tests/e2e/brother_r3.py <base-url> [out]
import asyncio, sys, os, json
sys.path.insert(0, os.path.dirname(__file__))
from common import *
from perfhud import perf, overlay, overlay_off
BASE = sys.argv[1] if len(sys.argv) > 1 and sys.argv[1].startswith('http') else 'http://localhost:8123/'
OUT = (sys.argv[2] if len(sys.argv) > 2 else '/workspace/gz-shots-polish/brother-r3').rstrip('/') + '/'
os.makedirs(OUT, exist_ok=True); PERF = {}
BUDGET = (66, 186754)
async def shot(pg, name, settle=1.5):
    await asyncio.sleep(settle); d = await perf(pg, n=4, gap=0.3); PERF[name] = d
    await overlay(pg, d, name); await pg.screenshot(path=OUT + name + '.png', timeout=240000); await overlay_off(pg); print('shot', name, d, flush=True)
    assert d['draws'] <= BUDGET[0] and d['tris'] <= BUDGET[1], (name, d)
# 头顶高度：头骨骼的世界坐标 + 头（含头发）大约的高度
HEIGHTS = """() => { const out = {}; for (const m of __game.scene.meshes) { if (!m.skeleton || !m.isEnabled() || !/^(kid|buddy)/.test(m.name)) continue;
  const bb = m.getHierarchyBoundingVectors ? null : null; const b = m.skeleton.bones[2]; const p = b.getAbsolutePosition(m);
  out[m.name + ':' + (m.metadata && m.metadata.kind || '')] = { headBoneY: +p.y.toFixed(3), footY: +m.position.y.toFixed(3), scale: +m.scaling.y.toFixed(3) }; } return out; }"""
async def main():
    async with async_playwright() as p:
        b, pg, logs = await open_game(p, BASE + '?q=1&char=mingming')
        await pg.evaluate('__game.setDtMax(0.12)'); await asyncio.sleep(2)
        await pg.evaluate('__game.teleport(0,0.05,-50,0); __game.player.facing=0; __game.player.yaw=3.14159; __game.player.pitch=0.12; __game.player.dist=2.4')
        await shot(pg, '01-ming-front')
        # 两兄弟并排站在站厅（闸机前），都面向镜头
        await pg.evaluate('__game.teleport(0.6,-5.95,-11,0); __game.player.facing=0; __game.player.yaw=3.14159; __game.player.pitch=0.1; __game.player.dist=3.6')
        await asyncio.sleep(1.5); await pg.evaluate("__game.brother.buddy(-0.6,__game.player.position.y,-11,0,'idle')")
        await asyncio.sleep(1.0); print('HEIGHTS', json.dumps(await pg.evaluate(HEIGHTS)), flush=True)
        await shot(pg, '03-brothers-concourse', settle=2.5)
        await pg.evaluate("__game.brother.buddy(null)")
        assert not errs(logs), errs(logs); await b.close()
        # 骑楼（纪念堂站的竹升云吞面）：先在站台上让欢迎广播响起来，再出站走到骑楼门口 → 字幕必须消失
        b, pg, logs = await open_game(p, BASE + '?q=1&char=mingming&start=jnt')
        await pg.evaluate('__game.setDtMax(0.12)'); await asyncio.sleep(2)
        cap = "(() => { const e = document.getElementById('caption'); return e && !e.hidden ? e.textContent.trim() : null; })()"
        for _ in range(40):
            c = await pg.evaluate(cap)
            if c: break
            await asyncio.sleep(0.5)
        print('caption on platform:', c, (await st(pg))['zone'], flush=True)
        s = (await pg.evaluate('__game.brother.food.info()'))['shops'][0]; yaw = s['yawIn']
        x = -13.6 + 5.5 if s['out'][0] < 0 else 13.6 - 5.5
        await pg.evaluate(f"__game.teleport({x},0.05,-50.6,{yaw}); __game.player.facing={yaw}-0.75; __game.player.yaw={yaw}-0.35; __game.player.pitch=0.05; __game.player.dist=3.4")
        seen = []
        for _ in range(12):
            await asyncio.sleep(0.5); c2 = await pg.evaluate(cap)
            if c2: seen.append(c2)
        print('captions after exit:', seen, (await st(pg))['zone'], flush=True)
        await shot(pg, '04-qilou-nosub', settle=1)
        c3 = await pg.evaluate(cap); print('caption at shot:', c3)
        assert not c3, c3
        assert not errs(logs), errs(logs); await b.close()
    print('PERF', json.dumps(PERF))
asyncio.run(main())
