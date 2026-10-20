# 商场清洁机器人运营管理系统 · 实施报告

> WorkItem：wi-t1000005 ｜ 阶段：implementation ｜ 执行模式：inline-light（simple-frontend 路线）
> 需求基线：`docs/wi-t1000005/requirements.md`（sha256:1afd01bb536d8d704bdcfd49d203861e25c5cd58365290532320cbbc4f3fc7ec）
> 架构基线：`docs/wi-t1000005/architecture-baseline.md`（sha256:129d9e69db0d681b50f032efa05bc414afe0df3085d8578fca964d989607f686）

## 1. 变更行为

在工作区内新建了完整的 React/Vite 单页应用，闭环需求主线的四步演示流程：

1. **创建晚间清洁计划**：运营人员选择楼层 → 区域（联动，展示区域面积）→ 作业时间（默认当天/次日 22:00）→ 清洁模式（自由文本，提供常用模式快捷填入），保存后进入计划详情，可重新打开核对楼层/区域/作业时间/清洁模式与输入一致（AC-01）。
2. **分配机器人**：计划详情页从机器人清单选择机器人并确认；分配即写入计划-机器人关联并启动执行；执行中的机器人不可重复分配、非待分配计划不可再分配（AC-02）。
3. **查看实时进度**：分配后任务进入执行状态，实时看板（及计划详情页）每 500ms 重算快照，展示当前位置（楼层·区域·路线站点）、任务进度、已清洁面积、异常状态与执行事件流；执行中期安排两类模拟异常（障碍物绕行、垃圾箱清理），异常期间进度暂停、状态徽章与事件同步变化（AC-03）。
4. **完成并查看报告**：进度推进到 100% 后任务自动完成并落档作业报告；作业报告页/计划详情页可查看已清洁面积、任务进度（100%）、执行时长与异常记录（AC-04）。

刷新页面不丢失计划、报告与执行进度：执行快照由「执行起点时间 + 纯函数模拟器」推导，重新打开页面后按已耗时自动恢复，到点后由全局 tick 自动完成并生成报告。

## 2. 实现范围与调用链

```
UI 层（pages/components）
  PlansPage → PlanForm ──────────────┐
  PlanDetailPage → RobotAssignForm ──┤
  DashboardPage → ExecutionDashboard ┤
  ReportsPage → ReportDetail ────────┘
业务边界（store/store.ts：唯一读写边界，页面不直拼存储键）
  createPlan / assignRobot / refreshCompletions → localStorage（键 cleaning-robot-ops:v1）
模拟执行器（simulator/simulator.ts：纯函数）
  progressAt / pausedMsAt / snapshotAt / eventsUpTo / reportExceptionRecords
数据与基础设施
  data/zones.ts（楼层-区域目录，含面积）· data/robots.ts（内置机器人种子）
  lib/storage.ts（localStorage 适配，无 DOM 时降级内存存储，供单测使用）
  lib/format.ts（时间/时长/面积/百分比格式化）· lib/useTicker.ts（定时驱动）
```

关键设计点：

- **状态机**：计划状态 `pending → executing → completed`；分配、重复分配、越权分配均有服务端（store 层）校验并反馈错误文案，非法操作不可用（crud-workflow profile 的验收路径）。
- **单一读写边界**：所有业务数据经 `store.ts` 读写 `localStorage`；读回基线（AC-01/AC-02）由单测直接对持久化内容断言字段一致。
- **实时性**：`useTicker(500)` + `useSyncExternalStore` 绑定；`refreshCompletions()` 每 500ms 检查到 100% 的执行并原子地完成计划、移除执行、生成报告（一次 commit）。
- **已清洁面积口径**：区域面积 × 任务进度（需求未规定口径的最小可观察表达，与看板/报告一致）。
- **异常**：两段确定性异常窗口（35%–45% 障碍物绕行、70%–78% 垃圾箱清理），窗口内进度暂停；报告落档异常标签、详情与发生时刻。

## 3. 需求/设计对照

| 项 | 状态 | 说明 |
| --- | --- | --- |
| §5.1 创建计划（楼层/区域/作业时间/清洁模式，读回一致） | 已实现 | PlanForm + createPlan + 持久化读回 |
| §5.2 分配机器人（两步可区分，读回关联） | 已实现 | RobotAssignForm + assignRobot；创建与分配为两个可区分步骤 |
| §5.3 执行与实时看板（四项数据、实时更新、位置按楼层/区域） | 已实现 | ExecutionDashboard + 模拟执行器；异常作为展示项（不预设固定分类清单，窗口来自模拟器） |
| §5.4 作业报告（可观察结果汇总：面积/进度/异常） | 已实现 | refreshCompletions 自动落档 + ReportDetail |
| §5.5 机器人来源（演示前提） | 已实现 | 内置 4 台种子机器人；不提供档案管理 |
| §6 入口统一为用户界面 | 已实现 | SPA 四个页面：清洁计划/计划详情/实时看板/作业报告 |
| §8 未规定事项 | 未实现（符合边界） | 清洁模式自由文本不设固定清单；无自动调度、无导出、无服务端/认证/集成 |

