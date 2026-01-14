import { useEffect } from 'react'; // Added useEffect
import { Routes, Route } from 'react-router-dom';
import { AppProvider } from './state/AppContext';
import { useAnalytics } from './hooks/useAnalytics'; // Added Hook

import { Shell } from './components/layout/Shell';
import { UploadPage } from './pages/UploadPage';
import InstrumentPage from './pages/InstrumentPage';

function App() {
  const { trackEvent } = useAnalytics();

  useEffect(() => {
    // Track initial landing
    trackEvent('visit', { path: window.location.pathname });
  }, []);

  return (
    <AppProvider>
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
      </Routes>
    </AppProvider>
  );
}

export default App;