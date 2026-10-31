/*
 * 福州地铁默认街口（第一批没有专门街区的站都用这个）：出口亭出来朝 +z 就是街。
 *   人行道 → 斑马线横过一条双向马路（行道树、路灯、公交站）→ 对面一排沿街商铺（底层店招：鱼丸、肉燕、锅边、便利店……）+ 行人。
 *   出口亭后面（-z）几栋楼当背景。面数都很省：人用 xmSM.lowPerson（约 110 个三角形），车 / 店招都是盒子 + 图集贴图。
 * 本文件的图集朝向约定同 xmStreet：quad 的 a = 0 朝 -z（朝着出口亭这边），π 朝 +z。
 */
import { hex } from '../core/geo.js';
import * as D from './decor.js';
import { facadePaint, textPaint, FONT, FONT_EN } from './xmStreet.js';
import { lowPerson } from './xmSM.js';
import { taxi } from './fzsDecor.js';

const NO = { ao: false };
const SHOPS = [['福州鱼丸', '#C8102E'], ['肉燕老铺', '#D9822B'], ['锅边糊', '#8E5A3C'], ['便利店', '#1E8E4E'], ['药店', '#2B8C6E'], ['面包房', '#B5651D'],
  ['茶叶店', '#3F6E3A'], ['水果店', '#E07A3A'], ['奶茶', '#C2185B'], ['光饼', '#A0522D'], ['小卷米粉', '#1F5FA8'], ['理发', '#5B6670']];
const WALLS = ['#E3DCCF', '#D4D9DD', '#E8E1D3', '#CFD6CC', '#E6D8C8', '#DADCE0'];

