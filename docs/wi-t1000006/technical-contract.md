# 技术契约：清洁机器人运营管理系统 HTTP API

本文为前后端共同遵循的 API 契约，是字段级唯一定义来源；架构结论见 `docs/wi-t1000006/architecture-baseline.md`。

## 通用约定

- Base path `/api`；请求与响应体均为 UTF-8 JSON。
- 字段命名 snake_case，与数据库列一致；服务端负责行→对象映射与派生字段计算（计数、`mall_id`、`current_task_id`、统计聚合），前端原样消费、不做字段转换。
- 时间为 ISO 8601 UTC 字符串（如 `2026-10-20T07:30:00.000Z`）；`id` 为整数。
- 认证：无（需求未设角色与权限体系），所有端点匿名可用。
- 错误结构：`{"error":{"code":"<CODE>","message":"<人类可读说明>","fields":{"<字段>":"<原因>"}}}`；`fields` 仅校验错误时出现。
- 幂等性：GET 安全可重复；POST 创建为非幂等；状态迁移端点（下达/处理关闭/机器人上报）在状态已变更后重复调用返回 409，不做静默重放。

通用错误码：

| HTTP | code | 场景 |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | 字段缺失、类型或长度校验失败 |
| 404 | `NOT_FOUND` | 路径中对象不存在 |
| 409 | `ROBOT_CODE_DUPLICATED` | 机器人编号已存在 |
| 409 | `ROBOT_BUSY` | 机器人执行任务中调整楼层归属 |
| 409 | `TASK_NOT_DISPATCHABLE` | 任务当前状态不允许下达 |
| 409 | `NO_AVAILABLE_ROBOT` | 下达时目标楼层无可分配空闲机器人 |
| 409 | `INVALID_STATUS_TRANSITION` | 机器人上报的状态转换非法 |
| 409 | `NO_EXECUTING_TASK` | 机器人无执行中任务时上报完成 |
| 409 | `EVENT_ALREADY_RESOLVED` | 运维事件已处理 |

## Mall API（组织管理）

| 端点 | 请求 | 成功响应 | 失败 |
| --- | --- | --- | --- |
| `GET /api/malls` | — | 200 `{"malls":[MallSummary]}` | — |
| `POST /api/malls` | `{"name":string 1..100 必填}` | 201 `{"mall":MallSummary}` | 400 |
| `GET /api/malls/:id` | — | 200 `{"mall":MallDetail}` | 404 |
| `PATCH /api/malls/:id` | `{"name":string 1..100 可选}` | 200 `{"mall":MallSummary}` | 400 / 404 |

- `MallSummary = {"id":int,"name":string,"floor_count":int,"robot_count":int,"created_at":string}`（计数由服务端派生）。
- `MallDetail = MallSummary + {"floors":[{"id":int,"name":string,"robot_count":int}]}`。

## Floor API（组织管理）

| 端点 | 请求 | 成功响应 | 失败 |
| --- | --- | --- | --- |
| `GET /api/floors?mall_id=` | `mall_id` 可选（省略=全部） | 200 `{"floors":[Floor]}` | — |
| `POST /api/floors` | `{"mall_id":int 必填,"name":string 1..100 必填}` | 201 `{"floor":Floor}` | 400 / 404（商场不存在） |
| `GET /api/floors/:id` | — | 200 `{"floor":FloorDetail}` | 404 |
| `PATCH /api/floors/:id` | `{"name":string 1..100 可选}` | 200 `{"floor":Floor}` | 400 / 404 |

- `Floor = {"id":int,"mall_id":int,"name":string,"robot_count":int,"created_at":string}`。
- `FloorDetail = Floor + {"mall":{"id":int,"name":string},"robots":[Robot]}`。

## Robot API（组织管理与监控读取）

| 端点 | 请求 | 成功响应 | 失败 |
| --- | --- | --- | --- |
| `GET /api/robots?mall_id=&floor_id=&status=` | 过滤参数均可省略 | 200 `{"robots":[Robot]}` | — |
| `POST /api/robots` | `{"floor_id":int 必填,"name":string 1..100 必填,"code":string 1..50 必填}` | 201 `{"robot":Robot}` | 400 / 404（楼层不存在）/ 409 `ROBOT_CODE_DUPLICATED` |
| `GET /api/robots/:id` | — | 200 `{"robot":RobotDetail}` | 404 |
| `PATCH /api/robots/:id` | `{"name":string 1..100 可选,"floor_id":int 可选}` | 200 `{"robot":Robot}` | 400 / 404 / 409 `ROBOT_BUSY`（执行任务中改楼层） |

- `Robot = {"id":int,"floor_id":int,"mall_id":int,"name":string,"code":string,"status":"idle"|"executing"|"fault","current_task_id":int|null,"created_at":string}`（`mall_id`、`current_task_id` 由服务端派生；`current_task_id` 为该机器人执行中任务的 id，无则为 null）。
- `RobotDetail = Robot + {"floor":{"id":int,"name":string},"mall":{"id":int,"name":string},"current_task":Task|null}`。
- 状态值与界面标签映射由前端承担：`idle`=空闲、`executing`=执行任务中、`fault`=异常。

## Task API（任务调度）

