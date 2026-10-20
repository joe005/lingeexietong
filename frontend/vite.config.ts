import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// 前端子包构建约定（见 docs/wi-t1000006/architecture-baseline.md §1/§3）：
// - 生产构建产物输出到仓库根 public/，由后端（T01）静态托管；
// - dev server 将 /api 代理到后端（默认 http://localhost:3000）；
// - `npm run dev:mock`（--mode mock，读取 .env.mock）以内置 mock 通道驱动页面，
//   用于不依赖后端进程的页面数据流验证；默认 dev 与生产构建均不启用 mock。
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const useMock = env.VITE_USE_MOCK === 'true';
  return {
    plugins: [react()],
    define: {
      // dev 下经 importAnalysis 合入 import.meta.env；build 下替换为字面量并静态剔除 mock。
      // 值统一为字符串 'true'/'false'，与代码中 === 'true' 比较及 vitest 注入保持一致。
      'import.meta.env.VITE_USE_MOCK': JSON.stringify(String(useMock)),
    },
    build: {
      outDir: '../public',
      emptyOutDir: true,
    },
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
        },
      },
    },
  };
});
