import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { useNavigate } from 'react-router-dom';

import { useApp } from '../state/AppContext';
import { useAnalytics } from '../hooks/useAnalytics';
import audioEngine from '../audio/AudioEngine';
import { FlowFieldInstrument } from '../components/FlowFieldInstrument';

const MAX_BANDS = 36;
const MAX_ROWS = 36;
const RITUAL_DURATION_SEC = 36;

const InstrumentPage: React.FC = () => {
  const navigate = useNavigate();
  const { state, saveRecording, setAudioBuffer, captureSoundPrint } = useApp();
  const { trackEvent } = useAnalytics();

  const [isPlaying, setIsPlaying] = useState(false);
  const [isIntroPlaying, setIsIntroPlaying] = useState(false);
  const [activeRows, setActiveRows] = useState<number[]>(new Array(MAX_BANDS).fill(-1));
  const [countdownProgress, setCountdownProgress] = useState(0);
  const [isDecoding, setIsDecoding] = useState(false);

  const requestRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const completedRef = useRef(false);

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
        } catch (err) {
          console.error('Decoding failed:', err);
          trackEvent('decode_error');
        } finally {
          setIsDecoding(false);
        }
      }
    };
    decodeAudio();
  }, [state.file, state.audioBuffer, isDecoding, setAudioBuffer, trackEvent]);

  const onTriggerAudio = useCallback(
    (x01: number, y01: number) => {
      if (!isPlaying) return;

      const bandIndex = Math.min(MAX_BANDS - 1, Math.max(0, Math.floor(x01 * MAX_BANDS)));
      const rowIndex = Math.min(MAX_ROWS - 1, Math.max(0, Math.floor(y01 * MAX_ROWS)));

      setActiveRows(prev => {
        if (prev[bandIndex] === rowIndex) return prev;
        const next = [...prev];
        next[bandIndex] = rowIndex;
        return next;
      });

      audioEngine.setBandGain(bandIndex, rowIndex);
    },
    [isPlaying]
  );

  const handleRitualComplete = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    if (requestRef.current) cancelAnimationFrame(requestRef.current);

    const canvas = document.querySelector('canvas') as HTMLCanvasElement | null;
    if (canvas) captureSoundPrint(canvas.toDataURL('image/png'));

    const blob = audioEngine.getRecordingBlob();
    if (blob) saveRecording(blob, activeRows);

    trackEvent('ritual_complete', { durationPlayed: (Date.now() - startTimeRef.current) / 1000 });
    navigate('/result');
  }, [activeRows, captureSoundPrint, saveRecording, navigate, trackEvent]);

  const updateLoop = useCallback(() => {
    if (!startTimeRef.current) return;
    const elapsed = (Date.now() - startTimeRef.current) / 1000;
    const duration = state.audioBuffer?.duration || 0;
    const remaining = Math.max(0, duration - elapsed);

    if (remaining <= RITUAL_DURATION_SEC) {
      setCountdownProgress(Math.min(1, (RITUAL_DURATION_SEC - remaining) / RITUAL_DURATION_SEC));
    }

    requestRef.current = requestAnimationFrame(updateLoop);
  }, [state.audioBuffer]);

  const beginActualPlayback = async () => {
    if (!state.audioBuffer) return;
    try {
      completedRef.current = false;
      await audioEngine.init();

      const canvas = document.querySelector('canvas');
      const videoStream = canvas ? (canvas as any).captureStream(30) : null;

      audioEngine.startPlayback(state.audioBuffer, videoStream, () => handleRitualComplete());
      setIsPlaying(true);
      startTimeRef.current = Date.now();
      requestRef.current = requestAnimationFrame(updateLoop);
      trackEvent('ritual_start');
    } catch (e) {
      console.error('Failed to start ritual:', e);
    }
  };

  const handleLaunchClick = () => {
    if (isPlaying || isIntroPlaying || !state.audioBuffer) return;
    setIsIntroPlaying(true);
    trackEvent('intro_video_start');
  };

  useEffect(() => {
    return () => {
      audioEngine.stop();
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  return (
    <div
      style={{
        width: '100vw',
        height: '100dvh',
        background: '#050810',
        position: 'relative',
        overflow: 'hidden',
        touchAction: 'none',
      }}
    >
      {isIntroPlaying && (
        <video
          src="/intro-dissolve.mp4"
          autoPlay
          muted
          playsInline
          preload="auto"
          onEnded={() => {
            setIsIntroPlaying(false);
            beginActualPlayback();
          }}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            zIndex: 100,
            background: '#050810',
          }}
        />
      )}

      {/* R3F visuals */}
      <div style={{ position: 'absolute', inset: 0, opacity: isPlaying ? 1 : 0, transition: 'opacity 1.5s ease-in' }}>
        <Canvas
          orthographic
          camera={{ position: [0, 0, 1], zoom: 1 }}
          gl={{ preserveDrawingBuffer: true }}
          style={{ position: 'absolute', inset: 0 }}
        >
          <FlowFieldInstrument
            onTriggerAudio={onTriggerAudio}
            countdownProgress={countdownProgress}
          />
        </Canvas>
      </div>

      {/* launch screen */}
      {!isPlaying && !isIntroPlaying && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: "url('/ritual-launch-bg.jpg')",
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <button
            onClick={handleLaunchClick}
            disabled={!state.audioBuffer}
            style={{
              width: '28vmin',
              height: '28vmin',
              borderRadius: '50%',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: !state.audioBuffer ? 'wait' : 'pointer',
              boxShadow: !state.audioBuffer ? 'none' : '0 0 50px rgba(0, 255, 102, 0.4)',
              animation: !state.audioBuffer ? 'none' : 'pulse 3s infinite ease-in-out',
            }}
          />
          <style>{`@keyframes pulse { 0% { transform: scale(1); } 50% { transform: scale(1.02); } 100% { transform: scale(1); } }`}</style>
        </div>
      )}
    </div>
  );
};

export default InstrumentPage;