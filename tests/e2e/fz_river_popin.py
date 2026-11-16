# PR #37 follow-up: tileCull pop-in check (fast turn / 180° boat). Undrawn in-view tris should be 0 (or at most one frame).
# PR #37 tileCull pop-in check: fixed-dt (60 fps) frame stepping, fast yaw turns / spins / pitch, per-frame engine stale-tile check + frame capture.
import asyncio, sys, json, os, math, base64, time
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from playwright.async_api import async_playwright
from common import ARGS, errs
from perfhud import perf
BASE = sys.argv[1]; OUT = sys.argv[2]; QS = os.environ.get('QS', '&t=day'); TAG = 'night' if 'night' in QS else 'day'
os.makedirs(OUT, exist_ok=True)
RES = {'tag': TAG, 'url': BASE, 'perf': {}, 'cases': {}}

HOOK = r"""(() => {
  const S = __game.fzMetro.street, TC = S.tileCull, B = BABYLON, PAD = 24, NEAR_KEEP = 28;
  if (!TC) return 'no tileCull';
  const hits = (min, max, planes, pad) => { for (const pl of planes) { const n = pl.normal; const x = n.x > 0 ? max.x - pad : min.x + pad, y = n.y > 0 ? max.y - pad : min.y + pad, z = n.z > 0 ? max.z - pad : min.z + pad; if (n.x * x + n.y * y + n.z * z + pl.d < 0) return false; } return true; };
  TC.list.forEach(it => { it._inc = null; });
  if (!TC._orig) TC._orig = TC.update;
  TC.update = function (cam, opts = {}) {
    const before = TC.list.map(it => it.key);
    TC._orig.call(TC, cam, opts);
    const planes = B.Frustum.GetPlanes(cam.getScene().getTransformMatrix());
    const pos = cam.position, px = opts.px != null ? opts.px : pos.x, pz = opts.pz != null ? opts.pz : pos.z, detR = opts.detR, detOn = opts.detOn !== false;
    TC.list.forEach((it, k) => { if (it.key === null || it.key === before[k]) return;
      const inc = new Uint8Array(it.tiles.length);
      if (!(it.det && !detOn)) it.tiles.forEach((t, j) => { const d = Math.hypot(t.cx - px, t.cz - pz); if (it.det && detR && d > detR && d >= NEAR_KEEP) return; if (d < NEAR_KEEP || hits(t.min, t.max, planes, 0)) inc[j] = 1; });
      it._inc = inc; it._opts = { px, pz, detR, detOn }; });
    window.__tcUpd = (window.__tcUpd || 0) + 1;
  };
  // per-frame check: tiles whose unpadded box is in the *current* frustum (within fog end) but not drawn
  window.__staleCheck = () => {
    const sc = S.scene, cam = sc.activeCamera, planes = B.Frustum.GetPlanes(sc.getTransformMatrix()), cp = cam.globalPosition || cam.position;
    const fogEnd = sc.fogMode ? sc.fogEnd : 1e9; let n = 0, tris = 0, dmin = 1e9, worst = null, meshes = {};
    TC.list.forEach(it => { const m = it.mesh; if (!(!m.parent || m.parent.isEnabled())) return; if (m.isVisible === false || !it._inc) return;
      const o = it._opts;
      it.tiles.forEach((t, j) => { if (it._inc[j] && !it.hid) return;
        if (it.det && (!o.detOn || (o.detR && Math.hypot(t.cx - o.px, t.cz - o.pz) > o.detR && Math.hypot(t.cx - o.px, t.cz - o.pz) >= NEAR_KEEP))) return;   // intended distance cull
        if (!hits(t.min, t.max, planes, PAD)) return;
        const bx = Math.max(t.min.x + PAD - cp.x, 0, cp.x - t.max.x + PAD), bz = Math.max(t.min.z + PAD - cp.z, 0, cp.z - t.max.z + PAD), d = Math.hypot(bx, bz);
        if (d > fogEnd) return;
        n++; tris += t.i.length / 3; meshes[m.name] = (meshes[m.name] || 0) + t.i.length / 3; if (d < dmin) { dmin = d; worst = { mesh: m.name, cx: Math.round(t.cx), cz: Math.round(t.cz), d: Math.round(d), tris: t.i.length / 3 }; } }); });
    return { n, tris, dmin: n ? Math.round(dmin) : null, worst, meshes };
  };
  window.__invalidate = () => { TC.list.forEach(it => { it.key = null; }); };
  return { items: TC.list.length, tiles: TC.list.reduce((a, it) => a + it.tiles.length, 0), names: TC.list.map(it => it.mesh.name + ':' + it.tiles.length + (it.det ? ':det' : '')) };
})()"""

