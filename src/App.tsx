// src/App.tsx
import { Routes, Route } from 'react-router-dom';
import { AppProvider } from './state/AppContext';

import { Shell } from './components/layout/Shell';
import { UploadPage } from './pages/UploadPage';
import InstrumentPage from './pages/InstrumentPage';
// import ResultPage from './pages/ResultPage'; // when ready

function App() {
  return (
    <AppProvider>
      <Routes>
        {/* Step 1 – Upload page with invisible hotspot */}
        <Route
          path="/"
          element={
            <Shell>
              <UploadPage />
            </Shell>
          }
        />

        {/* Step 3 – Instrument / Ritual */}
        <Route
          path="/instrument"
          element={
            <Shell>
              <InstrumentPage />
            </Shell>
          }
        />

        {/* Future: captured result, auth, Stripe, wagmi, etc. */}
        {/* <Route path="/result" element={<ResultPage />} /> */}
      </Routes>
    </AppProvider>
  );
}

export default App;