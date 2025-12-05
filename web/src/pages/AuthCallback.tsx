/**
 * AuthCallback Component
 *
 * This page handles the OAuth redirect after Google sign-in.
 * It provisions the user in the backend by:
 * 1. Getting the Supabase session (which includes the access token)
 * 2. Sending the access token to /api/auth/provision
 * 3. Backend creates/updates the agent record in database
 * 4. Redirects to dashboard on success
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

export default function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Function to handle the OAuth callback and provision user
    const handleCallback = async () => {
      try {
        console.log("[AuthCallback] Starting OAuth callback handling...");

        // Get the current session from Supabase
        // This should exist after Google OAuth redirects back
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          console.error("[AuthCallback] Session error:", sessionError);
          setError("Failed to get session: " + sessionError.message);
          return;
        }

        if (!session) {
          console.error("[AuthCallback] No session found");
          setError("No session found. Please try logging in again.");
          // Redirect to login after 2 seconds
          setTimeout(() => navigate("/"), 2000);
          return;
        }

        console.log("[AuthCallback] Session from getSession:", {
          provider_token: session.provider_token?.substring(0, 20) + "...",
          access_token: session.access_token?.substring(0, 20) + "...",
          expires_in: session.expires_in,
          expires_at: session.expires_at,
          refresh_token: session.refresh_token?.substring(0, 20) + "...",
        });

        console.log("[AuthCallback] getSession() confirmation:", {
          provider_token: session.provider_token?.substring(0, 20) + "...",
          access_token: session.access_token?.substring(0, 20) + "...",
          expires_in: session.expires_in,
          expires_at: session.expires_at,
          refresh_token: session.refresh_token?.substring(0, 20) + "...",
        });

        console.log("[AuthCallback] Supabase user:", {
          id: session.user?.id,
          aud: session.user?.aud,
          role: session.user?.role,
          email: session.user?.email,
          email_confirmed_at: session.user?.email_confirmed_at,
        });

        // Extract the access token
        // This is the JWT token that the backend will verify
        const accessToken = session.access_token;

        if (!accessToken) {
          console.error("[AuthCallback] No access token in session");
          setError("No access token found");
          return;
        }

        console.log("[AuthCallback] Calling /api/auth/provision...");

        // Call backend to provision user
        // CRITICAL: We must send the Authorization header with the access token
        const response = await fetch("/api/auth/provision", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            // This is the critical header the backend needs!
            Authorization: `Bearer ${accessToken}`,
          },
        });

        console.log(
          "[AuthCallback] /api/auth/provision status:",
          response.status,
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error("[AuthCallback] Provision failed:", errorText);
          setError(`Provisioning failed: ${response.status} ${errorText}`);
          return;
        }

        // Parse the response
        const data = await response.json();
        console.log(
          "[AuthCallback] Raw /api/auth/provision response text:",
          data,
        );

        console.log("[AuthCallback] Parsed /api/auth/provision JSON:", data);

        if (!data.ok) {
          console.error(
            "[AuthCallback] Provisioning FAILED - status:",
            response.status,
            "body:",
            data,
          );
          setError("Provisioning failed");
          return;
        }

        console.log("[AuthCallback] Provisioning SUCCESS!");
        console.log("[AuthCallback] Navigating to /dashboard");

        // Success! Redirect to dashboard
        navigate("/dashboard");
      } catch (err) {
        console.error(
          "[AuthCallback] Unexpected error in callback handler:",
          err,
        );
        setError(err instanceof Error ? err.message : "Unknown error occurred");
      }
    };

    // Run the callback handler
    handleCallback();
  }, [navigate]);

  // Render loading or error state
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
        flexDirection: "column",
        gap: "20px",
      }}
    >
      {error ? (
        <>
          <h2>Authentication Error</h2>
          <p style={{ color: "red" }}>{error}</p>
          <p>Redirecting to login...</p>
        </>
      ) : (
        <>
          <h2>Completing sign-in...</h2>
          <p>Please wait while we set up your account.</p>
        </>
      )}
    </div>
  );
}
