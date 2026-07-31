import { Route, Routes } from 'react-router-dom';
import { HomePage } from '@/pages/home/HomePage';
import { NotFoundPage } from '@/pages/not-found/NotFoundPage';

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
