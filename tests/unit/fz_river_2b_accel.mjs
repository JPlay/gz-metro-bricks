// 福州内河 2B：船的加 / 减速度（小美 16:40 定：加速 ≤ 0.5、减速 ≤ 1.0 m/s²），按 fzBoat 每帧调用的同一个 boatStep 积分，
// 帧长 1/60、0.05、0.25 和随机抖动（0.004–0.25 s）都跑；用未取整的船速，包括过闸、到站停稳
import * as R from '../../js/data/fz-river.js';
const fails = [];
function ok(n, v, info) { console.log(`${v ? 'PASS' : 'FAIL'} ${n}${!v && info !== undefined ? ' ' + JSON.stringify(info) : ''}`); if (!v) fails.push(n); }
R.useNet('a');
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const N = R.STOPS.length;
for (const [tag, dtf] of [['1/60', () => 1 / 60], ['0.05', () => 0.05], ['0.25', () => 0.25], ['jitter', () => 0.004 + rnd() * 0.246]]) {
  let aMax = 0, dMax = 0, stuck = 0;
  for (const [i0, i1] of [[0, N - 1], [N - 1, 0]]) for (let i = i0; i !== i1; i += Math.sign(i1 - i0)) {
    const S = R.LOCK_STATE; if (R.LOCK) { S.gU = S.gD = 0; S.lvl = i0 === 0 ? R.LOCK.rise : 0; }
    const b = { s: R.STOPS[i].s, v: 0, dir: Math.sign(i1 - i0), target: i + Math.sign(i1 - i0), phase: 'go', lk: null };
    let t = 0, done = false;
    while (t < 900) { const dt = dtf(), v0 = b.v; done = R.boatStep(b, dt); t += dt;
      const a = (b.v - v0) / dt; if (a > aMax) aMax = a; if (-a > dMax) dMax = -a; if (done) break; }
    if (!done || b.v > 1e-9) stuck++;
  }
  ok(`dt ${tag}: accel ≤ 0.5 (${aMax.toFixed(3)}), decel ≤ 1.0 (${dMax.toFixed(3)}) m/s², every leg arrives at v 0`, aMax <= 0.5 + 1e-9 && dMax <= 1.0 + 1e-9 && !stuck, { aMax, dMax, stuck });
}
if (fails.length) { console.log('FAIL', fails); process.exit(1); } else console.log('ALL PASS');
