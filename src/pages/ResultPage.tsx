// src/pages/ResultPage.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../state/AppContext';
import { useAnalytics } from '../hooks/useAnalytics';

import loggedOutSkin from '../assets/result-logged-out.webp';
import loggedInSkin from '../assets/result-logged-in.webp';
import ritualSlots from '../assets/ritual-slots.webp';
import prize0 from '../assets/prize-0.webp';
import steamSlotsHub from '../assets/steam-slots-hub.webp';

import './ResultPage.css';

/** -------- IndexedDB helpers -------- */
const DB_NAME = 'G4BKU5_DB';
const STORE_NAME = 'blobs';
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveBlob(key: string, blob: Blob): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).put(blob, key);
  db.close();
}

async function loadBlob(key: string): Promise<Blob | null> {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(key);
    req.onsuccess = () => resolve((req.result as Blob) ?? null);
    req.onerror = () => resolve(null);
  });
}

const RECOVERY_BLOB_KEY = 'res_recovery_blob';
const RECOVERY_PRINT_KEY = 'res_recovery_print';

type ResultView = 'summary' | 'slots' | 'prize-0' | 'hub';

type StreakState = {
  day: number; // 1..6
  lastDate: string; // YYYY-MM-DD
};

function todayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseDateKey(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const yy = Number(m[1]);
  const mm = Number(m[2]) - 1;
  const dd = Number(m[3]);
  return new Date(yy, mm, dd);
}

function diffDays(a: Date, b: Date) {
  const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((utcB - utcA) / (24 * 60 * 60 * 1000));
}

function getAndUpdateStreak(): StreakState {
  const key = 'g4m3_daily_streak';
  const today = todayKey();
  const raw = localStorage.getItem(key);

  if (!raw) {
    const s = { day: 1, lastDate: today };
    localStorage.setItem(key, JSON.stringify(s));
    return s;
  }

  try {
    const prev: StreakState = JSON.parse(raw);
    if (prev.lastDate === today) return prev;

    const prevDate = parseDateKey(prev.lastDate);
    const nowDate = parseDateKey(today);
    if (!prevDate || !nowDate) {
      const s = { day: 1, lastDate: today };
      localStorage.setItem(key, JSON.stringify(s));
      return s;
    }

    const d = diffDays(prevDate, nowDate);

    if (d === 1) {
      const nextDay = Math.min(6, (prev.day || 1) + 1);
      const s = { day: nextDay, lastDate: today };
      localStorage.setItem(key, JSON.stringify(s));
      return s;
    }

    const s = { day: 1, lastDate: today };
    localStorage.setItem(key, JSON.stringify(s));
    return s;
  } catch {
    const s = { day: 1, lastDate: today };
    localStorage.setItem(key, JSON.stringify(s));
    return s;
  }
}

