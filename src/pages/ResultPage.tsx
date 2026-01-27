// src/pages/ResultPage.tsx
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../state/AppContext';
import { useAnalytics } from '../hooks/useAnalytics';

import loggedOutSkin from '../assets/result-logged-out.webp';
import loggedInSkin from '../assets/result-logged-in.webp';
import './ResultPage.css';

/** -------- IndexedDB helpers (for large video blobs) -------- */
const DB_NAME = 'G4BKU5_DB';
const STORE_NAME = 'blobs';
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveBlob(key: string, blob: Blob): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(blob, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function loadBlob(key: string): Promise<Blob | null> {
  const db = await openDB();
  const blob = await new Promise<Blob | null>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(key);
    req.onsuccess = () => resolve((req.result as Blob) ?? null);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return blob;
}

async function deleteBlob(key: string): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

const RECOVERY_BLOB_KEY = 'res_recovery_blob';
const RECOVERY_PRINT_KEY = 'res_recovery_print';

/** -------- Filename helpers -------- */
function sanitizeBaseName(name: string): string {
  return name.replace(/\.[^/.]+$/, '').replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '');
}

function buildSessionFileName(file?: File | null): string {
  const prefix = '4B4KU5-';
  if (file?.name) {
    const base = sanitizeBaseName(file.name) || 'session';
    return `${prefix}${base}.webm`;
  }
  const now = new Date();
  const stamp = `${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
  return `${prefix}${stamp}.webm`;
}

/** -------- Component -------- */
const ResultPage: React.FC = () => {
  const navigate = useNavigate();
  const { state, ritual, auth, signOut, reset, signInWithDiscord, signInWithX } = useApp();
  const { trackEvent } = useAnalytics();

  const [recoveredPrint, setRecoveredPrint] = useState<string | null>(null);
  const [recoveredBlob, setRecoveredBlob] = useState<Blob | null>(null);

  useEffect(() => {
    const run = async () => {
      const savedPrint = sessionStorage.getItem(RECOVERY_PRINT_KEY);
      if (savedPrint) setRecoveredPrint(savedPrint);
      try {
        const blob = await loadBlob(RECOVERY_BLOB_KEY);
        if (blob) setRecoveredBlob(blob);
      } catch { /* ignore */ }
    };
    run();
  }, []);

  const effectiveBlob = state.recordingBlob ?? recoveredBlob ?? null;

  const handleSocialLogin = useCallback(
    async (provider: 'discord' | 'x') => {
      trackEvent('social_login_attempt', { provider });

      // Local IndexedDB backup (safety for large videos)
      if (state.recordingBlob) {
        try {
          await saveBlob(RECOVERY_BLOB_KEY, state.recordingBlob);
        } catch (e) {
          console.warn('IndexedDB save failed:', e);
        }
      }

      // Call context methods
      if (provider === 'discord') {
        await signInWithDiscord();
      } else {
        await signInWithX();
      }
    },
    [state.recordingBlob, trackEvent, signInWithDiscord, signInWithX]
  );

  const downloadSession = useCallback(() => {
    if (!effectiveBlob) {
      alert('No recording data found. Please try the ritual again.');
      return;
    }
    const url = URL.createObjectURL(effectiveBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = buildSessionFileName(state.file || null);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    trackEvent('download_session', { type: effectiveBlob.type || 'video/webm' });
  }, [effectiveBlob, state.file, trackEvent]);

  const goHome = useCallback(() => {
    sessionStorage.removeItem(RECOVERY_PRINT_KEY);
    deleteBlob(RECOVERY_BLOB_KEY).catch(() => {});
    reset();
    navigate('/');
  }, [navigate, reset]);

  const handleSignOut = useCallback(async () => {
    await signOut();
  }, [signOut]);

  const isLoggedIn = !!auth.user?.id;
  const currentPrint = ritual.soundPrintDataUrl || recoveredPrint;

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
          {currentPrint && (
            <img src={currentPrint} className="res-print-internal" alt="Sound Print" />
          )}
        </div>

        <div className="res-interactive-layer">
          {isLoggedIn ? (
            <>
              <button className="hs hs-home-li" onClick={goHome} aria-label="Return Home" />
              <button className="hs hs-download" onClick={downloadSession} aria-label="Download Video" />
              <button className="hs hs-signout-li" onClick={handleSignOut} aria-label="Sign Out" />
            </>
          ) : (
            <>
              <button
                className="hs hs-discord"
                onClick={() => handleSocialLogin('discord')}
                aria-label="Login with Discord"
              />
              <button className="hs hs-home-lo" onClick={goHome} aria-label="Return Home" />
              <button
                className="hs hs-x"
                onClick={() => handleSocialLogin('x')}
                aria-label="Login with X"
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResultPage;