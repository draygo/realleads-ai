// web/src/pages/Login.tsx
import React from 'react';
import { supabase } from '../lib/supabaseClient';

export const Login: React.FC = () => {
  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      console.error('Error signing in with Google:', error.message);
      alert('Error signing in. Please check the console for details.');
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1rem',
      }}
    >
      <h1>RealLeads Admin</h1>
      <p>Sign in with your Google account to access the dashboard.</p>
      <button onClick={handleGoogleLogin}>Sign in with Google</button>
    </div>
  );
};
