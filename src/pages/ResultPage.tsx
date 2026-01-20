import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../state/AppContext';
import { useAnalytics } from '../hooks/useAnalytics';
import { AuthForm } from '../components/ui/AuthForm';

// Make sure these match your uploaded filenames exactly
import loggedOutSkin from '../assets/result-logged-out.webp';
import loggedInSkin from '../assets/result-logged-in.webp';
import './ResultPage.css';

const ResultPage: React.FC = () => {
  const navigate = useNavigate();
  const { state, ritual, auth, savePerformance, signOut, reset } = useApp();
  const { trackEvent } = useAnalytics();

  const downloadAudio = useCallback(() => {
    if (!auth.user || !state.recordingBlob) return;
    const url = URL.createObjectURL(state.recordingBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${state.file?.name.replace(/\.[^/.]+$/, "") || 'performance'}-sound-print.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    trackEvent('download_audio', { fileName: state.file?.name });
  }, [state.recordingBlob, state.file, auth.user, trackEvent]);

  const handleSave = useCallback(async () => {
    if (!auth.user) return;
    const trackName = state.file?.name || 'Unknown Track';
    const trackHash = btoa(state.file?.name || '') + '-' + state.file?.size;
    await savePerformance(ritual.finalEQState, trackName, trackHash);
    alert("Saved to library.");
  }, [auth.user, state.file, ritual.finalEQState, savePerformance]);

  const replay = () => { reset(); navigate('/instrument'); };
  const goHome = () => { reset(); navigate('/'); };

  const isLoggedIn = !!auth.user?.id;

  return (
    <div className="res-container">
      <div className="res-machine-wrapper">
        
        {/* THE BACKGROUND SKIN */}
        <img 
          src={isLoggedIn ? loggedInSkin : loggedOutSkin} 
          className="res-skin" 
          alt="Interface" 
        />

        {/* 1. DYNAMIC TEXT OVERLAYS */}
        {/* Positioned under "YOUR SOUND PRINT" */}
        <div className="res-header-text">
          {auth.isLoading ? "LOADING..." : 
           isLoggedIn ? `Signed in as ${auth.user?.email}` : 
           ""} {/* Empty string because 'Sign In' is painted on the bg */}
        </div>

        {/* 2. THE SCREEN (Sound Print) */}
        {/* Confined strictly to the glass box */}
        <div className="res-screen-box">
          {ritual.soundPrintDataUrl && (
            <img src={ritual.soundPrintDataUrl} alt="Sound Print" className="res-wave-img" />
          )}
        </div>

        {/* 3. INTERACTIVE LAYERS */}
        {isLoggedIn ? (
          // === LOGGED IN HOTSPOTS ===
          // Invisible buttons that sit exactly over the glowing artwork
          <div className="res-controls-layer">
            <button className="hotspot hs-download" onClick={downloadAudio} aria-label="Download" />
            <button className="hotspot hs-save" onClick={handleSave} aria-label="Save" />
            <button className="hotspot hs-replay" onClick={replay} aria-label="Replay" />
            <button className="hotspot hs-home" onClick={goHome} aria-label="Home" />
            <button className="hotspot hs-signout" onClick={signOut} aria-label="Sign Out" />
          </div>
        ) : (
          // === LOGGED OUT LAYER ===
          <div className="res-controls-layer">
             {/* 
                Since AuthForm likely has its own styling, we wrap it 
                to position it over the wood panel. 
                CSS below makes the container transparent.
             */}
            <div className="res-auth-positioner">
              <AuthForm />
            </div>

            {/* Bottom buttons for logged out state */}
            <button className="hotspot hs-replay-lo" onClick={replay} aria-label="Replay" />
            <button className="hotspot hs-home-lo" onClick={goHome} aria-label="Home" />
          </div>
        )}

      </div>
    </div>
  );
};

export default ResultPage;