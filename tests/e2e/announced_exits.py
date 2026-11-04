# 报站 / 车厢屏里说的出口必须真的存在，而且从那个出口真的能走到景点。
# 1. 静态：
#    - 广州：VISITS 里每个带出口的景点，出口 = 站里真有的出口（station.js exitMain）；车厢屏黄条和三语报站文字都写这个出口。
#    - 厦门：改过的站（镇海路 / 蔡塘）报站出口 = 街区出口亭 XM_EXITS[code].n；莲花路口、后埔不再报景点（忠仑公园只在蔡塘报）。
#    - 删掉的景点（没搭出来的）在所有 visit / xmvisit / xmexit 片段和车厢屏黄条里都不能再出现。
#    - 语音清单 manifest 里这些片段的文字 = phrases.js 导出的文字（音频和屏幕一致），MP3 文件存在。
# 2. 步行（autopilot，只在起点传送到站台）：
#    - 广州 烈士陵园 / 东山口 / 公园前 / 越秀公园：站台 → 报的出口 → 街面 → 景点跟前 → 走回出口 → 站厅
#    - 厦门 镇海路：站台 → 1 号出口 → 和平码头、中山路骑楼街 → 回出口亭 → 站厅 → 站台
#    - 厦门 蔡塘：站台 → 2 号出口 → 忠仑公园（进大门到湖边步道）→ 回出口亭 → 站厅 → 站台
# 用法：python tests/e2e/announced_exits.py [base-url] [static,gz,xm（可选，默认全部）]
import asyncio, sys, json, os, math
sys.path.insert(0, os.path.dirname(__file__))
from common import *
from journey import GCLOCK, auto, log
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8123/'
PARTS = sys.argv[2].split(',') if len(sys.argv) > 2 else ['static', 'gz', 'xm']
R = {'checks': {}, 'info': {}}
def ok(k, v, extra=None):
    R['checks'][k] = bool(v); log('check', k, bool(v), '' if v else extra); return v

GZ_REMOVED = ['kk', 'fc', 'csl', 'xmk', 'tyzx', 'lx', 'nz', 'jnx', 'seg', 'hzgc', 'syl', 'bygy', 'bywhgc']
GZ_GONE = ['黄大仙', '醉观', '上下九', '荔枝湾', '光孝寺', '北京路', '东山湖', '天河体育中心', '洛溪大桥', '洛浦', '海珠儿童公园', '陈李济', '十香园',
           '大元帅府', '石室', '圣心', '镇海楼', '抗英', '规划展览', 'Zhenhai Tower', 'Beijing Road', 'Dongshan Lake', 'Exit C. ', 'Wong Tai Sin']
