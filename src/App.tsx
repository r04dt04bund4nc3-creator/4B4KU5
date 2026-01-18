// src/App.tsx
import { useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { AppProvider, useApp } from './state/AppContext';
import { useAnalytics } from './hooks/useAnalytics';

import { Shell } from './components/layout/Shell';
import { UploadPage } from './pages/UploadPage';
import InstrumentPage from './pages/InstrumentPage';
import ResultPage from './pages/ResultPage';
import AuthCallbackPage from './pages/AuthCallbackPage';

// Runs on every page, after AppProvider is mounted
function GlobalGuards() {
  const { auth } = useApp();
  const navigate = useNavigate();

  // Clean up any OAuth error params so they don't persist
  useEffect(() => {
    const url = new URL(window.location.href);
    const hasOAuthError =
      url.searchParams.get('error') || url.searchParams.get('error_code');

    if (hasOAuthError) {
      console.warn('OAuth error:', Object.fromEntries(url.searchParams.entries()));
      // Strip querystring silently
      window.history.replaceState({}, '', url.origin + url.pathname);
    }
  }, []);

  // If we just returned from OAuth, force navigation to /result
  useEffect(() => {
    if (auth.isLoading) return;

    const flag = sessionStorage.getItem('post-auth-redirect');
    if (flag === 'result' && auth.user) {
      sessionStorage.removeItem('post-auth-redirect');
      navigate('/result', { replace: true });
    }
  }, [auth.isLoading, auth.user, navigate]);

  return null;
}

function App() {
  const { trackEvent } = useAnalytics();

  useEffect(() => {
    trackEvent('visit', { path: window.location.pathname });
  }, []);

  return (
    <AppProvider>
      <GlobalGuards />
      <Routes>
        <Route
          path="/"
          element={
            <Shell>
              <UploadPage />
            </Shell>
          }
        />
        <Route
          path="/instrument"
          element={
            <Shell>
              <InstrumentPage />
            </Shell>
          }
        />
        <Route
          path="/result"
          element={
            <Shell>
              <ResultPage />
            </Shell>
          }
        />
        {/* OAuth returns here; we finalize session then bounce to /result */}
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
      </Routes>
    </AppProvider>
  );
}

export default App;