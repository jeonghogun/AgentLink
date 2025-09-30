import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-950 text-center text-slate-200">
      <h1 className="text-3xl font-bold">페이지를 찾을 수 없습니다.</h1>
      <p className="text-sm text-slate-400">요청하신 경로가 존재하지 않습니다. 대시보드 홈으로 이동해주세요.</p>
      <Link
        to="/dashboard/store"
        className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400"
      >
        대시보드 홈으로 이동
      </Link>
    </div>
  );
}
