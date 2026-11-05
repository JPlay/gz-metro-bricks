# 中山纪念堂室内（小美第二轮走查的两条）：
# 1. 舞台两侧踏步：从观众区走上东侧踏步 → 站到「天下为公」匾下面（舞台面 y≈1.1）→ 从西侧踏步走下来回到地面（真碰撞，autopilot 走）
# 2. 到达卡只弹一次：台阶前第一次到达弹卡（关掉）→ 进门 → 上二楼楼座：没有卡 → 下楼出门、再走过台阶前到达区：不弹卡
#    → 第二次进门上楼座：仍然没有卡
# 另外每个机位记录绘制调用 / 三角形（面数），预算 90k 面 / 50 次绘制。
# 用法：python tests/e2e/jnt_hall.py [base-url]
import asyncio, sys, json, os, math
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from common import *
from journey import GCLOCK, auto, wait, log
from perfhud import perf
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8123/'
SHOTS = '/tmp/jnt_hall/'; os.makedirs(SHOTS, exist_ok=True)
BUDGET = {'tris': 90000, 'draws': 50}
R = {'checks': {}, 'perf': {}}
def ok(k, v, extra=None):
    R['checks'][k] = bool(v); log('check', k, bool(v), '' if v else extra); return v
CARD = "(()=>{const d=__game.state().discover;return d.card||d.cardSoon||!document.getElementById('goalCard').hidden})()"
TO_HALL = [[72, 1.0], [72, 8.6], [72, 10.6]]
UP_BALCONY = [[600, -16.5], [600, -20.5], [597.4, -20.5], [595, -20.5], [592, -20.5], [589.4, -20.5], [588.9, -18.0], [594, -17.9], [600, -17.9], [600, -16.2], [600, -14], [600, -12.45]]
DOWN_BALCONY = [[600, -14], [600, -16.2], [600, -17.9], [594, -17.9], [588.9, -18.0], [589.4, -20.5], [592, -20.5], [595, -20.5], [597.4, -20.5], [600, -20.5]]
async def walk(pg, pts):
    for pt in pts:
        if not await auto(pg, [pt]): return False
    return True
async def P(pg, name):
    d = await perf(pg); R['perf'][name] = d; log('perf', name, d)
    await safe_shot(pg, path=SHOTS + name + '.jpg', type='jpeg', quality=60, timeout=180000)
    ok(f'perf:{name}:budget', d['tris'] < BUDGET['tris'] and d['draws'] < BUDGET['draws'], d)
async def no_card(pg, name, secs=4):
    # 游戏时间 secs 秒内卡片一直不出现（含“马上要弹”的计时）
    appeared = await wait(pg, CARD, secs)
    ok(name, not appeared, await pg.evaluate('__game.state().discover'))
async def balcony(pg, n):
    await walk(pg, UP_BALCONY); s = await st(pg)
    ok(f'balcony{n}:reached', s['zone'] == 'hall' and s['pos'][1] > 4 and s['pos'][2] > -13.5, s['pos'])
    await no_card(pg, f'balcony{n}:noArrivalCard')
    if n == 1: await P(pg, 'balcony')
    await walk(pg, DOWN_BALCONY); s = await st(pg); ok(f'balcony{n}:backDown', s['pos'][1] < 0.3, s['pos'])

