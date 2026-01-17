// src/components/layout/Shell.tsx
import React, { useEffect, useState } from 'react';
// 🎯 Fixed import path: changed from '../state/AppContext' to '../../state/AppContext'
import { useApp } from '../../state/AppContext';

export function Shell({ children }: { children: React.ReactNode }) {
  // 🎯 Pull signInWithDiscord directly from context instead of calling useApp() inside onClick
  const { auth, signInWithDiscord } = useApp();
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    if (auth.isLoading) {
      setStatusMessage('Loading...');
    } else if (auth.user) {
      setStatusMessage(`Signed in as ${auth.user.user_metadata?.username || 'User'} – performances will be saved.`);
    } else {
      setStatusMessage('Not signed in – play freely.');
    }
  }, [auth]);

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        position: 'relative',
        overflow: 'hidden',
        color: '#fff',
      }}
    >
      {/* Top Status Bar */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: '0.5rem 1rem',
        fontSize: '0.75rem',
        fontFamily: 'monospace',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        zIndex: 1000,
      }}>
        <span>{statusMessage}</span>
        {!auth.isLoading && !auth.user && (
          <button
            onClick={signInWithDiscord}
            style={{
              padding: '0.25rem 0.5rem',
              backgroundColor: '#00ff66',
              color: '#000',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.75rem',
              fontWeight: 'bold',
            }}
          >
            Sign in with Discord
          </button>
        )}
      </div>

      {/* Main Content */}
      {children}
    </div>
  );
}