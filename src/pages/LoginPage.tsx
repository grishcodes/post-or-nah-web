import React, { useState } from 'react';
import { signInWithGoogle } from '../firebaseConfig';
import { useNavigate, Link } from 'react-router-dom';
import appIcon from '../assets/4aa122b285e3e6a8319c5a3638bb61ba822a9ec8.png';
import { useEffect } from 'react';

export default function LoginPage(): React.JSX.Element {
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const navigate = useNavigate();

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      const user = await signInWithGoogle();
      console.log('Signed in user:', user);
      // Redirect to home after successful sign-in
      navigate('/');
    } catch (err) {
      console.error(err);
      setError('Failed to sign in with Google. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const [logoVisible, setLogoVisible] = useState(false);

  useEffect(() => {
    // slight delay so transition feels natural
    const t = setTimeout(() => setLogoVisible(true), 80);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="min-h-screen overflow-hidden flex items-center justify-center px-6" style={{ background: 'var(--deep-bg)', position: 'relative' }}>
      <div className="orb orb-1 top-[-140px] left-[-120px] opacity-80" />
      <div className="orb orb-2 bottom-[-100px] right-[-120px] opacity-70" style={{ animationDelay: '5s' }} />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_30%,rgba(124,58,237,0.14),transparent)] pointer-events-none" />

      <div className="relative z-10 w-full max-w-xs">
        <Link to="/" aria-label="Home" className="block">
          <img
            src={appIcon}
            alt="Post or Nah"
            className={`h-14 w-14 rounded-2xl mx-auto mb-6 shadow-[0_8px_40px_rgba(124,58,237,0.55)] transition-opacity duration-500 ${
              logoVisible ? 'opacity-100' : 'opacity-0'
            }`}
          />
        </Link>
        <div className="glass rounded-2xl p-6">
          <h1 className="text-2xl font-bold gradient-text text-center mb-6">Post or Nah</h1>

          <div className="space-y-4">
            <button
              className="btn-primary w-full py-4 text-base font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleGoogleSignIn}
              disabled={loading}
            >
              <span className="relative z-10">{loading ? 'Signing in…' : 'Sign in with Google'}</span>
            </button>

            {error && <p className="text-sm text-red-300/90 text-center bg-red-500/10 border border-red-500/20 rounded-xl p-3">{error}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
