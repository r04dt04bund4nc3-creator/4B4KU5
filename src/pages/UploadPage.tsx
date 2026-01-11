// src/pages/UploadPage.tsx
import React, { useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../state/AppContext';
import { audioEngine } from '../audio/AudioEngine';

export const UploadPage: React.FC = () => {
  const { setFile, setAudioBuffer, setRitualPhase } = useApp();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      // 1. Store file in global state
      setFile(file);

      try {
        // 2. Decode audio immediately
        const arrayBuffer = await file.arrayBuffer();
        await audioEngine.init();

        const ctx = audioEngine.getAudioContext();
        const AudioContextClass =
          window.AudioContext || (window as any).webkitAudioContext;
        const audioCtx = ctx || new AudioContextClass();

        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

        // 3. Store buffer in context
        setAudioBuffer(audioBuffer);

        // 4. Move ritual to "ritual" phase (launch screen)
        setRitualPhase('ritual');

        // 5. Navigate to instrument ritual interface
        navigate('/instrument');
      } catch (error) {
        console.error('Error decoding audio:', error);
        alert('Could not decode MP3. Please try another file.');
      }
    },
    [setFile, setAudioBuffer, setRitualPhase, navigate]
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
      }}
    >
      {/* Invisible upload hotspot mapped to "TAP HERE / TAP TO SELECT MP3" */}
      <div
        className="upload-hotspot"
        onClick={triggerFilePicker}
        aria-hidden="true"
      />

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        onChange={handleFileUpload}
        style={{ display: 'none' }}
      />

      {/* Accessible trigger for screen readers */}
      <button onClick={triggerFilePicker} className="sr-only">
        Upload audio to begin ritual
      </button>
    </div>
  );
};