| 端点 | 请求 | 成功响应 | 失败 |
| --- | --- | --- | --- |
| `GET /api/tasks?status=&floor_id=&mall_id=` | 过滤参数均可省略 | 200 `{"tasks":[Task]}` | — |
| `POST /api/tasks` | `{"floor_id":int 必填}` | 201 `{"task":Task}` | 404（楼层不存在） |
| `POST /api/tasks/:id/dispatch` | 无请求体 | 200 `{"task":Task}` | 404 / 409 `TASK_NOT_DISPATCHABLE` / 409 `NO_AVAILABLE_ROBOT` |
| `GET /api/tasks/:id` | — | 200 `{"task":TaskDetail}` | 404 |

- `Task = {"id":int,"floor_id":int,"mall_id":int,"robot_id":int|null,"status":"pending"|"executing"|"completed","created_at":string,"dispatched_at":string|null,"completed_at":string|null}`（`mall_id` 由服务端派生）。
- `TaskDetail = Task + {"floor":{"id":int,"name":string},"robot":{"id":int,"name":string,"code":string}|null}`。
- `POST /api/tasks` 语义：创建任务（`status="pending"`）并立即按分配规则尝试分配目标楼层空闲机器人（`code` 升序首个）；无可分配时 `robot_id=null` 保持待执行。
- `dispatch` 语义：任务 `pending`→`executing`（记录 `dispatched_at`）；若未分配或原分配机器人已非空闲，重新按分配规则分配；分配成功后机器人 `idle`→`executing`。任务状态与机器人状态变更在同事务内原子提交。
- 任务状态界面标签由前端映射：`pending`=待执行、`executing`=执行中、`completed`=已完成。

## Robot Report API（机器人上报通道）

调用方为机器人侧；当前为内置“机器人模拟控制台”页面，真实机器人接入时仅替换调用方，本契约不变。

| 端点 | 请求 | 成功响应 | 失败 |
| --- | --- | --- | --- |
| `POST /api/robot-gateway/:robotId/status` | `{"status":"fault"|"idle" 必填}` | 200 `{"robot":Robot}` | 400 / 404 / 409 `INVALID_STATUS_TRANSITION` |
| `POST /api/robot-gateway/:robotId/task-completion` | 无请求体 | 200 `{"task":Task,"robot":Robot}` | 404 / 409 `NO_EXECUTING_TASK` |

- `status="fault"`：机器人任意状态→`fault`；若其有执行中任务，该任务回退 `pending` 并解除机器人关联（`robot_id=null`），同事务提交。
- `status="idle"`：仅 `fault`→`idle`（恢复上报）合法；其他起始状态返回 `INVALID_STATUS_TRANSITION`。
- `task-completion`：该机器人执行中的任务→`completed`（记录 `completed_at`），机器人→`idle`，同事务提交。

## Maintenance API（设备运维）

| 端点 | 请求 | 成功响应 | 失败 |
| --- | --- | --- | --- |
| `GET /api/maintenance-events?robot_id=&status=` | 过滤参数均可省略 | 200 `{"events":[Event]}` | — |
| `POST /api/maintenance-events` | `{"robot_id":int 必填,"type":"fault"|"maintenance" 必填,"description":string 1..500 必填}` | 201 `{"event":Event}` | 400 / 404（机器人不存在） |
| `GET /api/maintenance-events/:id` | — | 200 `{"event":EventDetail}` | 404 |
| `POST /api/maintenance-events/:id/resolve` | `{"resolution":string 1..500 必填}` | 200 `{"event":Event}` | 400 / 404 / 409 `EVENT_ALREADY_RESOLVED` |

- `Event = {"id":int,"robot_id":int,"type":"fault"|"maintenance","description":string,"status":"open"|"resolved","resolution":string|null,"created_at":string,"resolved_at":string|null}`。
- `EventDetail = Event + {"robot":{"id":int,"name":string,"code":string}}`。
- 语义边界：登记与处理运维事件不改变机器人运行状态（记录域与运行状态域解耦）。
- 界面标签由前端映射：`type`：`fault`=故障、`maintenance`=维护；`status`：`open`=未处理、`resolved`=已处理。

## Stats API（数据分析）

| 端点 | 请求 | 成功响应 | 失败 |
| --- | --- | --- | --- |
| `GET /api/stats` | — | 200 `{"stats":{...}}` | — |

- `stats.totals = {"malls":int,"floors":int,"robots":int,"robots_idle":int,"robots_executing":int,"robots_fault":int,"tasks":int,"tasks_pending":int,"tasks_executing":int,"tasks_completed":int,"maintenance":int,"maintenance_open":int,"maintenance_resolved":int}`。
- `stats.by_mall = [{"mall_id":int,"mall_name":string,"floors":int,"robots":int,"robots_fault":int,"tasks":int,"tasks_completed":int,"maintenance_open":int}]`。
- 全部数值由 SQL 实时聚合自对应记录表计算，无缓存与预聚合存储，保证与系统内实际记录一致。

## 前端消费约定

- SPA 路由：`/malls`、`/monitor`、`/tasks`、`/maintenance`、`/analytics`、`/robot-sim`。
- 监控页与任务列表页每 5 秒轮询对应列表端点并提供手动刷新；写操作成功后立即重新拉取受影响数据。
