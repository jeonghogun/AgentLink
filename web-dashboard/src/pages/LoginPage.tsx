import { FormEvent, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../providers/AuthProvider';

export function LoginPage() {
  const { signInWithPassword, sendMagicLink, completeEmailLinkLogin, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    completeEmailLinkLogin()
      .then(() => {
        if (user) {
          const redirectTo = (location.state as { from?: Location })?.from?.pathname ?? '/dashboard/store';
          navigate(redirectTo, { replace: true });
        }
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : '이메일 링크 로그인에 실패했습니다.';
        toast.error(message);
      });
  }, [completeEmailLinkLogin, user, navigate, location.state]);

  useEffect(() => {
    if (user) {
      const redirectTo = (location.state as { from?: Location })?.from?.pathname ?? '/dashboard/store';
      navigate(redirectTo, { replace: true });
    }
  }, [user, navigate, location.state]);

  const handlePasswordSignIn = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await signInWithPassword(email, password);
      toast.success('로그인에 성공했습니다.');
    } catch (error) {
      const message = error instanceof Error ? error.message : '이메일/비밀번호 로그인에 실패했습니다.';
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  const handleMagicLink = async () => {
    if (!email) {
      toast.error('이메일을 입력해주세요.');
      return;
    }
    setBusy(true);
    try {
      await sendMagicLink(email);
      toast.success('Magic Link를 전송했습니다. 메일함을 확인해주세요.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Magic Link 전송에 실패했습니다.';
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/60 p-8 shadow-xl">
        <h1 className="text-2xl font-semibold text-slate-100">업체 대시보드 로그인</h1>
        <p className="mt-2 text-sm text-slate-400">Firebase Auth 이메일/비밀번호 또는 Magic Link로 로그인할 수 있습니다.</p>
        <form className="mt-6 space-y-4" onSubmit={handlePasswordSignIn}>
          <div>
            <label className="block text-sm font-medium text-slate-300" htmlFor="email">
              이메일
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none"
              placeholder="owner@example.com"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300" htmlFor="password">
              비밀번호
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none"
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            className="flex w-full items-center justify-center rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-800"
            disabled={busy}
          >
            이메일/비밀번호 로그인
          </button>
        </form>
        <div className="mt-6 space-y-2 rounded-lg bg-slate-900/40 p-4 text-sm text-slate-300">
          <p className="font-semibold text-slate-200">Magic Link</p>
          <p>아래 버튼을 누르면 이메일로 일회용 로그인 링크를 전송합니다.</p>
          <button
            type="button"
            onClick={handleMagicLink}
            className="mt-3 w-full rounded-lg border border-slate-700 px-4 py-2 font-semibold text-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-900"
            disabled={busy}
          >
            Magic Link 전송
          </button>
        </div>
      </div>
    </div>
  );
}
