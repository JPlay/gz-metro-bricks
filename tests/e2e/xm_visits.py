# 厦门景点：报站片段（下一站后接景点句，普通话 + 闽南语 + 英语，有 MP3）+ 厦门线路图景点图标可点开卡片
import asyncio, sys, json, os
sys.path.insert(0, os.path.dirname(__file__))
from common import *
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8177/'
R = {'checks': {}}
def ok(k, v): R['checks'][k] = bool(v); print('check', k, bool(v), flush=True)
async def main():
  async with async_playwright() as p:
    b, pg, logs = await open_game(p, URL)
    segs = await pg.evaluate("""(async () => { const P = await import('./js/data/phrases.js');
      const d = P.xmDepartSegs(2, 'jtou', Object.keys((await import('./js/data/xm-lines.js')).XM_LINES[2].dirs)[0], 1, false);
      return d.map(s => s.id); })()""")
    print('segs', segs, flush=True)
    ok('departHasVisit', 'voice.xmvisit.jtou.zh' in segs and 'voice.xmvisit.jtou.en' in segs and segs.index('voice.xmvisit.jtou.zh') > segs.index('voice.next.jtou.zh'))
    man = await pg.evaluate("""fetch('assets/audio/manifest.json').then(r => r.json()).then(m => m.assets.filter(a => a.id.startsWith('voice.xmvisit.')).map(a => a.file))""")
    ok('manifest14', len([f for f in man if not f.endswith('-nan.mp3')]) == 14 and len([f for f in man if f.endswith('-nan.mp3')]) == 7)   # 普通话+英语 14 条 + 闽南语 7 条
    okf = await pg.evaluate("""(async (fs) => { for (const f of fs) { const r = await fetch('assets/audio/' + f); if (!r.ok) return false; } return true; })""", man)
    ok('mp3sLoad', okf)
    await pg.evaluate("""(() => { const g=__game; g.east.ensure(); g.east.side='xm'; g.east.cur={st:g.station, loc:'xmmetro', area:'metro'}; g.xmMetro.enterFromRailway(g.player); })()""")
    await asyncio.sleep(1); await pg.evaluate('__game.openMap()'); await asyncio.sleep(0.6)
    n = await pg.evaluate('document.querySelectorAll("#netmap g.attr[data-attr^=xm-]").length'); ok('mapIcons7', n == 7)
    box = await pg.evaluate('(() => { const r = document.querySelector("#netmap g.attr[data-attr=xm-jtou] circle").getBoundingClientRect(); return [r.x + r.width/2, r.y + r.height/2]; })()')
    await pg.mouse.click(box[0], box[1]); await asyncio.sleep(0.5)
    s = await st(pg); print('card', s['attrCard'], flush=True)
    ok('cardJtou', s['attrCard'] and '莲龙小学' in s['attrCard']['text'] and '2' in s['attrCard']['text'])
    R['errors'] = errs(logs); good = all(R['checks'].values()) and not R['errors']
    print(json.dumps(R, ensure_ascii=False, indent=1, default=str))
    print('XMVISITS', 'PASS' if good else 'FAIL', [k for k, v in R['checks'].items() if not v], flush=True)
    await b.close()
    if not good: sys.exit(1)
if __name__ == "__main__": asyncio.run(main())
