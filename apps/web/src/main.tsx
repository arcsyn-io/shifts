import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@arcsyn-io/react/styles.css';
import { App } from '@/app/App';
import { AppProviders } from '@/app/providers/AppProviders';
import '@/shared/styles/global.css';
import { initializeTheme } from '@/shared/theme';

initializeTheme();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </StrictMode>,
);
