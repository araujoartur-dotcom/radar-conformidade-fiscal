import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { AuthProvider } from './contexts/AuthContext';
import { KpiProvider } from './contexts/KpiContext';
import './index.css';

if (typeof window !== 'undefined') {
  console.log(
    `%c[Radar de Conformidade Fiscal] Build: ${__BUILD_HASH__} (${__BUILD_TIMESTAMP__}) v${__APP_VERSION__}`,
    'color: #0284c7; font-weight: bold; padding: 2px 4px; background: #0f172a; border-radius: 4px;'
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <KpiProvider>
        <App />
      </KpiProvider>
    </AuthProvider>
  </StrictMode>,
);