const ResultPage: React.FC = () => {
  const navigate = useNavigate();
  const { state, ritual, auth, signOut, reset, signInWithDiscord, signInWithGoogle } = useApp();
  const { trackEvent } = useAnalytics();

  const [view, setView] = useState<ResultView>('summary');
  const [recoveredPrint, setRecoveredPrint] = useState<string | null>(null);
  const [recoveredBlob, setRecoveredBlob] = useState<Blob | null>(null);
  const [canProceed, setCanProceed] = useState(false);

  // FIXED: Removed 'setStreak' to satisfy the linter
  const [streak] = useState<StreakState>(() => {
    try {
      return getAndUpdateStreak();
    } catch {
      return { day: 1, lastDate: todayKey() };
    }
  });

  useEffect(() => {
    const run = async () => {
      const savedPrint = sessionStorage.getItem(RECOVERY_PRINT_KEY);
      if (savedPrint) setRecoveredPrint(savedPrint);
      const blob = await loadBlob(RECOVERY_BLOB_KEY);
      if (blob) setRecoveredBlob(blob);
    };
    run();
  }, []);

  useEffect(() => {
    if (view === 'prize-0') {
      setCanProceed(false);
      const timer = setTimeout(() => setCanProceed(true), 2000);
      return () => clearTimeout(timer);
    }
  }, [view]);

  const effectiveBlob = state.recordingBlob ?? recoveredBlob ?? null;

  const handleSocialLogin = useCallback(
    async (provider: 'discord' | 'google') => {
      trackEvent('social_login_attempt', { provider });
      if (state.recordingBlob) {
        try { await saveBlob(RECOVERY_BLOB_KEY, state.recordingBlob); } catch (e) { console.warn(e); }
      }
      if (ritual.soundPrintDataUrl) {
        sessionStorage.setItem(RECOVERY_PRINT_KEY, ritual.soundPrintDataUrl);
      }
      if (provider === 'discord') await signInWithDiscord();
      else await signInWithGoogle();
    },
    [state.recordingBlob, ritual.soundPrintDataUrl, trackEvent, signInWithDiscord, signInWithGoogle]
  );

  const downloadAndSpin = useCallback(() => {
    if (!effectiveBlob) {
      alert('No recording found. Please try the ritual again.');
      return;
    }

    const url = URL.createObjectURL(effectiveBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `4B4KU5-session-${Date.now()}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    trackEvent('download_and_spin');
    setView('slots');
  }, [effectiveBlob, trackEvent]);

  const goHome = useCallback(() => {
    reset();
    navigate('/');
  }, [navigate, reset]);

  const handleSignOut = useCallback(async () => {
    await signOut();
    navigate('/');
  }, [navigate, signOut]);

  const isLoggedIn = !!auth.user?.id;
  const currentPrint = ritual.soundPrintDataUrl || recoveredPrint;

  const dayText = useMemo(() => {
    return `DAY ${streak.day} OF 6: Come back tomorrow. Six consecutive days unlock the NFT for free.`;
  }, [streak.day]);

  if (view === 'hub') {
    return (
      <div className="res-page-root">
        <div className="res-machine-container">
          <img src={steamSlotsHub} className="res-background-image" alt="Steam Slots Hub" />
          <div className="res-interactive-layer">
            <button className="hs hs-hub-home" onClick={goHome} aria-label="Return Home" />
          </div>
        </div>
      </div>
    );
  }

  if (view === 'slots') {
    return (
      <div className="res-page-root">
        <div className="res-machine-container">
          <img src={ritualSlots} className="res-background-image" alt="Slot Ritual" />
          <div className="res-interactive-layer">
            <button className="hs hs-slot-left" onClick={() => setView('prize-0')} aria-label="$0" />
            <button className="hs hs-slot-center" onClick={() => setView('prize-0')} aria-label="$6" />
            <button className="hs hs-slot-right" onClick={() => setView('prize-0')} aria-label="$3" />
          </div>
        </div>
      </div>
    );
  }

  if (view === 'prize-0') {
    return (
      <div 
        className="res-page-root" 
        onClick={() => canProceed && setView('hub')}
        style={{ cursor: canProceed ? 'pointer' : 'wait' }}
      >
        <div className="res-machine-container">
          <img src={prize0} className="res-background-image" alt="Prize 0" />
          <div className="prize-shelf-text">
            {dayText}
          </div>
          {canProceed && (
            <div style={{
              position: 'absolute',
              bottom: '10%',
              left: '50%',
              transform: 'translateX(-50%)',
              color: 'rgba(201, 255, 216, 0.6)',
              fontSize: '14px',
              pointerEvents: 'none'
            }}>
              Tap to continue
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="res-page-root">
      <div className="res-machine-container">
        <img
          src={isLoggedIn ? loggedInSkin : loggedOutSkin}
          className="res-background-image"
          alt=""
          draggable={false}
        />

        <div className="res-visualizer-screen">
          {currentPrint && <img src={currentPrint} className="res-print-internal" alt="Sound Print" />}
        </div>

        <div className="res-interactive-layer">
          {isLoggedIn ? (
            <>
              <button className="hs hs-home-li" onClick={goHome} aria-label="Return Home" />
              <button className="hs hs-download" onClick={downloadAndSpin} aria-label="Download & Spin" />
              <button className="hs hs-signout-li" onClick={handleSignOut} aria-label="Sign Out" />
            </>
          ) : (
            <>
              <button className="hs hs-discord" onClick={() => handleSocialLogin('discord')} aria-label="Login with Discord" />
              <button className="hs hs-home-lo" onClick={goHome} aria-label="Return Home" />
              <button className="hs hs-google" onClick={() => handleSocialLogin('google')} aria-label="Login with Google" />
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResultPage;