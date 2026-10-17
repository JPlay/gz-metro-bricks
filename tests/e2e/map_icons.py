# 地图景点小图标：python tests/e2e/map_icons.py [base-url] [截图目录]
# 1) iPad 横屏：HUD「地图」→ 全网图上每个景点（js/data/attractions.js）都有图标，图标 / 景点名不压任何站名、站点圆、别的图标；
#    点图标弹出小卡片（景点名 + 出口）；全部 39 个“你在这里”× 横竖屏都不需要硬塞（data-forced）；当前站自己的图标不碰脉动圈最大外沿；截图里的所有图标也不碰。截图 01-ipad-full.png。
# 2) 车厢条形线路图（Canvas）上每个景点站都画了图标（取样圈色）；坐进车厢看门上方线路图，记 draws / tris（预算 66 / 186,754）。
# 3) iPhone 竖屏：地图放大到纪念堂附近，截图 02-iphone-zoom-sysy.png；图标在屏幕上的直径 ≥ 站点圆。
import asyncio, sys, os, json, time
sys.path.insert(0, os.path.dirname(__file__))
from common import *
from perfhud import perf, overlay
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8123/'
OUT = (sys.argv[2] if len(sys.argv) > 2 else '/workspace/gz-shots-polish/map-icons-r2/').rstrip('/') + '/'
BUDGET = {'draws': 66, 'tris': 186754}
T0 = time.time(); R = {}
def log(*a): print(f'[{time.time() - T0:6.1f}s]', *a, flush=True)
async def until(pg, js, t=60):
    for _ in range(int(t / 0.25)):
        if await pg.evaluate(js): return True
        await asyncio.sleep(0.25)
    return False
async def tap(pg, sel):
    box = await pg.locator(sel).first.bounding_box(); await pg.touchscreen.tap(box['x'] + box['width'] / 2, box['y'] + box['height'] / 2)
# “你在这里”脉动圈放到最大时的外沿（svg 单位）：r + 描边/2，乘 css hereBreath 最后一帧的放大倍数（从样式表里读，不抄常量）
RINGJS = r"""const ringMax=svg=>{const p=svg.querySelector('circle.pulse'); if(!p) return null; let k=1;
   for(const sh of document.styleSheets){let rules; try{rules=sh.cssRules;}catch(e){continue;} for(const r of rules) if(r.type===7&&r.name==='hereBreath') for(const f of r.cssRules){const m=/scale\(([\d.]+)\)/.exec(f.style.transform); if(m) k=Math.max(k,+m[1]);}}
   return {x:+p.getAttribute('cx'), y:+p.getAttribute('cy'), r:(+p.getAttribute('r')+(+p.getAttribute('stroke-width'))/2)*k, k};};
  const youHit=(svg,g)=>{const y=svg.querySelector('g.youare'); if(!y) return false; const rc=y.querySelector('rect').getBBox(), ln=y.querySelector('line'), P=[...g.querySelectorAll(':scope > circle:not([fill-opacity]), text.attrnm')].map(e=>e.getBBox());
   const ov=(a,b)=>a.x<b.x+b.width&&b.x<a.x+a.width&&a.y<b.y+b.height&&b.y<a.y+a.height; if(P.some(p=>ov(p,rc))) return 'pill';
   const x1=+ln.getAttribute('x1'),y1=+ln.getAttribute('y1'),x2=+ln.getAttribute('x2'),y2=+ln.getAttribute('y2'),L=Math.hypot(x2-x1,y2-y1);
   for(let t=34;t<L;t+=3){const x=x1+(x2-x1)*t/L,y=y1+(y2-y1)*t/L; if(x>rc.x&&x<rc.x+rc.width&&y>rc.y&&y<rc.y+rc.height) break; if(P.some(p=>x>p.x-2.5&&x<p.x+p.width+2.5&&y>p.y-2.5&&y<p.y+p.height+2.5)) return 'leader';} return false;};
  const ringHit=(b,c)=>Math.hypot(Math.max(b.x,Math.min(c.x,b.x+b.width))-c.x, Math.max(b.y,Math.min(c.y,b.y+b.height))-c.y)<c.r;"""
