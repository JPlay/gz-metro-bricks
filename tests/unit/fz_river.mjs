// 福州内河 1A（白马河 + 安泰河 + 东西河首段；游船 A 线 西湖码头—西水关码头—黎明湖码头）：河网数据 / 船体在水里 / 篷顶过桥净空 / 出口接入 / 码头牌 / 报站（普通话 + 英语）。
import * as R from '../../js/data/fz-river.js';
import { FZ_EXITS, FZ_EXIT_TABLE } from '../../js/data/fz-exits.js';
import { allJobs, fzBoatDepartSegs, fzBoatArriveSegs, fzBoatJobs } from '../../js/data/phrases.js';
const fails = [];
function ok(n, v, info) { console.log(`${v ? 'PASS' : 'FAIL'} ${n}${!v && info !== undefined ? ' ' + JSON.stringify(info) : ''}`); if (!v) fails.push(n); }
const F = R.FZR;
// ---- 数据 ----
ok('three rivers bm/at/dx with widths 20/12/14', ['bm', 'at', 'dx'].every(k => R.RIVERS[k]) && R.RIVERS.bm.hw === 10 && R.RIVERS.at.hw === 6 && R.RIVERS.dx.hw === 7, Object.keys(R.RIVERS));
ok('along-river compression 1:3 (K=3)', F.K === 3);
ok('water level below bank', R.WY < -2 && R.WY > -4);
ok('land + water triangle meshes present', Object.keys(F.land).length > 20 && Object.keys(F.water).length > 20);
const bn = R.BRIDGES.map(b => b.name).filter(Boolean);
ok('26 bridges (2B +5 on 东西河)', R.BRIDGES.length === 26, R.BRIDGES.length);
ok('安泰河 named arch/hump bridges 观音桥/馆驿桥/金斗桥/澳门桥 + 二桥亭桥 + 桂芳桥', ['观音桥', '馆驿桥', '金斗桥', '澳门桥', '二桥亭桥', '桂芳桥'].every(n => bn.includes(n)), bn);
ok('unnamed small bridges have no plate (⑧)', R.BRIDGES.filter(b => !b.name).every(b => !b.plate));
ok('bridge ids unique', new Set(R.BRIDGES.map(b => b.id)).size === R.BRIDGES.length);
for (const b of R.BRIDGES) { const c = R.RIVERS[b.river].line.at(b.s); if (!R.isWater(c.x, c.z) && !R.isWater(b.x, b.z)) ok('bridge over water ' + b.id, false); }
ok('every bridge spans water', true);
// 岸：桥两头都是陆地
ok('both bridge ends on land', R.BRIDGES.every(b => [-1, 1].every(sg => R.isLand(b.x + b.n[0] * sg * (b.hw + 2.5), b.z + b.n[1] * sg * (b.hw + 2.5)))), R.BRIDGES.filter(b => ![-1, 1].every(sg => R.isLand(b.x + b.n[0] * sg * (b.hw + 2.5), b.z + b.n[1] * sg * (b.hw + 2.5)))).map(b => b.id));
// 落水回岸：河心的每个点都能找到岸
let shoreBad = 0; for (const k in R.RIVERS) { const L = R.RIVERS[k].line; for (let s = 5; s < L.len - 5; s += 10) { const a = L.at(s); const sh = R.shoreFor(a.x, a.z); if (!sh || !R.isLand(sh.x, sh.z) || Math.hypot(sh.x - a.x, sh.z - a.z) > 30) shoreBad++; } }
ok('shoreFor finds land from every river point', shoreBad === 0, shoreBad);
ok('three water steps (水埠头) marked dry', F.steps.length === 3 && F.steps.every(s => R.isDry(s.x - s.n[0] * 0.7, s.z - s.n[1] * 0.7)));
// ---- 航线 / 码头 ----
ok('route A: 西湖码头 → 西水关码头 → 黎明湖码头 → 市民服务中心码头', R.STOPS.map(s => s.id).join(',') === 'xihu,xsg,lmh,smc' && R.STOPS.map(s => s.pier.zh).join(',') === '西湖码头,西水关码头,黎明湖码头,市民服务中心码头');
ok('stops ascending along route', R.STOPS[0].s < R.STOPS[1].s && R.STOPS[1].s < R.STOPS[2].s && R.STOPS[2].s <= R.ROUTE.line.len);
let hullOut = 0; for (let s = 0; s <= R.ROUTE.line.len; s += 0.5) for (const { x, z } of R.hullPts(s)) if (!R.isWater(x, z) && !R.isDry(x, z) && !R.inChamber(x, z)) { hullOut++; break; }
ok('boat hull stays inside water along whole route', hullOut === 0, hullOut);
const cr = R.clearanceReport(0.25);
ok(`canopy never clips a bridge (min clearance ${cr.min.toFixed(3)} ≥ ${R.CLEAR_MIN})`, cr.ok && cr.min >= R.CLEAR_MIN, cr.per);
const crossed = Object.keys(cr.per || {});
ok('route passes under bridges incl. 桂芳桥 arch', crossed.length >= 10 && crossed.includes('bm5'), crossed);
ok('speed cap slower under bridges (2B: A 线沿用 B 线规则，过桥 ≤ zones.vBridge 3.5，低于东西河东段 5.5)', R.BRIDGES.filter(b => crossed.includes(b.id)).length > 0 && Math.min(...R.SPEED_CAP) <= ((R.ROUTE.zones || {}).vBridge || R.SLOW) + 1e-6 && (R.ROUTE.zones || {}).vBridge < (R.ROUTE.zones || {}).vFast);
ok('pier signs: zh name + English + next stops', R.PIERS.every(p => p.zh.endsWith('码头') && /Pier$/.test(p.en) && R.pierNext(p.id).length >= 1) && R.pierNext('xsg').map(p => p.id).join() === 'xihu,lmh');
ok('pier names (en)', R.PIER.xihu.en === 'West Lake Pier' && R.PIER.xsg.en === 'Xishuiguan Pier' && R.PIER.lmh.en === 'Liming Lake Pier');
// ---- 出口 ----
const cx = (FZ_EXITS.fzxm.more || []).find(e => e.attr === 'fzriver'), ay = FZ_EXITS.fzxiy;
ok('西门 C → 白马河 / 西水关码头 (attr fzriver, line 4)', cx && cx.n === 'C' && cx.line === 4 && cx.to.includes('西水关码头'), cx);
ok('西洋 A → 东西河 / 黎明湖码头 (attr fzriver, line 2)', ay && ay.n === 'A' && ay.attr === 'fzriver' && ay.line === 2 && ay.to.includes('黎明湖码头'), ay);
ok('西门 B unchanged (西湖公园)', FZ_EXITS.fzxm.n === 'B' && FZ_EXITS.fzxm.to[0] === '西湖公园');
ok('exit tables list the river exits', FZ_EXIT_TABLE.fzxm.some(r => r[0] === 'C') && FZ_EXIT_TABLE.fzxiy.some(r => r[0] === 'A'));
ok('river kiosks for both exits on land', ['fzxm', 'fzxiy'].every(c => R.KIOSKS[c] && R.isLand(R.KIOSKS[c].x, R.KIOSKS[c].z + 3)) && R.KIOSKS.fzxm.n === 'C' && R.KIOSKS.fzxiy.n === 'A');
// ---- 报站 ----
const jobs = fzBoatJobs(), ids = jobs.map(j => j.id);
ok('boat jobs exist (zh + en only)', jobs.length >= 10 && ids.every(id => /^voice\.fz\.boat\./.test(id) && /\.(zh|en)$/.test(id)) && !ids.some(id => /\.(fzh|nan|yue)$/.test(id)), ids);
ok('allJobs includes every boat job', (() => { const all = new Set(allJobs().map(j => j.id)); return ids.every(id => all.has(id)); })());
const dep = fzBoatDepartSegs('lmh', 'xsg'), arr = fzBoatArriveSegs('xsg', false), arrT = fzBoatArriveSegs('lmh', true);
const txt = a => a.map(x => x.text).join(' ');
ok('depart: zh welcome + next stop + English', /内河游船A线/.test(txt(dep)) && /黎明湖码头/.test(txt(dep)) && /西水关码头/.test(txt(dep)) && /Next stop/i.test(txt(dep)), dep.map(x => x.id + '|' + x.text));
ok('arrive: 西水关码头到了 + English', /西水关码头到了/.test(txt(arr)) && /Xishuiguan Pier/.test(txt(arr)), arr.map(x => x.text));
ok('terminal arrive mentions 终点', /终点/.test(txt(arrT)) && /end of this line/i.test(txt(arrT)), arrT.map(x => x.text));
ok('all boat segs zh/en only', [...dep, ...arr, ...arrT].every(x => /\.(zh|en)$/.test(x.id)));
console.log(fails.length ? `\n${fails.length} FAILED: ${fails.join(', ')}` : '\nALL PASS');
process.exit(fails.length ? 1 : 0);
