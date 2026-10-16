# 截图用的性能角标：游戏内 FPS（无头 SwiftShader，不代表 iPad）+ 绘制调用 + 活动三角形。
#   perf(pg)        → {'fps','draws','tris','meshes'}：连续采样 n 帧取最大的绘制调用 / 三角形（保守）
#   overlay(pg, d)  → 在画面左下角贴一块小角标（截图后 overlay_off 去掉）
# 三角形 = scene.getActiveIndices() / 3（本帧实际提交渲染的索引数，含实例），绘制调用 = engine._drawCalls.current。
import asyncio
JS_SAMPLE = """() => { const g = __game, s = g.scene, e = g.engine;
  return { fps: Math.round(e.getFps()), draws: (e._drawCalls && e._drawCalls.current) || 0,
           tris: Math.round(s.getActiveIndices() / 3), meshes: s.getActiveMeshes().length }; }"""
async def perf(pg, n=6, gap=0.35):
    v = []
    for _ in range(n):
        await asyncio.sleep(gap); v.append(await pg.evaluate(JS_SAMPLE))
    return {'fps': round(sum(x['fps'] for x in v) / len(v), 1), 'draws': max(x['draws'] for x in v),
            'tris': max(x['tris'] for x in v), 'meshes': max(x['meshes'] for x in v)}
async def overlay(pg, d, label=''):
    txt = f"{label}  FPS {d['fps']} (headless)  ·  draws {d['draws']}  ·  tris {d['tris']:,}"
    await pg.evaluate("""t => { let el = document.getElementById('perfTag'); if (!el) { el = document.createElement('div'); el.id = 'perfTag';
      el.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:6px;z-index:99;padding:4px 12px;border-radius:10px;background:rgba(0,0,0,.62);color:#fff;font:600 14px/1.3 -apple-system,Helvetica,sans-serif;pointer-events:none;white-space:nowrap';
      document.body.appendChild(el); } el.textContent = t; }""", txt)
async def overlay_off(pg): await pg.evaluate("() => { const el = document.getElementById('perfTag'); if (el) el.remove(); }")
