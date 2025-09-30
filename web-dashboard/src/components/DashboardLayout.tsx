import { Fragment } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../providers/AuthProvider';

const navigation = [
  { to: '/dashboard/store', label: '스토어 정보' },
  { to: '/dashboard/menus', label: '메뉴 관리' },
  { to: '/dashboard/orders', label: '주문 관리' },
];

export function DashboardLayout() {
  const { user, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-lg font-semibold">AgentLink Dashboard</p>
            <p className="text-sm text-slate-400">Functions REST 기반 업체 운영 도구</p>
          </div>
          <div className="flex items-center gap-4 text-sm text-slate-300">
            {user && (
              <Fragment>
                <span>{user.email}</span>
                <button
                  type="button"
                  onClick={() => signOut()}
                  className="rounded border border-slate-700 px-3 py-1 font-medium text-slate-200 transition hover:bg-slate-800"
                >
                  로그아웃
                </button>
              </Fragment>
            )}
          </div>
        </div>
      </header>
      <div className="mx-auto flex max-w-6xl gap-6 px-6 py-8">
        <nav className="w-56 space-y-2">
          {navigation.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                [
                  'block rounded-lg px-4 py-2 text-sm font-medium transition',
                  isActive ? 'bg-emerald-500/20 text-emerald-200' : 'bg-slate-900/40 text-slate-300 hover:bg-slate-800/60',
                ].join(' ')
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
