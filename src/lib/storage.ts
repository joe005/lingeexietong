/** 存储适配层：浏览器中使用 localStorage，Node（单元测试）中退化为内存存储。 */

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function createMemoryStorage(): KeyValueStorage {
  const map = new Map<string, string>();
  return {
    getItem: (key) => (map.has(key) ? (map.get(key) as string) : null),
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
}

export function resolveStorage(): KeyValueStorage {
  try {
    const candidate = (globalThis as { localStorage?: KeyValueStorage }).localStorage;
    if (candidate) {
      const probeKey = '__cleaning_ops_probe__';
      candidate.setItem(probeKey, '1');
      candidate.removeItem(probeKey);
      return candidate;
    }
  } catch {
    // 隐私模式等场景下 localStorage 不可用，退化为内存存储
  }
  return createMemoryStorage();
}

export const storage: KeyValueStorage = resolveStorage();
