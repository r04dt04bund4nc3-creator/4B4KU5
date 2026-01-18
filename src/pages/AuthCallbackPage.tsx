// src/pages/AuthCallbackPage.tsx
import { useEffect } from 'react';
import { useApp } from '../state/AppContext';
import { useNavigate } from 'react-router-dom';

const AuthCallbackPage: React.FC = () => {
  const { auth } = useApp();
  const navigate = useNavigate();

  useEffect(() => {
    // Wait for auth to fully load, then check if user is logged in
    if (!auth.isLoading) {
      if (auth.user) {
        // User is logged in → send them to their Sound Print
        navigate('/result');
      } else {
        // Login failed → send them back to upload
        navigate('/');
      }
    }
  }, [auth.isLoading, auth.user, navigate]);

  // Show loading state while auth finalizes
  if (auth.isLoading) {
    return (
      <div style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#050810',
        color: '#00ff66',
        fontFamily: 'monospace'
      }}>
        <div style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>FINALIZING SESSION</div>
        <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>You will be redirected shortly</div>
      </div>
    );
  }

  return null;
};

export default AuthCallbackPage;