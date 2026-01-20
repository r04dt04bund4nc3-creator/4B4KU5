// src/components/ui/AuthForm.tsx
import React, { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

const buttonBaseStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px',
  border: 'none',
  borderRadius: '4px',
  cursor: 'pointer',
  fontWeight: 'bold',
  fontSize: '1rem',
  marginBottom: '10px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '10px'
};

// Added showTitle prop (defaulting to true for other pages)
export const AuthForm: React.FC<{ showTitle?: boolean }> = ({ showTitle = true }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const getRedirectUrl = () => window.location.origin + '/auth/callback';

  const handleSocialLogin = async (provider: 'google' | 'discord') => {
    setLoading(true);
    setError('');
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: getRedirectUrl() },
      });
      if (error) throw error;
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        const { error: otpError } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: getRedirectUrl() },
        });
        if (otpError) throw otpError;
        setMessage('Check your email for the login link!');
      } else {
        setMessage('Successfully signed in!');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      width: '100%',
      textAlign: 'center',
      fontFamily: 'monospace',
    }}>
      {/* Hide this if showTitle is false */}
      {showTitle && (
        <h3 style={{ marginBottom: '20px', color: '#fff' }}>
          SIGN IN TO DOWNLOAD & SAVE
        </h3>
      )}

      <button
        style={{ ...buttonBaseStyle, backgroundColor: '#4285F4', color: '#fff', opacity: loading ? 0.7 : 1 }}
        onClick={() => handleSocialLogin('google')}
        disabled={loading}
      >
        Sign in with Google
      </button>
      <button
        style={{ ...buttonBaseStyle, backgroundColor: '#5865F2', color: '#fff', opacity: loading ? 0.7 : 1 }}
        onClick={() => handleSocialLogin('discord')}
        disabled={loading}
      >
        Sign in with Discord
      </button>

      <div style={{ display: 'flex', alignItems: 'center', margin: '15px 0', color: '#666' }}>
        <hr style={{ flex: 1, borderColor: '#333' }} />
        <span style={{ padding: '0 10px', fontSize: '0.8rem' }}>OR</span>
        <hr style={{ flex: 1, borderColor: '#333' }} />
      </div>

      <form onSubmit={handleEmailSignIn}>
        <input
          type="email"
          placeholder="your@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{
            width: '100%',
            padding: '10px',
            marginBottom: '10px',
            borderRadius: '4px',
            border: '1px solid #444',
            background: 'rgba(0,0,0,0.5)',
            color: '#fff'
          }}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{
            width: '100%',
            padding: '10px',
            marginBottom: '10px',
            borderRadius: '4px',
            border: '1px solid #444',
            background: 'rgba(0,0,0,0.5)',
            color: '#fff'
          }}
        />
        <button
          type="submit"
          disabled={loading}
          style={{
            ...buttonBaseStyle,
            backgroundColor: '#00ff66',
            color: '#000',
            opacity: loading ? 0.7 : 1,
            fontSize: '0.9rem'
          }}
        >
          {loading ? 'Processing...' : 'Sign In with Email'}
        </button>
      </form>

      {error && <p style={{ color: '#ff4d4d', fontSize: '0.7rem', marginTop: '5px' }}>{error}</p>}
      {message && <p style={{ color: '#4ade80', fontSize: '0.7rem', marginTop: '5px' }}>{message}</p>}
    </div>
  );
};