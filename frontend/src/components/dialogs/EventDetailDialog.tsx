import { useEffect, useState } from 'react';
import { getApiClient } from '../../api';
import type { MaintenanceEventDetail } from '../../api/types';
import { formatDateTime } from '../../lib/format';
import { ErrorBanner, errorText } from '../ErrorBanner';
import { Modal } from '../Modal';
import { EventStatusBadge, EventTypeBadge } from '../StatusBadge';
import { SkeletonBlock } from '../ui';

/** 运维事件详情对话框（GET /api/maintenance-events/:id → EventDetail）。 */
export function EventDetailDialog({
  open,
  eventId,
  onClose,
}: {
  open: boolean;
  eventId: number | null;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<MaintenanceEventDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || eventId === null) {
      setDetail(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    getApiClient()
      .then((api) => api.getMaintenanceEvent(eventId))
      .then(({ event }) => {
        if (!cancelled) setDetail(event);
      })
      .catch((cause) => {
        if (!cancelled) setError(errorText(cause));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, eventId]);

  return (
    <Modal open={open} title="运维事件详情" onClose={onClose}>
      {loading ? <SkeletonBlock className="h-32" /> : null}
      {error ? <ErrorBanner message={error} /> : null}
      {detail ? (
        <dl className="space-y-3 text-sm">
          <div className="flex items-center gap-2">
            <dt className="sr-only">类型</dt>
            <dd>
              <EventTypeBadge type={detail.type} />
            </dd>
            <dt className="sr-only">状态</dt>
            <dd>
              <EventStatusBadge status={detail.status} />
            </dd>
            <dd className="text-xs text-slate-400">事件 #{detail.id}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-500">关联机器人</dt>
            <dd className="mt-0.5 text-slate-800">
              {detail.robot.code} · {detail.robot.name}（id {detail.robot.id}）
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-500">事件描述</dt>
            <dd className="mt-0.5 leading-relaxed text-slate-800" title={detail.description}>
              {detail.description}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-500">登记时间</dt>
            <dd className="mt-0.5 text-slate-800" title={detail.created_at}>
              {formatDateTime(detail.created_at)}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-500">处理结果</dt>
            <dd className="mt-0.5 leading-relaxed text-slate-800" title={detail.resolution ?? undefined}>
              {detail.resolution ?? '—（尚未处理）'}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-500">处理时间</dt>
            <dd className="mt-0.5 text-slate-800" title={detail.resolved_at ?? undefined}>
              {formatDateTime(detail.resolved_at)}
            </dd>
          </div>
        </dl>
      ) : null}
    </Modal>
  );
}
