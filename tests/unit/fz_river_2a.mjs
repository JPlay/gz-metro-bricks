// 福州内河 2A：西湖船闸（过闸约 30 s、闸门没开船不过、两侧水位、刻度线）+ 西门 B 并进内河（西湖公园）
import fs from 'node:fs';
import * as R from '../../js/data/fz-river.js';
import { fzBoatLockSegs, allJobs } from '../../js/data/phrases.js';
const fails = [];
function ok(n, v, info) { console.log(`${v ? 'PASS' : 'FAIL'} ${n}${!v && info !== undefined ? ' ' + JSON.stringify(info) : ''}`); if (!v) fails.push(n); }
R.useNet('a');
const L = R.LOCK, S = R.LOCK_STATE, ease = u => u * u * (3 - 2 * u);
ok('lock on 白马河 exit straight, chamber 16 m × 4.2 m, rise 0.5 m', L && L.river === 'bm' && L.s[1] - L.s[0] === 16 && L.hw === 2.1 && L.rise === 0.5, L && { s: L.s, hw: L.hw });
ok('lake + upstream water at WY+0.5, downstream WY', R.levelAt(-380, 180) === R.WY + 0.5 && R.levelAt(...R.PIER.xihu.berth) === R.WY + 0.5 && R.levelAt(...R.PIER.xsg.berth) === R.WY);
ok('route passes lock between 西湖码头 and 西水关码头', R.STOPS[0].s < L.sU && L.sD < R.STOPS[1].s, { sU: L.sU, sD: L.sD });
ok('chamber is not open water (dam + gates), hull still inside chamber', !R.isWater(...L.mid) && R.inChamber(...L.mid));
// 过闸模拟：两个方向
for (const [i0, i1] of [[0, 1], [1, 0]]) {
  S.lvl = 0; S.gU = S.gD = 0; const dir = Math.sign(i1 - i0), b = { s: R.STOPS[i0].s, v: 0, dir, target: i1, phase: 'go', lk: null };
  let t = 0, tEnter = null, tIn = null, tOut = null, minAng = 999, maxDy = 0, prevY = R.levelAtS(b.s), stages = [];
  while (t < 900) {
    if (R.boatStep(b, 1 / 60)) break; t += 1 / 60;
    if (b.lkEv === 'enter') tEnter = t;
    const st = b.lk ? b.lk.st : null; if (st !== stages[stages.length - 1]) stages.push(st);
    if (st === 'enter' && tIn === null) tIn = t; if (st === 'exit' && tOut === null) tOut = t;
    for (const [gs, gk] of [[L.sU, 'gU'], [L.sD, 'gD']]) { const bow = Math.abs(b.s - gs) - R.BOAT.len / 2; if (bow < 1) minAng = Math.min(minAng, ease(S[gk])); }
    const y = R.levelAtS(b.s); maxDy = Math.max(maxDy, Math.abs(y - prevY)); prevY = y;
  }
  const name = i0 === 0 ? 'down (西湖 → 西水关)' : 'up (西水关 → 西湖)';
  ok(`${name}: lock sequence approach → enter → closeIn → level → openOut → exit`, stages.filter(Boolean).join(',') === 'approach,enter,closeIn,level,openOut,exit', stages);
  ok(`${name}: in-lock time (gate open → exit gate open) 25–40 s`, tOut - tEnter >= 25 && tOut - tEnter <= 40, +(tOut - tEnter).toFixed(1));
  ok(`${name}: chamber in → out about 30 s`, tOut - tIn >= 24 && tOut - tIn <= 34, +(tOut - tIn).toFixed(1));
  ok(`${name}: never passes a gate that is not open (≥70% open when bow < 1 m)`, minAng >= 0.7, +minAng.toFixed(1));
  ok(`${name}: boat level changes smoothly (no jump > 2 cm/frame)`, maxDy < 0.02, +maxDy.toFixed(4));
  ok(`${name}: ends at the other side level`, S.lvl === (i0 === 0 ? 0 : L.rise));
}
const T = R.runTime(0, 1); ok('runTime 西湖 → 西水关 includes lock (< 4 min)', T.secs > 100 && T.secs < 240, T);
const segs = fzBoatLockSegs();
ok('lock announcement zh + en only', segs.length === 2 && segs[0].text === '船只正在通过西湖船闸，请坐稳。' && segs[1].lang === 'en' && /West Lake lock/.test(segs[1].text));
ok('allJobs includes the lock clips', allJobs().some(j => j.id === 'voice.fz.boat.lock.xihu.zh'));
const bsrc = fs.readFileSync(new URL('../../js/game/fzBoat.js', import.meta.url), 'utf8'), rsrc = fs.readFileSync(new URL('../../js/world/fzRiver.js', import.meta.url), 'utf8');
ok('standing up only when docked (no 起身 in the lock)', /canStand\(\) \{ return this\.phase === 'dock'/.test(bsrc));
ok('boat rides the water level (y0 = levelAtS)', /this\.y0 = levelAtS\(this\.s\)/.test(bsrc) && /deck = this\.y0 \+ bob/.test(bsrc));
ok('lock gates: dark steel, walkway + railing, red/white edge stripe, gauge on chamber walls, no text', /#474C52/.test(rsrc) && /顶上走道/.test(rsrc) && /红白警示条/.test(rsrc) && /水位刻度尺/.test(rsrc) && !/lockStatic[\s\S]{0,3000}textPaint/.test(rsrc.split('lockGates()')[0].slice(-3000)));
console.log(fails.length ? `\n${fails.length} FAILED: ${fails.join(', ')}` : '\nALL PASS'); process.exit(fails.length ? 1 : 0);
