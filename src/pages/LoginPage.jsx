import React, { useState } from 'react';
import { Button } from '../components/ui/button';
import { signInWithGoogle } from '../firebaseConfig';

export default function LoginPage() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      const user = await signInWithGoogle();
      console.log('Signed in user:', user);
      // Optionally redirect or update state here; App listens to auth state
    } catch (err) {
      console.error(err);
      setError('Failed to sign in with Google. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-300 to-blue-800 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white/5 backdrop-blur-sm rounded-2xl shadow-xl p-6">
        <h1 className="text-2xl font-bold text-white text-center mb-6">Post or Nah</h1>

        <div className="space-y-4">
          <input
            type="email"
            placeholder="Enter your email"
            className="w-full px-4 py-3 rounded-lg bg-white/10 text-white placeholder:text-blue-100 outline-none focus:ring-2 focus:ring-blue-400"
          />

          <input
            type="password"
            placeholder="Enter your password"
            className="w-full px-4 py-3 rounded-lg bg-white/10 text-white placeholder:text-blue-100 outline-none focus:ring-2 focus:ring-blue-400"
          />

          <Button
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
            onClick={handleGoogleSignIn}
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Sign in with Google'}
          </Button>

          {error && <p className="text-sm text-red-300 text-center">{error}</p>}

          <p className="text-sm text-blue-100 text-center">
            Don’t have an account? <span className="text-white underline">Sign up</span>
          </p>
        </div>
      </div>
    </div>
  );
}
