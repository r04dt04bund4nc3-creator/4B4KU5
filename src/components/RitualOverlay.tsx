import React, { useState } from 'react';
import { useApp } from '../state/AppContext';
import { audioEngine } from '../audio/AudioEngine';
import { useNavigate } from 'react-router-dom';

const RitualOverlay: React.FC = () => {
  const { ritual, audio } = useApp();
  const [hasStarted, setHasStarted] = useState(false);
  const navigate = useNavigate();

  // ONLY show the overlay if we have a file and are ready for the ritual phase
  // If phase is 'upload', this returns null and stays out of your way.
  if (ritual.phase !== 'ritual' || hasStarted) return null;

  const handleStart = async () => {
    try {
      await audioEngine.init();
      if (audio.audioBuffer) {
        setHasStarted(true);
        // Ensure we are on the instrument page
        navigate('/sound-print');
      }
    } catch (e) {
      console.error("Audio init failed", e);
    }
  };

  return (
    <div 
      onClick={handleStart}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(0, 20, 0, 0.9)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999,
        cursor: 'pointer',
        fontFamily: 'monospace',
        color: '#4ade80'
      }}
    >
      <div style={{ padding: '40px', border: '2px solid #4ade80', borderRadius: '50%', textAlign: 'center' }}>
        <h1 style={{ fontSize: '24px', margin: 0 }}>TAP TO BEGIN</h1>
      </div>
    </div>
  );
};

export default RitualOverlay;