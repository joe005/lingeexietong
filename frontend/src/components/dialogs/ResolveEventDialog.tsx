import { useEffect, useState, type FormEvent } from 'react';
import { getApiClient, isApiRequestError } from '../../api';
import type { MaintenanceEvent } from '../../api/types';
import { formatDateTime } from '../../lib/format';
import { EventStatusBadge, EventTypeBadge } from '../StatusBadge';
import { Field, TextArea, splitFormError } from '../ui';
import { FormDialog } from './FormDialog';

/** 运维事件处理对话框（POST /api/maintenance-events/:id/resolve：处理并关闭）。 */
export function ResolveEventDialog({
  open,
  event,
  onClose,
  onSubmitted,
}: {
  open: boolean;
  event: MaintenanceEvent | null;
  onClose: () => void;
  onSubmitted: (event: MaintenanceEvent) => void;
}) {
  const [resolution, setResolution] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setResolution('');
      setFormError(null);
      setFieldErrors({});
    }
  }, [open]);

  async function handleSubmit(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    if (!resolution.trim()) {
      setFieldErrors({ resolution: '请填写处理结果' });
      setFormError(null);
      return;
    }
    setSubmitting(true);
    setFormError(null);
    setFieldErrors({});
    try {
      const api = await getApiClient();
      const { event: resolved } = await api.resolveMaintenanceEvent(event!.id, {
        resolution: resolution.trim(),
      });
      onSubmitted(resolved);
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
      title="处理运维事件"
      onClose={onClose}
      submitLabel="确认处理并关闭"
      submitting={submitting}
      onSubmit={handleSubmit}
      formError={formError}
    >
      {event ? (
        <div className="mb-4 space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
          <div className="flex flex-wrap items-center gap-2">
            <EventTypeBadge type={event.type} />
            <EventStatusBadge status={event.status} />
            <span>事件 #{event.id}</span>
          </div>
          <p className="leading-relaxed text-slate-500" title={event.description}>
            {event.description}
          </p>
          <p className="text-slate-400">登记时间：{formatDateTime(event.created_at)}</p>
        </div>
      ) : null}
      <Field label="处理结果" htmlFor="event-resolution" error={fieldErrors.resolution} hint="1..500 个字符，处理后事件将关闭">
        <TextArea
          id="event-resolution"
          value={resolution}
          onChange={(changeEvent) => setResolution(changeEvent.target.value)}
          placeholder="如：已更换驱动轮电机并测试正常"
          maxLength={500}
        />
      </Field>
    </FormDialog>
  );
}