# 舞台 3P 镜头区：三个坏点 × yaw 0..2π/8 + 匾下横走
# 规则（小美 option A）：(1) 幕+台口墙板 mesh 遮罩像素 ≤30%  (2) 镜头在幕观众侧且不在台口 AABB  (3) 主角可见
STAGE_SPOTS = [
    ('E_top', 602.9, 1.1, 9.81),
    ('W_top', 597.1, 1.1, 9.8),
    ('oldbad', 597.03, 0.05, 6.72),
]
STAGE_YAWS = [i * math.pi / 4 for i in range(8)]
# 浏览器内 ID/mask 采样：curtMesh+portalMesh→品红，其余→黑（保深度遮挡），计品红占比
OCC_FRAC_JS = r"""(() => {
  const scene = __game.scene, eng = __game.engine, B = BABYLON;
  const hi = __game.station && __game.station.interior;
  if (!hi || !hi.curtMesh || !hi.portalMesh) return -1;
  if (!window.__occBlk) {
    const blk = new B.StandardMaterial('__occBlk', scene);
    blk.disableLighting = true;
    blk.diffuseColor = new B.Color3(0,0,0);
    blk.emissiveColor = new B.Color3(0,0,0);
    blk.specularColor = new B.Color3(0,0,0);
    blk.freeze && blk.freeze();
    window.__occBlk = blk;
  }
  const blk = window.__occBlk;
  const targets = new Set([hi.curtMesh, hi.portalMesh]);
  for (const m of scene.meshes) {
    let p = m.parent;
    while (p) { if (targets.has(p)) { targets.add(m); break; } p = p.parent; }
  }
  const saved = [];
  for (const m of scene.meshes) {
    saved.push({ m, mat: m.material, vis: m.visibility });  // do NOT snapshot isEnabled(): while hall is up street kit.root is disabled, isEnabled() is false for children; restoring setEnabled(false) permanently kills street collision after leaveBuilding
    if (!m.isEnabled()) continue;
    m.visibility = 1;
    if (!targets.has(m)) m.material = blk;
  }
  // force target full vis (override distance curt fade)
  hi.curtMesh.visibility = 1; hi.portalMesh.visibility = 1;
  const prevCC = scene.clearColor.clone();
  scene.clearColor = new B.Color4(0,0,0,1);
  scene.render();
  const canvas = eng.getRenderingCanvas();
  const c2 = document.createElement('canvas'); c2.width = 64; c2.height = 40;
  const ctx = c2.getContext('2d', { willReadFrequently: true });
  let frac = -1;
  try {
    ctx.drawImage(canvas, 0, 0, 64, 40);
    const d = ctx.getImageData(0, 0, 64, 40).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] + d[i+1] + d[i+2] > 24) n++;
    frac = n / (64 * 40);
  } catch (e) { frac = -1; }
  scene.clearColor.copyFrom(prevCC);
  for (const s of saved) { s.m.material = s.mat; s.m.visibility = s.vis; }
  return frac;
})()"""
GEO_OK_JS = r"""(() => {
  const h = __game.station && __game.station.interior, c = __game.player.cam.position;
  return !!(h && h.stageCamGeoOK && h.stageCamGeoOK(c.x, c.y, c.z));
})()"""
async def occ_frac(pg):
    return await pg.evaluate(OCC_FRAC_JS)
async def geo_ok(pg):
    return await pg.evaluate(GEO_OK_JS)
