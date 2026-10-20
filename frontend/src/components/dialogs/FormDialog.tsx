import type { FormEvent, ReactNode } from 'react';
import { Modal } from '../Modal';
import { Spinner, btnPrimary, btnSecondary } from '../ui';

/** 表单对话框基组件：统一提交按钮、提交中状态与表单级错误展示。 */
export function FormDialog({
  open,
  title,
  onClose,
  submitLabel,
  submitting,
  onSubmit,
  formError,
  children,
  widthClass = 'max-w-md',
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  submitLabel: string;
  submitting: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  formError: string | null;
  children: ReactNode;
  widthClass?: string;
}) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      widthClass={widthClass}
      footer={
        <>
          <button type="button" className={btnSecondary} onClick={onClose} disabled={submitting}>
            取消
          </button>
          <button type="submit" form="form-dialog-form" className={btnPrimary} disabled={submitting}>
            {submitting ? <Spinner className="h-3.5 w-3.5" /> : null}
            {submitLabel}
          </button>
        </>
      }
    >
      {formError ? (
        <div role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs leading-relaxed text-red-700">
          {formError}
        </div>
      ) : null}
      <form id="form-dialog-form" onSubmit={onSubmit} className="space-y-4">
        {children}
      </form>
    </Modal>
  );
}
