// src/pages/ResultPage.tsx
import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../state/AppContext';
import { useAnalytics } from '../hooks/useAnalytics';

const ResultPage: React.FC = () => {
  const navigate = useNavigate();
  const { state, ritual, auth, savePerformance, signInWithDiscord, reset } = useApp();
  const { trackEvent } = useAnalytics();

  const downloadAudio = useCallback(() => {
    if (!state.recordingBlob) return;

    const url = URL.createObjectURL(state.recordingBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${state.file?.name.replace(/\.[^/.]+$/, "") || 'performance'}-sound-print.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    trackEvent('download_audio', {
      fileName: state.file?.name,
      fileSize: state.recordingBlob.size,
    });
  }, [state.recordingBlob, state.file, trackEvent]);

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
    alert("Performance saved to your library.");
  }, [auth.user, state.file, ritual.finalEQState, savePerformance, trackEvent]);

  return (
    <div className="result-page" style={{
      width: '100vw',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#050810',
      fontFamily: 'monospace'
    }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '1.5rem', letterSpacing: '4px' }}>
        YOUR SOUND PRINT
      </h1>

      {/* Visual capture display */}
      <div style={{ marginBottom: '2rem', position: 'relative' }}>
        {ritual.soundPrintDataUrl ? (
          <img
            src={ritual.soundPrintDataUrl}
            alt="Sound Print"
            style={{
              maxWidth: '80vw',
              maxHeight: '40vh',
              border: '2px solid #00ff66',
              borderRadius: '8px',
              boxShadow: '0 0 20px rgba(0, 255, 102, 0.2)'
            }}
          />
        ) : (
          <div style={{ width: '300px', height: '200px', border: '1px dashed #333' }} />
        )}
      </div>

      {/* Primary Navigation Actions */}
      <div style={{ display: 'flex', gap: '15px', marginBottom: '30px' }}>
        <button 
          onClick={downloadAudio} 
          disabled={!state.recordingBlob}
          style={{
            padding: '10px 20px',
            backgroundColor: '#00ff66',
            color: '#000',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          DOWNLOAD AUDIO
        </button>

        <button onClick={replayRitual} style={{ padding: '10px 20px', backgroundColor: '#4ade80', color: '#000', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
          REPLAY RITUAL
        </button>

        <button onClick={returnHome} style={{ padding: '10px 20px', backgroundColor: '#333', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
          RETURN HOME
        </button>
      </div>

      {/* Auth-specific Save Action */}
      <div style={{ marginTop: '10px' }}>
        {auth.isLoading ? (
          <span style={{ opacity: 0.5 }}>SYNCHRONIZING...</span>
        ) : auth.user ? (
          <button
            onClick={handleSavePerformance}
            style={{
              padding: '8px 16px',
              backgroundColor: 'transparent',
              color: '#00ff66',
              border: '1px solid #00ff66',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.8rem'
            }}
          >
            SAVE TO LIBRARY
          </button>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <button
              onClick={signInWithDiscord}
              style={{
                padding: '10px 24px',
                backgroundColor: '#5865F2', // Discord Blue
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              SIGN IN WITH DISCORD TO SAVE
            </button>
          </div>
        )}
      </div>

    </div>
  );
};

export default ResultPage;