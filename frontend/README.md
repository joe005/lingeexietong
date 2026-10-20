# cleanbot-ops-frontend

清洁机器人运营管理系统的 React SPA 前端子包（React 18 + Vite 5 + TypeScript + Tailwind CSS）。

- 页面路由：`/malls`（组织管理，商场→楼层→机器人逐层下钻）、`/monitor`（实时监控）、`/tasks`（任务调度）、`/maintenance`（设备运维）、`/analytics`（数据分析）、`/robot-sim`（机器人模拟控制台）。
- API 契约消费：类型与客户端位于 `src/api/`，字段 snake_case 原样消费，不做字段转换；契约来源为 `docs/wi-t1000006/technical-contract.md`。
- 监控页与任务列表页每 5 秒轮询 + 手动刷新；写操作成功后立即重新拉取受影响数据。

## 常用命令（在本目录执行）

```bash
npm install          # 安装依赖
npm run dev          # 开发模式：/api 代理至 http://localhost:3000（后端须已启动）
npm run dev:mock     # 开发模式（mock 通道）：不依赖后端进程，页面数据流走内置契约 mock
npm run typecheck    # TypeScript 类型检查（tsc --noEmit）
npm test             # 单元级聚焦测试（vitest + jsdom：契约行为 + 页面数据流，不依赖后端）
npm run build        # 类型检查 + 生产构建，产物输出至仓库根 public/（后端静态托管目录）
npm run preview      # 预览生产构建产物
```

生产构建不含 mock 模块（`__USE_MOCK__` 在构建时被静态替换并剔除）。
