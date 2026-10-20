import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  BuildingIcon,
  ChartIcon,
  MonitorIcon,
  RadioIcon,
  RobotIcon,
  TasksIcon,
  WrenchIcon,
} from './icons';

interface NavItem {
  to: string;
  title: string;
  icon: typeof BuildingIcon;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/malls', title: '组织管理', icon: BuildingIcon },
  { to: '/monitor', title: '实时监控', icon: MonitorIcon },
  { to: '/tasks', title: '任务调度', icon: TasksIcon },
  { to: '/maintenance', title: '设备运维', icon: WrenchIcon },
  { to: '/analytics', title: '数据分析', icon: ChartIcon },
];

const SECTION_MATCHERS: Array<[prefix: string, title: string]> = [
  ['/monitor', '实时监控'],
  ['/tasks', '任务调度'],
  ['/maintenance', '设备运维'],
  ['/analytics', '数据分析'],
  ['/robot-sim', '机器人模拟'],
];

function currentSection(pathname: string): string {
  for (const [prefix, title] of SECTION_MATCHERS) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return title;
  }
  return '组织管理'; // /malls、/robots 及默认
}

const navLinkClass = (isActive: boolean) =>
  `flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition ${
    isActive ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
  }`;

/**
 * saas-ops-console 展示模板（architecture-baseline.md §3）：
 * 左侧固定导航 + 顶部上下文栏 + 主工作区；
 * “机器人模拟”以辅助样式区隔，明示为机器人通道的模拟驱动控制台。
 */
export default function AppLayout() {
  const { pathname } = useLocation();
  const section = currentSection(pathname);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100">
      <aside className="flex w-60 shrink-0 flex-col bg-slate-900 text-slate-100">
        <div className="flex items-center gap-3 border-b border-slate-800 px-5 py-5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600">
            <RobotIcon className="h-5 w-5 text-white" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight">清洁机器人运营管理</p>
            <p className="mt-0.5 truncate text-[11px] text-slate-400">Cleanbot Ops Console</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => navLinkClass(isActive)}>
              <item.icon className="h-4.5 w-4.5 h-[18px] w-[18px] shrink-0" />
              {item.title}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-slate-800 px-3 pb-4 pt-4">
          <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">机器人通道</p>
          <NavLink
            to="/robot-sim"
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-md border border-dashed px-3 py-2.5 text-sm font-medium transition ${
                isActive
                  ? 'border-blue-500 bg-slate-800 text-white'
                  : 'border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'
              }`
            }
          >
            <RadioIcon className="h-[18px] w-[18px] shrink-0" />
            <span className="flex-1">机器人模拟</span>
            <span className="rounded border border-slate-600 px-1 py-0.5 text-[10px] text-slate-400">模拟</span>
          </NavLink>
          <p className="mt-2 px-2 text-[11px] leading-snug text-slate-500">
            以机器人身份调用上报通道，用于演示与验收驱动。
          </p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6">
          <h1 className="text-sm font-semibold text-slate-700">{section}</h1>
          <span className="text-xs text-slate-400">多商场清洁机器人统一运营平台</span>
        </header>
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