async def stage_cam_audit(pg):
    if await pg.evaluate('__game.player.view') != 'third':
        await pg.evaluate('__game.toggleView()')
    for name, x, y, z in STAGE_SPOTS:
        for i, yaw in enumerate(STAGE_YAWS):
            await pg.evaluate(f'__game.teleport({x},{y},{z},{yaw}); __game.player.pitch=-0.1; __game.player._stageCamK=1; __game.player._stageCamU=1; __game.player._scPos=null; __game.player._scShown=null; for(let i=0;i<90;i++)__game.player.updateCamera(1/60,__game.scene)')
            await asyncio.sleep(0.15)
            info = await pg.evaluate('(()=>{const pl=__game.player,c=pl.cam;return{en:pl.model.isEnabled(),fade:+(pl._heroFade??1).toFixed(3),k:+(pl._stageCamK||0).toFixed(3),pos:[+pl.position.x.toFixed(2),+pl.position.y.toFixed(2),+pl.position.z.toFixed(2)],cam:[+c.position.x.toFixed(2),+c.position.y.toFixed(2),+c.position.z.toFixed(2)],yaw:+pl.yaw.toFixed(3),aimYaw:pl.aimYaw,camRotY:+c.rotation.y.toFixed(3)}})()')
            vis = info['en'] and info['fade'] > 0.02
            rf = await occ_frac(pg)
            gok = await geo_ok(pg)
            ok(f'stageCam:{name}:yaw{i}:hero', vis, info)
            ok(f'stageCam:{name}:yaw{i}:occ', rf >= 0 and rf <= 0.30, {'occFrac': round(rf, 3) if rf is not None else None, **info})
            ok(f'stageCam:{name}:yaw{i}:geo', gok, {'geo': gok, **info})
            dyaw = abs((info['camRotY'] - info['yaw'] + math.pi) % (2*math.pi) - math.pi)
            ok(f'stageCam:{name}:yaw{i}:noFlip', info.get('aimYaw') is None and dyaw < 0.15, {'dyaw': round(dyaw, 3), **info})
    # 匾下东→西横走：每帧主角不得被藏
    await pg.evaluate("""(()=>{
      if (window.__scObs) { __game.scene.onAfterRenderObservable.remove(window.__scObs); window.__scObs=null; }
      const H=window.__scH={n:0,hid:0};
      window.__scObs=__game.scene.onAfterRenderObservable.add(()=>{
        const pl=__game.player; if (pl.view!=='third') return;
        H.n++; if (!pl.model.isEnabled() || (pl._heroFade??1)<0.02) H.hid++;
      });
    })()""")
    await pg.evaluate('__game.teleport(602.9,1.1,9.7,Math.PI); __game.player.pitch=-0.1; __game.player.vy=0; __game.player.grounded=true; __game.player._stageCamK=1; __game.player._stageCamU=1; __game.player._scPos=null; __game.player._scShown=null; for(let i=0;i<90;i++)__game.player.updateCamera(1/60,__game.scene)')
    await asyncio.sleep(0.8)
    await pg.evaluate('__game.setMove(1, 0)')
    walked = False
    for _ in range(50):
        spos = await st(pg)
        if spos['pos'][1] < 0.5:
            break
        if spos['pos'][0] <= 597.25:
            walked = True; break
        await asyncio.sleep(0.2)
    await pg.evaluate('__game.setMove(0, 0)')
    hid = await pg.evaluate('(()=>{const H=window.__scH||{n:0,hid:0}; if(window.__scObs){__game.scene.onAfterRenderObservable.remove(window.__scObs);window.__scObs=null;} return H;})()')
    ok('stageCam:plaqueWalk:reached', walked, {'walked': walked, 'pos': (await st(pg))['pos'], **hid})
    ok('stageCam:plaqueWalk:heroVisible', hid.get('n', 0) > 0 and hid.get('hid', 1) == 0, hid)
    for tag, x in (('plaqueE', 602.5), ('plaqueM', 600.0), ('plaqueW', 597.5)):
        await pg.evaluate(f'__game.teleport({x},1.1,9.7,Math.PI); __game.player.pitch=-0.1; __game.player._stageCamK=1; __game.player._stageCamU=1; __game.player._scPos=null; __game.player._scShown=null; for(let i=0;i<90;i++)__game.player.updateCamera(1/60,__game.scene)')
        await asyncio.sleep(0.5)
        info = await pg.evaluate('(()=>{const pl=__game.player;return{en:pl.model.isEnabled(),fade:+(pl._heroFade??1).toFixed(3),cam:[+pl.cam.position.x.toFixed(2),+pl.cam.position.y.toFixed(2),+pl.cam.position.z.toFixed(2)]}})()')
        rf = await occ_frac(pg)
        gok = await geo_ok(pg)
        ok(f'stageCam:{tag}:hero', info['en'] and info['fade'] > 0.02, info)
        ok(f'stageCam:{tag}:occ', rf >= 0 and rf <= 0.30, {'occFrac': round(rf, 3) if rf is not None else None, **info})
        ok(f'stageCam:{tag}:geo', gok, {'geo': gok, **info})