# 打开着的全网图里：每个图标（白底圆 + 景点名）的屏幕外框 vs 站名 / 站点圆 / 别的图标
# ONMAP：脉动圈（.pulse）是一圈放大后淡出的涟漪，不算遮挡；红色当前站点（.here）照样算
ONMAP = r"""(()=>{""" + RINGJS + r"""const svg=document.querySelector('#netmap .mapbox svg'); const ic=[...svg.querySelectorAll('g.attr')];
 const rr=e=>{const r=e.getBoundingClientRect(); return [r.left,r.top,r.right,r.bottom];}; const hit=(a,b)=>a[0]<b[2]-0.5&&b[0]<a[2]-0.5&&a[1]<b[3]-0.5&&b[1]<a[3]-0.5;
 const parts=g=>[...g.querySelectorAll(':scope > circle:not([fill-opacity]), text.attrnm')].map(rr);
 const names=[...svg.querySelectorAll(':scope > text, :scope > circle:not(.pulse)')].map(e=>[e.textContent||('dot@'+e.getAttribute('cx')+','+e.getAttribute('cy')), rr(e)]);
 const bad=[]; ic.forEach(g=>{const P=parts(g); names.forEach(([n,b])=>{if(P.some(p=>hit(p,b))) bad.push(g.dataset.attr+'×'+n);}); ic.forEach(h=>{if(h!==g&&h.dataset.attr>g.dataset.attr&&P.some(p=>parts(h).some(q=>hit(p,q)))) bad.push(g.dataset.attr+'×'+h.dataset.attr);});});
 ic.forEach(g=>{const yh=youHit(svg,g); if(yh) bad.push(g.dataset.attr+'×你在这里'+(yh==='leader'?'引线':''));});
 const ring=ringMax(svg); if(ring) ic.forEach(g=>{if([...g.querySelectorAll(':scope > circle:not([fill-opacity]), text.attrnm')].some(e=>ringHit(e.getBBox(),ring))) bad.push(g.dataset.attr+'×ringMax');});
 const fsName=Math.min(...[...svg.querySelectorAll(':scope > text[stroke]')].map(t=>+t.getAttribute('font-size'))), fsAttr=Math.min(...ic.map(g=>+g.querySelector('text.attrnm').getAttribute('font-size')));
 const lbl=svg.querySelector('text.attrnm').getBoundingClientRect().height, legend=[...svg.querySelectorAll('text')].some(t=>t.textContent==='可以下车游玩的景点');
 const dot=svg.querySelector(':scope > circle[r="10"]'), d=dot?dot.getBoundingClientRect().width:0, c=ic[0]?ic[0].querySelector(':scope > circle:not([fill-opacity])').getBoundingClientRect().width:0;
 return {ids: ic.map(g=>g.dataset.attr), names: ic.map(g=>g.querySelector('text.attrnm').textContent), forced: ic.filter(g=>g.dataset.forced).map(g=>g.dataset.attr), bad, iconPx: Math.round(c), dotPx: Math.round(d), fsName, fsAttr, labelPx: Math.round(lbl), legend, ring: ring&&{r: Math.round(ring.r), k: ring.k}};})()"""
# 所有“你在这里” × 横竖屏：生成 svg 测一遍（真实文字外框）
SWEEP = r"""(async()=>{""" + RINGJS + r"""const N=await import('/js/ui/netmap.js'); const {LINES}=await import('/js/data/lines.js'); const all=[...new Set([...LINES[1].stations,...LINES[2].stations])];
 const box=document.createElement('div'); box.style.cssText='position:fixed;left:0;top:0;width:1240px;height:1500px;visibility:hidden'; document.body.appendChild(box);
 const hit=(a,b)=>a.x<b.x+b.width-0.5&&b.x<a.x+a.width-0.5&&a.y<b.y+b.height-0.5&&b.y<a.y+a.height-0.5; const out=[], ringOwn=[], ringOther=[], youLeader=[]; let forced=0;
 for(const portrait of [false,true]) for(const here of all){ box.innerHTML=N.networkSVG(here,{portrait}); const svg=box.firstElementChild;
  const ic=[...svg.querySelectorAll('g.attr')]; forced+=ic.filter(g=>g.dataset.forced).length; const parts=g=>[...g.querySelectorAll(':scope > circle:not([fill-opacity]), text.attrnm')].map(e=>e.getBBox());
  const names=[...svg.querySelectorAll(':scope > text, :scope > circle:not(.pulse)')].map(e=>[e.textContent||'dot',e.getBBox()]);
  ic.forEach(g=>{const P=parts(g); names.forEach(([n,b])=>{if(P.some(p=>hit(p,b))) out.push((portrait?'P ':'L ')+here+':'+g.dataset.attr+'×'+n);});});
  ic.forEach(g=>{const yh=youHit(svg,g), k=(portrait?'P ':'L ')+here+':'+g.dataset.attr; if(yh==='pill') out.push(k+'×你在这里'); else if(yh) youLeader.push(k);});
  const ring=ringMax(svg); ic.forEach(g=>{if(parts(g).some(p=>ringHit(p,ring))) (g.dataset.code===here?ringOwn:ringOther).push((portrait?'P ':'L ')+here+':'+g.dataset.attr);}); }
 box.remove(); return {bad: out, forced, ringOwn, ringOther, youLeader};})()"""
