import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppProvider } from "./src/state/AppContext";
import InstrumentPage from "./src/pages/InstrumentPage";
import { UploadPage } from "./src/pages/UploadPage";
import { SoundPrintPage } from "./src/pages/SoundPrintPage";
import "./App.css";

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<UploadPage />} />
          <Route path="/instrument" element={<InstrumentPage />} />
          <Route path="/print" element={<SoundPrintPage />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}