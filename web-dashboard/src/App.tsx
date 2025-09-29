import { useEffect, useState } from 'react';

type HealthResponse = {
  status: string;
};

function App() {
  const [health, setHealth] = useState<'loading' | 'ok' | 'error'>('loading');

  useEffect(() => {
    const controller = new AbortController();

    fetch('/api/health', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('Request failed');
        }
        const data = (await response.json()) as HealthResponse;
        setHealth(data.status === 'ok' ? 'ok' : 'error');
      })
      .catch(() => {
        setHealth('error');
      });

    return () => controller.abort();
  }, []);

  return (
    <main className="min-h-screen bg-slate-900 text-slate-100">
      <section className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-16">
        <header>
          <h1 className="text-3xl font-semibold">AgentLink 업체 대시보드</h1>
          <p className="mt-2 text-slate-300">
            Firebase Functions, Firestore, Storage, Hosting, Auth, Emulator 기반 모노레포 초기 상태입니다.
          </p>
        </header>
        <article className="rounded-lg border border-slate-700 bg-slate-800/40 p-6 shadow-lg">
          <h2 className="text-xl font-medium">API 상태</h2>
          <p className="mt-2 text-sm text-slate-300">
            루트 `npm run dev` 실행 시 Functions 에뮬레이터를 통해 <code className="rounded bg-slate-900 px-1">/api/health</code> 엔드포인트가 연결됩니다.
          </p>
          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400" aria-hidden />
            <span className="text-sm font-semibold">
              {health === 'loading' && '확인 중...'}
              {health === 'ok' && '정상 동작 중'}
              {health === 'error' && '연결 실패'}
            </span>
          </div>
        </article>
      </section>
    </main>
  );
}

export default App;
