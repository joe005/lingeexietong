/**
 * API 门面：页面统一经 getApiClient() 获取客户端。
 *
 * - 默认（dev / build）：返回 httpClient（真实 /api 通道）；
 * - dev:mock 与单元测试（VITE_USE_MOCK=true）：动态加载 mock 通道；
 *   生产构建时该开关被静态替换为 false，mock 模块不进入产物。
 */
import { httpClient, type ApiClient } from './client';

let clientPromise: Promise<ApiClient> | null = null;

export function getApiClient(): Promise<ApiClient> {
  if (!clientPromise) {
    clientPromise =
      import.meta.env.VITE_USE_MOCK === 'true'
        ? import('./mocks').then((module) => module.createMockClient())
        : Promise.resolve(httpClient);
  }
  return clientPromise;
}

export { isApiRequestError, ApiRequestError } from './client';
export type { ApiClient } from './client';