async def stage_cam_glide_audit(pg):
    """固定 dt=1/60 直接调 updateCamera（停掉主循环）：
    进出区 + 幕布推点；每帧位移 ≤0.15m、≥0.3s 到 95%；
    幕+台口 mesh 遮罩 ≤30%、几何在观众侧、主角可见。"""
    if await pg.evaluate('__game.player.view') != 'third':
        await pg.evaluate('__game.toggleView()')
    active = await pg.evaluate('!!(__game.station && __game.station.interior && __game.station.interior.active && __game.player.stageCamFn)')
    ok('glide:hallActive', active, {'active': active})
    if not active:
        return
    js = r"""
() => {
  const pl = __game.player, scene = __game.scene, eng = __game.engine, G = __game, B = BABYLON;
  const DT = 1/60, OCC_LIM = 0.30;
  const canvas = eng.getRenderingCanvas();
  const c2 = document.createElement('canvas'); c2.width = 64; c2.height = 40;
  const ctx = c2.getContext('2d', { willReadFrequently: true });
  const savedDtMax = (typeof G.dtMax === 'number') ? G.dtMax : 0.25;
  eng.stopRenderLoop();
  G.setDtMax(0);

  const hi = G.station && G.station.interior;
  function sampleOcc() {
    if (!hi || !hi.curtMesh || !hi.portalMesh) return -1;
    if (!window.__occBlk) {
      const blk0 = new B.StandardMaterial('__occBlk', scene);
      blk0.disableLighting = true;
      blk0.diffuseColor = new B.Color3(0,0,0);
      blk0.emissiveColor = new B.Color3(0,0,0);
      blk0.specularColor = new B.Color3(0,0,0);
      window.__occBlk = blk0;
    }
    const blk = window.__occBlk;
    const targets = new Set([hi.curtMesh, hi.portalMesh]);
    for (const m of scene.meshes) {
      let p = m.parent;
      while (p) { if (targets.has(p)) { targets.add(m); break; } p = p.parent; }
    }
    const saved = [];
    for (const m of scene.meshes) {
      saved.push({ m, mat: m.material, vis: m.visibility });  // do NOT snapshot isEnabled(): while hall is up street kit.root is disabled, isEnabled() is false for children; restoring setEnabled(false) permanently kills street collision after leaveBuilding
      if (!m.isEnabled()) continue;
      m.visibility = 1;
      if (!targets.has(m)) m.material = blk;
    }
    hi.curtMesh.visibility = 1; hi.portalMesh.visibility = 1;
    const prevCC = scene.clearColor.clone();
    scene.clearColor = new B.Color4(0,0,0,1);
    scene.render();
    let frac = -1;
    try {
      ctx.drawImage(canvas, 0, 0, 64, 40);
      const d = ctx.getImageData(0, 0, 64, 40).data;
      let n = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i] + d[i+1] + d[i+2] > 24) n++;
      frac = n / (64 * 40);
    } catch (e) { frac = -1; }
    scene.clearColor.copyFrom(prevCC);
    for (const s of saved) { s.m.material = s.mat; s.m.visibility = s.vis; }
    return frac;
  }
  function geoOk() {
    const c = pl.cam.position;
    return !!(hi && hi.stageCamGeoOK && hi.stageCamGeoOK(c.x, c.y, c.z));
  }
  function resetStage() {
    pl._stageCamK = 0; pl._stageCamU = 0; pl._stageCamLast = null; pl._scPos = null; pl._scShown = null;
  }
  function place(x, y, z, yaw) {
    pl.spawn(x, y, z, yaw); pl.pitch = -0.1; pl.vy = 0; pl.grounded = true; pl.vel.set(0,0,0); pl.frame = null;
  }
  function step() { pl.updateCamera(DT, scene); }
  function camP() { const c = pl.cam.position; return [c.x, c.y, c.z]; }
  function heroOk() { return pl.model.isEnabled() && (pl._heroFade ?? 1) > 0.02; }

  const out = { runs: [], maxDeltaAll: 0, maxOccAll: 0, hidFramesAll: 0, geoFailAll: 0, sampleOccOk: true };

  function measure(name, frames, entering, kTarget) {
    let maxD = 0, maxOcc = 0, hid = 0, t95 = null, occFail = 0, geoFail = 0;
    let prev = camP();
    for (let i = 0; i < frames; i++) {
      step();
      const c = camP();
      const d = Math.hypot(c[0]-prev[0], c[1]-prev[1], c[2]-prev[2]);
      if (d > maxD) maxD = d;
      prev = c;
      const of = sampleOcc();
      if (of < 0) out.sampleOccOk = false;
      else { if (of > maxOcc) maxOcc = of; if (of > OCC_LIM) occFail++; }
      if (!geoOk()) geoFail++;
      if (!heroOk()) hid++;
      const k = pl._stageCamK || 0;
      if (t95 === null) {
        if (entering && k >= 0.95 * Math.max(0.01, kTarget)) t95 = (i + 1) * DT;
        if (!entering && k <= 0.05) t95 = (i + 1) * DT;
      }
    }
    const rec = {
      name, maxDelta: +maxD.toFixed(4), t95: t95 === null ? null : +t95.toFixed(3),
      maxOcc: +maxOcc.toFixed(3), hid, occFail, geoFail,
      kFinal: +(pl._stageCamK || 0).toFixed(3),
      aimYaw: pl.aimYaw, entering, kTarget
    };
    out.runs.push(rec);
    if (maxD > out.maxDeltaAll) out.maxDeltaAll = maxD;
    if (maxOcc > out.maxOccAll) out.maxOccAll = maxOcc;
    out.hidFramesAll += hid;
    out.geoFailAll += geoFail;
    return rec;
  }

  for (const [name, x, y, z, yaw] of [
    ['enter:E_top', 602.9, 1.1, 9.81, 0],
    ['enter:W_top', 597.1, 1.1, 9.8, 0],
    ['enter:oldbad', 597.03, 0.05, 6.72, Math.PI],
  ]) {
    place(x, y, z, yaw);
    resetStage();
    const sc0 = pl.stageCamFn(pl.position, pl.yaw);
    const kTarget = sc0 && sc0.w > 0 ? sc0.w : 0;
    step();
    measure(name, 90, true, kTarget);
  }

  {
    place(602.9, 1.1, 9.81, 0);
    resetStage(); pl._stageCamU = 1; pl._stageCamK = 1;
    for (let i = 0; i < 90; i++) step();
    const savedFn = pl.stageCamFn;
    pl.stageCamFn = () => null;
    measure('exit:E_top', 90, false, 0);
    pl.stageCamFn = savedFn;
  }

  function pushRun(name, x, y, z, yaw0, yaw1) {
    place(x, y, z, yaw0);
    resetStage(); pl._stageCamU = 1; pl._stageCamK = 1;
    for (let i = 0; i < 90; i++) step();
    const c0 = camP();
    pl._scShown = { x: c0[0], y: c0[1], z: c0[2] };
    pl._scPos = { x: c0[0], y: c0[1], z: c0[2] };
    pl.yaw = yaw1;
    step();
    measure(name, 90, true, 1);
  }
  pushRun('push:E_top', 602.9, 1.1, 9.81, 0, Math.PI / 2);
  pushRun('push:W_top', 597.1, 1.1, 9.8, 0, -Math.PI / 2);
  pushRun('push:oldbad', 597.03, 0.05, 6.72, Math.PI, -Math.PI / 2);

  out.maxDeltaAll = +out.maxDeltaAll.toFixed(4);
  out.maxOccAll = +out.maxOccAll.toFixed(3);

  G.setDtMax(savedDtMax);
  eng.runRenderLoop(() => scene.render());
  return out;
}
"""
    result = await pg.evaluate(js)
    log('glide', result)
    ok('glide:sampleOcc', result.get('sampleOccOk', False), result)
    ok('glide:maxDelta', result.get('maxDeltaAll', 99) <= 0.15, {'maxDeltaAll': result.get('maxDeltaAll'), 'runs': result.get('runs')})
    ok('glide:noHidden', result.get('hidFramesAll', 99) == 0, {'hidFramesAll': result.get('hidFramesAll')})
    ok('glide:maxOcc', result.get('maxOccAll', 99) <= 0.30, {'maxOccAll': result.get('maxOccAll')})
    ok('glide:geo', result.get('geoFailAll', 99) == 0, {'geoFailAll': result.get('geoFailAll')})
    for rec in result.get('runs') or []:
        t95 = rec.get('t95')
        if rec['name'].startswith('enter:') or rec['name'].startswith('exit:'):
            ok(f"glide:{rec['name']}:t95", t95 is not None and t95 >= 0.3, rec)
        ok(f"glide:{rec['name']}:delta", rec.get('maxDelta', 99) <= 0.15, rec)
        ok(f"glide:{rec['name']}:occ", rec.get('occFail', 1) == 0 and rec.get('maxOcc', 99) <= 0.30, rec)
        ok(f"glide:{rec['name']}:geo", rec.get('geoFail', 1) == 0, rec)
        ok(f"glide:{rec['name']}:hero", rec.get('hid', 1) == 0, rec)
        ok(f"glide:{rec['name']}:noAimYaw", rec.get('aimYaw') is None, rec)

