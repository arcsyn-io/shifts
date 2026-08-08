import { Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '@/features/auth';
import { HomePage } from '@/pages/home/HomePage';
import { LoginPage } from '@/pages/login/LoginPage';
import { NotFoundPage } from '@/pages/not-found/NotFoundPage';
import { OrganizationPage } from '@/pages/organizations/OrganizationPage';
import { StatusPage } from '@/pages/status/StatusPage';

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/status" element={<StatusPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/organizations/:slug" element={<OrganizationPage />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
