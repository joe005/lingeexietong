import type { Zone } from '../types';

/** 商场楼层与区域目录（演示种子数据）：区域自带清洁面积，作为已清洁面积的统计口径。 */
export const ZONES: Zone[] = [
  { id: 'B1-parking', floor: 'B1', name: '地下停车场', areaSqm: 4200 },
  { id: '1F-atrium', floor: '1F', name: '中庭', areaSqm: 860 },
  { id: '1F-corridor', floor: '1F', name: '主走廊', areaSqm: 640 },
  { id: '2F-restaurant', floor: '2F', name: '餐饮区', areaSqm: 1180 },
  { id: '2F-retail', floor: '2F', name: '零售区', areaSqm: 1520 },
  { id: '3F-kids', floor: '3F', name: '儿童区', areaSqm: 720 },
  { id: '3F-office', floor: '3F', name: '办公区', areaSqm: 480 },
];

export const FLOORS: string[] = ['B1', '1F', '2F', '3F'];

export function zonesByFloor(floor: string): Zone[] {
  return ZONES.filter((zone) => zone.floor === floor);
}

export function findZone(zoneId: string): Zone | undefined {
  return ZONES.find((zone) => zone.id === zoneId);
}
