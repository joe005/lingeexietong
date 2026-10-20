import { useEffect, useState, type FormEvent } from 'react';
import { getApiClient, isApiRequestError } from '../../api';
import type { MallSummary } from '../../api/types';
import { splitFormError } from '../ui';
import { Field, TextInput } from '../ui';
import { FormDialog } from './FormDialog';

/** 商场创建 / 名称编辑对话框（POST /api/malls 或 PATCH /api/malls/:id）。 */
export function MallFormDialog({
  open,
  mode,
  mallId,
  initialName,
  onClose,
  onSubmitted,
}: {
  open: boolean;
  mode: 'create' | 'edit';
  mallId?: number;
  initialName?: string;
  onClose: () => void;
  onSubmitted: (mall: MallSummary) => void;
}) {
  const [name, setName] = useState(initialName ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setName(initialName ?? '');
      setFormError(null);
      setFieldErrors({});
    }
  }, [open, initialName]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) {
      setFieldErrors({ name: '请输入商场名称' });
      setFormError(null);
      return;
    }
    setSubmitting(true);
    setFormError(null);
    setFieldErrors({});
    try {
      const api = await getApiClient();
      const body = { name: name.trim() };
      const { mall } = mode === 'create' ? await api.createMall(body) : await api.updateMall(mallId!, body);
      onSubmitted(mall);
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
      title={mode === 'create' ? '创建商场' : '编辑商场'}
      onClose={onClose}
      submitLabel={mode === 'create' ? '确认创建' : '保存'}
      submitting={submitting}
      onSubmit={handleSubmit}
      formError={formError}
    >
      <Field label="商场名称" htmlFor="mall-name" error={fieldErrors.name} hint="1..100 个字符">
        <TextInput
          id="mall-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="如：星云广场"
          maxLength={100}
          autoFocus
        />
      </Field>
    </FormDialog>
  );
}
