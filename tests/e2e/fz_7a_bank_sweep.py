# 7A 三维实走扫描：真玩家碰撞（不是 2D 洪水填充）。两岸 s=20→命名西头，并过每一座涵洞斑马。
# 用法（迭代）：FZDT=0.25 FZQS='&t=day' python tests/e2e/fz_7a_bank_sweep.py <base-url> [outdir]
import asyncio, sys, os, json, math, time
sys.path.insert(0, os.path.dirname(__file__))
import fz_river as F
from common import *
from journey import GCLOCK, log

def frame(c, x, z):
    return (round((x - c['x']) * c['t'][0] + (z - c['z']) * c['t'][1], 3),
            round((x - c['x']) * c['n'][0] + (z - c['z']) * c['n'][1], 3))

async def yz(pg):
    s = await F.st(pg)
    p = s['pos']
    info = await pg.evaluate(f"""(async () => {{
      const M = await import('/js/data/fz-river.js'); const yx = M.RIVERS.yx, cs = M.FZR.a7a.culverts;
      const R = __game.fzMetro.street.kit.root.position, x = {p[0]} - R.x, z = {p[2]} - R.z;
      let best = 0, bd = 1e9;
      for (let s = 0; s <= yx.line.len; s += 0.5) {{
        const q = yx.line.at(s, 0); const d = (q.x-x)**2+(q.z-z)**2; if (d < bd) {{ bd = d; best = s; }}
      }}
      const mid = yx.line.at(best, 0), plus = yx.line.at(best, 1);
      const lat = (x-mid.x)*(plus.x-mid.x)+(z-mid.z)*(plus.z-mid.z);
      let near = null, nd = 1e9;
      for (const c of cs) {{
        const t = (x-c.x)*c.t[0]+(z-c.z)*c.t[1], n = (x-c.x)*c.n[0]+(z-c.z)*c.n[1];
        const d = Math.hypot(t, n); if (d < nd) {{ nd = d; near = {{ name: c.roadName || c.id, s: c.s, t: +t.toFixed(3), n: +n.toFixed(3), d: +d.toFixed(2) }}; }}
      }}
      return {{ s: +best.toFixed(2), lat: +lat.toFixed(3), y: {p[1]}, near }};
    }})()""")
    return {'world': [round(p[0], 2), round(p[1], 3), round(p[2], 2)], **info}

async def go_rec(pg, tx, tz, label, stalls):
    okw = await F.go(pg, tx, tz, label, tries=2)
    info = await yz(pg)
    if not okw:
        stalls.append({'label': label, **info, 'target': [round(tx, 2), round(tz, 2)]})
        log('STALL', label, json.dumps(info, ensure_ascii=False))
    else:
        log('ok', label, 'y', info['y'], 's', info['s'], 'lat', info['lat'])
    return okw

async def teleport_bank(pg, s, side, off):
    w = await F.rpt(pg, 'yx', s, side * off)
    await pg.evaluate(f'(() => {{ const p = __game.player.position; p.x = {w[0]}; p.y = 0.05; p.z = {w[1]}; }})()')
    await asyncio.sleep(0.25)
    return w

