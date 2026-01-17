// src/pages/ResultPage.tsx
import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../state/AppContext';
import { useAnalytics } from '../hooks/useAnalytics';

const ResultPage: React.FC = () => {
  const navigate = useNavigate();
  const { state, ritual, auth, savePerformance, signInWithDiscord, reset } = useApp();
  const { trackEvent } = useAnalytics();

  const isLoggedIn = !!auth.user;

  const downloadAudio = useCallback(() => {
    if (!state.recordingBlob || !isLoggedIn) return;

    const url = URL.createObjectURL(state.recordingBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download =
      `${state.file?.name?.replace(/\.[^/.]+$/, '') || 'performance'}-sound-print.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    trackEvent('download_audio', {
      fileName: state.file?.name,
      fileSize: state.recordingBlob.size,
    });
  }, [state.recordingBlob, state.file, isLoggedIn, trackEvent]);

  const replayRitual = useCallback(() => {
    reset();
    navigate('/instrument');
  }, [navigate, reset]);

  const returnHome = useCallback(() => {
    reset();
    navigate('/');
  }, [navigate, reset]);

  const handleSavePerformance = useCallback(async () => {
    if (!auth.user) {
      return;
    }
    const trackName = state.file?.name || 'Unknown Track';
    const trackHash = btoa(state.file?.name || '') + '-' + (state.file?.size ?? 0);

    await savePerformance(ritual.finalEQState, trackName, trackHash);
    trackEvent('save_performance', { userId: auth.user.id });
  }, [auth.user, state.file, ritual.finalEQState, savePerformance, trackEvent]);

  return (
    <div className="result-page">
      <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>Your Sound Print is Ready</h1>

      {ritual.soundPrintDataUrl ? (
        <img
          src={ritual.soundPrintDataUrl}
          alt="Sound Print Thumbnail"
          style={{
            maxWidth: '80%',
            maxHeight: '300px',
            objectFit: 'contain',
            marginBottom: '1rem',
            border: '2px solid #00ff66',
            borderRadius: '8px',
          }}
        />
      ) : (
        <div
          style={{
            maxWidth: '80%',
            maxHeight: '300px',
            width: '400px',
            height: '200px',
            backgroundColor: '#333',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ccc',
            marginBottom: '1rem',
            border: '2px dashed #00ff66',
            borderRadius: '8px',
          }}
        >
          No Visual Sound Print Captured
        </div>
      )}

      <div className="actions" style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
        {isLoggedIn ? (
          <>
            <button onClick={downloadAudio} disabled={!state.recordingBlob} className="download">
              Download Audio
            </button>
            <button onClick={handleSavePerformance} className="download">
              Save to My Library
            </button>
          </>
        ) : (
          <button onClick={signInWithDiscord} className="download">
            Sign in with Discord to Download
          </button>
        )}

        <button onClick={replayRitual} className="replay">
          Replay Ritual
        </button>

        <button onClick={returnHome} className="home">
          Return Home
        </button>
      </div>

      <p className="footer-note" style={{ marginTop: '1.5rem', fontSize: '0.7rem', opacity: 0.6 }}>
              We don’t upload your MP3s. Only your performance data + login are stored.
                    </p>
                        </div>
                          );
};

export default ResultPage;