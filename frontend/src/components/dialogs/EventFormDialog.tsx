import { useEffect, useState, type FormEvent } from 'react';
import { getApiClient, isApiRequestError } from '../../api';
import type { MaintenanceEvent, MaintenanceType, Robot } from '../../api/types';
import { Field, Select, TextArea, splitFormError } from '../ui';
import { FormDialog } from './FormDialog';

/** 运维事件登记对话框（POST /api/maintenance-events；登记不改变机器人运行状态）。 */
export function EventFormDialog({
  open,
  robots,
  onClose,
  onSubmitted,
}: {
  open: boolean;
  robots: Robot[];
  onClose: () => void;
  onSubmitted: (event: MaintenanceEvent) => void;
}) {
  const [robotId, setRobotId] = useState<number | ''>('');
  const [type, setType] = useState<MaintenanceType | ''>('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const sortedRobots = [...robots].sort((a, b) => a.code < b.code ? -1 : a.code > b.code ? 1 : 0);

  useEffect(() => {
    if (open) {
      setRobotId('');
      setType('');
      setDescription('');
      setFormError(null);
      setFieldErrors({});
    }
  }, [open]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const errors: Record<string, string> = {};
    if (!robotId) errors.robot_id = '请选择机器人';
    if (!type) errors.type = '请选择事件类型';
    if (!description.trim()) errors.description = '请填写事件描述';
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setFormError(null);
      return;
    }
    setSubmitting(true);
    setFormError(null);
    setFieldErrors({});
    try {
      const api = await getApiClient();
      const { event: created } = await api.createMaintenanceEvent({
        robot_id: robotId as number,
        type: type as MaintenanceType,
        description: description.trim(),
      });
      onSubmitted(created);
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
      title="登记运维事件"
      onClose={onClose}
      submitLabel="确认登记"
      submitting={submitting}
      onSubmit={handleSubmit}
      formError={formError}
    >
      <Field label="机器人" htmlFor="event-robot" error={fieldErrors.robot_id}>
        <Select
          id="event-robot"
          value={robotId}
          onChange={(event) => setRobotId(event.target.value === '' ? '' : Number(event.target.value))}
        >
          <option value="">请选择机器人</option>
          {sortedRobots.map((robot) => (
            <option key={robot.id} value={robot.id}>
              {robot.code} · {robot.name}（id {robot.id}）
            </option>
          ))}
        </Select>
      </Field>
      <Field label="事件类型" htmlFor="event-type" error={fieldErrors.type} hint="故障=运行异常报修；维护=保养需求">
        <Select
          id="event-type"
          value={type}
          onChange={(event) => setType(event.target.value as MaintenanceType | '')}
        >
          <option value="">请选择事件类型</option>
          <option value="fault">故障</option>
          <option value="maintenance">维护</option>
        </Select>
      </Field>
      <Field label="事件描述" htmlFor="event-description" error={fieldErrors.description} hint="1..500 个字符">
        <TextArea
          id="event-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="如：边刷缠绕异物，需要现场清理"
          maxLength={500}
        />
      </Field>
    </FormDialog>
  );
}
