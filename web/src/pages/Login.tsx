/**
 * Login Component
 * 
 * This is the landing page of RealLeads.ai.
 * It provides Google OAuth authentication via Supabase.
 * 
 * Flow:
 * 1. User clicks "Sign in with Google"
 * 2. Supabase opens Google OAuth popup
 * 3. User authenticates with Google
 * 4. Google redirects to /auth/callback
 * 5. AuthCallback component processes the authentication
 */

import { supabase } from '../lib/supabaseClient';

/**
 * Login Component
 * 
 * Displays the login interface with Google OAuth button.
 * 
 * IMPORTANT: This is a DEFAULT export (no curly braces in import)
 * Matches: import Login from './pages/Login'
 */
export default function Login() {
  /**
   * Handle Google Sign In
   * 
   * Initiates the OAuth flow with Google via Supabase.
   * 
   * Process:
   * - Calls supabase.auth.signInWithOAuth()
   * - Provider: 'google'
   * - Redirect URL: /auth/callback (where OAuth returns after authentication)
   */
  const handleGoogleSignIn = async () => {
    // Get the current URL to construct the redirect URL
    const redirectUrl = `${window.location.origin}/auth/callback`;
    
    console.log('Initiating Google sign-in with redirect:', redirectUrl);
    
    // Start OAuth flow with Supabase
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        // After Google auth, redirect back to our callback handler
        redirectTo: redirectUrl,
      },
    });

    // Handle any errors from Supabase
    if (error) {
      console.error('Error signing in with Google:', error);
      alert('Failed to sign in with Google. Please try again.');
    }
  };

  /**
   * Render the Login UI
   * 
   * Simple centered layout with:
   * - App title
   * - Subtitle/description
   * - Google sign-in button
   */
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      backgroundColor: '#1a202c',
      color: '#fff',
    }}>
      {/* App title */}
      <h1 style={{ marginBottom: '10px' }}>RealLeads Admin</h1>
      
      {/* Subtitle */}
      <p style={{ marginBottom: '40px', color: '#a0aec0' }}>
        Sign in with your Google account to access the dashboard.
      </p>
      
      {/* Google OAuth button */}
      <button
        onClick={handleGoogleSignIn}
        style={{
          padding: '12px 24px',
          fontSize: '16px',
          backgroundColor: '#fff',
          color: '#1a202c',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          fontWeight: '600',
        }}
      >
        Sign in with Google
      </button>
    </div>
  );
}