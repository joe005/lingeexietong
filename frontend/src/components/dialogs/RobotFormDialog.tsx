import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { getApiClient, isApiRequestError } from '../../api';
import type { Floor, Robot, RobotDetail } from '../../api/types';
import { Field, Select, TextInput, splitFormError } from '../ui';
import { FormDialog } from './FormDialog';

/** 机器人登记 / 编辑对话框（POST /api/robots 或 PATCH /api/robots/:id）。编辑支持楼层归属调整。 */
export function RobotFormDialog({
  open,
  mode,
  robot,
  floors,
  onClose,
  onSubmitted,
}: {
  open: boolean;
  mode: 'create' | 'edit';
  /** 编辑时的机器人详情（取初始名称与楼层）。 */
  robot?: RobotDetail;
  /** 楼层归属可选项（全量楼层，按商场分组显示）。 */
  floors: Floor[];
  onClose: () => void;
  onSubmitted: (robot: Robot) => void;
}) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [floorId, setFloorId] = useState<number | ''>('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const floorOptions = useMemo(() => [...floors].sort((a, b) => a.mall_id - b.mall_id || a.id - b.id), [floors]);
  /** 楼层 id → 商场名（构建“商场 / 楼层”展示，仅用于选项文案）。 */
  const floorLabel = useMemo(() => {
    const map = new Map<number, string>();
    return (floor: Floor) => map.get(floor.id) ?? `楼层 #${floor.id}`;
  }, []);

  useEffect(() => {
    if (open) {
      setName(mode === 'edit' ? (robot?.name ?? '') : '');
      setCode(mode === 'edit' ? (robot?.code ?? '') : '');
      setFloorId(mode === 'edit' ? (robot?.floor_id ?? '') : '');
      setFormError(null);
      setFieldErrors({});
    }
  }, [open, mode, robot]);

  function validate(): boolean {
    const errors: Record<string, string> = {};
    if (!name.trim()) errors.name = '请输入机器人名称';
    if (mode === 'create' && !code.trim()) errors.code = '请输入机器人编号';
    if (mode === 'create' && !floorId) errors.floor_id = '请选择归属楼层';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validate()) {
      setFormError(null);
      return;
    }
    setSubmitting(true);
    setFormError(null);
    setFieldErrors({});
    try {
      const api = await getApiClient();
      if (mode === 'create') {
        const { robot: created } = await api.createRobot({
          floor_id: floorId as number,
          name: name.trim(),
          code: code.trim(),
        });
        onSubmitted(created);
      } else {
        const body: { name?: string; floor_id?: number } = { name: name.trim() };
        if (floorId !== '' && floorId !== robot?.floor_id) body.floor_id = floorId;
        const { robot: updated } = await api.updateRobot(robot!.id, body);
        onSubmitted(updated);
      }
    } catch (error) {
      if (isApiRequestError(error)) {
        const split = splitFormError(error);
        setFormError(split.formError);
        setFieldErrors(split.fieldErrors);
      } else {
        setFormError('提交失败，请重试。');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <FormDialog
      open={open}
      title={mode === 'create' ? '登记机器人' : '编辑机器人'}
      onClose={onClose}
      submitLabel={mode === 'create' ? '确认登记' : '保存'}
      submitting={submitting}
      onSubmit={handleSubmit}
      formError={formError}
    >
      <Field label="机器人名称" htmlFor="robot-name" error={fieldErrors.name} hint="1..100 个字符">
        <TextInput
          id="robot-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="如：一号清洁机器人"
          maxLength={100}
          autoFocus
        />
      </Field>
      {mode === 'create' ? (
        <Field
          label="机器人编号"
          htmlFor="robot-code"
          error={fieldErrors.code}
          hint="全局唯一，1..50 个字符（服务端校验重复）"
        >
          <TextInput
            id="robot-code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="如：CB-001"
            maxLength={50}
          />
        </Field>
      ) : (
        <div>
          <p className="text-sm font-medium text-slate-700">机器人编号</p>
          <p className="mt-1.5 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
            {robot?.code ?? '—'}（编号创建后不可修改）
          </p>
        </div>
      )}
      <Field
        label="归属楼层"
        htmlFor="robot-floor"
        error={fieldErrors.floor_id}
        hint={mode === 'edit' ? '执行任务中的机器人暂不能调整楼层归属' : '每台机器人归属唯一楼层'}
      >
        <Select
          id="robot-floor"
          value={floorId}
          onChange={(event) => setFloorId(event.target.value === '' ? '' : Number(event.target.value))}
        >
          <option value="">请选择楼层</option>
          {floorOptions.map((floor) => (
            <option key={floor.id} value={floor.id}>
              {floorLabel(floor)}（id {floor.id}）
            </option>
          ))}
        </Select>
      </Field>
    </FormDialog>
  );
}
