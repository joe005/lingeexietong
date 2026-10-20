# 系统设计：清洁机器人运营管理系统

设计输入：已批准需求基线 `docs/wi-t1000006/requirements.md`（SHA-256 `78c0aa5e74efee0b305e7f4425553a192b368d402d9bb6673316dd67252eda71`）。业务对象、状态与验收语义以需求基线为唯一来源，本文仅规定必要的技术承载方式；字段级 API 契约见 `docs/wi-t1000006/technical-contract.md`。

<!-- system-design: scope -->
## 1. 整体方案与设计基线

**应用定性**：新建全栈 Web 运营后台（分类 fullstack-complex）。单操作员使用、无认证与角色体系（需求未规定）；服务端为权威数据源；机器人侧数据流由系统内模拟通道承载（见 §5）。

**技术栈（冻结）**：

| 层 | 选型 | 说明 |
| --- | --- | --- |
| 后端 | Node.js ≥ 20（ESM）+ Hono | HTTP JSON API；服务入口 `src/server.js` |
| 前端 | React + Vite（SPA） | 客户端路由；生产构建产物由服务端静态托管 |
| 样式 | Tailwind CSS | 工具类样式，实现 §3 的 Modern SaaS 视觉基线 |
| 数据 | SQLite（better-sqlite3） | 文件数据库 + 项目内数据访问层 + 版本化 SQL 迁移 |
| 包管理 | npm | `package-lock.json` 入库 |

**运行形态**：单进程 Node 服务同时承载 API 与前端静态资源；开发期 Vite dev server 将 `/api` 代理至后端。单实例部署，无横向扩展要求，无外部服务依赖。

```
浏览器（桌面 Web）
 └ React SPA：组织管理 / 实时监控 / 任务调度 / 设备运维 / 数据分析 / 机器人模拟控制台
       │  JSON over HTTP（/api）
       ▼
 Hono 服务（src/server.js，单进程）
 ├ organization（组织与设备）   —— owns malls / floors / robots
 ├ tasking（任务调度）          —— owns tasks
 ├ robot-gateway（机器人上报通道）—— 无表，经领域服务写入
 ├ maintenance（设备运维）      —— owns maintenance_events
 └ analytics（数据分析）        —— 无表，实时聚合查询
       ▼
 SQLite 文件数据库（DB_PATH，默认 ./data/cleanbot-ops.db）
```

**运行约定**：常规启动 `npm start`（`node src/server.js`，生产先 `npm run build`）；开发 `npm run dev`。端口 `PORT`（默认 3000）；数据库 `DB_PATH`（默认 `./data/cleanbot-ops.db`，打开前自动创建父目录，隔离验证以 `DB_PATH` 指向独立文件覆盖）。验收启动由验证阶段专用脚本负责启动与清理，与日常启动分开记录。

<!-- system-design: architecture-boundaries -->
## 2. 领域责任、模块边界与接口摘要

| 模块 | 职责 | 唯一数据归属 | 接口摘要（调用方向） |
| --- | --- | --- | --- |
| organization | 商场/楼层/机器人登记、层级浏览、基本信息更新；机器人运行状态唯一事实源 | `malls`、`floors`、`robots` | Mall/Floor/Robot API（前端→服务端）；机器人状态读写领域服务（服务端内部） |
| tasking | 清洁任务创建、下达、跟踪与完成落库；机器人分配规则 | `tasks` | Task API（前端→服务端）；任务完成领域服务（robot-gateway→tasking） |
| robot-gateway | 承载“机器人→系统”上报数据流：状态上报（故障/恢复）与任务完成上报 | 无表（经 organization/tasking 领域服务写库） | Robot Report API（机器人侧调用方→服务端；当前调用方为内置模拟控制台） |
| maintenance | 运维事件登记、处理关闭与历史查询；纯记录域，不驱动机器人运行状态 | `maintenance_events` | Maintenance API（前端→服务端） |
| analytics | 任务执行/机器人运行/运维记录的聚合统计，查询时实时计算 | 无表（只读聚合） | Stats API（前端→服务端） |

**边界规则**：前端仅经 `/api` 访问服务端；模块不直读其他模块私有表，跨模块写入一律调用被写模块的领域服务；机器人运行状态仅由 robot-gateway 上报与 tasking 下达/完成流转驱动（maintenance 事件与机器人状态解耦）；监控、任务、运维、分析围绕同一机器人对象体系同源读取。

**领域状态机（服务端唯一事实源）**：

- 机器人 `status`：`idle`（空闲）→ `executing`（执行任务中）→ `idle`；任意状态 → `fault`（异常）；`fault` → `idle`（恢复上报）。
- 任务 `status`：`pending`（待执行）→ `executing`（执行中）→ `completed`（已完成）。下达由操作员触发；完成由机器人上报驱动；机器人故障上报时其执行中任务回退 `pending` 并解除机器人关联。
- 运维事件 `status`：`open`（未处理）→ `resolved`（已处理）。

**机器人分配规则（最小确定性实现）**：任务创建与下达时在目标楼层内选取空闲（`idle`）机器人，按 `code` 升序取首个；无空闲机器人时任务保持待执行并在界面上可读原因。调度策略的“智能”程度需求未规定，不构成实现约束。

## 3. 全局 UI 基线

