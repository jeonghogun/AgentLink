import { useState } from 'react';
import { z } from 'zod';
import type { MenuOption, MenuOptionGroup } from '../../api/types';
import { uploadMenuImages } from '../../storage/upload';
import { Field } from '../../components/Field';

export type MenuFormValues = {
  name: string;
  price: number;
  currency: string;
  stock: number;
  description: string;
  option_groups: MenuOptionGroup[];
  images: string[];
};

const formSchema = z.object({
  name: z.string().min(1),
  price: z.number().min(0),
  currency: z.string().min(1),
  stock: z.number().min(0),
  description: z.string().optional(),
  option_groups: z.array(z.any()),
  images: z.array(z.string()),
});

const defaultValues: MenuFormValues = {
  name: '',
  price: 0,
  currency: 'KRW',
  stock: 1,
  description: '',
  option_groups: [],
  images: [],
};

type MenuEditorProps = {
  ownerUid: string;
  initialValues?: MenuFormValues;
  onSubmit: (values: MenuFormValues) => Promise<void>;
  onCancel: () => void;
};

const INPUT_CLASS =
  'w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none';

export function MenuEditor({ ownerUid, initialValues, onSubmit, onCancel }: MenuEditorProps) {
  const [values, setValues] = useState<MenuFormValues>(
    initialValues
      ? { ...initialValues }
      : { ...defaultValues, option_groups: [], images: [] },
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateField = <K extends keyof MenuFormValues>(key: K, value: MenuFormValues[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    setBusy(true);
    setError(null);
    try {
      const payload = formSchema.parse(values) as MenuFormValues;
      await onSubmit(payload);
    } catch (error) {
      setError(error instanceof Error ? error.message : '입력값을 확인해주세요.');
    } finally {
      setBusy(false);
    }
  };

  const addOptionGroup = () => {
    const nextGroup: MenuOptionGroup = {
      id: crypto.randomUUID?.() ?? `group-${Date.now()}`,
      name: '새 옵션 그룹',
      type: 'single_choice',
      options: [],
    };
    updateField('option_groups', [...values.option_groups, nextGroup]);
  };

  const updateGroup = (groupId: string, updater: (group: MenuOptionGroup) => MenuOptionGroup) => {
    updateField(
      'option_groups',
      values.option_groups.map((group) => (group.id === groupId ? updater(group) : group)),
    );
  };

  const removeGroup = (groupId: string) => {
    updateField(
      'option_groups',
      values.option_groups.filter((group) => group.id !== groupId),
    );
  };

  const addOption = (groupId: string) => {
    updateGroup(groupId, (group) => ({
      ...group,
      options: [
        ...group.options,
        {
          id: crypto.randomUUID?.() ?? `option-${Date.now()}`,
          name: '새 옵션',
          price: 0,
        },
      ],
    }));
  };

  const updateOption = (groupId: string, optionId: string, updater: (option: MenuOption) => MenuOption) => {
    updateGroup(groupId, (group) => ({
      ...group,
      options: group.options.map((option) => (option.id === optionId ? updater(option) : option)),
    }));
  };

  const removeOption = (groupId: string, optionId: string) => {
    updateGroup(groupId, (group) => ({
      ...group,
      options: group.options.filter((option) => option.id !== optionId),
    }));
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) {
      return;
    }
    setBusy(true);
    try {
      const uploaded = await uploadMenuImages(ownerUid, Array.from(files));
      updateField('images', [...values.images, ...uploaded]);
    } catch (error) {
      setError(error instanceof Error ? error.message : '이미지 업로드에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="메뉴명">
          <input className={INPUT_CLASS} value={values.name} onChange={(event) => updateField('name', event.target.value)} />
        </Field>
        <Field label="가격">
          <input
            className={INPUT_CLASS}
            type="number"
            min={0}
            value={values.price}
            onChange={(event) => updateField('price', Number(event.target.value))}
          />
        </Field>
        <Field label="통화">
          <input className={INPUT_CLASS} value={values.currency} onChange={(event) => updateField('currency', event.target.value)} />
        </Field>
        <Field label="재고">
          <input
            className={INPUT_CLASS}
            type="number"
            min={0}
            value={values.stock}
            onChange={(event) => updateField('stock', Number(event.target.value))}
          />
        </Field>
      </div>
      <Field label="설명">
        <textarea
          className="min-h-[120px] w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none"
          value={values.description}
          onChange={(event) => updateField('description', event.target.value)}
        />
      </Field>
      <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/40 p-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-slate-100">옵션 그룹</h4>
          <button
            type="button"
            onClick={addOptionGroup}
            className="rounded-lg border border-emerald-500 px-3 py-1 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/20"
          >
            옵션 그룹 추가
          </button>
        </div>
        {values.option_groups.length === 0 && <p className="text-xs text-slate-400">옵션 그룹이 없습니다.</p>}
        <div className="space-y-4">
          {values.option_groups.map((group) => (
            <div key={group.id} className="rounded-lg border border-slate-800 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <input
                  className={INPUT_CLASS}
                  value={group.name}
                  onChange={(event) =>
                    updateGroup(group.id, (current) => ({ ...current, name: event.target.value }))
                  }
                />
                <div className="flex items-center gap-3">
                  <select
                    className={INPUT_CLASS}
                    value={group.type}
                    onChange={(event) =>
                      updateGroup(group.id, (current) => ({
                        ...current,
                        type: event.target.value as MenuOptionGroup['type'],
                      }))
                    }
                  >
                    <option value="single_choice">단일 선택</option>
                    <option value="multi_select">다중 선택</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => removeGroup(group.id)}
                    className="rounded border border-red-500 px-2 py-1 text-xs text-red-300 hover:bg-red-500/10"
                  >
                    삭제
                  </button>
                </div>
              </div>
              <div className="mt-3 space-y-2">
                {group.options.map((option) => (
                  <div key={option.id} className="grid gap-2 md:grid-cols-[minmax(0,1fr)_120px_80px]">
                    <input
                      className={INPUT_CLASS}
                      value={option.name}
                      onChange={(event) =>
                        updateOption(group.id, option.id, (current) => ({
                          ...current,
                          name: event.target.value,
                        }))
                      }
                    />
                    <input
                      className={INPUT_CLASS}
                      type="number"
                      min={0}
                      value={option.price ?? 0}
                      onChange={(event) =>
                        updateOption(group.id, option.id, (current) => ({
                          ...current,
                          price: Number(event.target.value),
                        }))
                      }
                    />
                    <button
                      type="button"
                      onClick={() => removeOption(group.id, option.id)}
                      className="rounded border border-red-500 px-2 py-1 text-xs text-red-300 hover:bg-red-500/10"
                    >
                      제거
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addOption(group.id)}
                  className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-200 hover:bg-slate-800"
                >
                  옵션 추가
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-slate-100">이미지</h4>
        <input type="file" multiple accept="image/*" onChange={(event) => handleFileUpload(event.target.files)} />
        {values.images.length > 0 && (
          <ul className="grid gap-2 md:grid-cols-3">
            {values.images.map((url) => (
              <li key={url} className="group relative overflow-hidden rounded-lg border border-slate-800">
                <img src={url} alt="menu" className="h-32 w-full object-cover" />
                <button
                  type="button"
                  onClick={() => updateField('images', values.images.filter((image) => image !== url))}
                  className="absolute right-2 top-2 hidden rounded bg-slate-900/70 px-2 py-1 text-xs text-slate-200 group-hover:block"
                >
                  제거
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800"
          disabled={busy}
        >
          취소
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-800"
          disabled={busy}
        >
          저장
        </button>
      </div>
    </div>
  );
}

export function toMenuPayload(values: MenuFormValues) {
  return {
    name: values.name,
    price: values.price,
    currency: values.currency,
    stock: values.stock,
    description: values.description,
    option_groups: values.option_groups,
    images: values.images,
  };
}
