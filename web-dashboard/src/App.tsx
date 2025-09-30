import { Navigate, Route, Routes } from 'react-router-dom';
import { DashboardLayout } from './components/DashboardLayout';
import { RequireAuth } from './components/RequireAuth';
import { MenusPage } from './features/menus/MenusPage';
import { OrdersPage } from './features/orders/OrdersPage';
import { StorePage } from './features/store/StorePage';
import { LoginPage } from './pages/LoginPage';
import { NotFoundPage } from './pages/NotFoundPage';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<Navigate to="/dashboard/store" replace />} />
      <Route
        path="/dashboard"
        element={
          <RequireAuth>
            <DashboardLayout />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="store" replace />} />
        <Route path="store" element={<StorePage />} />
        <Route path="menus" element={<MenusPage />} />
        <Route path="orders" element={<OrdersPage />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default App;
