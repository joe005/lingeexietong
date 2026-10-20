import { describe, expect, it } from 'vitest';
import { defaultEveningTime, formatArea, formatDateTime, formatDuration, formatPercent } from '../src/lib/format';

describe('format', () => {
  it('formatDateTime 输出本地日期时间', () => {
    expect(formatDateTime('2026-10-20T14:00:00.000Z')).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  });

  it('formatDuration 覆盖秒与分', () => {
    expect(formatDuration(45_000)).toBe('45 秒');
    expect(formatDuration(65_000)).toBe('1 分 05 秒');
  });

  it('formatArea 保留一位小数', () => {
    expect(formatArea(860)).toBe('860 ㎡');
    expect(formatArea(123.44)).toBe('123.4 ㎡');
  });

  it('formatPercent 取整', () => {
    expect(formatPercent(66.6)).toBe('67%');
  });

  it('defaultEveningTime 默认为当天或次日 22:00', () => {
    expect(defaultEveningTime(new Date('2026-10-20T10:00:00'))).toMatch(/T22:00$/);
  });
});