# frame stepper: stop loop, fixed dt 1/60, per-frame yaw/pitch schedule; capture downscaled frame + stale check
STEP = r"""async (args) => {
  const g = __game, e = g.engine, sc = g.scene, P = g.player, cv = e.getRenderingCanvas();
  const W = 400, H = Math.round(400 * cv.height / cv.width), c2 = document.createElement('canvas'); c2.width = W; c2.height = H; const x2 = c2.getContext('2d');
  const out = [];
  for (let f = 0; f < args.sched.length; f++) {
    const s = args.sched[f]; if (s.yaw != null) P.yaw = s.yaw; if (s.pitch != null) P.pitch = s.pitch;
    if (s.inval) window.__invalidate(); if (s.lod) g.fzMetro.street.lodNow(false);
    const u0 = window.__tcUpd || 0; sc.render(); const st = window.__staleCheck();
    let img = null; if (s.cap) { x2.drawImage(cv, 0, 0, W, H); img = c2.toDataURL('image/jpeg', 0.8); }
    out.push({ f, t: +(f / 60).toFixed(3), yaw: +P.yaw.toFixed(3), camYaw: +sc.activeCamera.rotation.y.toFixed(3), pitch: +P.pitch.toFixed(3), upd: (window.__tcUpd || 0) - u0, stale: st, img, tris: Math.round(sc.getActiveIndices() / 3), tag: s.tag || '' });
  }
  return out;
}"""

def sched_turn(y0, dy, nturn, nhold, pitch=None, tag='turn'):
    s = [{'yaw': y0, 'cap': i >= 26, 'tag': 'pre'} for i in range(30)]   # settle 0.5 s (≥2 lodNow) at start view
    s += [{'yaw': y0 + dy * (i + 1) / nturn, 'cap': True, 'tag': tag} for i in range(nturn)]
    s += [{'yaw': y0 + dy, 'cap': True, 'tag': 'hold'} for i in range(nhold)]
    s += [{'yaw': y0 + dy, 'cap': True, 'tag': 'truth', 'inval': True, 'lod': True}]
    if pitch is not None:
        for x in s: x['pitch'] = pitch
    return s
def sched_pitch(y0, p_up, p_back, view):
    s = [{'yaw': y0, 'pitch': 0.08, 'cap': i >= 28, 'tag': 'pre'} for i in range(30)]
    s += [{'yaw': y0, 'pitch': 0.08 + (p_up - 0.08) * (i + 1) / 6, 'cap': True, 'tag': 'up'} for i in range(6)]
    s += [{'yaw': y0, 'pitch': p_up, 'cap': i % 5 == 0, 'tag': 'uphold'} for i in range(40)]
    s += [{'yaw': y0, 'pitch': p_up + (p_back - p_up) * (i + 1) / 6, 'cap': True, 'tag': 'down'} for i in range(6)]
    s += [{'yaw': y0, 'pitch': p_back, 'cap': True, 'tag': 'hold'} for i in range(36)]
    s += [{'yaw': y0, 'pitch': p_back, 'cap': True, 'tag': 'truth', 'inval': True, 'lod': True}]
    return s

