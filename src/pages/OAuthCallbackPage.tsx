import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { signInWithCustomToken } from 'firebase/auth';
import { auth } from '../firebaseConfig';

export default function OAuthCallbackPage(): React.JSX.Element {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [error, setError] = useState<string>('');
  const [status, setStatus] = useState<string>('Processing authentication...');

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const code = searchParams.get('code');
        const state = searchParams.get('state');

        if (!code || !state) {
          setError('Missing authorization code or state parameter');
          return;
        }

        // Verify the state parameter matches what we stored
        const savedState = sessionStorage.getItem('oauth_state_pending');
        if (savedState !== state) {
          setError('State parameter mismatch. This might indicate a security issue.');
          return;
        }

        setStatus('Exchanging authorization code...');

        // Exchange the authorization code for tokens on the backend
        const backendUrl = import.meta.env.VITE_BACKEND_URL || window.location.origin;
        const callbackResponse = await fetch(`${backendUrl}/api/oauth/callback`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, state }),
        });

        if (!callbackResponse.ok) {
          const error = await callbackResponse.json();
          throw new Error(error.error || 'Failed to complete OAuth');
        }

        const { idToken } = await callbackResponse.json();

        setStatus('Signing in with Firebase...');

        // Use the ID token to sign in with Firebase
        // Note: This requires Firebase to be configured to accept Google ID tokens
        // For a more robust solution, use a custom Firebase token or implement Firebase's signInWithIdp
        try {
          // Option 1: If your backend can create custom Firebase tokens
          // const customTokenResponse = await fetch(`${backendUrl}/api/auth/custom-token`, {
          //   method: 'POST',
          //   headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
          // });
          // const { token } = await customTokenResponse.json();
          // await signInWithCustomToken(auth, token);

          // Option 2: Redirect to Firebase's custom sign-in endpoint
          // For now, we'll store the token and let Firebase handle it client-side
          localStorage.setItem('google_id_token', idToken);
          
          // Clean up
          sessionStorage.removeItem('oauth_state_pending');

          setStatus('Authentication successful! Redirecting...');
          
          // Give a brief moment for the status message to show, then redirect
          setTimeout(() => {
            navigate('/');
          }, 1000);
        } catch (firebaseError) {
          console.error('Firebase sign-in error:', firebaseError);
          setError('Failed to sign in with Firebase. Please try again.');
        }
      } catch (err) {
        console.error('OAuth callback error:', err);
        setError(err instanceof Error ? err.message : 'An error occurred during authentication');
      }
    };

    handleCallback();
  }, [searchParams, navigate]);

  // If already logged in, redirect immediately
  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  return (
    <div className="min-h-screen overflow-hidden flex items-center justify-center px-6" style={{ background: 'var(--deep-bg)', position: 'relative' }}>
      <div className="orb orb-1 top-[-140px] left-[-120px] opacity-80" />
      <div className="orb orb-2 bottom-[-100px] right-[-120px] opacity-70" style={{ animationDelay: '5s' }} />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_30%,rgba(124,58,237,0.14),transparent)] pointer-events-none" />

      <div className="relative z-10 w-full max-w-xs">
        <div className="glass rounded-2xl p-6">
          <h1 className="text-2xl font-bold gradient-text text-center mb-6">Post or Nah</h1>

          {error ? (
            <div className="text-center">
              <p className="text-sm text-red-300/90 mb-4">{error}</p>
              <a href="/login" className="btn-primary inline-block py-3 px-6 text-sm font-semibold">
                <span className="relative z-10">Back to Login</span>
              </a>
            </div>
          ) : (
            <div className="text-center">
              <div className="mb-4">
                <div className="inline-block w-8 h-8 rounded-full border-2 border-white/20 border-t-white animate-spin-smooth" />
              </div>
              <p className="text-white/70 text-sm">{status}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