export function fzStreet(s) {
  const k = s.kit, P = k.solid, M = k.metal, G = k.glow, A = s.atlas, ex = s.ex;
  /* 马路（z 9..23）+ 斑马线 + 停止线 */
  const rz0 = 9, rz1 = 23;
  s.road(-160, 160, rz0, rz1, true, null);
  for (let x = -4.5; x < 4.6; x += 1.0) P.slab(x, x + 0.5, 0.012, 0.022, rz0 + 0.5, rz1 - 0.5, hex('#F4F4F2'), NO);
  for (const [xa, xb, z] of [[-30, -6, rz0 + 0.2], [6, 30, rz1 - 0.2]]) P.slab(xa, xb, 0.012, 0.02, z - 0.15, z + 0.15, hex('#F4F4F2'), NO);
  for (const x of [-6.5, 6.5]) for (const z of [rz0 - 0.2, rz1 + 0.2]) P.slab(x - 0.25, x + 0.25, 0, 0.16, z - 0.6, z + 0.6, hex('#E2DFD8'), NO);   // 坡道口
  // 人行横道信号灯
  for (const [x, z, a] of [[-5.6, rz0 - 0.6, Math.PI], [5.6, rz1 + 0.6, 0]]) {
    M.cyl(x, 1.6, z, 0.12, 3.2, hex('#5B6066'), 8); P.box(x, 3.0, z, 0.4, 0.8, 0.3, hex('#2B3036'), 0, 0, 0, 1, NO);
    G.box(x, 2.82, z + (a ? 0.16 : -0.16), 0.24, 0.24, 0.02, hex('#3BD16F'), 0, 0, 0, 1, NO); k.colSlab(x - 0.15, x + 0.15, 0, 3, z - 0.15, z + 0.15);
  }
  /* 近侧人行道：行道树、路灯、公交站 */
  const busX = 18;
  for (let x = -150; x <= 150; x += 10) if (Math.abs(x) > 8 && Math.abs(x - busX) > 7) s.lightTree(x, rz0 - 1.4, 0.8);
  for (let x = -150; x <= 150; x += 10) if (Math.abs(x) > 7) s.lightTree(x + 5, rz1 + 1.4, 0.8);
  for (const x of [-10, 30, -45]) D.lamp(k, x, 0, rz0 - 0.7, 0);
  for (const x of [10, -30, 45]) D.lamp(k, x, 0, rz1 + 0.7, Math.PI);
  { const x = busX, z0 = 5.6, z1 = 8.2;
    P.slab(x - 4.4, x + 4.4, 2.7, 2.85, z0 - 0.2, z1 + 0.3, hex('#E9ECEE'), NO); M.slab(x - 4.4, x + 4.4, 2.6, 2.7, z0 - 0.2, z1 + 0.3, hex('#1F6E4E'), NO);
    for (const sx of [-4.2, 4.2]) M.slab(x + sx - 0.07, x + sx + 0.07, 0, 2.6, z0 - 0.07, z0 + 0.07, hex('#5B6066'), NO);
    k.glass.slab(x - 4.2, x + 4.2, 0.3, 2.5, z0 - 0.03, z0 + 0.03, hex('#D6EEF8')); k.colSlab(x - 4.3, x + 4.3, 0, 2.6, z0 - 0.1, z0 + 0.1);
    P.slab(x - 3, x + 1.5, 0.42, 0.5, z0 + 0.1, z0 + 0.6, hex('#8D949B'), NO); k.colSlab(x - 3, x + 1.5, 0, 0.5, z0 + 0.1, z0 + 0.6);
    P.slab(x + 2.4, x + 3.8, 0.2, 2.4, z0 + 0.08, z0 + 0.3, hex('#1F6E4E'), NO);
    A.quad(x + 3.1, 1.4, z0 + 0.32, 1.2, 1.9, Math.PI, A.draw(1.2, 1.9, (c, pw, ph) => {
      c.fillStyle = '#F4F4F2'; c.fillRect(0, 0, pw, ph); c.fillStyle = '#1F6E4E'; c.fillRect(0, 0, pw, ph * 0.2);
      c.fillStyle = '#FFFFFF'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `800 ${ph * 0.1}px ${FONT}`; c.fillText('公交站', pw / 2, ph * 0.1);
      c.fillStyle = '#1B2530'; c.font = `700 ${ph * 0.075}px ${FONT}`; ['1路', '9路', '20路', '51路', '106路', '夜1路'].forEach((t, i) => c.fillText(t, pw / 2, ph * (0.3 + i * 0.11)));
    }, 100));
    A.quad(x - 0.5, 3.1, z1 + 0.32, 6, 0.45, Math.PI, A.draw(6, 0.45, textPaint(['公交车站  Bus Stop'], { bg: '#1F6E4E', fg: '#FFFFFF' }), 80));
    for (let i = 0; i < 3; i++) lowPerson(P, x - 2.5 + i * 1.3, 0, z1 - 0.2 - (i % 2) * 0.4, 0.15 * (i - 1), 40 + i * 3, false);
    lowPerson(P, x - 1, 0, z0 + 0.9, 0, 52, true);
    // 进站的公交车
    const bz = rz0 + 2.0, bx = x - 1;
    P.box(bx, 1.75, bz, 12, 2.9, 2.5, hex('#2E9E5B'), 0, 0, 0, 1, NO); P.box(bx, 2.15, bz, 12.04, 1.0, 2.54, hex('#2B3A44'), 0, 0, 0, 1, NO);
    P.box(bx, 3.25, bz, 11.6, 0.12, 2.3, hex('#E9ECEE'), 0, 0, 0, 1, NO);
    for (const ax of [-3.8, 3.6]) for (const s2 of [-1, 1]) P.box(bx + ax, 0.5, bz + s2 * 1.15, 1.0, 1.0, 0.3, hex('#24272B'), 0, 0, 0, 1, NO);
    A.quad(bx + 6.03, 2.95, bz, 2.2, 0.4, -Math.PI / 2, A.draw(2.2, 0.4, textPaint(['51路'], { bg: '#111', fg: '#FFB52E' }), 80));
    k.colSlab(bx - 6, bx + 6, 0, 3.2, bz - 1.25, bz + 1.25);
  }
  taxi(k, -38, rz0 + 2.4, -1); taxi(k, 46, rz1 - 2.4, 1, '#C9CED3'); taxi(k, -70, rz1 - 2.4, 1, '#3B8E5A');
  /* 对面一排沿街商铺（z 30..44）：瓷砖立面 + 底层店招 + 雨篷 */
  const fz0 = 30, fd = 14;
  // 立面贴图只画 3 种（长面 / 端面各一张），7 栋楼轮流用 —— 图集放得下（每张 340×440 px）
  const ground = (c, x0, y0, pw, fh) => { c.fillStyle = '#3A4650'; c.fillRect(0, y0, pw, fh); for (let j = 0; j < 3; j++) { c.fillStyle = '#F3E3C2'; c.fillRect(pw * (j / 3 + 0.03), y0 + fh * 0.3, pw * 0.27, fh * 0.66); } };
  const w = 20, KINDS = [[22, WALLS[0]], [18, WALLS[1]], [26, WALLS[2]]].map(([h, wall]) => {
    const floors = Math.round(h / 3.3);
    return { h, wall, uvL: A.draw(w, h, facadePaint({ floors, bays: 6, wall, band: '#F4F2EE', ground }), 17), uvE: A.draw(fd, h, facadePaint({ floors, bays: 4, wall, band: '#F4F2EE' }), 17) };
  });
  const signUV = {};
  [-66, -44, -22, 0, 22, 44, 66].forEach((cx, i) => {
    const { h, wall, uvL, uvE } = KINDS[i % 3], cz = fz0 + fd / 2;
    P.slab(cx - w / 2, cx + w / 2, 0, h, fz0, fz0 + fd, hex(wall), NO); k.colSlab(cx - w / 2, cx + w / 2, 0, h, fz0, fz0 + fd);
    A.quad(cx, h / 2, fz0 - 0.03, w, h, 0, uvL); A.quad(cx, h / 2, fz0 + fd + 0.03, w, h, Math.PI, uvL);
    A.quad(cx - w / 2 - 0.03, h / 2, cz, fd, h, -Math.PI / 2, uvE); A.quad(cx + w / 2 + 0.03, h / 2, cz, fd, h, Math.PI / 2, uvE);
    P.slab(cx - w / 2 - 0.25, cx + w / 2 + 0.25, h, h + 0.5, fz0 - 0.25, fz0 + fd + 0.25, hex('#E9E5DD'), NO);
    for (let j = 0; j < 3; j++) {
      const sx = cx - w / 2 + (j + 0.5) * w / 3, [zh, col] = SHOPS[(i * 3 + j) % SHOPS.length];
      P.slab(sx - 2.9, sx + 2.9, 3.0, 3.9, fz0 - 0.35, fz0 - 0.05, hex(col), NO);
      A.quad(sx, 3.45, fz0 - 0.37, 5.6, 0.8, 0, (signUV[zh] = signUV[zh] || A.draw(5.6, 0.8, textPaint([zh], { bg: col, fg: '#FFFFFF' }), 50)));
      P.box(sx, 2.75, fz0 - 0.8, 5.8, 0.08, 1.4, hex(['#E8505B', '#F2C14E', '#3E8EDE', '#42B883'][(i + j) % 4]), 0, -0.25, 0, 1, NO);   // 雨篷
    }
  });
  /* 行人：两边人行道上走、过斑马线、店门口 */
  const people = [[-14, 4, Math.PI / 2], [-22, 6.5, -Math.PI / 2], [12, 3, -Math.PI / 2], [26, 4.5, Math.PI / 2], [-1.6, 13, 0], [1.4, 18.5, Math.PI], [0.2, 15.5, 0],
    [-30, 26.5, Math.PI / 2], [-12, 27.5, -Math.PI / 2], [8, 26, Math.PI / 2], [20, 28.5, Math.PI], [34, 26.8, -Math.PI / 2], [-48, 27.6, Math.PI / 2], [50, 26.4, -Math.PI / 2], [-7, 28.6, Math.PI], [-40, 5, Math.PI / 2]];
  people.forEach(([x, z, ry], i) => lowPerson(P, x, 0, z, ry, i * 3 + 1, i % 6 === 4));
  D.bench(k, -8, 0, 6.8, Math.PI); D.bin(k, 8, 0, 7.5);
  // 站名牌（出口亭旁，朝着出来的人）
  const st = s.N.STATIONS[s.code];
  if (st) { M.cyl(4.2, 1.4, 2.4, 0.08, 2.8, hex('#8A9198'), 8); for (const a of [0, Math.PI]) A.quad(4.2, 2.9, 2.4 + (a ? 0.03 : -0.03), 2.6, 0.6, a, A.draw(2.6, 0.6, textPaint([st.zh + '站'], { bg: '#20272E', fg: '#FFFFFF' }))); }
  if (ex && ex.road) s.roadSign(-6.6, rz0 - 1.2, ex.road, 0);
  /* 出口亭后面几栋楼（背景） */
  s.filler([[40, -34, 30, 14, 28, '#C9C2B6'], [-36, -36, 30, 14, 24, '#D8D2C6'], [-100, -38, 30, 14, 32, '#BFB6A8'], [100, -36, 26, 14, 22, '#CDC5B8']]);
}
