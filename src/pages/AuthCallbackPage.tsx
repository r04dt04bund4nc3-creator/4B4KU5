// src/pages/AuthCallbackPage.tsx
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

export default function AuthCallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Exchange the OAuth code for a session
        const { error } = await supabase.auth.getSession();
        if (error) throw error;

        // Clean up the URL (remove #access_token=...)
        window.history.replaceState({}, '', '/auth/callback');

        // Redirect to /result after a tiny delay (ensures session is persisted)
        setTimeout(() => navigate('/result', { replace: true }), 50);
      } catch (err) {
        console.error('Auth callback failed:', err);
        navigate('/'); // Fallback to home on error
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div style={{ background: '#050810', minHeight: '100vh', color: 'white', padding: '2rem' }}>
      <p>Finalizing login...</p>
    </div>
  );
}