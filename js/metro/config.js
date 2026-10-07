// 共享配置：站点、尺度、调色。所有模块只读，不要各自另起一套常量。
(function () {
  'use strict';
  var GZ = (window.GZ = window.GZ || {});

  GZ.config = {
    // 尺度：1 单位 = 1 个积木颗粒。小人身高 3.8，玩家眼睛离地 3.4。
    PERSON_H: 3.8,
    EYE_H: 3.4,
    LINE: { name: '1号线', color: '#F3D03E', terminals: { up: '广州东站', down: '西塱' } },
    TRAIN: { bodyColor: '#F6CF1B', stripeColor: '#D01F2D', cars: 6 },
    // 沿「往广州东站」方向依次排列的真实车站。color 是站台色带颜色，
    // 2026-10-06 已核对各站1号线站体色系与出口（来源/配色解释见 _dev/WORLD_API.md）。
    // 色系经查证；HEX 是积木材质近似色，并非广州地铁官方色号。
    STATIONS: [
      { id: 'gyq',  name: '公园前',   en: 'Gongyuanqian',               color: '#FFFFFF', colorVerified: true,
        transfer: '2号线', exit: 'F', landmark: 'park',   landmarkName: '人民公园' },
      { id: 'njs',  name: '农讲所',   en: 'Peasant Movement Institute', color: '#9C1010', colorVerified: true,
        transfer: null,    exit: 'C', landmark: 'njs',    landmarkName: '农民运动讲习所旧址' },
      { id: 'lsly', name: '烈士陵园', en: "Martyrs' Park",              color: '#C8AA6E', colorVerified: true,
        transfer: null,    exit: 'D', landmark: 'martyrs', landmarkName: '广州起义烈士陵园' },
      { id: 'dsk',  name: '东山口',   en: 'Dongshankou',                color: '#E6D6AD', colorVerified: true,
        transfer: '6号线', exit: 'F', landmark: 'dongshan', landmarkName: '东山洋楼' }
    ]
  };
})();