async def sweep(pg):
    stalls = []
    await F.station_to_exit(pg, 'fzdm', "x.attr === 'fzriver'", 'fzdm')
    await F.nav(pg); await asyncio.sleep(0.6)
    A = await pg.evaluate("""(async () => { const M = await import('/js/data/fz-river.js'); const F = M.FZR, a7 = F.a7a, yx = M.RIVERS.yx;
      return { hw: F.rivers.yx.hw, len: yx.line.len, tipS: a7.official && (a7.official.namedWestTip / 4),
        host: a7.host, jnHw: F.rivers.jn.hw, culverts: a7.culverts }; })()""")
    hw, off, cs = A['hw'], A['hw'] + 2.8, A['culverts']
    tip_s = min(A['len'] - 8, max(20, (A.get('tipS') or 446)))
    # 斗门 C → 汇入口，再走到 s=20 +lat，作为扫描起点
    p0 = await F.rpt(pg, 'jn', A['host']['s'] - 25, A['jnHw'] + 2.6)
    await go_rec(pg, *p0, 'C→汇入口南', stalls)
    start = await F.rpt(pg, 'yx', 20, off)
    await go_rec(pg, *start, '→ yx s=20 +lat', stalls)

    # 两岸沿岸：途经每座涵洞前 8 m 和西头
    marks = [20]
    for c in cs:
        if c['s'] >= 20:
            marks.append(c['s'] - 8)
    marks.append(tip_s)
    marks = sorted(set(round(s, 1) for s in marks if 20 <= s <= tip_s + 0.01))

    for side, tag in ((1, '+lat'), (-1, '-lat')):
        if side == -1:
            await teleport_bank(pg, 20, side, off)
        for s in marks:
            w = await F.rpt(pg, 'yx', s, side * off)
            okw = await go_rec(pg, *w, f'岸 {tag} → s={s}', stalls)
            here = await yz(pg)
            if here['y'] > 0.6:
                log('NOTE climbed y=', here['y'], 'at', tag, 's', s)
            if not okw:
                # hop past this mark (real player still stuck at the snag otherwise)
                await teleport_bank(pg, min(tip_s, s + 4), side, off)
        # 走完该岸后，把人放回 s=20 对岸准备
    # 每座涵洞：两岸斑马横过（从该岸 s-8 起步；失败则传送继续扫下一座）
    for c in cs:
        name = c.get('roadName') or c['id']
        along, wth, walk = c['along'], c['w'], c.get('walk') or 2.5
        zw = min(3.0, max(2.4, along * 0.18))
        tu = (along / 2 - zw / 2)
        nv = wth / 2 - walk / 2
        def xz(tu_, nv_):
            return (c['x'] + c['t'][0] * tu_ + c['n'][0] * nv_, c['z'] + c['t'][1] * tu_ + c['n'][1] * nv_)
        for bank_t, blab in ((1, 't+'), (-1, 't-')):
            bank_s = c['s'] - 8 if c['s'] > 10 else c['s'] + 8
            # 选与这条斑马同侧的河岸（用 bank 点的 road-t 符号贴过去）
            bp = await F.rpt(pg, 'yx', bank_s, 1 * off)
            # 传送到较近的一岸再走，避免被上一处卡住
            await teleport_bank(pg, bank_s, 1 if bank_t > 0 else -1, off)
            a = await F.W(pg, *xz(bank_t * tu, -nv))
            b = await F.W(pg, *xz(bank_t * tu, nv))
            ok1 = await go_rec(pg, *a, f'{name} {blab} 斑马一侧', stalls)
            if ok1:
                ok2 = await go_rec(pg, *b, f'{name} {blab} 斑马对侧', stalls)
                if ok2:
                    await go_rec(pg, *a, f'{name} {blab} 斑马回来', stalls)
    return stalls

async def main():
    T0 = time.time()
    out = sys.argv[2] if len(sys.argv) > 2 and sys.argv[2] != '-' else '/workspace/fzlogs/7a/sweep'
    os.makedirs(out, exist_ok=True)
    async with async_playwright() as p:
        b, pg, logs = await open_game(p, F.BASE + '?q=1' + F.QS)
        await pg.evaluate(GCLOCK); await pg.evaluate(F.JUMP)
        await pg.evaluate(f"__game.setDtMax({float(os.environ.get('FZDT', '0.25'))})")
        await asyncio.sleep(1)
        if F.HALF: await F._vp(pg, F.HALF_VP); log('viewport', F.HALF_VP, 'FZDT', os.environ.get('FZDT', '0.25'))
        await pg.evaluate("""(() => { const g=__game; g.east.ensure(); g.east.side='fz'; g.east.cur={st:g.station, loc:'fzmetro', area:'metro'}; g.station.kit.root.setEnabled(false); g.fzMetro.enterFromRailway(g.player); })()""")
        await asyncio.sleep(1.5)
        await pg.evaluate('window.__fzNavRes = 0.45')
        stalls = await sweep(pg)
        await b.close()
    rec = {'secs': round(time.time() - T0), 'stalls': stalls, 'n': len(stalls)}
    open(os.path.join(out, 'sweep.json'), 'w').write(json.dumps(rec, ensure_ascii=False, indent=1))
    print(json.dumps(rec, ensure_ascii=False, indent=1))
    print('SWEEP', 'PASS' if not stalls else 'FAIL', len(stalls), 'stalls', flush=True)
    if stalls:
        sys.exit(1)

if __name__ == '__main__':
    asyncio.run(main())
