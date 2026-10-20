import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactElement } from 'react';
import { getApiClient } from '../src/api';
import type { ApiClient } from '../src/api/client';
import { createStandardSeed, type MockStore } from '../src/api/mock-data';
import { ToastProvider } from '../src/components/Toast';
import AnalyticsPage from '../src/pages/AnalyticsPage';
import MaintenancePage from '../src/pages/MaintenancePage';
import MallsPage from '../src/pages/MallsPage';
import MonitorPage from '../src/pages/MonitorPage';
import RobotSimPage from '../src/pages/RobotSimPage';
import TasksPage from '../src/pages/TasksPage';

type MockApiClient = ApiClient & { __store: MockStore };

function renderPage(ui: ReactElement) {
  return render(
    <MemoryRouter>
      <ToastProvider>{ui}</ToastProvider>
    </MemoryRouter>,
  );
}

/** 每个用例从标准种子起步：页面与测试共享 getApiClient() 的 mock 单例。 */
async function resetMockStore(): Promise<MockApiClient> {
  const client = (await getApiClient()) as MockApiClient;
  const fresh = createStandardSeed();
  Object.assign(client.__store, fresh);
  return client;
}

let client: MockApiClient;

beforeEach(async () => {
  client = await resetMockStore();
});

afterEach(() => {
  // 兜底：即使轮询用例中断也恢复真实计时器，避免级联卡死
  vi.useRealTimers();
});

describe('组织管理页数据流（AC-01）', () => {
  it('渲染商场卡片，创建商场后列表立即刷新', async () => {
    const user = userEvent.setup();
    renderPage(<MallsPage />);

    expect(await screen.findByText('星云广场')).toBeInTheDocument();
    expect(screen.getByText('澜庭荟')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '创建商场' }));
    await user.type(await screen.findByLabelText(/^商场名称/), '云顶新商城');
    await user.click(screen.getByRole('button', { name: '确认创建' }));

    expect(await screen.findByText('云顶新商城')).toBeInTheDocument();
    expect(await screen.findByText(/商场「云顶新商城」已创建/)).toBeInTheDocument();
    // 服务端派生计数随真实数据返回
    const created = client.__store.malls.find((mall) => mall.name === '云顶新商城');
    expect(created).toBeTruthy();
  });

  it('空态展示创建引导', async () => {
    client.__store.malls = [];
    renderPage(<MallsPage />);
    expect(await screen.findByText('还没有商场')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '创建第一个商场' })).toBeInTheDocument();
  });
});

