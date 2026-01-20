import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../state/AppContext';
import { useAnalytics } from '../hooks/useAnalytics';
import { AuthForm } from '../components/ui/AuthForm';

import loggedOutSkin from '../assets/result-logged-out.webp';
import loggedInSkin from '../assets/result-logged-in.webp';
import './ResultPage.css';

const ResultPage: React.FC = () => {
  const navigate = useNavigate();
  const { state, ritual, auth, savePerformance, signOut, reset } = useApp();
  const { trackEvent } = useAnalytics();

  const downloadAudio = useCallback(() => {
    if (!auth.user || !state.recordingBlob) return;
    trackEvent('download_audio', { fileName: state.file?.name });

    const url = URL.createObjectURL(state.recordingBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${state.file?.name.replace(/\.[^/.]+$/, '') || 'performance'}-sound-print.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [state.recordingBlob, state.file, auth.user, trackEvent]);

  const handleSave = async () => {
    if (!auth.user) return;
    const trackName = state.file?.name || 'Unknown Track';
    const trackHash = btoa(state.file?.name || '') + '-' + state.file?.size;
    await savePerformance(ritual.finalEQState, trackName, trackHash);
    trackEvent('save_performance', { userId: auth.user.id });
    alert('Saved to library.');
  };

  const replay = () => {
    trackEvent('ritual_replay');
    reset();
    navigate('/instrument');
  };

  const goHome = () => {
    reset();
    navigate('/');
  };

  const isLoggedIn = !!auth.user?.id;

  return (
    <div
      style={{
        position: 'fixed', // sit on top of Shell / other containers
        inset: 0,
        backgroundColor: '#050810',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        zIndex: 9999,
        margin: 0,
        padding: 0,
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '1400px',
          aspectRatio: '1365 / 768',
          maxHeight: '100dvh',
        }}
      >
        {/* MACHINE BACKGROUND */}
        <img
          src={isLoggedIn ? loggedInSkin : loggedOutSkin}
          style={{
            width: '100%',
            height: '100%',
            display: 'block',
            pointerEvents: 'none',
          }}
          alt=""
        />

        {/* STATUS / EMAIL TEXT */}
        <div
          style={{
            position: 'absolute',
            top: '14.5%',
            left: 0,
            width: '100%',
            textAlign: 'center',
            color: '#4ade80',
            fontFamily: 'monospace',
            fontSize: '1.2vw',
            pointerEvents: 'none',
            textTransform: 'uppercase',
          }}
        >
          {auth.isLoading
            ? 'SYNCING...'
            : isLoggedIn
            ? `Logged in: ${auth.user?.email}`
            : ''}
        </div>

        {/* SOUND PRINT INSIDE THE SCREEN */}
        <div
          style={{
            position: 'absolute',
            top: '24%',
            left: '31.2%',
            width: '37.6%',
            height: '45%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 5,
          }}
        >
          {ritual.soundPrintDataUrl && (
            <img
              src={ritual.soundPrintDataUrl}
              alt="Sound Print"
              style={{
                // Hard reset in case any global img styles are leaking in
                all: 'unset',
                width: '90%',
                height: '85%',
                objectFit: 'contain',
                background: 'transparent',
                display: 'block',
              }}
            />
          )}
        </div>

        {/* INVISIBLE HOTSPOTS + AUTH FORM */}
        <div className="res-interactive-layer">
          {isLoggedIn ? (
            <>
              <button className="hs hs-download" onClick={downloadAudio} />
              <button className="hs hs-save" onClick={handleSave} />
              <button className="hs hs-replay" onClick={replay} />
              <button className="hs hs-home" onClick={goHome} />
              <button className="hs hs-signout" onClick={signOut} />
            </>
          ) : (
            <>
              <div className="res-auth-box-position">
                <AuthForm showTitle={false} />
              </div>
              <button className="hs hs-replay-lo" onClick={replay} />
              <button className="hs hs-home-lo" onClick={goHome} />
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResultPage;