/*
 * 地图上的景点小图标：只列游戏里真的搭出来、能走进去玩的地方（只报站、进不去的不列，如石室、天河）。
 * code = 车站；icon = js/ui/mapicons.js 里的图标；name = 图标下面的短名；names = 点开小卡片的全名；
 * 出口和站里导向牌一致（station.js exitMain：attraction.exit || exitMain || 'D'）。
 */
import { STATIONS } from './lines.js';
export const ATTRACTIONS = [
  { id: 'sysy', code: 'jnt', icon: 'hall', name: '中山纪念堂', names: ['中山纪念堂'] },
  { id: 'njs', code: 'njs', icon: 'gate', name: '农讲所', names: ['农讲所旧址', '文明路糖水街'] },
  { id: 'hotel', code: 'njs', icon: 'bed', name: '丽呈酒店', names: ['丽呈铂锐酒店'] },
  { id: 'cjc', code: 'cjc', icon: 'clan', name: '陈家祠', names: ['陈家祠'] },
  { id: 'rams', code: 'yxgy', icon: 'rams', name: '五羊石像', names: ['越秀公园五羊石像'] },
  { id: 'shamian', code: 'hs', icon: 'chapel', name: '沙面', names: ['沙面'] },
];
export const attractionExit = code => { const s = STATIONS[code]; return s.attraction ? s.attraction.exit : s.exitMain || 'D'; };
export const attractionsAt = code => ATTRACTIONS.filter(a => a.code === code);
