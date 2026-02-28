import { useState } from 'react';
import { signInWithGoogle } from '../firebaseConfig';
import appIcon from '../assets/4aa122b285e3e6a8319c5a3638bb61ba822a9ec8.png';

interface SplashScreenProps {
  onComplete: () => void;
}

export function SplashScreen({ onComplete }: SplashScreenProps) {
  const [step, setStep] = useState<'start' | 'login'>('start');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleStart = () => {
    // reveal the Google login CTA in-place
    setStep('login');
  };

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      await signInWithGoogle();
      // onAuthStateChanged in App will move the flow forward
    } catch (err: any) {
      console.error('Google sign-in failed', err);
      // Use the user-friendly message from firebaseConfig if available
      const userMessage = err instanceof Error 
        ? err.message 
        : 'Failed to sign in with Google. Please try again.';
      setError(userMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen relative overflow-hidden flex flex-col items-center justify-center px-6"
      style={{ background: 'var(--deep-bg)' }}
    >
      {/* Ambient orbs */}
      <div className="orb orb-1 top-[-140px] left-[-120px] opacity-80" />
      <div className="orb orb-2 bottom-[-100px] right-[-120px] opacity-70" style={{ animationDelay: '5s' }} />
      <div className="orb orb-3 top-[45%] right-[5%] opacity-60" style={{ animationDelay: '9s' }} />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_30%,rgba(124,58,237,0.14),transparent)] pointer-events-none" />

      {/* Centered stack */}
      <div className="relative z-10 w-full max-w-xs flex flex-col items-center" style={{ gap: '2rem' }}>

        {/* Logo */}
        <div className="relative animate-scale-in">
          <div className="absolute inset-[-14px] rounded-[2rem] bg-gradient-to-br from-violet-600/30 to-purple-700/20 blur-2xl animate-glow-pulse" />
          <img
            src={appIcon}
            alt="Post or Nah"
            className="relative w-14 h-14 rounded-2xl shadow-[0_8px_40px_rgba(124,58,237,0.55)]"
          />
        </div>

        {/* Wordmark */}
        <h1 className="text-4xl font-black tracking-tight gradient-text leading-none text-center animate-fade-up" style={{ animationFillMode: 'both', margin: 0 }}>
          Post or Nah?
        </h1>

        {/* CTA */}
        <div className="w-full animate-fade-up" style={{ animationDelay: '0.1s', animationFillMode: 'both' }}>
          {step === 'start' ? (
            <button
              onClick={handleStart}
              className="btn-primary w-full py-4 text-base font-semibold"
            >
              <span className="relative z-10">Get Started</span>
            </button>
          ) : (
            <div className="flex flex-col items-center w-full" style={{ gap: '20px' }}>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '16px', fontWeight: 600, letterSpacing: '0.04em', margin: 0 }}>
                Sign in to continue
              </p>
              <button
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full glass-md flex items-center justify-center gap-3 rounded-2xl text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/10 transition-colors"
                style={{ padding: '16px 24px', fontSize: '17px', fontWeight: 700 }}
                aria-busy={loading}
              >
                {loading ? (
                  <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin-smooth" />
                ) : (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                )}
                <span>{loading ? 'Signing in…' : 'Continue with Google'}</span>
              </button>
              {error && (
                <div className="text-sm text-red-300/90 text-center bg-red-500/10 border border-red-500/20 rounded-xl p-3 w-full">
                  {error}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}