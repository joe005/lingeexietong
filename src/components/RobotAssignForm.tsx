import { useState } from 'react';
import type { FormEvent } from 'react';
import { assignRobot, busyRobotIds } from '../store/store';
import { useAppState } from '../store/useStore';
import type { Plan } from '../types';

export function RobotAssignForm({ plan }: { plan: Plan }) {
  const state = useAppState();
  const busy = busyRobotIds();
  const [robotId, setRobotId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!robotId) {
      setError('请选择要分配的机器人。');
      return;
    }
    try {
      assignRobot(plan.id, robotId);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '分配失败。');
    }
  };

  return (
    <form className="stack-form" onSubmit={submit}>
      <p className="form-hint">
        为计划「{plan.floor} · {plan.zoneName}」选择机器人；分配成功后任务立即进入执行状态，实时看板开始展示执行数据。
      </p>
      <label className="field">
        <span>选择机器人</span>
        <select value={robotId} onChange={(event) => setRobotId(event.target.value)}>
          <option value="">请选择</option>
          {state.robots.map((robot) => {
            const isBusy = busy.has(robot.id);
            return (
              <option key={robot.id} value={robot.id} disabled={isBusy}>
                {robot.name} · {robot.model} · 电量 {robot.batteryPct}%{isBusy ? '（执行中）' : ''}
              </option>
            );
          })}
        </select>
      </label>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <button type="submit" className="primary-button">
        分配机器人并开始执行
      </button>
    </form>
  );
}
