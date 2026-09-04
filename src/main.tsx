import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { AuthProvider } from './contexts/AuthContext';
import { KpiProvider } from './contexts/KpiContext';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <KpiProvider>
        <App />
      </KpiProvider>
    </AuthProvider>
  </StrictMode>,
);
