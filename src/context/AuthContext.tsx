import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth } from '../firebaseConfig';
import { onAuthStateChanged, signOut as firebaseSignOut, getRedirectResult, User } from 'firebase/auth';

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Handle redirect result from sign-in redirect (mobile)
    const handleRedirect = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result?.user) {
          console.log('User signed in via redirect:', result.user);
          setUser(result.user);
        }
      } catch (error: any) {
        // Only log errors that aren't related to missing state
        // (missing state might be normal if page was just loaded)
        if (!error.message?.includes('missing initial state')) {
          console.error('Error handling redirect result:', error);
        }
      }
    };

    handleRedirect();

    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
