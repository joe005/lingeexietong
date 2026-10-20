import { useEffect, useState } from 'react';

/** 定时返回当前时间戳，驱动实时看板按固定间隔重算执行快照。 */
export function useTicker(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}