GZ_EXPECT = {'lsly': 'D', 'dsk': 'D', 'gyq': 'D', 'yxgy': 'B1'}
XM_REMOVED = ['lhj', 'hpu']
XM_EXPECT = {'zhl': '1', 'ctg': '2'}
STATIC = """async (a) => {
  const V = await import('/js/data/visits.js'), X = await import('/js/data/xm-visits.js'), Ph = await import('/js/data/phrases.js');
  const L = await import('/js/data/lines.js'), XS = await import('/js/world/xmStreet.js');
  const man = await (await fetch('/assets/audio/manifest.json')).json(), M = {}; for (const m of man.assets) M[m.id] = m;
  const jobs = Ph.allJobs().filter(j => /^voice\\.(visit|xmvisit|xmexit)\\./.test(j.id));
  const gz = Object.entries(V.VISITS).map(([c, v]) => { const s = L.STATIONS[c]; return { code: c, exit: v.exit || null,
    real: s.attraction ? s.attraction.exit : s.exitMain || 'D', banner: V.visitBanner(c), texts: V.visitTexts(c, s.zh + '站', s.en + ' station') }; });
  const gzRemoved = a.gzRemoved.map(c => ({ code: c, texts: V.visitTexts(c, 'x', 'x'), banner: V.visitBanner(c), segs: Ph.visitSegs(c).length }));
  const xm = Object.keys(a.xmExpect).map(c => ({ code: c, guides: X.xmGuides(c).map(g => g.exit), kiosk: XS.XM_EXITS[c] && XS.XM_EXITS[c].n,
    to: XS.XM_EXITS[c] && [...(XS.XM_EXITS[c].to || []), ...(XS.XM_EXITS[c].toEn || [])], visit: X.xmVisitTexts(c, 'x', 'x'), exitT: X.xmExitTexts(c) }));
  const xmRemoved = a.xmRemoved.map(c => ({ code: c, v: !!X.XM_VISITS[c], visit: X.xmVisitTexts(c, 'x', 'x'), exitT: X.xmExitTexts(c), icon: X.XM_ATTRACTIONS.some(t => t.code === c) }));
  const zl = Object.entries(X.XM_VISITS).filter(([c, v]) => v.zh.includes('忠仑公园')).map(([c]) => c);
  const clips = jobs.map(j => ({ id: j.id, text: j.text, file: j.file, man: M[j.id] ? M[j.id].text : null, mfile: M[j.id] ? M[j.id].file : null }));
  const allXm = Object.keys(X.XM_VISITS).map(c => ({ code: c, g: X.xmGuides(c).map(g => g.exit), n: XS.XM_EXITS[c] ? XS.XM_EXITS[c].n : null }));
  return { gz, gzRemoved, xm, xmRemoved, zl, clips, allXm };
}"""
async def static(p):
    b, pg, logs = await open_game(p, BASE + '?q=1')
    try:
        S = await pg.evaluate(STATIC, {'gzRemoved': GZ_REMOVED, 'xmRemoved': XM_REMOVED, 'xmExpect': XM_EXPECT})
        for g in S['gz']:
            c, ex = g['code'], g['exit']
            if not ex: ok(f'static:gz:{c}:noExitNamed', all('出口' not in t and 'Exit' not in t for t in g['texts']) and '出口' not in g['banner'], g); continue
            ok(f'static:gz:{c}:exitIsReal', ex == g['real'], g)
            ok(f'static:gz:{c}:textsSayExit', f'{ex}出口' in g['texts'][0] and f'{ex}出口' in g['texts'][1] and f'Exit {ex}' in g['texts'][2] and f'（{ex} 出口）' in g['banner'], g)
        for c, ex in GZ_EXPECT.items():
            g = next((x for x in S['gz'] if x['code'] == c), None); ok(f'static:gz:{c}:announces{ex}', g and g['exit'] == ex, g)
        for g in S['gzRemoved']: ok(f"static:gz:{g['code']}:removed", g['texts'] is None and g['banner'] == '' and g['segs'] == 0, g)
        for g in S['gz']:
            bad = [w for w in GZ_GONE if w in g['banner'] or any(w in t for t in g['texts'])]; ok(f"static:gz:{g['code']}:noGoneNames", not bad, bad)
        for x in S['xm']:
            c = x['code']; ex = XM_EXPECT[c]
            ok(f'static:xm:{c}:exit{ex}', x['guides'] == [ex] and x['kiosk'] == ex, x)
            ok(f'static:xm:{c}:texts', f'请从{ex}号出口出站' in x['visit'][0] and f'Please use Exit {ex}.' in x['visit'][2] and f'请从{ex}号出口出站' in x['exitT'][0] and f'please use Exit {ex}.' in x['exitT'][2], x)
            ok(f'static:xm:{c}:no3B', not any('3B' in t for t in (x['to'] or []) + [x['visit'][0], x['visit'][2], x['exitT'][0], x['exitT'][2]]), x)
        for x in S['xmRemoved']: ok(f"static:xm:{x['code']}:removed", not x['v'] and x['visit'] is None and x['exitT'] is None and not x['icon'], x)
        for x in S['allXm']: ok(f"static:xm:{x['code']}:guideExitIsKiosk", x['n'] is not None and set(x['g']) <= {x['n']}, x)
        ok('static:xm:zhonglunOnlyAtCaitang', S['zl'] == ['ctg'], S['zl'])
        ids = {c['id'] for c in S['clips']}
        gone = [i for i in ids if any(f'.{c}.' in i for c in GZ_REMOVED + XM_REMOVED)]
        ok('static:clips:removedNotQueued', not gone, gone)
        mine = [c for c in S['clips'] if any(f'visit.{k}.' in c['id'] or f'xmexit.{k}.' in c['id'] for k in list(GZ_EXPECT) + list(XM_EXPECT))]
        ok('static:clips:count', len(mine) == 4 * 3 + 2 * 2 * 3, len(mine))
        for c in mine: ok(f"static:clip:{c['id']}:matchesText", c['man'] == c['text'] and c['mfile'] == c['file'], c)
        for c in mine:
            n = await pg.evaluate("async f => { const r = await fetch('/assets/audio/' + f); return r.ok ? (await r.arrayBuffer()).byteLength : -r.status; }", c['file']); ok(f"static:clip:{c['id']}:file", n > 4000, n)
        bad = [c['id'] for c in S['clips'] if c['man'] is not None and c['man'] != c['text']]
        ok('static:clips:allVisitClipsMatchText', not bad, bad)
        ok('static:noErrors', not errs(logs), errs(logs)[:5])
    finally: await b.close()

