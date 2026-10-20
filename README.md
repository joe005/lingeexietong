# 商场清洁机器人运营管理系统（cleanbot-ops）

面向大型购物中心/商业综合体的清洁机器人智能运营管理系统：多商场、多楼层、多机器人统一管理，可视化监控、智能任务调度、设备运维与数据分析四大核心能力。

- 架构基线：`docs/wi-t1000006/architecture-baseline.md`
- HTTP API 字段级契约：`docs/wi-t1000006/technical-contract.md`
- 需求基线：`docs/wi-t1000006/requirements.md`

## 技术栈

| 层 | 选型 |
| --- | --- |
| 后端 | Node.js ≥ 20（ESM）+ Hono，入口 `src/server.js` |
| 数据 | SQLite（better-sqlite3）+ 版本化 SQL 迁移（`migrations/`） |
| 前端 | React + Vite SPA（`frontend/` 子包，构建产物输出至根 `public/`，由服务端静态托管） |

单进程 Node 服务同时承载 `/api` JSON API 与前端静态资源；无认证（需求未设角色与权限体系）。

## 运行

```bash
# 干净目录一键运行（自动创建数据目录、应用迁移、监听端口）
npm install
npm run build   # 聚合构建：调用 frontend/ 子包构建（frontend/ 不存在时跳过，服务端无需构建）
npm start       # 启动服务，默认 http://localhost:3000

# 开发模式（后端 + 前端 Vite dev server 并行；frontend/ 不存在时仅启动后端）
npm run dev

# 运行项目内测试（node --test tests/）
npm test
```

### 环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `PORT` | `3000` | HTTP 监听端口（`0` 表示随机空闲端口，启动日志会打印实际端口） |
| `DB_PATH` | `./data/cleanbot-ops.db` | SQLite 数据库文件；打开前自动创建父目录 |

隔离验证约定：`DB_PATH` 指向独立文件、`PORT=0`（或选择空闲端口）、等待启动日志 `服务已启动` 后执行验证动作，结束后清理本次进程与文件。

### 静态托管

服务端托管前端构建产物目录 `public/`（相对进程工作目录）。目录不存在时服务仍正常启动并仅提供 API；存在时非 `/api` 的 GET 未命中文件回退 `public/index.html`（SPA 客户端路由）。

## 目录结构

```
src/server.js          服务入口（读取 env、打开数据库、应用迁移、监听端口、优雅停机）
src/app.js             Hono 应用组装（模块接线 + 错误结构 + 静态托管）
src/db/                数据访问层（连接/PRAGMA/迁移执行器）
src/http/              错误结构与错误码、请求校验助手、静态托管中间件
src/modules/
  organization/        商场/楼层/机器人登记、层级浏览、基本信息更新（owns malls/floors/robots）
  tasking/             任务创建/下达/跟踪/完成（owns tasks；机器人分配：楼层内 idle 按 code 升序首个）
  robot-gateway/       机器人上报通道（状态上报 fault/idle、任务完成上报；无表，经领域服务写库）
  maintenance/         运维事件登记/处理关闭/历史查询（owns maintenance_events）
  analytics/           实时聚合统计（无表，只读聚合）
migrations/            版本化 SQL 迁移（自 001_init.sql 起；schema_migrations 记录应用版本）
scripts/build.js       聚合构建（frontend/ 存在时调用其构建，否则跳过）
scripts/dev.js         开发期并行启动（后端 + 前端 dev server）
tests/                 node --test 测试（每个文件使用独立临时数据库）
```

## 数据迁移约定

- 新迁移：在 `migrations/` 增加按序号命名的 SQL 文件（如 `002_xxx.sql`），文件名字典序即应用序。
- 服务启动时在事务中应用未执行的迁移并记录到 `schema_migrations`；已应用迁移不重复执行。
- 禁止 ORM 自动同步与运行时手工改 schema。

## 状态机（服务端唯一事实源）

- 机器人 `status`：`idle` → `executing` → `idle`；任意状态 → `fault`；`fault` → `idle`（恢复上报）。
- 任务 `status`：`pending` → `executing` → `completed`；机器人故障上报时其执行中任务回退 `pending` 并解除机器人关联。
- 运维事件 `status`：`open` → `resolved`。
- 跨表状态流转（任务下达/完成、故障回退）在 better-sqlite3 同步事务中原子提交。

## API 概览

Base path `/api`，请求与响应体均为 UTF-8 JSON，字段 snake_case；错误结构 `{"error":{"code","message","fields"?}}`。完整端点、字段形状（含服务端派生字段 `mall_id`/`current_task_id`/计数/统计聚合）与错误码以 `docs/wi-t1000006/technical-contract.md` 为唯一依据。
