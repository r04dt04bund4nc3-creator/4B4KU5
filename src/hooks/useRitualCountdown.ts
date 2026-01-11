// src/hooks/useRitualCountdown.ts
import { useEffect, useRef, useCallback } from 'react';
import { useApp } from '../state/AppContext';

const RITUAL_DURATION = 36; // seconds

export function useRitualCountdown() {
  const { ritual, setCountdown, setRitualPhase } = useApp();
  const intervalRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  const startCountdown = useCallback(() => {
    setRitualPhase('ritual');
    setCountdown(RITUAL_DURATION);
    startTimeRef.current = Date.now();

    intervalRef.current = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      const remaining = Math.max(0, RITUAL_DURATION - elapsed);
      
      setCountdown(remaining);

      if (remaining === 0) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
        setRitualPhase('capture');
      }
    }, 100); // Update frequently for smooth display
  }, [setCountdown, setRitualPhase]);

  const stopCountdown = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    countdown: ritual.countdown,
    phase: ritual.phase,
    startCountdown,
    stopCountdown,
    isComplete: ritual.phase === 'complete',
  };
}