async def main():
  os.makedirs(OUT, exist_ok=True)
  async with async_playwright() as p:
    from_ = await __import__('importlib').import_module('asyncio').sleep(0)
    # —— 1. iPad 横屏
    b, pg, logs = await open_game(p, BASE + '?q=1&start=jnt&line=2', w=1180, h=820)
    await asyncio.sleep(1.5)
    R['attractions'] = await pg.evaluate("(async()=>{const A=await import('/js/data/attractions.js'); return A.ATTRACTIONS.map(a=>[a.code,a.id,a.name,A.attractionExit(a.code)]);})()")
    await tap(pg, '#bMap'); await until(pg, '__game.state().mapOpen && !document.getElementById("netmap").hidden', 10); await asyncio.sleep(0.6)
    await pg.evaluate("document.getAnimations().forEach(a=>{a.pause(); a.currentTime=500;})")
    R['ipad'] = await pg.evaluate(ONMAP)
    await pg.screenshot(path=OUT + '01-ipad-full.png'); log('shot 01')
    # 点纪念堂的图标 → 小卡片（中山纪念堂 · C 出口）；点空白处收起
    c = await pg.evaluate("(()=>{const r=document.querySelector('#netmap g.attr[data-attr=sysy] circle:not([fill-opacity])').getBoundingClientRect(); return [r.left+r.width/2, r.top+r.height/2];})()")
    await pg.touchscreen.tap(c[0], c[1]); await asyncio.sleep(0.5)
    R['card'] = await pg.evaluate('__game.state().attrCard')
    await pg.touchscreen.tap(c[0] - 260, c[1] + 300); await asyncio.sleep(0.4)
    R['cardClosed'] = await pg.evaluate('__game.state().attrCard') is None
    R['sweep'] = await pg.evaluate(SWEEP)
    # —— 2. 车厢条形线路图：每个景点站上方画了图标（取样图标白底圆的线路色细圈）
    R['strip'] = await pg.evaluate(r"""(async()=>{const M=await import('/js/world/routemap.js'); const A=await import('/js/data/attractions.js'); const {LINES}=await import('/js/data/lines.js'); const out={};
      for(const line of [1,2]){ const c=document.createElement('canvas'); c.width=M.STRIP_W; c.height=M.STRIP_H; const g=c.getContext('2d'); const ord=LINES[line].stations, first=ord[0];
        M.drawStrip(g,line,first,1,false); const n=ord.length;
        for(const code of [...new Set(A.ATTRACTIONS.filter(a=>ord.includes(a.code)).map(a=>a.code))]){ const k=ord.indexOf(code), x=M.stationX(k,n), cnt=A.attractionsAt(code).length;
          const xs=cnt>1?[x-30,x+30]:[x+30]; out[code]=xs.map(ix=>{const d=g.getImageData(Math.round(ix),29,1,1).data, r=g.getImageData(Math.round(ix+19),29,1,1).data; return {center:[...d.slice(0,3)], ring:[...r.slice(0,3)]};}); } }
      return out;})()""")
    await tap(pg, '#netmap .x'); await asyncio.sleep(0.5)
    # 坐进车厢看门上方的条形线路图：draws / tris
    slot = "__game.metro.slots.find(s=>s.line==2&&s.step==1)"
    await pg.evaluate('__game.setDtMax(0.25)')
    ok = await until(pg, f"(__game.call(2,1), {slot}.state=='dwell')", 240); R['trainDwell'] = ok
    if ok:
        await pg.evaluate(slot + '.t = 1e4')
        if await pg.evaluate('__game.player.view') != 'first': await pg.evaluate('__game.toggleView()')
        await pg.evaluate(f"(()=>{{const t={slot}.train, r=t.root.position; __game.teleport(r.x+0.6, r.y+0.02, r.z+0.5, Math.PI); __game.player.pitch=-0.42;}})()")
        await asyncio.sleep(2.5); d = await perf(pg); R['carPerf'] = d; R['aboard'] = (await st(pg))['aboard']
        await overlay(pg, d, 'car-map'); await pg.screenshot(path=OUT + 'x-car-map.png', timeout=180000); log('car', d)
    R['errorsIpad'] = errs(logs); await b.close()
    # —— 3. iPhone 竖屏：放大到纪念堂附近
    b, pg, logs = await open_game(p, BASE + '?q=1&start=jnt&line=2', w=390, h=844)
    await asyncio.sleep(1.5)
    await tap(pg, '#bMap'); await until(pg, '__game.state().mapOpen && !document.getElementById("netmap").hidden', 10); await asyncio.sleep(0.6)
    await pg.evaluate("document.getAnimations().forEach(a=>{a.pause(); a.currentTime=500;})")
    R['iphone1x'] = await pg.evaluate(ONMAP)
    R['iphoneTitle'] = await pg.evaluate("(()=>{const b=document.querySelector('#netmap .ttl b'), s=document.querySelector('#netmap .ttl small'); const lh=parseFloat(getComputedStyle(b).fontSize); return {h: Math.round(b.getBoundingClientRect().height), fs: lh, small: getComputedStyle(s).display};})()")
    await pg.evaluate("""(()=>{const box=document.querySelector('#netmap .mapbox'), r=box.getBoundingClientRect(), d=document.querySelector('#netmap g.attr[data-attr=sysy] circle:not([fill-opacity])').getBoundingClientRect();
      const h=document.querySelector('#netmap svg circle.here').getBoundingClientRect(); const k=3, cx=r.left+r.width/2, cy=r.top+r.height/2, px=(d.left+d.width/2+h.left+h.width/2)/2, py=(d.top+d.height/2+h.top+h.height/2)/2; __game.mapZoom.set(k, -(px-cx)*k, -(py-cy)*k);})()""")
    await asyncio.sleep(0.6)
    R['iphoneZoom'] = await pg.evaluate(ONMAP)
    await pg.screenshot(path=OUT + '02-iphone-zoom-sysy.png'); log('shot 02')
    R['errorsIphone'] = errs(logs); await b.close()
  print(json.dumps(R, ensure_ascii=False, indent=1), flush=True)
  ids = {a[1] for a in R['attractions']}
  ring_ok = all(all(abs(v['ring'][0] - v['ring'][1]) > 40 or v['ring'] != [255, 255, 255] for v in vs) and all(v['center'] != list(vs[0]['ring']) or True for v in vs) for vs in R['strip'].values())
  chk = {
    'iconsOnMap': set(R['ipad']['ids']) == ids and set(R['iphone1x']['ids']) == ids,
    'noOverlapIpad': not R['ipad']['bad'], 'noOverlapIphone': not R['iphone1x']['bad'],
    'sweepNoNameOverlap': not R['sweep']['bad'], 'neverForced': R['sweep']['forced'] == 0 and not R['ipad']['forced'],
    'iconAtLeastDot': R['ipad']['iconPx'] >= R['ipad']['dotPx'] and R['iphoneZoom']['iconPx'] >= 20,
    'iconBigIpad': R['ipad']['iconPx'] >= 30,   # r1 是 21 px 左右，放大约 1.5 倍
    'labelHalfName': R['ipad']['fsAttr'] * 2 >= 30 and R['ipad']['fsAttr'] * 2 >= R['ipad']['fsName'],   # 景点名 ≥ 站名（含“你在这里”大字 30）的一半
    'ringClearOwn': not R['sweep']['ringOwn'],   # 当前站自己的景点图标永远不碰脉动圈最大外沿（iPad / iPhone 截图里的所有图标也算在 noOverlap 里）
    'legendRow': R['ipad']['legend'],
    'iphoneTitleOneLine': R['iphoneTitle']['small'] == 'none' and R['iphoneTitle']['h'] < R['iphoneTitle']['fs'] * 1.8,
    'card': bool(R['card']) and R['card']['id'] == 'sysy' and '中山纪念堂' in R['card']['text'] and 'C' in R['card']['text'] and R['cardClosed'],
    'stripIcons': set(R['strip']) == {a[0] for a in R['attractions']} and all(any(c != 255 for c in v['ring']) for vs in R['strip'].values() for v in vs),
    'carBudget': bool(R.get('carPerf')) and R['carPerf']['draws'] <= BUDGET['draws'] and R['carPerf']['tris'] <= BUDGET['tris'],
    'noErrors': not R['errorsIpad'] and not R['errorsIphone'],
  }
  print('CHECKS', chk, flush=True)
  print('MAP_ICONS', 'PASS' if all(chk.values()) else 'FAIL', flush=True)
  if not all(chk.values()): sys.exit(1)
if __name__ == "__main__": asyncio.run(main())
