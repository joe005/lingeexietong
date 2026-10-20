/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** dev:mock 模式启用内置 mock 通道（见 .env.mock 与 vite.config.ts） */
  readonly VITE_USE_MOCK?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