async def run_case(pg, loc, name, sched):
    t0 = time.time()
    fr = await asyncio.wait_for(pg.evaluate(STEP, {'sched': sched}), 900)
    d = f'{OUT}/{loc}/{name}'; os.makedirs(d, exist_ok=True)
    for x in fr:
        if x['img']:
            open(f"{d}/f{x['f']:03d}_{x['tag']}.jpg", 'wb').write(base64.b64decode(x['img'].split(',')[1])); x['img'] = f"f{x['f']:03d}_{x['tag']}.jpg"
    json.dump(fr, open(f'{d}/frames.json', 'w'))
    st = [x for x in fr if x['stale']['n']]
    summ = {'frames': len(fr), 'staleFrames': len(st), 'staleFramesAfterTurn': len([x for x in st if x['tag'] in ('hold',)]),
            'maxStaleTris': max([x['stale']['tris'] for x in fr] or [0]), 'minStaleDist': min([x['stale']['dmin'] for x in st] or [None], key=lambda v: 1e9 if v is None else v),
            'worst': max(st, key=lambda x: x['stale']['tris'])['stale'] if st else None, 'secs': round(time.time() - t0)}
    # longest consecutive stale run in frames
    run = best = 0
    for x in fr: run = run + 1 if x['stale']['n'] else 0; best = max(best, run)
    summ['longestStaleRunFrames'] = best; summ['longestStaleRunSec'] = round(best / 60, 3)
    RES['cases'][f'{loc}/{name}'] = summ; print('CASE', loc, name, json.dumps(summ), flush=True)
    json.dump(RES, open(f'{OUT}/result.json', 'w'), indent=1)

async def cases(pg, loc):
    y0 = await pg.evaluate('__game.player.yaw'); P = math.pi
    await run_case(pg, loc, 'turn180_0.2s', sched_turn(y0, P, 12, 36))
    await run_case(pg, loc, 'turn180back_0.2s', sched_turn(y0 + P, -P, 12, 36))
    await run_case(pg, loc, 'turn90_0.1s', sched_turn(y0, P / 2, 6, 36))
    await run_case(pg, loc, 'spin360_0.5s', sched_turn(y0, 2 * P, 30, 36, tag='spin'))
    await run_case(pg, loc, 'spin720_1.0s_ccw', sched_turn(y0, -4 * P, 60, 36, tag='spin'))
    await run_case(pg, loc, 'pitch3p_up_down', sched_pitch(y0, -0.35, 0.55, 'third'))
    # first person: look at the sky then straight back down
    await pg.evaluate("(() => { const P=__game.player; if (P.view !== 'first') P.toggleView(); })()")
    await run_case(pg, loc, 'pitch1p_sky_back', sched_pitch(y0, -1.3, 0.1, 'first'))
    await run_case(pg, loc, 'turn180_1p_0.2s', sched_turn(y0, P, 12, 36, pitch=0.1))
    await pg.evaluate("(() => { const P=__game.player; if (P.view !== 'third') P.toggleView(); P.pitch = 0.08; })()")

async def stepmode(pg, on):
    if on: await pg.evaluate("(() => { const e=__game.engine; e.stopRenderLoop(); if (!e._gdt) e._gdt = e.getDeltaTime; e.getDeltaTime = () => 1000/60; })()")
    else: await pg.evaluate("(() => { const e=__game.engine; if (e._gdt) e.getDeltaTime = e._gdt; e.runRenderLoop(() => __game.scene.render()); })()")

