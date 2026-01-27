// src/App.tsx
import { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { AppProvider } from './state/AppContext';
import { useAnalytics } from './hooks/useAnalytics';

import { Shell } from './components/layout/Shell';
import { UploadPage } from './pages/UploadPage';
import InstrumentPage from './pages/InstrumentPage';
import ResultPage from './pages/ResultPage';
import AuthCallbackPage from './pages/AuthCallbackPage';

function GlobalGuards() {
  useEffect(() => {
    const url = new URL(window.location.href);
    const hasOAuthError = url.searchParams.get('error') || url.searchParams.get('error_code');

    if (hasOAuthError) {
      console.warn('OAuth error:', Object.fromEntries(url.searchParams.entries()));
      window.history.replaceState({}, '', url.origin + url.pathname);
    }
  }, []);

  return null;
}

function App() {
  const { trackEvent } = useAnalytics();

  useEffect(() => {
    trackEvent('visit', { path: window.location.pathname });
  }, [trackEvent]);

  return (
    <AppProvider>
      <GlobalGuards />
      <Routes>
        <Route path="/" element={<Shell><UploadPage /></Shell>} />
        <Route path="/instrument" element={<Shell><InstrumentPage /></Shell>} />
        <Route path="/result" element={<ResultPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
      </Routes>
    </AppProvider>
  );
}

export default App;