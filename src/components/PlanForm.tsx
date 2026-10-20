import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { FLOORS, zonesByFloor } from '../data/zones';
import { createPlan } from '../store/store';
import { defaultEveningTime } from '../lib/format';
import type { Plan } from '../types';

const MODE_SUGGESTIONS = ['标准清洁', '深度清洁', '日常巡扫'];

export function PlanForm({ onCreated }: { onCreated: (plan: Plan) => void }) {
  const [floor, setFloor] = useState<string>(FLOORS[1]);
  const zones = useMemo(() => zonesByFloor(floor), [floor]);
  const [zoneId, setZoneId] = useState<string>(() => zonesByFloor(FLOORS[1])[0]?.id ?? '');
  const [scheduledTime, setScheduledTime] = useState<string>(() => defaultEveningTime());
  const [cleaningMode, setCleaningMode] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!zones.some((zone) => zone.id === zoneId)) {
      setZoneId(zones[0]?.id ?? '');
    }
  }, [zones, zoneId]);

  const selectedZone = zones.find((zone) => zone.id === zoneId);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    try {
      const plan = createPlan({ floor, zoneId, scheduledTime, cleaningMode });
      setError(null);
      setCleaningMode('');
      onCreated(plan);
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建失败，请检查输入。');
    }
  };

  return (
    <form className="stack-form" onSubmit={submit}>
      <div className="form-grid">
        <label className="field">
          <span>楼层</span>
          <select value={floor} onChange={(event) => setFloor(event.target.value)}>
            {FLOORS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>区域</span>
          <select value={zoneId} onChange={(event) => setZoneId(event.target.value)}>
            {zones.map((zone) => (
              <option key={zone.id} value={zone.id}>
                {zone.name}（{zone.areaSqm} ㎡）
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>作业时间</span>
          <input
            type="datetime-local"
            value={scheduledTime}
            onChange={(event) => setScheduledTime(event.target.value)}
          />
        </label>
        <label className="field">
          <span>清洁模式</span>
          <input
            type="text"
            value={cleaningMode}
            placeholder="请输入清洁模式"
            onChange={(event) => setCleaningMode(event.target.value)}
          />
        </label>
      </div>
      <div className="mode-suggestions">
        <span className="form-hint">常用模式（点击填入，可自行修改）：</span>
        {MODE_SUGGESTIONS.map((mode) => (
          <button key={mode} type="button" className="chip" onClick={() => setCleaningMode(mode)}>
            {mode}
          </button>
        ))}
      </div>
      {selectedZone ? (
        <p className="form-hint">
          已选区域「{selectedZone.name}」清洁面积 {selectedZone.areaSqm} ㎡，执行完成后按此面积统计已清洁面积。
        </p>
      ) : null}
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <button type="submit" className="primary-button">
        创建晚间清洁计划
      </button>
    </form>
  );
}
