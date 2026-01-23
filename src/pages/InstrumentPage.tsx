import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { useNavigate } from 'react-router-dom';

import { useApp } from '../state/AppContext';
import { useAnalytics } from '../hooks/useAnalytics';
import audioEngine from '../audio/AudioEngine';
import { FlowFieldInstrument } from '../components/FlowFieldInstrument';

const MAX_BANDS = 36;
const MAX_ROWS = 36;

const InstrumentPage: React.FC = () => {
  const navigate = useNavigate();
  const { state, saveRecording, setAudioBuffer, captureSoundPrint } = useApp();
  const { trackEvent } = useAnalytics();

  const [isPlaying, setIsPlaying] = useState(false);
  const [isIntroPlaying, setIsIntroPlaying] = useState(false); 
  const [activeRows, setActiveRows] = useState<number[]>(new Array(MAX_BANDS).fill(-1));
  const [countdownProgress, setCountdownProgress] = useState(0);
  const [isDecoding, setIsDecoding] = useState(false);

  const startTimeRef = useRef<number>(0);
  const completedRef = useRef(false);
  const requestRef = useRef<number | null>(null);

  useEffect(() => {
    if (!state.file && !state.audioBuffer) navigate('/');
  }, [state.file, state.audioBuffer, navigate]);

  useEffect(() => {
    const decodeAudio = async () => {
      if (state.file && !state.audioBuffer && !isDecoding) {
        setIsDecoding(true);
        try {
          const arrayBuffer = await state.file.arrayBuffer();
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          const tempCtx = new AudioContextClass();
          const decoded = await tempCtx.decodeAudioData(arrayBuffer);
          setAudioBuffer(decoded);
        } catch (err) { console.error(err); } finally { setIsDecoding(false); }
      }
    };
    decodeAudio();
  }, [state.file, state.audioBuffer, isDecoding, setAudioBuffer]);

  const onTriggerAudio = useCallback((x: number, y: number) => {
    const bandIndex = Math.floor(x * MAX_BANDS);
    const rowIndex = Math.floor(y * MAX_ROWS);
    if (bandIndex >= 0 && bandIndex < MAX_BANDS && rowIndex >= 0 && rowIndex < MAX_ROWS) {
      setActiveRows(prev => {
        if (prev[bandIndex] === rowIndex) return prev;
        const next = [...prev];
        next[bandIndex] = rowIndex;
        return next;
      });
      audioEngine.setBandGain(bandIndex, rowIndex);
    }
  }, []);

  const handleRitualComplete = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    const canvas = document.querySelector('canvas') as HTMLCanvasElement | null;
    if (canvas) captureSoundPrint(canvas.toDataURL('image/png'));
    const blob = audioEngine.getRecordingBlob();
    if (blob) saveRecording(blob, activeRows);
    navigate('/result');
  }, [activeRows, captureSoundPrint, saveRecording, navigate]);

  const updateLoop = useCallback(() => {
    if (!startTimeRef.current) return;
    const elapsed = (Date.now() - startTimeRef.current) / 1000;
    const duration = state.audioBuffer?.duration || 0;
    const remaining = Math.max(0, duration - elapsed);
    if (remaining <= 36) setCountdownProgress(Math.min(1, (36 - remaining) / 36));
    requestRef.current = requestAnimationFrame(updateLoop);
  }, [state.audioBuffer]);

  const beginActualPlayback = async () => {
    if (!state.audioBuffer) return;
    try {
      await audioEngine.init();
      const canvas = document.querySelector('canvas');
      const videoStream = canvas ? (canvas as any).captureStream(30) : null;
      audioEngine.startPlayback(state.audioBuffer, videoStream, handleRitualComplete);
      setIsPlaying(true);
      startTimeRef.current = Date.now();
      requestRef.current = requestAnimationFrame(updateLoop);
      trackEvent('ritual_start');
    } catch (e) { console.error(e); }
  };

  return (
    <div style={{ width: '100vw', height: '100dvh', background: '#000', position: 'relative', overflow: 'hidden' }}>
      {isIntroPlaying && (
        <video
          src="/intro-dissolve.mp4" autoPlay muted playsInline
          onEnded={() => { setIsIntroPlaying(false); beginActualPlayback(); }}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 100 }}
        />
      )}

      <div style={{ width: '100%', height: '100%', opacity: isPlaying ? 1 : 0, transition: 'opacity 1.5s' }}>
        <Canvas 
          orthographic 
          camera={{ left: -1, right: 1, top: 1, bottom: -1, near: 0, far: 1 }}
          gl={{ preserveDrawingBuffer: true, antialias: false }} 
          style={{ position: 'absolute', inset: 0 }}
        >
          <FlowFieldInstrument 
            onTriggerAudio={onTriggerAudio}
            countdownProgress={countdownProgress}
          />
        </Canvas>
      </div>

      {!isPlaying && !isIntroPlaying && (
        <div style={{ position: 'absolute', inset: 0, backgroundImage: "url('/ritual-launch-bg.jpg')", backgroundSize: 'cover', backgroundPosition: 'center', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <button onClick={() => setIsIntroPlaying(true)} disabled={!state.audioBuffer} style={{ width: '30vmin', height: '30vmin', background: 'transparent', border: 'none', cursor: 'pointer' }} />
        </div>
      )}
    </div>
  );
};

export default InstrumentPage;