async def stick_dirs_audit(pg):
    """摇杆四向：舞台区内外世界位移同号；镜头 yaw = 玩家 yaw（无 180° 倒向）。"""
    if await pg.evaluate('__game.player.view') != 'third':
        await pg.evaluate('__game.toggleView()')
    dirs = [('up', 0, 1), ('down', 0, -1), ('right', 1, 0), ('left', -1, 0)]
    async def measure(x, y, z, yaw, tag):
        out = {}
        for name, mx, my in dirs:
            await pg.evaluate(f'__game.teleport({x},{y},{z},{yaw}); __game.player.vel.set(0,0,0); __game.player.pitch=-0.1; __game.setMove(0,0)')
            await asyncio.sleep(0.35)
            p0 = await pg.evaluate('[+__game.player.position.x, +__game.player.position.z, +__game.player.yaw, +__game.player.cam.rotation.y, __game.player.aimYaw]')
            await pg.evaluate(f'__game.setMove({mx},{my})')
            await asyncio.sleep(0.7)
            await pg.evaluate('__game.setMove(0,0)')
            p1 = await pg.evaluate('[+__game.player.position.x, +__game.player.position.z]')
            out[name] = {'dx': p1[0]-p0[0], 'dz': p1[1]-p0[1], 'yaw0': p0[2], 'camY0': p0[3], 'aimYaw': p0[4]}
            log('stick', tag, name, out[name])
        return out
    # 区外过道（面对 +z）
    base = await measure(600, 0.05, 0, 0, 'aisle')
    # 舞台踏步顶（同 yaw=0，面对舞台深处）
    stage = await measure(602.9, 1.1, 9.81, 0, 'E_top')
    for name, _, _ in dirs:
        b, s_ = base[name], stage[name]
        # 世界位移主轴同号（允许被墙挡住幅度变小，但不能反向）
        same_x = abs(b['dx']) < 0.05 or abs(s_['dx']) < 0.05 or (b['dx'] * s_['dx'] > 0)
        same_z = abs(b['dz']) < 0.05 or abs(s_['dz']) < 0.05 or (b['dz'] * s_['dz'] > 0)
        # 至少有一个主分量明显动了且同号
        moved = abs(s_['dx']) + abs(s_['dz']) > 0.15
        ok(f'stick:{name}:sameWorldDir', same_x and same_z and moved, {'aisle': b, 'stage': s_})
        dy = abs((s_['camY0'] - s_['yaw0'] + math.pi) % (2*math.pi) - math.pi)
        ok(f'stick:{name}:camFollowsYaw', s_['aimYaw'] is None and dy < 0.15, {'dyaw': round(dy, 3), **s_})
    # 进出区过渡：从脚下走向踏步顶，cam.rotation.y 与 player.yaw 差不能突然跳 > 0.5
    # 固定步长 dt=1/60（dtMax=1/60；软件渲染 <60fps，每帧恰好 1/60 s）——与 glide 审计同口径。
    # 旧版在全局 dtMax=0.25 下量（一帧 0.25 s），属测试步长假象，不是产品镜头跳变。
    await pg.evaluate('__game.setDtMax(1/60)')
    await pg.evaluate('__game.teleport(602.9,0.05,6.4,0); __game.player.pitch=-0.1; __game.setMove(0,0)')
    await asyncio.sleep(0.4)
    await pg.evaluate("""(()=>{
      if (window.__scYawObs) { __game.scene.onAfterRenderObservable.remove(window.__scYawObs); }
      const H=window.__scYaw={n:0,maxJump:0,last:null};
      window.__scYawObs=__game.scene.onAfterRenderObservable.add(()=>{
        const pl=__game.player; if (pl.view!=='third') return;
        const d=pl.cam.rotation.y - pl.yaw; const dd=Math.atan2(Math.sin(d),Math.cos(d));
        if (H.last!==null) { const j=Math.abs(dd-H.last); if (j>H.maxJump) H.maxJump=j; }
        H.last=dd; H.n++;
      });
    })()""")
    await walk(pg, [[602.9, 8.2], [602.9, 9.7]])
    yinfo = await pg.evaluate('(()=>{const H=window.__scYaw||{n:0,maxJump:0}; if(window.__scYawObs){__game.scene.onAfterRenderObservable.remove(window.__scYawObs);window.__scYawObs=null;} return {n:H.n,maxJump:+(H.maxJump||0).toFixed(3)};})()')
    await pg.evaluate('__game.setDtMax(0.25)')
    log('yawJump', yinfo)
    ok('stick:enterExit:noYawJump', yinfo.get('n', 0) > 5 and yinfo.get('maxJump', 99) < 0.5, yinfo)
