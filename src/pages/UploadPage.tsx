import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../state/AppContext';
import { audioEngine } from '../audio/AudioEngine';

export const UploadPage: React.FC = () => {
  const { setFile, setAudioBuffer, setRitualPhase } = useApp();
  const navigate = useNavigate();

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 1. Store file in context
    setFile(file);

    // 2. Decode audio immediately so we are ready for the ritual
    try {
      const arrayBuffer = await file.arrayBuffer();
      // Use the AudioEngine's context (it creates one if null)
      await audioEngine.init();
      const ctx = audioEngine.getAudioContext(); // Make sure we expose this in AudioEngine or use window.AudioContext
      
      // Fallback if engine context isn't ready (though init calls it)
      const audioCtx = ctx || new (window.AudioContext || (window as any).webkitAudioContext)();
      
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      
      // 3. Store buffer in context
      setAudioBuffer(audioBuffer);
      
      // 4. Update phase to 'ritual' (triggers the Green CRT Overlay)
      setRitualPhase('ritual');
      
      // 5. Navigate to the instrument (Overlay will appear on top)
      navigate('/sound-print');
      
    } catch (error) {
      console.error("Error decoding audio:", error);
      alert("Could not decode MP3. Please try another file.");
    }
  }, [setFile, setAudioBuffer, setRitualPhase, navigate]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      color: '#ffffff',
      fontFamily: 'monospace',
      textAlign: 'center',
      zIndex: 1
    }}>
      <h1 style={{ 
        fontSize: '2.5rem', 
        marginBottom: '1rem',
        textShadow: '0 0 10px rgba(74, 222, 128, 0.5)',
        color: '#4ade80' 
      }}>
        4B4KU5
      </h1>
      
      <p style={{ maxWidth: '400px', marginBottom: '2rem', lineHeight: '1.5' }}>
        Initiate the genesis ritual. <br/>
        Upload your audio artifact to begin.
      </p>

      <label style={{
        padding: '1rem 2rem',
        background: 'linear-gradient(90deg, #4ade80, #f87171)',
        color: '#000',
        fontWeight: 'bold',
        borderRadius: '4px',
        cursor: 'pointer',
        boxShadow: '0 0 15px rgba(74, 222, 128, 0.3)',
        transition: 'transform 0.2s'
      }}>
        SELECT AUDIO ARTIFACT
        <input 
          type="file" 
          accept="audio/*" 
          onChange={handleFileUpload} 
          style={{ display: 'none' }} 
        />
      </label>

      <div style={{ marginTop: '2rem', fontSize: '0.8rem', color: '#666' }}>
        Supported Formats: MP3, WAV
      </div>
    </div>
  );
};