- **展示模板**：`saas-ops-console`——左侧固定导航 + 顶部上下文栏 + 主工作区。导航项与路由一一对应：组织管理 `/malls`、实时监控 `/monitor`、任务调度 `/tasks`、设备运维 `/maintenance`、数据分析 `/analytics`、机器人模拟 `/robot-sim`（末项以辅助样式区隔，明示为机器人通道的模拟驱动控制台）。
- **视觉预设**：Modern SaaS——中性灰表面、细边界、少阴影、中等圆角；单一主色（蓝）承担主要操作与“执行任务中”状态；状态色约定：空闲=中性灰、执行任务中=主色、待执行=琥珀、已完成=绿、异常与未处理=红、已处理=绿。状态徽章为全局复用组件。
- **主工作流布局**：组织管理为商场→楼层→机器人逐层下钻的列表/详情（面包屑导航）；监控为按商场/楼层分组的机器人状态卡片墙与状态统计条；任务为筛选表格 + 详情视图；运维为事件表格 + 处理对话框；分析为指标卡 + 按商场汇总表；模拟控制台为机器人卡片与上报操作按钮组。
- **目标设备**：桌面 Web（主用宽度 ≥1280px）。需求未要求移动端/窄屏，不作该范围验收；表格在窄窗口横向滚动，截断文本以悬停标题显示全文。
- **全局状态**：加载（骨架/spinner）、空态（附创建入口引导）、错误（错误条 + 重试）、成功（轻提示）。
- **数据刷新**：监控与任务列表 5 秒轮询 + 手动刷新按钮；其余页面进入时拉取（刷新频率需求未规定，此为实现约定）。

## 4. 数据模型与迁移

**表结构**（概要；API 字段形状见技术契约）：

| 表 | 字段 | 关键约束 |
| --- | --- | --- |
| `malls` | `id`、`name`、`created_at` | — |
| `floors` | `id`、`mall_id`、`name`、`created_at` | `mall_id` 外键→`malls`；楼层唯一归属商场 |
| `robots` | `id`、`floor_id`、`name`、`code`、`status`、`created_at` | `floor_id` 外键→`floors`；`code` 全局唯一；`status∈idle/executing/fault` |
| `tasks` | `id`、`floor_id`、`robot_id`、`status`、`created_at`、`dispatched_at`、`completed_at` | `floor_id` 外键；`robot_id` 可空外键；`status∈pending/executing/completed` |
| `maintenance_events` | `id`、`robot_id`、`type`、`description`、`status`、`resolution`、`created_at`、`resolved_at` | `robot_id` 外键；`type∈fault/maintenance`；`status∈open/resolved` |

- 机器人“当前执行任务”不落列，由 `tasks`（`robot_id` + `status='executing'`）派生，保证单一事实源。
- `id` 为整数自增主键；时间戳为 ISO 8601 UTC 字符串。
- 机器人执行任务中禁止调整楼层归属（服务端守卫，返回冲突错误）；对象删除不在需求内，不提供删除能力。

**迁移**：`migrations/` 目录按序号命名的 SQL 文件（自 `001_init.sql` 起）+ `schema_migrations` 版本表；服务启动时在事务中应用未执行的迁移。禁止 ORM 自动同步与运行时手工改 schema。任务与机器人状态流转使用 better-sqlite3 同步事务，保证跨表一致性。

**CommonApp dbkit 评估结论（未选用）**：已按规则完成一次目录与 manifest 核查：dbkit 0.2.0（`@commonapp/dbkit`），status ready，manifest SHA-256 `f343ad1fc6ceae6843b0c43efc72f6c59c568f826619570f0808c017ec06eec6`，无模块依赖，SQLite 驱动。未选用理由：其一，本执行为 design 单阶段，源码写范围限定于 `docs/wi-t1000006` 与 `.expert-team/work-items/wi-t1000006`，而 dbkit 路线要求在设计阶段执行批准的 workspace-init 并向工作区根目录写入脚手架，超出本执行授权写范围；其二，需求持久化面简单（五张关系表、CRUD 与实时聚合），无跨应用复用信号，项目内以同驱动（better-sqlite3）实现访问层与版本化迁移即可满足且集成成本更低。替换条件：后续阶段获准执行工作区初始化且出现复用或迁移工具诉求时，可按同一 bootstrap 流程切换 dbkit，数据模型与 API 契约保持不变。

## 5. 机器人通道集成

需求声明“系统向机器人下达任务、机器人向系统上报运行状态”为必要产品数据流，未规定通信技术与协议。本设计以 **RobotGateway 通道**承载该边界：

- **下达方向（系统→机器人）**：任务下达后调度状态在服务端流转（分配机器人、机器人进入执行任务中），下达结果经任务与监控读取面呈现；当前无真实机器人端，不外发指令。
- **上报方向（机器人→系统）**：服务端暴露状态上报（故障/恢复）与任务完成上报端点；当前调用方为内置“机器人模拟控制台”页面（演示与验收驱动面），真实机器人接入时仅替换调用方，端点语义与状态机不变，监控与任务界面无需改动。
- **失败可见性**：非法状态转换（恢复一个空闲机器人、无执行中任务时上报完成等）返回冲突错误且原因可读；合法上报即时反映到监控数据面。

## 6. 运行与可靠性

- 干净目录执行 `npm install && npm run build && npm start` 即可运行：自动创建数据目录、应用迁移、监听 `PORT`（默认 3000），无需人工准备。
- 隔离验证：`DB_PATH` 指向独立文件、选择空闲端口、等待真实监听就绪后执行验收动作，结束后仅清理本次启动的进程。
- 一致性：同步 SQLite 事务承载跨表状态流转；无外部服务依赖；无认证（需求未要求），部署边界由运行环境承担。
