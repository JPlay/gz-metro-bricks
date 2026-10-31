/*
 * 福州南站 · 站台：复用厦门北那套站台（js/world/xmn.js XmnPlatform，同一套站台坐标），换福州的颜色和站房立面：
 *   雨棚底面浅灰、白色钢柱；柱基灰色花岗岩 + 金色压条；站房一侧立面白色 + 金色腰带 + 玻璃，没有燕尾脊；
 *   站房 / 出站层 / 地铁换乘 / 东西广场在 js/world/fzsStation.js（第一次 solo 才建）。
 */
import { hex } from '../core/geo.js';
import { FONT } from './kit.js';
import { XmnPlatform } from './xmn.js';
import { FzsStation } from './fzsStation.js';
import { FO } from './fzZones.js';

const C = {
  plat: hex('#CDCCC8'), edge: hex('#F1F0EC'), bed: hex('#8E8A83'), sleeper: hex('#A19C92'), rail: hex('#6D7175'),
  roof: hex('#C9D2DA'), roofTop: hex('#EEF0F2'), col: hex('#F4F5F3'), brick: hex('#8F9395'), stone: hex('#E6E3DC'), sea: hex('#2E5E9E'),
  wall: hex('#F2F2EF'), glass: hex('#8FB4CC'), dark: hex('#3A3F45'), gold: hex('#C9A24A')
};
/** 远处背景板：闽江边的山 + 福州南台岛的高楼 */
function paintBackdrop(c, pw, ph) {
  const g = c.createLinearGradient(0, 0, 0, ph * 0.72); g.addColorStop(0, '#80B2DE'); g.addColorStop(1, '#E6EFF5'); c.fillStyle = g; c.fillRect(0, 0, pw, ph);
  c.fillStyle = '#8DA79F'; c.beginPath(); c.moveTo(0, ph); for (let i = 0; i <= 10; i++) c.lineTo(pw * i / 10, ph * (0.42 + 0.16 * Math.abs(Math.sin(i * 1.3 + 0.5)))); c.lineTo(pw, ph); c.fill();
  const cols = ['#EEF1F3', '#DCE5EC', '#E9E4DA', '#CFDCE6'];
  for (let i = 0, x = 6; x < pw; i++) { const w = 12 + (i * 13) % 18, h = ph * (0.14 + ((i * 7) % 11) / 32); c.fillStyle = cols[i % 4]; c.fillRect(x, ph * 0.74 - h, w, h); c.fillStyle = 'rgba(60,85,110,0.42)'; for (let y = ph * 0.74 - h + 3; y < ph * 0.72; y += 5) for (let xx = x + 2; xx < x + w - 3; xx += 4) c.fillRect(xx, y, 2, 2.5); x += w + 5 + (i * 11) % 16; }
  c.fillStyle = '#7F9F78'; c.fillRect(0, ph * 0.74, pw, ph * 0.26);
}
function paintName(c, pw, ph) { c.fillStyle = '#163A5F'; c.fillRect(0, 0, pw, ph); c.fillStyle = '#FFFFFF'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `800 ${ph * 0.62}px ${FONT}`; c.fillText('福 州 南 站', pw * 0.5, ph * 0.54); }

export const FZS_CFG = { O: FO, id: 'fzs', name: ['福州南', 'Fuzhounan'], C, backdrop: paintBackdrop, station: scene => new FzsStation(scene) };

export class FzsPlatform extends XmnPlatform {
  constructor(scene) { super(scene, FZS_CFG); }
  /** 站房一侧立面：花岗岩墙基 + 金色腰带 + 玻璃幕墙 + 白色檐口（没有燕尾脊） */
  facade(k, atlas, xw, xe, zb) {
    const P = k.solid, M = k.metal, C = this.C;
    k.g('granite').slab(xw - 20, xe + 20, -1.3, 3.0, zb - 2, zb, C.brick);
    P.slab(xw - 20, xe + 20, 3.0, 3.4, zb - 2.1, zb, C.gold, { ao: false });
    k.glass.slab(xw - 20, xe + 20, 3.4, 13.5, zb - 1.6, zb - 1.5, C.glass);
    for (let x = xw - 20; x <= xe + 20; x += 4) M.slab(x - 0.1, x + 0.1, 3.4, 13.5, zb - 1.75, zb - 1.55, hex('#E2E5E8'), { ao: false });
    P.slab(xw - 20, xe + 20, 3.4, 13.5, zb - 0.3, zb, C.wall);
    P.slab(xw - 22, xe + 22, 13.5, 14.3, zb - 2.6, zb + 0.5, C.roofTop);
    atlas.quad(0, 9.2, zb - 2.17, 16, 2.6, Math.PI, atlas.draw(16, 2.6, paintName, 56));
  }
  /** 雨棚柱基座：灰色花岗岩 + 金色压顶 */
  colBase(k, x, zc) {
    const P = k.solid, C = this.C;
    k.g('granite').slab(x - 0.6, x + 0.6, 0, 1.1, zc - 0.6, zc + 0.6, C.brick); P.slab(x - 0.68, x + 0.68, 1.1, 1.22, zc - 0.68, zc + 0.68, C.gold, { ao: false });
  }
}
