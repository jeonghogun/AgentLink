import { FormEvent, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { z } from 'zod';
import { useInvalidateSearchPreview, useSearchPreview } from '../../hooks/useSearchPreview';
import { useStoreQuery, useUpdateStoreMutation } from '../../hooks/useStoreQuery';
import type { DeliveryRule, Store, StorePayload } from '../../api/types';
import { Field } from '../../components/Field';

const storeSchema = z.object({
  name: z.string().min(1),
  region: z.string().min(1),
  status: z.enum(['open', 'closed', 'paused']),
  delivery: z.object({
    available: z.boolean(),
    base_fee: z.number().min(0),
    rules: z.array(z.any()),
  }),
  rating: z.object({
    score: z.number().min(0).max(5),
    count: z.number().min(0),
  }),
});

const INPUT_CLASS =
  'w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none';

export function StorePage() {
  const { data: store, isLoading, isError, error } = useStoreQuery();
  const updateMutation = useUpdateStoreMutation();
  const invalidateSearch = useInvalidateSearchPreview();
  const searchPreview = useSearchPreview(store?.region);

  const [formState, setFormState] = useState<StorePayload | null>(null);
  const [rulesDraft, setRulesDraft] = useState('');

  useEffect(() => {
    if (store) {
      const payload = extractPayload(store);
      setFormState(payload);
      setRulesDraft(JSON.stringify(store.delivery.rules, null, 2));
    }
  }, [store]);

  if (isLoading) {
    return <p className="text-sm text-slate-300">스토어 정보를 불러오는 중입니다...</p>;
  }

  if (isError) {
    const message = error instanceof Error ? error.message : '스토어 정보를 불러오지 못했습니다.';
    return <p className="text-sm text-red-400">{message}</p>;
  }

  if (!store || !formState) {
    return <p className="text-sm text-slate-300">스토어 정보가 없습니다.</p>;
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const parsedRules = parseRules(rulesDraft);
      const payload = storeSchema.parse({
        ...formState,
        delivery: { ...formState.delivery, rules: parsedRules },
      }) as StorePayload;
      updateMutation.mutate(payload, {
        onSuccess: () => {
          invalidateSearch(payload.region);
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '입력값을 확인해주세요.';
      toast.error(message);
    }
  };

  const updateField = <K extends keyof StorePayload>(key: K, value: StorePayload[K]) => {
    setFormState((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const toggleStatus = (status: Store['status']) => {
    const payload: StorePayload = { ...formState, status };
    updateMutation.mutate(payload, {
      onSuccess: () => {
        invalidateSearch(payload.region);
      },
    });
  };

  return (
    <section className="space-y-6">
      <header>
        <h2 className="text-2xl font-semibold text-slate-100">스토어 정보</h2>
        <p className="text-sm text-slate-400">상호명, 지역, 영업 상태 및 배달 규칙을 관리합니다.</p>
      </header>
      <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="상호명">
            <input
              className={INPUT_CLASS}
              value={formState.name}
              onChange={(event) => updateField('name', event.target.value)}
              required
            />
          </Field>
          <Field label="지역">
            <input
              className={INPUT_CLASS}
              value={formState.region}
              onChange={(event) => updateField('region', event.target.value)}
              required
            />
          </Field>
          <Field label="상태">
            <select
              className={INPUT_CLASS}
              value={formState.status}
              onChange={(event) => updateField('status', event.target.value as Store['status'])}
            >
              <option value="open">open</option>
              <option value="closed">closed</option>
              <option value="paused">paused</option>
            </select>
          </Field>
          <Field label="배달 가능">
            <input
              type="checkbox"
              checked={formState.delivery.available}
              onChange={(event) =>
                updateField('delivery', { ...formState.delivery, available: event.target.checked })
              }
              className="h-4 w-4"
            />
          </Field>
          <Field label="배달 기본 요금">
            <input
              className={INPUT_CLASS}
              type="number"
              min={0}
              value={formState.delivery.base_fee}
              onChange={(event) =>
                updateField('delivery', { ...formState.delivery, base_fee: Number(event.target.value) })
              }
            />
          </Field>
          <Field label="평점">
            <div className="flex gap-3">
              <input
                className={INPUT_CLASS}
                type="number"
                min={0}
                max={5}
                step={0.1}
                value={formState.rating.score}
                onChange={(event) =>
                  updateField('rating', {
                    ...formState.rating,
                    score: Number(event.target.value),
                  })
                }
              />
              <input
                className={INPUT_CLASS}
                type="number"
                min={0}
                value={formState.rating.count}
                onChange={(event) =>
                  updateField('rating', {
                    ...formState.rating,
                    count: Number(event.target.value),
                  })
                }
              />
            </div>
          </Field>
        </div>
        <Field label="배달 규칙(JSON)">
          <textarea
            className="min-h-[160px] w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none"
            value={rulesDraft}
            onChange={(event) => setRulesDraft(event.target.value)}
          />
        </Field>
        <div className="flex items-center justify-between">
          <div className="space-x-2 text-sm">
            <StatusButton label="영업 시작" onClick={() => toggleStatus('open')} tone="emerald" />
            <StatusButton label="영업 종료" onClick={() => toggleStatus('closed')} tone="amber" />
            <StatusButton label="일시 중지" onClick={() => toggleStatus('paused')} tone="slate" />
          </div>
          <button
            type="submit"
            className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400"
          >
            저장
          </button>
        </div>
      </form>
      <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
        <h3 className="text-lg font-semibold text-slate-100">/api/search 미리보기</h3>
        <p className="text-sm text-slate-400">현재 지역({store.region}) 기준 상위 5개 검색 결과입니다.</p>
        {searchPreview.isLoading && <p className="mt-3 text-sm text-slate-400">검색 결과를 불러오는 중...</p>}
        {searchPreview.isError && <p className="mt-3 text-sm text-red-400">검색 결과를 가져오지 못했습니다.</p>}
        {!searchPreview.isLoading && !searchPreview.isError && (
          <ul className="mt-3 space-y-2 text-sm text-slate-200">
            {searchPreview.data && searchPreview.data.length > 0 ? (
              searchPreview.data.slice(0, 5).map((title) => (
                <li key={title} className="rounded bg-slate-900/70 px-3 py-2">
                  {title}
                </li>
              ))
            ) : (
              <li className="rounded bg-slate-900/70 px-3 py-2 text-slate-400">결과가 없습니다.</li>
            )}
          </ul>
        )}
      </section>
    </section>
  );
}

function extractPayload(store: Store): StorePayload {
  return {
    name: store.name,
    region: store.region,
    status: store.status,
    delivery: store.delivery,
    rating: store.rating,
  };
}

function parseRules(value: string): DeliveryRule[] {
  if (!value.trim()) {
    return [];
  }
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed as DeliveryRule[];
    }
    throw new Error('rules-not-array');
  } catch (error) {
    throw new Error('배달 규칙 JSON 형식이 올바르지 않습니다.');
  }
}


function StatusButton({
  label,
  onClick,
  tone,
}: {
  label: string;
  onClick: () => void;
  tone: 'emerald' | 'amber' | 'slate';
}) {
  const toneClass = {
    emerald: 'border-emerald-500 text-emerald-200 hover:bg-emerald-500/20',
    amber: 'border-amber-500 text-amber-200 hover:bg-amber-500/20',
    slate: 'border-slate-500 text-slate-300 hover:bg-slate-700/30',
  }[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-3 py-1 font-medium transition ${toneClass}`}
    >
      {label}
    </button>
  );
}

export default StorePage;
