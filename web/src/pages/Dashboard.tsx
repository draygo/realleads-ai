// web/src/pages/Dashboard.tsx
// -------------------------------------------------------------
// Simple placeholder dashboard for RealLeads Admin.
//
// Purpose:
// - Display that the user is logged in.
// - Show basic Supabase user info for debugging.
// - Provide a "Sign out" button.
//
// This page is rendered after a successful OAuth callback +
// backend provisioning (see AuthCallback.tsx).
// -------------------------------------------------------------

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

interface SupabaseUser {
  id: string;
  email?: string;
  [key: string]: any;
}

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  // On mount, fetch the current Supabase user.
  // If there is no user, we kick back to login.
  useEffect(() => {
    const loadUser = async () => {
      console.log('[Dashboard] Mounted – fetching Supabase user…');

      const { data, error } = await supabase.auth.getUser();

      if (error) {
        console.error('[Dashboard] getUser error:', error);
        setLoading(false);
        return;
      }

      if (!data.user) {
        console.warn('[Dashboard] No Supabase user – redirecting to /');
        setLoading(false);
        navigate('/', { replace: true });
        return;
      }

      console.log('[Dashboard] Supabase user:', data.user);
      setUser(data.user as SupabaseUser);
      setLoading(false);
    };

    loadUser();
  }, [navigate]);

  // Sign-out handler
  const handleSignOut = async () => {
    console.log('[Dashboard] Signing out…');
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('[Dashboard] signOut error:', error);
    }
    navigate('/', { replace: true });
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <p>Loading dashboard…</p>
      </div>
    );
  }

  if (!user) {
    // We already redirected in the effect, this is just a safety net.
    return (
      <div style={styles.container}>
        <p>No user found. Redirecting to login…</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>RealLeads Admin – Dashboard</h1>

      <div style={styles.card}>
        <h2>Welcome 👋</h2>
        <p>
          <strong>Signed in as:</strong> {user.email || '(no email on record)'}
        </p>

        <button style={styles.button} onClick={handleSignOut}>
          Sign out
        </button>
      </div>

      <div style={styles.debugCard}>
        <h3>Debug: Raw Supabase user</h3>
        <pre style={styles.pre}>{JSON.stringify(user, null, 2)}</pre>
      </div>
    </div>
  );
};

// Basic inline styles so we don't depend on any CSS yet
const styles: { [key: string]: React.CSSProperties } = {
  container: {
    minHeight: '100vh',
    padding: '40px',
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
    backgroundColor: '#fafafa',
  },
  title: {
    textAlign: 'center',
    marginBottom: '24px',
  },
  card: {
    maxWidth: '480px',
    margin: '0 auto 24px',
    padding: '24px',
    backgroundColor: '#fff',
    borderRadius: '12px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
  },
  button: {
    marginTop: '16px',
    padding: '10px 16px',
    borderRadius: '8px',
    border: 'none',
    cursor: 'pointer',
  },
  debugCard: {
    maxWidth: '800px',
    margin: '0 auto',
    padding: '16px',
    backgroundColor: '#111',
    color: '#0f0',
    borderRadius: '8px',
    fontSize: '12px',
  },
  pre: {
    margin: 0,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
};
