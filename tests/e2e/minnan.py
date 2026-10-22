# 闽南语报站：厦门地铁 1/2 号线 普通话 → 闽南语 → 英语（有 MP3 且真的播放）；广州（粤语）和动车（普通话+英语）里没有闽南语
import asyncio, sys, json, os
sys.path.insert(0, os.path.dirname(__file__))
from common import *
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8177/'
R = {'checks': {}}
def ok(k, v): R['checks'][k] = bool(v); print('check', k, bool(v), flush=True)
async def main():
  async with async_playwright() as p:
    b, pg, logs = await open_game(p, URL + ('&' if '?' in URL else '?') + 'q=1&start=gzdz&line=1')   # 站台上（站厅 / 街面会按规则掐掉广播）
    st0 = await pg.evaluate("""(async () => { const P = await import('./js/data/phrases.js');
      const xm = P.xmDepartSegs(1, 'lcu', 'zhl', 1, true).map(s => s.id), gz = P.departSegs(1, 'njs', 'up', 1, true).map(s => s.id);
      const emu = P.emuJobs().map(s => s.id), all = P.allJobs(), nan = all.filter(j => j.lang === 'nan');
      const m = await (await fetch('assets/audio/manifest.json')).json(), have = new Set(m.assets.map(a => a.id));
      let load = 0; for (const j of nan) { if (have.has(j.id)) { const r = await fetch('assets/audio/' + j.file); if (r.ok && (await r.arrayBuffer()).byteLength > 2000) load++; } }
      const XS = (await import('./js/data/xm-lines.js')).XM_STATIONS;
      const badNan = nan.filter(j => { const m = j.id.match(/^voice\\.(next|arrive|welcome|xmvisit|destination|terminal|platform)\\.([a-z0-9]+)/); return !m || (['destination', 'terminal', 'platform'].includes(m[1]) ? !m[2].startsWith('xm') : !XS[m[2].replace(/[12]$/, '')]); }).map(j => j.id);
      return { xm, gz, emuNan: emu.filter(i => i.endsWith('.nan')), nanCount: nan.length, load, badNan }; })()""")
    print(json.dumps(st0, ensure_ascii=False), flush=True)
    xm = st0['xm']
    for key in ['destination.xmzhl', 'next.lcu1', 'xmvisit.lcu']:
      ids = [f'voice.{key}.{l}' for l in ('zh', 'nan', 'en')]
      ok('order_' + key, all(i in xm for i in ids) and xm.index(ids[0]) < xm.index(ids[1]) < xm.index(ids[2]))
    ok('gzNoNan', not any(i.endswith('.nan') for i in st0['gz']) and any(i.endswith('.yue') for i in st0['gz']))
    ok('emuNoNan', not st0['emuNan'])
    ok('allNanHaveMp3', st0['nanCount'] > 150 and st0['load'] == st0['nanCount'])
    ok('nanOnlyXm', not st0['badNan'])
    # —— 真的播放：先在广州（粤语），再进厦门地铁（闽南语）——
    await pg.keyboard.press('F9'); await asyncio.sleep(0.8)
    a = await pg.evaluate('__game.Audio.getState().unlocked'); ok('unlocked', a)
    # 记录每段字幕事件：真正播放 MP3 的片段没有 silent / fallback 标记
    await pg.evaluate("window.__mn = []; window.addEventListener('gz-audio-caption', e => { const d = e.detail; if (d && window.__mnOn) window.__mn.push(d.id + (d.silent ? ':silent' : d.fallback ? ':fallback' : '')); })")
    async def play(expr):
      await pg.evaluate("new Promise(r => { const t0 = Date.now(), f = () => (!__game.Audio.isAnnouncing() || Date.now() - t0 > 60000) ? r() : setTimeout(f, 200); f(); })")   # 等游戏自己的广播播完（不去 cancel：会中断正在预载的片段）
      await pg.evaluate('window.__mn = []; window.__mnOn = true')
      await pg.evaluate(f"(async () => {{ const A = await import('./js/audio/announcements.js'); await {expr}; }})()")
      return await pg.evaluate('window.__mnOn = false; window.__mn')
    for _ in range(3):   # 游戏自己的站台广播（打断式）可能把这串打断：重试到完整播完
      gz = await play("A.depart(1, 'njs', 'up', 1, false)"); print('gz played', gz, flush=True)
      if len(gz) >= 3: break
    ok('gzPlayedYueNoNan', any(i.endswith('.yue') for i in gz) and not any(i.endswith('.nan') for i in gz))
    await pg.evaluate("""(() => { const g=__game; g.east.ensure(); g.east.side='xm'; g.east.cur={st:g.station, loc:'xmmetro', area:'metro'}; g.station.kit.root.setEnabled(false); g.xmMetro.enterFromRailway(g.player); })()""")
    await asyncio.sleep(1.5)
    for _ in range(3):
      xp = await play("A.xmDepart(2, 'lcu', 'wyw', 1, false)"); print('xm played', xp, flush=True)
      if len(xp) >= 6: break
    want = ['voice.next.lcu2.zh', 'voice.next.lcu2.nan', 'voice.next.lcu2.en', 'voice.xmvisit.lcu.zh', 'voice.xmvisit.lcu.nan', 'voice.xmvisit.lcu.en']
    ok('xmPlayedZhNanEn', xp == want)
    ok('xmNoYue', not any(i.endswith('.yue') for i in xp))
    print('errs', len(errs(logs)), errs(logs)[:4], flush=True)
    R['errors'] = errs(logs); good = all(R['checks'].values()) and not R['errors']
    print(json.dumps(R, ensure_ascii=False, indent=1, default=str))
    print('MINNAN', 'PASS' if good else 'FAIL', [k for k, v in R['checks'].items() if not v], flush=True)
    await b.close()
    if not good: sys.exit(1)
if __name__ == "__main__": asyncio.run(main())
