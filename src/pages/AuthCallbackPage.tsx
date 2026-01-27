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
          try {
            const { error } = await supabase.auth.exchangeCodeForSession(window.location.href);
            if (error) throw error;
          } catch (pkceErr: any) {
            // If PKCE fails (verifier missing), check if we have a session anyway
            // This is the "Back Button" logic automated
            const { data } = await supabase.auth.getSession();
            if (!data.session) throw pkceErr;
            console.warn('PKCE verifier missing but session recovered.');
          }
        }

        // Settling delay
        await new Promise(r => setTimeout(r, 400));
        if (cancelled) return;

        const dest = sessionStorage.getItem('post-auth-redirect') || '/result';
        sessionStorage.removeItem('post-auth-redirect');

        window.location.replace(dest);
      } catch (e: any) {
        console.error('Auth Error:', e);
        if (cancelled) return;
        setMsg(`Login failed: ${e?.message ?? 'Unknown Error'}`);
        setTimeout(() => window.location.replace('/'), 2000);
      }
    };

    run();
    return () => { cancelled = true; };
  }, []);

  return (
    <div style={{ minHeight: '100dvh', background: '#050810', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'monospace' }}>
      <div style={{ opacity: 0.85 }}>{msg}</div>
    </div>
  );
}