async def sample_peak(pg, label):
    look = await perf(pg, 3, 0.3); yaw0 = await pg.evaluate('__game.player.yaw'); rows = []
    for k in range(4):
        await pg.evaluate(f'__game.player.yaw = {k} * Math.PI / 2; __game.player.pitch = 0.08'); await asyncio.sleep(0.6); rows.append(await perf(pg, 3, 0.3))
    await pg.evaluate(f'__game.player.yaw = {yaw0}; __game.player.pitch = 0.08'); await asyncio.sleep(0.6)
    r = {'look': look, 'yaws': rows, 'peak': {'draws': max([look['draws']] + [x['draws'] for x in rows]), 'tris': max([look['tris']] + [x['tris'] for x in rows])}}
    RES['perf'][label] = r; print('PERF', label, json.dumps(r['peak']), 'look', json.dumps(look), flush=True); return r

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=ARGS)
        ctx = await b.new_context(viewport={'width': 1112, 'height': 834}, device_scale_factor=1, has_touch=True, is_mobile=True)
        pg = await ctx.new_page(); logs = []
        pg.on('console', lambda m: logs.append((m.type, m.text))); pg.on('pageerror', lambda e: logs.append(('pageerror', str(e))))
        await pg.goto(BASE + '?q=1' + QS)
        await pg.wait_for_function('window.__game', timeout=330000)
        await pg.evaluate('__game.setDtMax(0.25)'); await asyncio.sleep(1)
        await pg.evaluate("""(() => { const g=__game; g.east.ensure(); g.east.side='fz'; g.east.cur={st:g.station, loc:'fzmetro', area:'metro'}; g.station.kit.root.setEnabled(false); g.fzMetro.enterFromRailway(g.player); })()""")
        await asyncio.sleep(1.5)
        await pg.evaluate("""(async () => { const E = await import('/js/data/fz-exits.js'); const X = E.FZ_EXITS['fzxm']; const ex = X.attr === 'fzriver' ? X : (X.more || []).find(e => e.attr === 'fzriver'); const m=__game.fzMetro; m.buildStation('fzxm'); m.goStreet(ex); })()""")
        await asyncio.sleep(6)
        RES['scene'] = await pg.evaluate('(() => { const S=__game.fzMetro.street, sc=S.scene; return {night: !!(S.night&&S.night.on), fog: [sc.fogMode, sc.fogStart, sc.fogEnd], view: __game.player.view, fov: sc.activeCamera.fov}; })()')
        RES['hook'] = await pg.evaluate(HOOK); print('scene', RES['scene'], 'hook', json.dumps(RES['hook'])[:600], flush=True)
        LOCS = {
          'gate_west': """(() => { const S=__game.fzMetro.street, R=S.kit.root.position; const x=-70.55, z=-199.75, tx=-80, tz=-202.9;
              __game.player.spawn(R.x+x, 0.05, R.z+z, Math.atan2(tx-x, tz-z)); __game.player.pitch=0.08; })()""",
          'jindou_at4': """(async () => { const S=__game.fzMetro.street, R=S.kit.root.position; const M = await import('/js/data/fz-river.js'); const b = M.BRIDGES.find(b => b.id==='at4');
              const y = M.deckAt(b, 0) + 0.3, tx = b.x - b.t[0]*40, tz = b.z - b.t[1]*40;
              __game.player.spawn(R.x+b.x, y, R.z+b.z, Math.atan2(tx-b.x, tz-b.z)); __game.player.pitch=0.08; })()""",
          'cleg2_d30': """(() => { const S=__game.fzMetro.street, b=S.boats.C; if (window.__cs0 === undefined) { window.__cs0 = b.s; } const s0 = window.__cs0, dir = b.dir;
              b.s = s0 + 30*dir; b.place(0); const p=b.pose(); b.node.computeWorldMatrix(true); const wp=b.node.getAbsolutePosition();
              __game.player.spawn(wp.x, wp.y+1.2, wp.z, Math.atan2(p.tx*dir, p.tz*dir)); __game.player.pitch=0.08; })()""",
        }
        for loc, js in LOCS.items():
            try:
                await pg.evaluate(js); await asyncio.sleep(2.5)
                await sample_peak(pg, loc)
                await pg.screenshot(path=f'{OUT}/{loc}_look.jpg', type='jpeg', quality=80, timeout=180000)
                await stepmode(pg, True)
                await pg.evaluate(js)   # re-place (boat may have drifted)
                await cases(pg, loc)
            except Exception as ex:
                print('LOC FAIL', loc, repr(ex)[:400], flush=True); RES['cases'][loc + '/ERROR'] = repr(ex)[:400]
            finally:
                try: await stepmode(pg, False)
                except Exception: pass
        RES['errors'] = [l for l in errs(logs) if l[0] in ('error', 'pageerror')][:10]
        json.dump(RES, open(f'{OUT}/result.json', 'w'), indent=1)
        print('ERRORS', RES['errors'], flush=True)
        await b.close()
asyncio.run(main())
