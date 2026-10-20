import { useEffect, useState, type FormEvent } from 'react';
import { getApiClient, isApiRequestError } from '../../api';
import type { Floor } from '../../api/types';
import { Field, TextInput, splitFormError } from '../ui';
import { FormDialog } from './FormDialog';

/** 楼层创建 / 名称编辑对话框（POST /api/floors 或 PATCH /api/floors/:id）。 */
export function FloorFormDialog({
  open,
  mode,
  mallId,
  floorId,
  initialName,
  onClose,
  onSubmitted,
}: {
  open: boolean;
  mode: 'create' | 'edit';
  mallId?: number;
  floorId?: number;
  initialName?: string;
  onClose: () => void;
  onSubmitted: (floor: Floor) => void;
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
      setFieldErrors({ name: '请输入楼层名称' });
      setFormError(null);
      return;
    }
    setSubmitting(true);
    setFormError(null);
    setFieldErrors({});
    try {
      const api = await getApiClient();
      if (mode === 'create') {
        const { floor } = await api.createFloor({ mall_id: mallId!, name: name.trim() });
        onSubmitted(floor);
      } else {
        const { floor } = await api.updateFloor(floorId!, { name: name.trim() });
        onSubmitted(floor);
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
      title={mode === 'create' ? '创建楼层' : '编辑楼层'}
      onClose={onClose}
      submitLabel={mode === 'create' ? '确认创建' : '保存'}
      submitting={submitting}
      onSubmit={handleSubmit}
      formError={formError}
    >
      <Field label="楼层名称" htmlFor="floor-name" error={fieldErrors.name} hint="1..100 个字符，如：首层 F1">
        <TextInput
          id="floor-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="如：首层 F1"
          maxLength={100}
          autoFocus
        />
      </Field>
    </FormDialog>
  );
}
