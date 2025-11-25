// web/src/App.tsx
// Top-level React router for the admin UI.
// - Watches Supabase auth state
// - Redirects unauthenticated users to the Login page
// - Redirects authenticated users to /dashboard

import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { supabase } from './lib/supabaseClient';

import { Login } from './pages/Login';
import { AuthCallback } from './pages/AuthCallback';
import { Dashboard } from './pages/Dashboard';

const App: React.FC = () => {
  const [session, setSession] = useState<ReturnType<typeof supabase.auth.getSession> extends Promise<{ data: { session: infer S } }> ? S : any | null>(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation();

  useEffect(() => {
    console.log('🔄 App.tsx mounted');

    // 1) On startup, check the current session
    const initSession = async () => {
      console.log('🔐 Checking current Supabase session…');
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error) {
        console.error('❌ Error getting session in App.tsx:', error);
      } else {
        console.log('🟢 Current session:', session);
        setSession(session);
      }
      setLoading(false);
    };

    initSession();

    // 2) Subscribe to auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      console.log('📡 Auth state change in App.tsx:', _event, newSession);
      setSession(newSession);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // While we don’t yet know if there is a session, don’t flash the wrong route
  if (loading) {
    return <div>Loading…</div>;
  }

  const isLoggedIn = !!session;

  console.log('📍 Route render, path:', location.pathname, 'isLoggedIn:', isLoggedIn);

  return (
    <Routes>
      {/* Login route:
          - If already logged in, bounce to /dashboard
          - Otherwise show the login screen */}
      <Route
        path="/"
        element={isLoggedIn ? <Navigate to="/dashboard" replace /> : <Login />}
      />

      {/* OAuth callback route */}
      <Route path="/auth/callback" element={<AuthCallback />} />

      {/* Dashboard route:
          - If not logged in, force back to login */}
      <Route
        path="/dashboard"
        element={isLoggedIn ? <Dashboard /> : <Navigate to="/" replace />}
      />

      {/* Catch-all: send unknown routes to root */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;
