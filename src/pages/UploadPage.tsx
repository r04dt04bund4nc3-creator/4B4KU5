import React, { useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../state/AppContext';
// FIX: Changed to Named Import to match AudioEngine.ts exports
import { audioEngine } from '../audio/AudioEngine'; 
import { useAnalytics } from '../hooks/useAnalytics';

export const UploadPage: React.FC = () => {
  const { setFile, setAudioBuffer, setRitualPhase } = useApp();
  const { trackEvent } = useAnalytics();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      setFile(file);

      try {
        const arrayBuffer = await file.arrayBuffer();
        
        // Initialize engine
        await audioEngine.init();
        
        // Use existing context or create new one
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        const audioCtx = audioEngine.getAudioContext() || new AudioContextClass();

        // Decode
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

        // Analytics
        trackEvent('upload_success', {
          duration: audioBuffer.duration,
          fileName: file.name,
          fileType: file.type
        });

        setAudioBuffer(audioBuffer);
        setRitualPhase('ritual');
        navigate('/instrument');
        
      } catch (error) {
        console.error('Error decoding audio:', error);
        trackEvent('upload_error', { error: 'decode_failed' });
        alert('Could not decode audio. Please try another file.');
      }
    },
    [setFile, setAudioBuffer, setRitualPhase, navigate, trackEvent]
  );

  const triggerFilePicker = () => {
    fileInputRef.current?.click();
  };

  return (
    <div
      style={{
        position: 'relative',
        width: '100vw',
        height: '100vh',
        backgroundImage: "url('/ritual-bg-v2.jpg')",
        backgroundSize: 'contain',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundColor: '#000',
        overflow: 'hidden', // Prevent scrollbars
      }}
    >
      {/* The invisible click area covering the whole screen */}
      <div
        className="upload-hotspot"
        onClick={triggerFilePicker}
        style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          cursor: 'pointer',
          zIndex: 10
        }}
        aria-hidden="true"
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        onChange={handleFileUpload}
        style={{ display: 'none' }}
      />

      {/* This button is now visually hidden by .sr-only in index.css */}
      <button onClick={triggerFilePicker} className="sr-only">
        Upload audio to begin ritual
      </button>
    </div>
  );
};