# ---------- 广州：站台 → 出口 → 街面 → 景点 → 回站厅 ----------
OUTR = [[18.6, 13.1], [15.4, 13.1], [-1.6, 13.1], [-2.2, 13.1], [-2.2, 1.4], [2, 1.4], [2, -4.6], [8.6, -4.6], [10.5, -4.6], [10.5, -15.6], [1.2, -15.6], [1.2, -20], [1.2, -36], [1.2, -42]]
BACK = [[1.2, -42], [1.2, -20], [1.2, -15.6], [10.5, -15.6], [10.5, -4.6], [3, -4.6]]
# 景点跟前的目标点（街面坐标；见 js/world/station.js 招牌站地标、js/world/wy.js）：去的路、景点中心、要走到多近
GZ_WALK = {
    'lsly': ([[1.2, -46], [-16, -46], [-16, -8], [-8, -2]], (0, 0), 9.5, '纪念碑（台基 ±6）'),
    'dsk': ([[1.2, -48], [-12, -48], [-12, -44]], (-22, -44), 10.5, '红砖洋楼（西南那栋，东墙 x=-16）'),
    'gyq': ([[1.2, -48], [-12, -48], [-14, -42]], (-24, -40), 10.5, '人民公园喷泉（池半径 7.4）'),
    'yxgy': ([[1.2, -50], [1.2, -70], [0, -84], [0, -88]], (0, -106), 21.5, '五羊石像山岗脚下的石阶（山岗半径 16）'),
}
async def gz_one(p, code):
    b, pg, logs = await open_game(p, BASE + f'?q=1&start={code}&line=' + ('2' if code == 'yxgy' else '1'))
    try:
        await pg.evaluate(GCLOCK); await pg.evaluate('__game.setDtMax(0.25)'); await asyncio.sleep(1.5)
        if await pg.evaluate('__game.player.view') != 'third': await pg.evaluate('__game.toggleView()')
        real = await pg.evaluate('__game.station.exitMain'); ok(f'gz:{code}:stationExitIs{GZ_EXPECT[code]}', real == GZ_EXPECT[code], real)
        await pg.evaluate('__game.teleport(18.6,-11.95,12.6,0)'); await asyncio.sleep(0.8)
        for pt in OUTR: await auto(pg, [pt])
        s = await st(pg); ok(f'gz:{code}:platformToStreet', s['zone'] == 'street', s['pos'])
        if s['zone'] != 'street': return
        path, (cx, cz), near, what = GZ_WALK[code]
        for pt in path: await auto(pg, [pt])
        s = await st(pg); d = math.hypot(s['pos'][0] - cx, s['pos'][2] - cz); R['info'][code] = {'at': s['pos'], 'dist': round(d, 1), 'what': what}
        ok(f'gz:{code}:reachAttraction', s['zone'] == 'street' and d <= near, (s['pos'], d))
        await pg.evaluate("__game.player.view==='first' || __game.toggleView()"); await pg.evaluate(f"(() => {{ const p=__game.player; p.yaw=Math.atan2({cx}-p.position.x, {cz}-p.position.z); p.pitch=0.05; }})()")
        await asyncio.sleep(2); os.makedirs('/tmp/announced_exits', exist_ok=True)
        try: await safe_shot(pg, path=f'/tmp/announced_exits/gz_{code}.jpg', type='jpeg', quality=60, timeout=240000)
        except Exception as e: log('shot fail', e)
        await pg.evaluate("__game.player.view==='third' || __game.toggleView()")
        for pt in list(reversed(path[:-1])) + BACK: await auto(pg, [pt])
        s = await st(pg); ok(f'gz:{code}:backToConcourse', s['zone'] == 'concourse', s['pos'])
        ok(f'gz:{code}:noErrors', not errs(logs), errs(logs)[:5])
    finally: await b.close()

