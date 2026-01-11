import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import { useNavigate } from 'react-router-dom';
import * as THREE from 'three';

// Internal Logic & State
import { useApp } from '../state/AppContext';
import { audioEngine } from '../audio/AudioEngine';
import { BAND_COLORS } from '../config/bandColors';

// Components
import { BandColumn } from '../components/BandColumn';
import { Ribbon } from '../components/Ribbon';

// Constants
const MAX_BANDS = 36;
const MAX_ROWS = 36;
const RITUAL_DURATION_SEC = 36; 

// --- SCENE COMPONENT ---
const InstrumentScene: React.FC<{
  activeRows: number[];
  handleInteraction: (uv: THREE.Vector2) => void;
  showRibbon: boolean;
}> = ({ activeRows, handleInteraction, showRibbon }) => {
  return (
    <group>
      <mesh
        position={[0, 0, 0.1]} 
        visible={false} 
        onPointerDown={(e: ThreeEvent<PointerEvent>) => handleInteraction(e.uv!)}
        onPointerMove={(e: ThreeEvent<PointerEvent>) => {
          if (e.buttons > 0 || e.pointerType === 'touch') {
            handleInteraction(e.uv!);
          }
        }}
      >
        <planeGeometry args={[2, 2]} />
        <meshBasicMaterial color="red" wireframe />
      </mesh>

      {BAND_COLORS.map((color, index) => (
        <BandColumn
          key={index}
          index={index}
          colorData={color}
          activeRow={activeRows[index]}
          maxRows={MAX_ROWS}
          maxBands={MAX_BANDS}
        />
      ))}

      <Ribbon
        finalEQState={activeRows}
        maxBands={MAX_BANDS}
        maxRows={MAX_ROWS}
        isVisible={showRibbon}
      />
    </group>
  );
};

