// src/pages/ResultPage.tsx
import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../state/AppContext';
import { useAnalytics } from '../hooks/useAnalytics';
import { AuthForm } from '../components/ui/AuthForm';

const ResultPage: React.FC = () => {
  const navigate = useNavigate();
  const { state, ritual, auth, savePerformance, signOut, reset } = useApp();
  const { trackEvent } = useAnalytics();

  const downloadAudio = useCallback(() => {
    // Double guard to absolutely block unauthenticated downloads
    if (!auth.user || !state.recordingBlob) {
      if (!auth.user) {
        alert("Please sign in to download your performance.");
        trackEvent('download_attempt_unauthenticated');
      }
      return;
    }

    const url = URL.createObjectURL(state.recordingBlob);
    const a = document.createElement('a');
    a.href = url;
    // ✅ Fixed syntax error in filename
    a.download = `\({state.file?.name.replace(/\.[^/.]+\)/, "") || 'performance'}-sound-print.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    trackEvent('download_audio', {
      fileName: state.file?.name,
      fileSize: state.recordingBlob.size,
    });
  }, [state.recordingBlob, state.file, trackEvent, auth.user]);

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
    <div style={{
      // Use dynamic viewport height for mobile browser compatibility
      minHeight: '100dvh',
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#050810',
      fontFamily: 'monospace',
      // Prevent content from touching screen edges
      padding: '1.5rem',
      boxSizing: 'border-box'
    }}>
      {/* Max width to prevent overstretching on large desktop screens */}
      <div style={{
        width: '100%',
        maxWidth: '600px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '1.5rem'
      }}>

        <h1 style={{
          fontSize: 'clamp(1.5rem, 5vw, 2.5rem)',
          letterSpacing: '4px',
          color: '#fff',
          textAlign: 'center',
          margin: 0
        }}>
          YOUR SOUND PRINT
        </h1>

        {/* Visual capture display */}
        <div style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'center',
        }}>
          {ritual.soundPrintDataUrl ? (
            <img
              src={ritual.soundPrintDataUrl}
              alt="Sound Print"
              style={{
                maxWidth: '100%',
                maxHeight: '40vh',
                border: '2px solid #00ff66',
                borderRadius: '8px',
                boxShadow: '0 0 20px rgba(0, 255, 102, 0.2)'
              }}
              onError={() => console.error("Failed to load Sound Print")}
            />
          ) : (
            <div style={{
              width: '100%',
              maxWidth: '300px',
              aspectRatio: '3 / 2',
              border: '1px dashed #333',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ccc',
              gap: '8px',
              padding: '1rem'
            }}>
              <span>SOUND PRINT NOT CAPTURED</span>
              <small style={{ fontSize: '0.7rem', textAlign: 'center' }}>
                This may have occurred during the performance ritual
              </small>
            </div>
          )}
        </div>

        {auth.isLoading ? (
          <p style={{ color: '#fff', textAlign: 'center' }}>Loading session...</p>
        ) : auth.user?.id ? (
          // LOGGED-IN VIEW
          <div style={{
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1.5rem'
          }}>
            <p style={{ margin: 0, color: '#fff', textAlign: 'center' }}>
              Signed in as {auth.user.email}
            </p>

            <div style={{
              display: 'flex',
              gap: '0.8rem',
              flexWrap: 'wrap',
              justifyContent: 'center',
              width: '100%'
            }}>
              <button
                onClick={downloadAudio}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#00ff66',
                  color: '#000',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  flex: '1 1 auto',
                  minWidth: '140px'
                }}
              >
                DOWNLOAD AUDIO
              </button>

              <button
                onClick={handleSavePerformance}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: 'transparent',
                  color: '#00ff66',
                  border: '1px solid #00ff66',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  flex: '1 1 auto',
                  minWidth: '140px'
                }}
              >
                SAVE TO LIBRARY
              </button>
            </div>

            <div style={{
              display: 'flex',
              gap: '0.8rem',
              flexWrap: 'wrap',
              justifyContent: 'center',
              width: '100%'
            }}>
              <button
                onClick={replayRitual}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#4ade80',
                  color: '#000',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  flex: '1 1 auto',
                  minWidth: '120px'
                }}
              >
                REPLAY RITUAL
              </button>

              <button
                onClick={returnHome}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#333',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  flex: '1 1 auto',
                  minWidth: '120px'
                }}
              >
                RETURN HOME
              </button>

              <button
                onClick={signOut}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#6b7280',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  flex: '1 1 auto',
                  minWidth: '120px'
                }}
              >
                SIGN OUT
              </button>
            </div>
          </div>
        ) : (
          // LOGGED-OUT VIEW
          <div style={{
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1.5rem'
          }}>
            <AuthForm />

            <div style={{
              display: 'flex',
              gap: '0.8rem',
              flexWrap: 'wrap',
              justifyContent: 'center',
              width: '100%'
            }}>
              <button
                onClick={replayRitual}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#4ade80',
                  color: '#000',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  flex: '1 1 auto',
                  minWidth: '140px'
                }}
              >
                REPLAY RITUAL
              </button>

              <button
                onClick={returnHome}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#333',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  flex: '1 1 auto',
                  minWidth: '140px'
                }}
              >
                RETURN HOME
              </button>
            </div>
          </div>
        )}

        <p style={{
          fontSize: '0.7rem',
          opacity: 0.4,
          color: '#fff',
          textAlign: 'center',
          margin: 0,
          marginTop: '1rem'
        }}>
          ONLY PERFORMANCE DATA + LOGIN ARE STORED. WE DO NOT UPLOAD YOUR AUDIO FILES.
        </p>
      </div>
    </div>
  );
};

export default ResultPage;