# ---------- 厦门：站台 → 出口 → 景点 → 回站台 ----------
XO = 3000; XSX = 4000
XM_WALK = {
    'zhl': [('和平码头', [[4000, 6], [4030, 40], [4030, 72]], lambda q: q[2] > 68 and 4000 < q[0] < 4060),
            # 骑楼街只朝南（马路边人行道）开口：沿人行道往西再拐进去
            ('中山路骑楼街', [[4000, 6], [3990, -3.5], [3970, -3.5], [3930, -3.5], [3930, 40]], lambda q: 3916 < q[0] < 3944 and q[2] > 30)],
    'ctg': [('忠仑公园', [[4000, 6], [4000, 30], [4000, 72]], lambda q: abs(q[0] - 4000) < 3 and q[2] > 68)],
}
async def xm_one(pg, code):
    zm = await pg.evaluate(f"""(() => {{ const e=__game.east; e.cur.loc='xmmetro'; e.cur.area='metro'; const m=__game.xmMetro; if (m.street) m.backFromStreet(); const st=m.buildStation('{code}');
      const P=st.platforms.find(p=>p.up); return P ? (P.up.z0+P.up.z1)/2 : null; }})()""")
    ex = await pg.evaluate(f"(async () => {{ const S = await import('/js/world/xmStreet.js'); const e=S.XM_EXITS['{code}']; return {{x:e.x, n:e.n}}; }})()")
    ok(f'xm:{code}:kioskExit{XM_EXPECT[code]}', ex['n'] == XM_EXPECT[code], ex)
    await pg.evaluate(f"__game.player.spawn({XO}+2, -12.95, {zm}, -Math.PI/2)"); await asyncio.sleep(1)
    await auto(pg, [[XO - 3, zm], [XO - 12, zm]], True); await auto(pg, [[XO - 21.5, zm]], True); await auto(pg, [[XO - 22, -6], [XO - 15, -12]], True)
    s = await st(pg); ok(f'xm:{code}:platformToConcourse', s['zone'] == 'concourse', s['pos'])
    await auto(pg, [[XO + ex['x'], -16]], True); await auto(pg, [[XO + ex['x'], -20], [XO + ex['x'], -36]], True)
    street = await pg.evaluate("__game.xmMetro.street ? __game.xmMetro.street.info().code : null")
    ok(f'xm:{code}:exitToStreet', street == code, street)
    if street != code: return
    for name, path, good in XM_WALK[code]:
        for pt in path: await auto(pg, [pt], True)
        s = await st(pg); R['info'][f'{code}:{name}'] = s['pos']; ok(f'xm:{code}:reach:{name}', good(s['pos']) and await pg.evaluate('!!__game.xmMetro.street'), s['pos'])
        await pg.evaluate("__game.player.view==='first' || __game.toggleView()"); await pg.evaluate('__game.player.pitch=0.05'); await asyncio.sleep(2)
        os.makedirs('/tmp/announced_exits', exist_ok=True)
        try: await safe_shot(pg, path=f'/tmp/announced_exits/xm_{code}_{len(R["info"])}.jpg', type='jpeg', quality=60, timeout=240000)
        except Exception as e: log('shot fail', e)
        await pg.evaluate("__game.player.view==='third' || __game.toggleView()")
        for pt in list(reversed(path[:-1])): await auto(pg, [pt], True)
    await auto(pg, [[XSX, 2], [XSX, -1.5], [XSX, -4.5]], True); await asyncio.sleep(0.5)
    s = await st(pg); ok(f'xm:{code}:backToKiosk', not await pg.evaluate('!!__game.xmMetro.street') and s['pos'][2] < -33, s['pos'])
    await auto(pg, [[XO + ex['x'], -20], [XO + ex['x'], -15]], True)
    await auto(pg, [[XO - 15, -12], [XO - 22, -6], [XO - 22, zm]], True); await auto(pg, [[XO - 10, zm]], True); await auto(pg, [[XO + 2, zm]], True)
    s = await st(pg); ok(f'xm:{code}:backToPlatform', s['zone'] == 'platform' and abs(s['pos'][1] + 13) < 0.3, s['pos'])
async def xm(p):
    b, pg, logs = await open_game(p, BASE + '?q=1')
    try:
        await pg.evaluate(GCLOCK); await pg.evaluate('__game.setDtMax(0.25)'); await asyncio.sleep(1)
        await pg.evaluate("""(() => { const g=__game; g.east.ensure(); g.east.side='xm'; g.east.cur={st:g.station, loc:'xmmetro', area:'metro'}; g.station.kit.root.setEnabled(false); g.xmMetro.enterFromRailway(g.player); if (g.player.view!=='third') g.toggleView(); })()""")
        await asyncio.sleep(1.5)
        for c in (os.environ.get('XM_CODES', '').split(',') if os.environ.get('XM_CODES') else XM_EXPECT): await xm_one(pg, c)
        ok('xm:noErrors', not errs(logs), errs(logs)[:5])
    finally: await b.close()

async def main():
    async with async_playwright() as p:
        if 'static' in PARTS: await static(p)
        if 'gz' in PARTS:
            for c in GZ_EXPECT: await gz_one(p, c)
        for part in PARTS:
            if part in GZ_EXPECT: await gz_one(p, part)
        if 'xm' in PARTS: await xm(p)
    print(json.dumps(R, ensure_ascii=False, indent=1, default=str))
    bad = [k for k, v in R['checks'].items() if not v]
    print('ANNOUNCED_EXITS', 'PASS' if not bad else 'FAIL', bad, flush=True)
    if bad: sys.exit(1)
if __name__ == '__main__': asyncio.run(main())
