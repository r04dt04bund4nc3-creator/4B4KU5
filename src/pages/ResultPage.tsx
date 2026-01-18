// src/pages/ResultPage.tsx
import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../state/AppContext';
import { useAnalytics } from '../hooks/useAnalytics';
import { AuthForm } from '../components/ui/AuthForm';

// Import the background skins and the new CSS file
import loggedOutSkin from '../assets/result-logged-out.webp';
import loggedInSkin from '../assets/result-logged-in.webp';
import './ResultPage.css';

const ResultPage: React.FC = () => {
  const navigate = useNavigate();
  const { state, ritual, auth, savePerformance, signOut, reset } = useApp();
  const { trackEvent } = useAnalytics();

  // --- All your existing logic remains the same ---
  const downloadAudio = useCallback(() => {
    if (!auth.user || !state.recordingBlob) {
      if (!auth.user) {
        alert('Please sign in to download your performance.');
        trackEvent('download_attempt_unauthenticated');
      }
      return;
    }
    const url = URL.createObjectURL(state.recordingBlob);
    const a = document.createElement('a');
    const baseName =
      (state.file?.name ?? 'performance').replace(/\.[^/.]+$/, '');
    a.href = url;
    a.download = `${baseName}-sound-print.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    trackEvent('download_audio', {
      fileName: state.file?.name,
      fileSize: state.recordingBlob.size,
    });
  }, [auth.user, state.recordingBlob, state.file, trackEvent]);

  const replayRitual = useCallback(() => {
    reset();
    navigate('/instrument');
  }, [navigate, reset]);

  const returnHome = useCallback(() => {
    reset();
    navigate('/');
  }, [navigate, reset]);

  const handleSavePerformance = useCallback(async () => {
    if (!auth.user) return;
    const trackName = state.file?.name || 'Unknown Track';
    const trackHash = btoa(state.file?.name || '') + '-' + state.file?.size;
    await savePerformance(ritual.finalEQState, trackName, trackHash);
    trackEvent('save_performance', { userId: auth.user.id });
    alert('Performance saved to your library.');
  }, [auth.user, state.file, ritual.finalEQState, savePerformance, trackEvent]);
  // --- End of existing logic ---

  const isLoggedIn = !!auth.user?.id;

  return (
    <div className="result-root">
      <div className="machine">
        {/* The background image changes based on auth state */}
        <img
          src={isLoggedIn ? loggedInSkin : loggedOutSkin}
          alt="Synthesizer machine interface"
          className="machine__bg"
        />

        {/* --- DYNAMIC OVERLAYS --- */}

        {/* SOUND PRINT SCREEN */}
        <div className="machine__screen">
          {ritual.soundPrintDataUrl ? (
            <img
              src={ritual.soundPrintDataUrl}
              alt="Your sound print visualization"
              className="machine__screen-img"
            />
          ) : (
            <div className="machine__screen-fallback">
              <span>SOUND PRINT NOT CAPTURED</span>
              <small>
                This may have occurred during the performance ritual.
              </small>
            </div>
          )}
        </div>

        {/* TOP TEXT AREA (Changes based on auth state) */}
        <div className="overlay overlay--top-text">
          {auth.isLoading ? (
            <p>Loading session…</p>
          ) : isLoggedIn ? (
            <p>Signed in as {auth.user?.email}</p>
          ) : null}
        </div>

        {/* RENDER UI BASED ON AUTH STATE */}
        {auth.isLoading ? null : isLoggedIn ? (
          /* --- LOGGED-IN HOTSPOTS --- */
          <>
            <button
              className="hotspot hotspot--download"
              onClick={downloadAudio}
              aria-label="Download Audio"
            />
            <button
              className="hotspot hotspot--save"
              onClick={handleSavePerformance}
              aria-label="Save to Library"
            />
            <button
              className="hotspot hotspot--replay"
              onClick={replayRitual}
              aria-label="Replay Ritual"
            />
            <button
              className="hotspot hotspot--home"
              onClick={returnHome}
              aria-label="Return Home"
            />
            <button
              className="hotspot hotspot--signout"
              onClick={signOut}
              aria-label="Sign Out"
            />
          </>
        ) : (
          /* --- LOGGED-OUT UI & HOTSPOTS --- */
          <>
            {/* The AuthForm is placed precisely over the input area */}
            <div className="overlay overlay--auth">
              <AuthForm />
            </div>
            {/* The single button available when logged out */}
            <button
              className="hotspot hotspot--replay-loggedout"
              onClick={replayRitual}
              aria-label="Replay Ritual"
            />
          </>
        )}
      </div>
    </div>
  );
};

export default ResultPage;