describe('实时监控页数据流（AC-02）', () => {
  it('按商场/楼层分组展示机器人状态卡片与状态统计条', async () => {
    renderPage(<MonitorPage />);

    expect(await screen.findByText('星云广场')).toBeInTheDocument();
    expect(screen.getByText('澜庭荟')).toBeInTheDocument();
    expect(screen.getAllByText('CB-001').length).toBeGreaterThan(0);
    expect(screen.getAllByText('CB-003').length).toBeGreaterThan(0);

    const idle = screen.getByTestId('monitor-stat-idle');
    expect(idle).toHaveTextContent('空闲');
    expect(idle.textContent).toContain('2');
    const executing = screen.getByTestId('monitor-stat-executing');
    expect(executing.textContent).toContain('1');
    const fault = screen.getByTestId('monitor-stat-fault');
    expect(fault.textContent).toContain('1');

    // 状态徽章按契约约定展示中文标签
    expect(screen.getAllByText('执行任务中').length).toBeGreaterThan(0);
    expect(screen.getAllByText('异常').length).toBeGreaterThan(0);
    expect(screen.getAllByText('空闲').length).toBeGreaterThan(2);
  });

  it('5 秒轮询将机器人状态变化反映到界面（含手动刷新）', async () => {
    vi.useFakeTimers();
    try {
      renderPage(<MonitorPage />);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(screen.getByTestId('monitor-stat-idle').textContent).toContain('2');

      // 数据面变化：创建并下达任务使 CB-001 进入执行任务中
      const { task } = await client.createTask({ floor_id: 1 });
      await client.dispatchTask(task.id);

      // 轮询尚未到期，界面保持旧数据
      expect(screen.getByTestId('monitor-stat-idle').textContent).toContain('2');

      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });
      expect(screen.getByTestId('monitor-stat-idle').textContent).toContain('1');
      expect(screen.getByTestId('monitor-stat-executing').textContent).toContain('2');
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('任务调度页数据流（AC-03）', () => {
  it('创建任务并下达后，状态跟踪至执行中且分配结果可读', async () => {
    const user = userEvent.setup();
    renderPage(<TasksPage />);

    // 种子任务可见
    expect(await screen.findByText(/待执行/)).toBeInTheDocument();
    expect(screen.getAllByText(/已完成/).length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: '创建清洁任务' }));
    await user.selectOptions(await screen.findByLabelText(/^目标楼层/), '1');
    await user.click(screen.getByRole('button', { name: '创建并尝试分配' }));

    // 新任务出现在列表，创建即自动分配空闲机器人（code 升序首个 = CB-001）
    const newRow = (await screen.findByText('任务 #5')).closest('tr');
    expect(newRow).toBeTruthy();
    expect(within(newRow!).getByText('待执行')).toBeInTheDocument();
    expect(within(newRow!).getByText(/CB-001/)).toBeInTheDocument();

    await user.click(within(newRow!).getByRole('button', { name: '下达' }));
    expect(await screen.findByText(/已下达/)).toBeInTheDocument();

    await waitFor(() => {
      const row = screen.getByText('任务 #5').closest('tr')!;
      expect(within(row).getByText('执行中')).toBeInTheDocument();
    });
  });

  it('下达无空闲机器人的任务时展示可读原因（NO_AVAILABLE_ROBOT）', async () => {
    const user = userEvent.setup();
    renderPage(<TasksPage />);
    expect(await screen.findByText('任务 #3')).toBeInTheDocument();

    const row = screen.getByText('任务 #3').closest('tr')!; // 澜庭荟楼层唯一机器人 fault
    await user.click(within(row).getByRole('button', { name: '下达' }));

    expect(await screen.findByText(/目标楼层暂无可分配的空闲机器人/)).toBeInTheDocument();
    // 任务保持待执行
    await waitFor(() => {
      const unchanged = screen.getByText('任务 #3').closest('tr')!;
      expect(within(unchanged).getByText('待执行')).toBeInTheDocument();
    });
  });
});

describe('设备运维页数据流（AC-04）', () => {
  it('登记事件后出现在列表，处理并关闭后状态变为已处理', async () => {
    const user = userEvent.setup();
    renderPage(<MaintenancePage />);

    // 种子事件可见
    expect(await screen.findByText(/驱动轮电机异响/)).toBeInTheDocument();
    expect(screen.getByText('例行尘盒清理与滤网更换')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '登记运维事件' }));
    await user.selectOptions(await screen.findByLabelText(/^机器人/, { selector: '#event-robot' }), '1');
    await user.selectOptions(screen.getByLabelText(/^事件类型/), 'maintenance');
    await user.type(screen.getByLabelText(/^事件描述/), '边刷缠绕异物需现场清理');
    await user.click(screen.getByRole('button', { name: '确认登记' }));

    const newRow = (await screen.findByText('边刷缠绕异物需现场清理')).closest('tr');
    expect(newRow).toBeTruthy();
    expect(within(newRow!).getByText('未处理')).toBeInTheDocument();

    await user.click(within(newRow!).getByRole('button', { name: '处理' }));
    await user.type(await screen.findByLabelText(/^处理结果/), '已清理异物并测试正常');
    await user.click(screen.getByRole('button', { name: '确认处理并关闭' }));

    await waitFor(() => {
      const row = screen.getByText('边刷缠绕异物需现场清理').closest('tr')!;
      expect(within(row).getByText('已处理')).toBeInTheDocument();
    });
    expect(await screen.findByText(/已处理并关闭/)).toBeInTheDocument();
  });
});

describe('机器人模拟控制台数据流（AC-02/AC-03 上报通道驱动面）', () => {
  it('上报任务完成后机器人状态更新为空闲', async () => {
    const user = userEvent.setup();
    renderPage(<RobotSimPage />);

    const card = (await screen.findByText('CB-003')).closest('section');
    expect(card).toBeTruthy();
    expect(within(card!).getByText('执行任务中')).toBeInTheDocument();

    await user.click(within(card!).getByRole('button', { name: '上报任务完成' }));

    await waitFor(() => {
      const updated = screen.getByText('CB-003').closest('section')!;
      expect(within(updated).getByText('空闲')).toBeInTheDocument();
    });
    expect(await screen.findByText(/已上报任务完成/)).toBeInTheDocument();
  });

  it('上报恢复异常机器人后状态更新为空闲', async () => {
    const user = userEvent.setup();
    renderPage(<RobotSimPage />);

    const card = (await screen.findByText('CB-004')).closest('section');
    expect(within(card!).getByText('异常')).toBeInTheDocument();

    await user.click(within(card!).getByRole('button', { name: /上报恢复/ }));

    await waitFor(() => {
      const updated = screen.getByText('CB-004').closest('section')!;
      expect(within(updated).getByText('空闲')).toBeInTheDocument();
    });
  });
});

describe('数据分析页数据流（AC-05）', () => {
  it('展示与实际记录一致的指标卡与按商场汇总表', async () => {
    renderPage(<AnalyticsPage />);

    expect(await screen.findByText('总体规模')).toBeInTheDocument();
    const metric = (label: string) => screen.getByTestId(`metric-${label}`).textContent;
    expect(metric('商场')).toBe('2');
    expect(metric('楼层')).toBe('3');
    expect(metric('机器人')).toBe('4');
    expect(metric('执行任务中')).toBe('1');
    expect(metric('异常')).toBe('1');
    expect(metric('已完成')).toBe('2');
    expect(metric('未处理')).toBe('1');

    expect(screen.getByText('按商场汇总')).toBeInTheDocument();
    const mallRow = screen.getByText('星云广场').closest('tr')!;
    expect(within(mallRow).getByText('1').textContent).toBe('1'); // tasks_completed = 1
    expect(screen.getByText('澜庭荟')).toBeInTheDocument();
  });
});
