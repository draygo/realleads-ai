// web/src/pages/AuthCallback.tsx
// -----------------------------------------------------------------------------
// OAuth callback landing page for Supabase + Google login.
//
// Flow:
// 1. Supabase redirects the browser back to this route after Google login.
// 2. We read the URL to find either:
//    - An `access_token` in the hash (implicit flow), OR
//    - A `code` in the query string (PKCE flow).
// 3. We hand that data to Supabase (`setSession` or `exchangeCodeForSession`)
//    to establish a client-side session.
// 4. We call the backend `/api/auth/provision` route so the server can
//    create/update the `agents` row for this email.
// 5. On success, we redirect to `/dashboard`; on failure we go back to `/`.
// -----------------------------------------------------------------------------

import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

export const AuthCallback: React.FC = () => {
  const navigate = useNavigate();

  // Guard to avoid running the effect twice in React 18 Strict Mode (dev only).
  const hasRunRef = useRef(false);

  useEffect(() => {
    if (hasRunRef.current) {
      console.log('[AuthCallback] Effect already ran, skipping duplicate.');
      return;
    }
    hasRunRef.current = true;

    const handleCallback = async () => {
      try {
        console.group('[AuthCallback]');

        console.log('[AuthCallback] Mounted');
        console.log('[AuthCallback] Current URL:', window.location.href);

        // -------------------------------------------------------------------
        // 1. Parse the URL to find auth data (hash or query param).
        // -------------------------------------------------------------------
        const url = new URL(window.location.href);
        const hash = window.location.hash || '';
        console.log('[AuthCallback] Current hash:', hash);

        let session = null;

        // First, try PKCE style: ?code=...
        const code = url.searchParams.get('code');
        if (code) {
          console.log('[AuthCallback] Found ?code in URL – using exchangeCodeForSession');

          const { data, error } = await supabase.auth.exchangeCodeForSession(code);

          if (error) {
            console.error('[AuthCallback] exchangeCodeForSession error:', error);
            throw error;
          }

          session = data.session;
          console.log('[AuthCallback] Session after exchangeCodeForSession:', session);
        } else if (hash.includes('access_token')) {
          // Fallback: implicit flow with #access_token in the hash
          const hashParams = new URLSearchParams(hash.replace('#', ''));

          const accessToken = hashParams.get('access_token') || undefined;
          const refreshToken = hashParams.get('refresh_token') || undefined;

          console.log('[AuthCallback] access_token from hash:', accessToken);
          console.log('[AuthCallback] refresh_token from hash:', refreshToken);

          if (accessToken) {
            console.log('[AuthCallback] Found access_token – calling supabase.auth.setSession');
            const { data, error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

            if (error) {
              console.error('[AuthCallback] setSession error:', error);
              throw error;
            }

            session = data.session;
            console.log('[AuthCallback] Session after callback handling:', session);
          }
        } else {
          // Last resort: see if a session already exists
          console.log('[AuthCallback] No code or access_token – calling getSession');
          const { data, error } = await supabase.auth.getSession();
          if (error) {
            console.error('[AuthCallback] getSession error:', error);
            throw error;
          }
          session = data.session;
          console.log('[AuthCallback] Session from getSession:', session);
        }

        if (!session) {
          console.warn('[AuthCallback] No Supabase session – redirecting back to login');
          console.groupEnd();
          navigate('/', { replace: true });
          return;
        }

        // Also log the "current session" from a separate call, just to be sure.
        const currentSessionResult = await supabase.auth.getSession();
        console.log(
          '[AuthCallback] getSession() confirmation:',
          currentSessionResult.data.session
        );

        // -------------------------------------------------------------------
        // 2. Load the Supabase user (we need email to provision).
        // -------------------------------------------------------------------
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) {
          console.error('[AuthCallback] getUser error:', userError);
          throw userError;
        }

        console.log('[AuthCallback] Supabase user:', user);

        if (!user || !user.email) {
          console.error('[AuthCallback] Missing user or email – redirecting to login');
          console.groupEnd();
          navigate('/', { replace: true });
          return;
        }

        // -------------------------------------------------------------------
        // 3. Call backend /api/auth/provision
        // -------------------------------------------------------------------
        // After we’ve confirmed the Supabase session and have `user`
        // this is the provisioning call:
        try {
          console.log('[AuthCallback] Calling /api/auth/provision…');

          const provisionResponse = await fetch('/api/auth/provision', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              email: user.email,
              supabase_user_id: user.id,
            }),
          });

          console.log(
            '[AuthCallback] /api/auth/provision status:',
            provisionResponse.status
          );

          // Try to read as text first (500s often aren’t JSON)
          const rawText = await provisionResponse.text();
          console.log(
            '[AuthCallback] Raw /api/auth/provision response text:',
            rawText || '(empty)'
          );

          let parsed: any = null;
          try {
            parsed = rawText ? JSON.parse(rawText) : null;
          } catch {
            console.warn(
              '[AuthCallback] Could not parse JSON from /api/auth/provision'
            );
          }
          console.log('[AuthCallback] Parsed /api/auth/provision JSON:', parsed);

          // 🔥 SOFT-FAIL LOGIC:
          if (!provisionResponse.ok) {
            console.warn(
              '[AuthCallback] Provisioning FAILED – status:',
              provisionResponse.status,
              'body:',
              parsed
            );
            // Instead of sending you back to "/", just log it and continue.
          }
        } catch (err) {
          console.error(
            '[AuthCallback] Unexpected error calling /api/auth/provision:',
            err
          );
          // Also treat this as non-blocking.
        }

        // ✅ In ALL cases (success *or* failure) go to the dashboard:
        console.log('[AuthCallback] Navigating to /dashboard');
        navigate('/dashboard', { replace: true });


        // Read raw text so we can log it even if it's not valid JSON.
        const rawText = await provisionResponse.text();
        console.log('[AuthCallback] Raw /api/auth/provision response text:', rawText);

        let parsed: any = null;
        if (rawText) {
          try {
            parsed = JSON.parse(rawText);
          } catch (parseErr) {
            console.warn(
              '[AuthCallback] Could not parse JSON from /api/auth/provision:',
              parseErr
            );
          }
        }

        console.log('[AuthCallback] Parsed /api/auth/provision JSON:', parsed);

        if (!provisionResponse.ok) {
          console.error(
            '[AuthCallback] Provisioning FAILED – status:',
            status,
            'body:',
            parsed
          );
          // For now, send the user back to login; later we can show a nicer error page.
          console.groupEnd();
          navigate('/', { replace: true });
          return;
        }

        console.log('[AuthCallback] Provisioning succeeded – redirecting to /dashboard');
        console.groupEnd();
        navigate('/dashboard', { replace: true });
      } catch (err) {
        console.error('[AuthCallback] Unexpected error in callback handler:', err);
        console.groupEnd();
        navigate('/', { replace: true });
      }
    };

    void handleCallback();
  }, [navigate]);

  // Very simple loading UI – you should only see this for a moment.
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '1.25rem',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
      }}
    >
      Finishing sign-in…
    </div>
  );
};
