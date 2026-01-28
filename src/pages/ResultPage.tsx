// src/pages/ResultPage.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../state/AppContext';
import { useAnalytics } from '../hooks/useAnalytics';
import { supabase } from '../lib/supabaseClient'; 
import { claimRitualArtifact } from '../lib/manifold';

// Assets
import loggedOutSkin from '../assets/result-logged-out.webp';
import loggedInSkin from '../assets/result-logged-in.webp';
import ritualSlots from '../assets/ritual-slots.webp';
import steamSlotsHub from '../assets/steam-slots-hub.webp';
import prize0 from '../assets/prize-0.webp';
import prize3 from '../assets/prize-3.webp';
import prize6 from '../assets/prize-6.webp';

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

type ResultView = 'summary' | 'slots' | 'prize-0' | 'prize-3' | 'prize-6' | 'hub';

type StreakState = {
  day: number;
  lastDate: string;
  nftClaimed: boolean;
};

const ResultPage: React.FC = () => {
  const navigate = useNavigate();
  const { state, ritual, auth, signOut, reset, signInWithDiscord, signInWithGoogle } = useApp();
  const { trackEvent } = useAnalytics();

  const [view, setView] = useState<ResultView>('summary');
  const [recoveredPrint, setRecoveredPrint] = useState<string | null>(null);
  const [recoveredBlob, setRecoveredBlob] = useState<Blob | null>(null);
  const [canProceed, setCanProceed] = useState(false);
  const [loadingStreak, setLoadingStreak] = useState(false);
  const [claiming, setClaiming] = useState(false);

  const [streak, setStreak] = useState<StreakState>({ 
    day: 1, 
    lastDate: new Date().toISOString().split('T')[0],
    nftClaimed: false
  });

  // Fetch streak from Supabase
  const fetchStreak = useCallback(async () => {
    if (!auth.user?.id) return;

    setLoadingStreak(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      
      let { data, error } = await supabase
        .from('user_streaks')
        .select('*')
        .eq('user_id', auth.user.id)
        .single();

      if (error && error.code === 'PGRST116') {
        const { data: newData, error: insertError } = await supabase
          .from('user_streaks')
          .insert({ user_id: auth.user.id, current_day: 1, last_visit: today, total_visits: 1 })
          .select()
          .single();
        if (insertError) throw insertError;
        data = newData;
      } else if (data) {
        const lastVisit = new Date(data.last_visit);
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - lastVisit.getTime());
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        
        let newDay = data.current_day;
        
        if (data.last_visit !== today) {
           if (diffDays === 1) {
             newDay = Math.min(data.current_day + 1, 6);
           } else if (diffDays > 1) {
             newDay = 1;
           }
           
           await supabase.from('user_streaks').update({
             current_day: newDay,
             last_visit: today,
             total_visits: data.total_visits + 1
           }).eq('user_id', auth.user.id);
        }

        data.current_day = newDay;
      }

      setStreak({
        day: data?.current_day || 1,
        lastDate: data?.last_visit || today,
        nftClaimed: data?.nft_claimed || false
      });

    } catch (err) {
      console.error("Streak sync error:", err);
    } finally {
      setLoadingStreak(false);
    }
  }, [auth.user?.id]);

  useEffect(() => {
    if (auth.user?.id) fetchStreak();
  }, [auth.user?.id, fetchStreak]);

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
    if (view.startsWith('prize-')) {
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

  const handleClaim = async () => {
    if (!auth.user?.id) return;
    setClaiming(true);
    try {
      await claimRitualArtifact(auth.user.id);
      await supabase.from('user_streaks').update({ nft_claimed: true }).eq('user_id', auth.user.id);
      setStreak(prev => ({ ...prev, nftClaimed: true }));
      trackEvent('nft_claimed', { day: 6 });
    } catch (e) {
      console.error(e);
    } finally {
      setClaiming(false);
    }
  };

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
    if (loadingStreak) return "ALIGNING PLANETARY GEARS...";
    if (streak.day === 6) {
      if (streak.nftClaimed) return "CYCLE COMPLETE. ARTIFACT SECURED.";
      return "DAY 6 OF 6: THE GATE IS OPEN.";
    }
    return `DAY ${streak.day} OF 6: RETURN TOMORROW TO STRENGTHEN THE SIGNAL.`;
  }, [streak, loadingStreak]);

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
            <button className="hs hs-slot-left" onClick={() => setView('prize-0')} aria-label="$0 Reward" />
            <button className="hs hs-slot-center" onClick={() => setView('prize-6')} aria-label="$6 Subscription" />
            <button className="hs hs-slot-right" onClick={() => setView('prize-3')} aria-label="$3 Subscription" />
          </div>
        </div>
      </div>
    );
  }

  const renderPrizeScreen = (imgSrc: string, text: string, showClaimBtn: boolean = false) => (
    <div 
      className="res-page-root" 
      onClick={() => canProceed && !showClaimBtn && setView('hub')}
      style={{ cursor: canProceed && !showClaimBtn ? 'pointer' : 'default' }}
    >
      <div className="res-machine-container">
        <img src={imgSrc} className="res-background-image" alt="Prize" />
        <div className="prize-shelf-text">{text}</div>

        {showClaimBtn && canProceed && (
           <div className="claim-container">
             <button className="manifold-claim-btn" onClick={(e) => { e.stopPropagation(); handleClaim(); }} disabled={claiming}>
               {claiming ? "MINTING..." : "CLAIM ARTIFACT"}
             </button>
             <div className="claim-subtext" onClick={() => setView('hub')}>or continue to hub</div>
           </div>
        )}

        {canProceed && !showClaimBtn && (
          <div className="tap-continue-hint">Tap to continue</div>
        )}
      </div>
    </div>
  );

  if (view === 'prize-0') return renderPrizeScreen(prize0, dayText, streak.day === 6 && !streak.nftClaimed);
  if (view === 'prize-3') return renderPrizeScreen(prize3, "ANNUAL SUBSCRIPTION: MONTHLY NFT DROPS ACTIVATED.");
  if (view === 'prize-6') return renderPrizeScreen(prize6, "MONTHLY SUBSCRIPTION: SIGNAL BOOSTED.");

  return (
    <div className="res-page-root">
      <div className="res-machine-container">
        <img src={isLoggedIn ? loggedInSkin : loggedOutSkin} className="res-background-image" alt="" draggable={false} />
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