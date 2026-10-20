/** 展示格式化helper：时间、时长、面积、百分比。 */

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds} 秒`;
  return `${minutes} 分 ${pad(seconds)} 秒`;
}

export function formatArea(sqm: number): string {
  const rounded = Math.round(sqm * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)} ㎡`;
}

export function formatPercent(pct: number): string {
  return `${Math.round(pct)}%`;
}

/** 表单默认作业时间：当天 22:00，已过则取次日 22:00。 */
export function defaultEveningTime(now: Date = new Date()): string {
  const evening = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 22, 0, 0);
  if (evening.getTime() <= now.getTime()) evening.setDate(evening.getDate() + 1);
  return `${evening.getFullYear()}-${pad(evening.getMonth() + 1)}-${pad(evening.getDate())}T${pad(evening.getHours())}:${pad(evening.getMinutes())}`;
}