// --- MAIN PAGE COMPONENT ---
const InstrumentPage: React.FC = () => {
  const navigate = useNavigate();
  // FIX: Destructure setAudioBuffer to allow decoding
  const { state, saveRecording, setAudioBuffer } = useApp(); 
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeRows, setActiveRows] = useState<number[]>(new Array(MAX_BANDS).fill(-1));
  const [showRibbon, setShowRibbon] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isDecoding, setIsDecoding] = useState(false); 

  const requestRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  // 1. Redirect if totally empty
  useEffect(() => {
    if (!state.file && !state.audioBuffer) {
      navigate("/");
    }
  }, [state.file, state.audioBuffer, navigate]);

  // 2. AUTO-DECODE: Turn the File into a Playable Buffer
  useEffect(() => {
    const decodeAudio = async () => {
      if (state.file && !state.audioBuffer && !isDecoding) {
        setIsDecoding(true);
        console.log("🎧 Decoding audio file...");
        try {
          const arrayBuffer = await state.file.arrayBuffer();
          // Use a temporary context just for decoding
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          const tempCtx = new AudioContextClass();
          const decoded = await tempCtx.decodeAudioData(arrayBuffer);
          
          console.log("✅ Audio ready. Duration:", decoded.duration);
          setAudioBuffer(decoded);
        } catch (err) {
          console.error("❌ Decoding failed:", err);
        } finally {
          setIsDecoding(false);
        }
      }
    };
    decodeAudio();
  }, [state.file, state.audioBuffer, isDecoding, setAudioBuffer]);

  // 3. Interaction Handler
  const handleInteraction = useCallback((uv: THREE.Vector2) => {
    if (!isPlaying) return;

    const bandIndex = Math.floor(uv.x * MAX_BANDS);
    const rowIndex = Math.floor(uv.y * MAX_ROWS);

    if (bandIndex >= 0 && bandIndex < MAX_BANDS && rowIndex >= 0 && rowIndex < MAX_ROWS) {
      setActiveRows(prev => {
        const newRows = [...prev];
        newRows[bandIndex] = rowIndex;
        return newRows;
      });
      audioEngine.setBandGain(bandIndex, rowIndex);
    }
  }, [isPlaying]);

  // 4. Game Loop
  const updateLoop = useCallback(() => {
    if (!startTimeRef.current) return;

    const elapsed = (Date.now() - startTimeRef.current) / 1000;
    const duration = state.audioBuffer?.duration || 0;
    const remaining = Math.max(0, duration - elapsed);

    setTimeLeft(remaining);

    if (remaining <= RITUAL_DURATION_SEC && !showRibbon) {
      setShowRibbon(true);
    }

    requestRef.current = requestAnimationFrame(updateLoop);
  }, [state.audioBuffer, showRibbon]);

  // 5. Completion
  const handleRitualComplete = useCallback(() => {
    if (requestRef.current) cancelAnimationFrame(requestRef.current);
    const blob = audioEngine.getRecordingBlob();
    if (blob) {
      saveRecording(blob, activeRows);
    }
    navigate("/result");
  }, [activeRows, navigate, saveRecording]);

  // 6. Start Trigger
  const startRitual = async () => {
    console.log("🖱️ Start Ritual tapped");
    
    if (isPlaying) return;
    
    if (!state.audioBuffer) {
      console.warn("⚠️ Audio buffer not ready. Still decoding?");
      return;
    }

    try {
      console.log("🔌 Initializing Audio Engine...");
      await audioEngine.init();
      
      console.log("▶️ Starting Playback...");
      audioEngine.startPlayback(state.audioBuffer, () => {
        handleRitualComplete();
      });

      setIsPlaying(true);
      startTimeRef.current = Date.now();
      requestRef.current = requestAnimationFrame(updateLoop);

    } catch (e) {
      console.error("❌ Failed to start ritual:", e);
    }
  };

  // Cleanup
  useEffect(() => {
    return () => {
      audioEngine.stop();
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#050810', position: 'relative', overflow: 'hidden' }}>
      
      {/* 3D CANVAS */}
      <div style={{ width: '100%', height: '100%', opacity: isPlaying ? 1 : 0, transition: 'opacity 1s ease-in' }}>
        <Canvas
          dpr={[1, 2]} 
          camera={{ position: [0, 0, 1.4], fov: 60 }} 
          style={{ touchAction: 'none' }} 
        >
          <color attach="background" args={['#050810']} />
          <ambientLight intensity={0.2} />
          <pointLight position={[10, 10, 10]} intensity={0.5} />
          
          <InstrumentScene 
              activeRows={activeRows} 
              handleInteraction={handleInteraction}
              showRibbon={showRibbon}
          />
        </Canvas>
      </div>

      {/* OVERLAY: STEAMPUNK LAUNCH */}
      {!isPlaying && (
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
          {/* THE ACTIVE HOTSPOT */}
          <button 
            onClick={startRitual}
            disabled={!state.audioBuffer} 
            aria-label="Start Ritual"
            style={{
              width: '28vmin', 
              height: '28vmin',
              borderRadius: '50%',
              backgroundColor: 'transparent', 
              border: 'none',
              cursor: !state.audioBuffer ? 'wait' : 'pointer',
              // Breathing Glow Effect
              boxShadow: !state.audioBuffer 
                ? 'none' 
                : '0 0 50px rgba(0, 255, 102, 0.4), inset 0 0 20px rgba(0, 255, 102, 0.2)',
              animation: !state.audioBuffer 
                ? 'none'
                : 'pulse 3s infinite ease-in-out',
              transition: 'all 0.3s ease'
            }}
          />
          
          {/* Optional Loading Indicator Text */}
          {!state.audioBuffer && (
             <div style={{
                position: 'absolute',
                color: 'rgba(0, 255, 102, 0.6)',
                fontFamily: 'monospace',
                fontSize: '12px',
                letterSpacing: '2px',
                pointerEvents: 'none'
             }}>
               INITIALIZING...
             </div>
          )}

          <style>{`
            @keyframes pulse {
              0% { transform: scale(1); box-shadow: 0 0 50px rgba(0, 255, 102, 0.4); }
              50% { transform: scale(1.02); box-shadow: 0 0 80px rgba(0, 255, 102, 0.7); }
              100% { transform: scale(1); box-shadow: 0 0 50px rgba(0, 255, 102, 0.4); }
            }
          `}</style>
        </div>
      )}

      {/* HUD: Time Display */}
      {isPlaying && (
        <div style={{
          position: 'absolute',
          bottom: '20px',
          right: '20px',
          fontFamily: 'monospace',
          color: timeLeft <= RITUAL_DURATION_SEC ? '#FF003C' : '#555',
          pointerEvents: 'none'
        }}>
          {timeLeft.toFixed(1)}s
        </div>
      )}
    </div>
  );
};

export default InstrumentPage;