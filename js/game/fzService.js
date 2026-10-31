/*
 * 福州地铁运营：和厦门地铁同一套状态机（js/game/xmService.js XmMetro），只换城市描述：
 *   车站 FzStation（白搪瓷墙面）、出站街口 XmStreet.plain（福州地铁出口亭）、报站 普通话 → 福州话（暂缺，跳过）→ 英语。
 * 列车 id 20 / 21（厦门 10 / 11、广州 0..）；涂装 net='fz'（js/world/train.js registerNet）。
 */
import * as Ann from '../audio/announcements.js';
import { fzExitSegs } from '../data/phrases.js';
import { FZ_LINES, FZ_STATIONS, fzNext } from '../data/fz-lines.js';
import { FZ_EXITS, fzExitZh } from '../data/fz-exits.js';
import { FzStation, FZ_NET } from '../world/fzMetro.js';
import { XmStreet } from '../world/xmStreet.js';
import { XmMetro } from './xmService.js';
import { FS } from '../world/fzZones.js';

export const FZ_STREET = { O: FS, net: 'fz', EXITS: FZ_EXITS, LINES: FZ_LINES, STATIONS: FZ_STATIONS, brand: ['福州地铁', 'Fuzhou Metro'], exitZh: fzExitZh, special: false };

export const FZ_SVC = {
  N: FZ_NET, net: 'fz', ev: 'fz', ids: [20, 21],
  station: (scene, code) => new FzStation(scene, code),
  street: (scene, code) => new XmStreet(scene, code, FZ_STREET),
  next: fzNext,
  ann: { platform: Ann.fzPlatform, depart: Ann.fzDepart, arrive: Ann.arrive, welcome: Ann.welcome, exit: Ann.fzExit },
  exitSegs: fzExitSegs,
  /** 福州火车南站的出口在国铁换乘大厅里（FzsStation），不走地铁站厅出口街口 */
  streetAt: code => !!FZ_EXITS[code],
};

export class FzMetro extends XmMetro {
  constructor(scene, ctx) { super(scene, ctx, FZ_SVC); }
}
