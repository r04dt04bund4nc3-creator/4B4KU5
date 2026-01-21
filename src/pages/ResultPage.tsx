import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../state/AppContext';
import { useAnalytics } from '../hooks/useAnalytics';
import { supabase } from '../lib/supabaseClient';

import loggedOutSkin from '../assets/result-logged-out.webp';
import loggedInSkin from '../assets/result-logged-in.webp';
import './ResultPage.css';

const ResultPage: React.FC = () => {
  const navigate = useNavigate();
  const { state, ritual, auth, savePerformance, signOut, reset } = useApp();
  const { trackEvent } = useAnalytics();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const getRedirectUrl = () => window.location.origin + '/auth/callback';

  const handleSocialLogin = async (provider: 'google' | 'discord') => {
    trackEvent('social_login_attempt', { provider });
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: getRedirectUrl() },
    });
  };

  const handleEmailSignIn = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    trackEvent('email_login_attempt');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: getRedirectUrl() },
      });
      alert('Check your email for the login link!');
    }
  };

  const downloadAudio = useCallback(() => {
    if (!auth.user || !state.recordingBlob) return;
    trackEvent('download_audio', { fileName: state.file?.name });
    const url = URL.createObjectURL(state.recordingBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${state.file?.name.replace(/\.[^/.]+$/, "") || 'performance'}-sound-print.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [state.recordingBlob, state.file, auth.user, trackEvent]);

  const handleSave = async () => {
    if (!auth.user) return;
    const trackName = state.file?.name || 'Unknown Track';
    const trackHash = btoa(state.file?.name || '') + '-' + state.file?.size;
    await savePerformance(ritual.finalEQState, trackName, trackHash);
    trackEvent('save_performance', { userId: auth.user.id });
    alert("Saved to library.");
  };

  const replay = () => {
    trackEvent('ritual_replay');
    reset(); 
    navigate('/instrument'); 
  };

  const goHome = () => { 
    reset(); 
    navigate('/'); 
  };

  const isLoggedIn = !!auth.user?.id;

  return (
    <div className="res-page-root">
      <div className="res-machine-container">
        
        {/* HARDWARE BACKGROUND */}
        <img 
          src={isLoggedIn ? loggedInSkin : loggedOutSkin} 
          className="res-background-image"
          alt="" 
        />

        {/* LOGGED IN USER OVERLAY */}
        <div className="res-email-overlay">
          {auth.isLoading ? "SYNCING..." : isLoggedIn ? `Logged in: ${auth.user?.email}` : ""}
        </div>

        {/* CENTRAL SOUND PRINT SCREEN */}
        <div className="res-visualizer-screen">
          {ritual.soundPrintDataUrl && (
            <img 
              src={ritual.soundPrintDataUrl} 
              className="res-print-internal"
              alt="Sound Print" 
            />
          )}
        </div>

        {/* INVISIBLE INTERACTION LAYER */}
        <div className="res-interactive-layer">
          {isLoggedIn ? (
            /* --- LOGGED IN BUTTONS --- */
            <>
              <button className="hs hs-download" onClick={downloadAudio} title="Download" />
              <button className="hs hs-save" onClick={handleSave} title="Save to Library" />
              <button className="hs hs-replay-li" onClick={replay} title="Replay" />
              <button className="hs hs-home-li" onClick={goHome} title="Home" />
              <button className="hs hs-signout-li" onClick={signOut} title="Sign Out" />
            </>
          ) : (
            /* --- LOGGED OUT BUTTONS & INPUTS --- */
            <>
              {/* Login Hotspots */}
              <button className="hs hs-google" onClick={() => handleSocialLogin('google')} />
              <button className="hs hs-discord" onClick={() => handleSocialLogin('discord')} />
              
              {/* Completely Transparent Form Inputs */}
              <form onSubmit={handleEmailSignIn}>
                <input 
                  type="email" 
                  className="hs-input hs-input-email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <input 
                  type="password" 
                  className="hs-input hs-input-pass" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button type="submit" className="hs hs-email-signin" />
              </form>

              <button className="hs hs-replay-lo" onClick={replay} />
            </>
          )}
        </div>

      </div>
    </div>
  );
};

export default ResultPage;