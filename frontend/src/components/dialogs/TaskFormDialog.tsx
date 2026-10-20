import { useEffect, useState, type FormEvent } from 'react';
import { getApiClient, isApiRequestError } from '../../api';
import type { Floor, MallSummary, Task } from '../../api/types';
import { Field, Select, splitFormError } from '../ui';
import { FormDialog } from './FormDialog';

/** 清洁任务创建对话框（POST /api/tasks：创建即尝试分配目标楼层空闲机器人）。 */
export function TaskFormDialog({
  open,
  malls,
  floors,
  onClose,
  onSubmitted,
}: {
  open: boolean;
  malls: MallSummary[];
  floors: Floor[];
  onClose: () => void;
  onSubmitted: (task: Task) => void;
}) {
  const [floorId, setFloorId] = useState<number | ''>('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const mallName = new Map(malls.map((mall) => [mall.id, mall.name]));
  const sortedFloors = [...floors].sort((a, b) => a.mall_id - b.mall_id || a.id - b.id);

  useEffect(() => {
    if (open) {
      setFloorId('');
      setFormError(null);
      setFieldErrors({});
    }
  }, [open]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!floorId) {
      setFieldErrors({ floor_id: '请选择目标楼层' });
      setFormError(null);
      return;
    }
    setSubmitting(true);
    setFormError(null);
    setFieldErrors({});
    try {
      const api = await getApiClient();
      const { task } = await api.createTask({ floor_id: floorId });
      onSubmitted(task);
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
      title="创建清洁任务"
      onClose={onClose}
      submitLabel="创建并尝试分配"
      submitting={submitting}
      onSubmit={handleSubmit}
      formError={formError}
    >
      <Field
        label="目标楼层"
        htmlFor="task-floor"
        error={fieldErrors.floor_id}
        hint="创建后系统将按分配规则选取该楼层的空闲机器人；无可分配时任务保持待执行"
      >
        <Select
          id="task-floor"
          value={floorId}
          onChange={(event) => setFloorId(event.target.value === '' ? '' : Number(event.target.value))}
        >
          <option value="">请选择楼层</option>
          {sortedFloors.map((floor) => (
            <option key={floor.id} value={floor.id}>
              {mallName.get(floor.mall_id) ?? `商场 #${floor.mall_id}`} · {floor.name}（id {floor.id}）
            </option>
          ))}
        </Select>
      </Field>
    </FormDialog>
  );
}
