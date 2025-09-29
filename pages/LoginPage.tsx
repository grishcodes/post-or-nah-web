import React, { useState } from 'react';
import { Button } from '../components/ui/button';
import { signInWithGoogle } from '../firebaseConfig';
import { useNavigate, Link } from 'react-router-dom';
import appIcon from '../assets/4aa122b285e3e6a8319c5a3638bb61ba822a9ec8.png';
import { useEffect } from 'react';

export default function LoginPage(): JSX.Element {
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
    <div className="min-h-screen bg-gradient-to-b from-blue-300 to-blue-800 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <Link to="/" aria-label="Home" className="block">
          <img
            src={appIcon}
            alt="Post or Nah"
            className={`max-h-[18px] md:max-h-[24px] w-auto mx-auto mb-4 transition-opacity duration-500 ${
              logoVisible ? 'opacity-100' : 'opacity-0'
            }`}
          />
        </Link>
        <div className="bg-white/5 backdrop-blur-sm rounded-2xl shadow-xl p-6">
          <h1 className="text-2xl font-bold text-white text-center mb-6">Post or Nah</h1>

          <div className="space-y-4">
          <Button
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg"
            onClick={handleGoogleSignIn}
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Sign in with Google'}
          </Button>

          {error && <p className="text-sm text-red-300 text-center">{error}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
