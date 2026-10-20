import { useEffect, useState } from 'react';
import { Bot, CalendarClock, FileText, LayoutDashboard } from 'lucide-react';
import { PlansPage } from './pages/PlansPage';
import { PlanDetailPage } from './pages/PlanDetailPage';
import { DashboardPage } from './pages/DashboardPage';
import { ReportsPage } from './pages/ReportsPage';
import { refreshCompletions } from './store/store';

type View =
  | { name: 'plans' }
  | { name: 'plan'; planId: string }
  | { name: 'dashboard' }
  | { name: 'reports' };

interface NavItem {
  hash: string;
  label: string;
  icon: typeof CalendarClock;
  matches: (view: View) => boolean;
}

const NAV_ITEMS: NavItem[] = [
  {
    hash: '#/plans',
    label: '清洁计划',
    icon: CalendarClock,
    matches: (view) => view.name === 'plans' || view.name === 'plan',
  },
  { hash: '#/dashboard', label: '实时看板', icon: LayoutDashboard, matches: (view) => view.name === 'dashboard' },
  { hash: '#/reports', label: '作业报告', icon: FileText, matches: (view) => view.name === 'reports' },
];

function parseHash(hash: string): View {
  const path = hash.replace(/^#\/?/, '');
  if (path.startsWith('plan/')) {
    const planId = decodeURIComponent(path.slice('plan/'.length));
    if (planId) return { name: 'plan', planId };
  }
  if (path.startsWith('reports')) return { name: 'reports' };
  if (path.startsWith('dashboard')) return { name: 'dashboard' };
  return { name: 'plans' };
}

export function App() {
  const [view, setView] = useState<View>(() => parseHash(window.location.hash));

  useEffect(() => {
    const onHashChange = () => setView(parseHash(window.location.hash));
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // 每 500ms 检查推进到 100% 的执行并落档作业报告；实时数据由看板页面按 tick 自行重算。
  useEffect(() => {
    refreshCompletions();
    const timer = window.setInterval(() => refreshCompletions(), 500);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <Bot size={24} aria-hidden="true" />
          <div className="brand-text">
            <h1>商场清洁机器人运营管理系统</h1>
            <p>清洁任务编排与实时运营看板</p>
          </div>
        </div>
        <nav className="app-nav" aria-label="主导航">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = item.matches(view);
            return (
              <a
                key={item.hash}
                href={item.hash}
                className={active ? 'nav-item nav-item-active' : 'nav-item'}
                aria-current={active ? 'page' : undefined}
              >
                <Icon size={16} aria-hidden="true" />
                {item.label}
              </a>
            );
          })}
        </nav>
      </header>
      <main className="app-main">
        {view.name === 'plans' && (
          <PlansPage onOpenPlan={(planId) => {
            window.location.hash = `#/plan/${encodeURIComponent(planId)}`;
          }} />
        )}
        {view.name === 'plan' && <PlanDetailPage planId={view.planId} />}
        {view.name === 'dashboard' && <DashboardPage />}
        {view.name === 'reports' && <ReportsPage />}
      </main>
    </div>
  );
}
