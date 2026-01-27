// src/pages/AuthCallbackPage.tsx
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function AuthCallbackPage() {
  const [msg, setMsg] = useState('Finalizing login...');

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const url = new URL(window.location.href);
        const hasCode = !!url.searchParams.get('code');

        if (hasCode) {
          // Exchange code for session
          const { error } = await supabase.auth.exchangeCodeForSession(window.location.href);
          if (error) throw error;
        } else {
          // Fallback: just get session (for direct navigation or refresh)
          const { error } = await supabase.auth.getSession();
          if (error) throw error;
        }

        // CRITICAL FIX: Wait 500ms to let Supabase client hydrate the session
        // This prevents the "bounce" where the session exists but the context hasn't updated yet
        await new Promise(resolve => setTimeout(resolve, 500));

        if (cancelled) return;

        // Check session again to be sure
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          throw new Error("Session not established after exchange");
        }

        // Redirect logic
        const dest = sessionStorage.getItem('post-auth-redirect') || '/result';
        sessionStorage.removeItem('post-auth-redirect');

        // Use replace so back button doesn't loop
        window.location.replace(dest);

      } catch (e: any) {
        console.error('AuthCallback Error:', e);
        if (cancelled) return;
        setMsg(`Login failed: ${e?.message ?? 'Unknown error'}`);
        setTimeout(() => window.location.replace('/'), 2000);
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div style={{ 
      minHeight: '100dvh', 
      background: '#050810', 
      color: '#fff', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      fontFamily: 'monospace'
    }}>
      <div style={{ opacity: 0.85, fontSize: '1.2rem' }}>{msg}</div>
    </div>
  );
}