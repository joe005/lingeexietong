import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// 单元级聚焦测试：mock 契约行为 + 页面数据流（jsdom，不启动浏览器/HTTP 服务）。
// 测试统一走 __USE_MOCK__=true 的 mock 客户端，不依赖后端进程。
export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_USE_MOCK': JSON.stringify('true'),
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    include: ['test/**/*.test.{ts,tsx}'],
  },
});