架构基线 §6「明确不包含」项均未实现（服务/API、权威数据库、认证权限、后台任务、外部集成、同步层、机器人档案管理、报告导出、按作业时间自动调度、固定模式/异常清单）。

## 4. 开发验证证据（实际执行）

工作目录：本 WorkItem 工作树根目录。

| checkId | 命令 | 工作目录 | 状态 | 退出码 | 证据 |
| --- | --- | --- | --- | --- | --- |
| dev-typecheck | `npx tsc --noEmit` | 工作树根 | passed | 0 | 无输出即通过 |
| dev-unit-tests | `npx vitest run` | 工作树根 | passed | 0 | 3 个文件 26 个用例全部通过（simulator 12 / store 9 / format 5） |
| dev-build | `npx vite build` | 工作树根 | passed | 0 | ✓ 1574 modules transformed，dist 产物生成（JS 169.18 kB / CSS 6.92 kB） |
| dev-preview-server | `npm run dev`（注册后台作业） | 工作树根 | running | — | Vite v5.4.21 ready，http://localhost:5187/（冒烟：`/` 与 `/src/main.tsx` 均 200，标题正确） |

单测覆盖点（对应 AC 的规则层断言）：创建计划字段与输入一致且持久化可读回（AC-01）；分配后状态/关联读回、机器人占用与重复分配拒绝（AC-02）；进度/暂停/面积/站点/异常窗口的确定性与完成判定（AC-03）；完成后报告内容与执行移除（AC-04）；初始种子机器人清单。

修复记录：单测首轮 1 例因 `0.35 × 45000` 二进制浮点误差失败（`1000.0000000000018`），将断言改为 `toBeCloseTo(1000, 6)` 后 26/26 通过；实现逻辑未改动。

## 5. 交接 QA 的浏览器验收项（开发未执行，不构成验收证据）

| checkId | 前置条件 | 预期结果 |
| --- | --- | --- |
| qa-ac-01-create-plan | 以运营人员身份打开清洁计划页 | 按楼层/区域/作业时间/清洁模式创建晚间计划并保存；重新打开该计划，字段与输入一致 |
| qa-ac-02-assign-robot | AC-01 的计划处于待分配 | 从机器人清单选择机器人并确认；计划显示已关联所选机器人，执行中机器人不可再选 |
| qa-ac-03-live-dashboard | AC-02 已分配 | 实时看板展示当前位置（楼层·区域·站点）、任务进度、已清洁面积、异常状态，且随执行推进实时更新；异常窗口出现异常提示 |
| qa-ac-04-report | AC-03 任务执行完成（约 50 秒，含异常暂停） | 作业报告已生成，包含已清洁面积、任务进度（100%）与异常记录 |
| qa-readback-refresh | 执行中或已完成若干计划 | 刷新/重开页面后计划、关联与报告仍在；执行中任务按已耗时继续推进直至完成 |

实现阶段按要求仅启动前端服务提供预览入口，未执行浏览器验收、未采集浏览器证据。

## 6. 遗留风险与说明

- 执行时长（约 50 秒）为演示节奏设定（`EXECUTION_DURATION_MS = 45_000` 加两段异常暂停），非需求规定的调度语义；作业时间仅作为计划配置项保存，不实现自动调度（需求明确未规定）。
- 数据仅存于当前浏览器 `localStorage`，不承诺跨浏览器/跨设备/跨用户可用（架构基线 §1/§2）。
- 若持久化内容损坏（非本应用写入），store 加载时重置为初始演示数据并告警；QA 验收前请使用全新浏览器配置或清理该键。
- 清洁模式为自由文本（提供常用模式快捷填入），异常分类来自模拟器两段确定性窗口，均按需求「未规定、不预设固定清单」处理。

## 7. StageResult 摘要

- status: completed
- url: http://localhost:5187/
- verification: dev-typecheck(passed,0) / dev-unit-tests(passed,0) / dev-build(passed,0) / dev-preview-server(running)
- 交付物：本报告 + 应用源码（src/、tests/、index.html、package.json、vite.config.ts、tsconfig.json、README.md）