async def main():
    async with async_playwright() as p:
        b, pg, logs = await open_game(p, BASE + '?q=1&start=jnt&line=2')
        try:
            await pg.evaluate(GCLOCK); await pg.evaluate('__game.setDtMax(0.25)'); await asyncio.sleep(1.5)
            if await pg.evaluate('__game.player.view') != 'third': await pg.evaluate('__game.toggleView()')
            # 台阶前第一次到达：弹卡，点“好的”关掉
            await pg.evaluate('__game.teleport(68.6,0.05,-14,0)'); await asyncio.sleep(0.8)
            await walk(pg, [[67.4, -9], [67.4, 1.2]]); await pg.evaluate('__game.setMove(0,0)')
            ok('arrive1:card', await wait(pg, "__game.state().discover.card", 8), await pg.evaluate('__game.state().discover'))
            bb = await pg.locator('#goalCard .ok').bounding_box()
            await pg.touchscreen.tap(bb['x'] + bb['width'] / 2, bb['y'] + bb['height'] / 2)
            ok('arrive1:cardClosed', await wait(pg, "!__game.state().discover.card", 5))
            await walk(pg, TO_HALL); ok('hall1:entered', await wait(pg, "__game.state().zone=='hall'", 8))
            # 舞台：中间过道 → 东侧踏步 → 匾下 → 西侧踏步 → 地面
            await walk(pg, [[600, -16.5], [600, -7.2], [600, 5.4], [602.9, 6.4]]); s = await st(pg)
            ok('stage:atStepFoot', abs(s['pos'][0] - 602.9) < 0.6 and abs(s['pos'][2] - 6.4) < 0.6 and s['pos'][1] < 0.3, s['pos'])
            # autopilot 到点半径 ~0.3m：目标 9.7 偶发停在最上一级踏步 (z≈9.44,y≈0.9)；目标放到台面里 9.95 确保站上台面
            await walk(pg, [[602.9, 8.2], [602.9, 9.7], [602.9, 9.95]]); s = await st(pg)
            ok('stage:upEastSteps', s['pos'][1] > 1.0 and s['pos'][2] > 9.2, s['pos'])
            await walk(pg, [[600, 9.95]]); s = await st(pg)
            ok('stage:underPlaque', s['pos'][1] > 1.0 and abs(s['pos'][0] - 600) < 0.6 and 9.2 < s['pos'][2] < 10.4, s['pos'])
            await pg.evaluate('__game.player.yaw=Math.PI; __game.player.pitch=0.1'); await asyncio.sleep(1.0); await P(pg, 'stageUnderPlaque')
            await stage_cam_audit(pg)
            await stage_cam_glide_audit(pg)
            await stick_dirs_audit(pg)
            await pg.evaluate('__game.teleport(600,0.05,0,0); __game.player.pitch=0.05'); await asyncio.sleep(1.5); await P(pg, 'stageSteps')
            await walk(pg, [[600, 5.4], [602.9, 6.4], [602.9, 9.7], [600, 9.7]])   # 摆机位后回到台上
            await walk(pg, [[597.1, 9.7], [597.1, 8.2], [597.1, 6.4]]); s = await st(pg)
            ok('stage:downWestSteps', s['pos'][1] < 0.3 and abs(s['pos'][0] - 597.1) < 0.6 and s['pos'][2] < 7.0, s['pos'])
            # 舞台中间（没有踏步的地方）仍然上不去：踏步是唯一的路
            await walk(pg, [[600, 7.6]]); await auto(pg, [[600, 10.5]]); s = await st(pg)
            ok('stage:solidFrontStillBlocks', s['pos'][1] < 0.3 and s['pos'][2] < 9.0, s['pos'])
            # 楼座第一次：没有卡
            await balcony(pg, 1)
            # 出门 → 走过台阶前到达区：不再弹卡
            # hall2 路径恢复为 bfd8d49/jh3/reg1 已通过的步行线（[[72,4],[70,1],[67.4,-2]]→北回）。
            # WIP 曾加 seed_street 抬高瞬移到 (67.4,y,-9)：该点落在站厅开口附近，往北走偶发掉进 platform
            # （optA4–A6）；短访厅双端对比（WIP+bfd8 × orig/seed）证明不是 player/sysyHall 位移回归。
            await walk(pg, [[600, -22.5], [600, -25]]); s = await st(pg); ok('out1:street', s['zone'] == 'street', s['pos'])
            await walk(pg, [[72, 4], [70, 1], [67.4, -2]]); await no_card(pg, 'arrive2:noCard')
            # 第二次进门上楼座：仍然没有卡
            await walk(pg, [[67.4, 1.2], [72, 1.0]] + TO_HALL[1:]); ok('hall2:entered', await wait(pg, "__game.state().zone=='hall'", 8))
            await balcony(pg, 2)
            ok('noErrors', not errs(logs), errs(logs)[:5])
        finally: await b.close()
    print(json.dumps(R, ensure_ascii=False, indent=1))
    bad = [k for k, v in R['checks'].items() if not v]
    print('JNT_HALL', 'PASS' if not bad else 'FAIL ' + ','.join(bad), flush=True)
    if bad: sys.exit(1)
if __name__ == '__main__': asyncio.run(main())
