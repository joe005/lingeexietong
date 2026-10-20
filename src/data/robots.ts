import type { Robot } from '../types';

/** 内置机器人清单（演示前提）：系统不提供机器人档案管理，仅作为可分配资源展示。 */
export const SEED_ROBOTS: Robot[] = [
  { id: 'R-01', name: '清洁机器人 01 号', model: 'CleanMax X2', batteryPct: 92 },
  { id: 'R-02', name: '清洁机器人 02 号', model: 'CleanMax X2', batteryPct: 87 },
  { id: 'R-03', name: '清洁机器人 03 号', model: 'FloorPro S1', batteryPct: 78 },
  { id: 'R-04', name: '清洁机器人 04 号', model: 'FloorPro S1', batteryPct: 64 },
];
