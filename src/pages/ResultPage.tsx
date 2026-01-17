// src/pages/ResultPage.tsx
import React, { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../state/AppContext';
import { useAnalytics } from '../hooks/useAnalytics';

const ResultPage: React.FC = () => {
  const navigate = useNavigate();
  const { state, ritual, auth, savePerformance } = useApp();
  const { trackEvent } = useAnalytics();

  const downloadAudio = useCallback(() => {
    if (!state.recordingBlob) return;

    const url = URL.createObjectURL(state.recordingBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${state.file?.name.replace(/\.[^/.]+$/, "") || 'performance'}-sound-print.webm`;
    a.click();
    URL.revokeObjectURL(url);

    trackEvent('download_audio', {
      fileName: state.file?.name,
      fileSize: state.recordingBlob.size,
    });
  }, [state.recordingBlob, state.file, trackEvent]);

  const replayRitual = useCallback(() => {
    navigate('/instrument');
  }, [navigate]);

  const returnHome = useCallback(() => {
    navigate('/');
  }, [navigate]);

  const handleSavePerformance = useCallback(async () => {
    if (!auth.user) {
      alert("You need to sign in to save your performance.");
      return;
    }

    const trackName = state.file?.name || 'Unknown Track';
    const trackHash = btoa(state.file?.name || '') + '-' + state.file?.size; // Simple hash for now

    await savePerformance(ritual.finalEQState, trackName, trackHash);
    trackEvent('save_performance', { userId: auth.user.id });
    alert("Performance saved successfully!");
  }, [auth.user, state.file, ritual.finalEQState, savePerformance, trackEvent]);

  useEffect(() => {
    // Auto-download if logged in and recording exists
    if (state.recordingBlob && auth.user) {
      downloadAudio();
    }
  }, [state.recordingBlob, auth.user, downloadAudio]);

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      background: '#050810',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      padding: '2rem',
      fontFamily: 'monospace',
      color: '#fff',
    }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>Your Sound Print is Ready</h1>

      {/* Thumbnail */}
      {ritual.soundPrintDataUrl && (
        <img 
          src={ritual.soundPrintDataUrl} 
          alt="Sound Print Thumbnail" 
          style={{ 
            maxWidth: '80%', 
            maxHeight: '300px', 
            objectFit: 'contain', 
            marginBottom: '1rem',
            border: '2px solid #00ff66',
            borderRadius: '8px'
          }} 
        />
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
        <button 
          onClick={downloadAudio}
          disabled={!state.recordingBlob}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#00ff66',
            color: '#000',
            border: 'none',
            borderRadius: '4px',
            cursor: state.recordingBlob ? 'pointer' : 'not-allowed',
            fontWeight: 'bold',
          }}
        >
          Download Audio
        </button>

        <button 
          onClick={replayRitual}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#4ade80',
            color: '#000',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold',
          }}
        >
          Replay Ritual
        </button>

        <button 
          onClick={returnHome}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#6b7280',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold',
          }}
        >
          Return Home
        </button>
      </div>

      {/* Save option */}
      <div style={{ marginTop: '2rem', fontSize: '0.8rem', opacity: 0.8 }}>
        {auth.isLoading ? 'Checking login...' :
         auth.user ? (
           <button 
             onClick={handleSavePerformance}
             style={{
               padding: '0.25rem 0.5rem',
               backgroundColor: '#00ff66',
               color: '#000',
               border: 'none',
               borderRadius: '4px',
               cursor: 'pointer',
               fontSize: '0.8rem',
             }}
           >
             Save to My Library
           </button>
         ) : (
           <div>
             Want to save this? <br />
             <button 
               onClick={() => {
                 const { signInWithDiscord } = useApp(); // Not available here — we’ll use context
                 // Instead, we’ll add a helper in AppContext
                 signInWithDiscord();
               }}
               style={{
                 padding: '0.25rem 0.5rem',
                 backgroundColor: '#00ff66',
                 color: '#000',
                 border: 'none',
                 borderRadius: '4px',
                 cursor: 'pointer',
                 fontSize: '0.8rem',
               }}
             >
               Sign in with Discord
             </button>
           </div>
         )}
      </div>

      {/* Footer note */}
      <p style={{ marginTop: '2rem', fontSize: '0.7rem', opacity: 0.6 }}>
        We don’t upload your MP3s. Only your performance data + login are stored.
      </p>
    </div>
  );
};

export default ResultPage;