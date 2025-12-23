import { useState, useEffect } from 'react';
import { auth } from '../firebaseConfig';
import { User } from 'firebase/auth';

interface UserSubscription {
  checksUsed: number;
  creditsBalance: number;
  isPremium: boolean;
  subscriptionEndDate?: Date;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export function useUserSubscription(user: User | null) {
  const [subscription, setSubscription] = useState<UserSubscription>({
    checksUsed: 0,
    creditsBalance: 0,
    isPremium: false,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch user subscription data from backend
  const fetchSubscription = async () => {
    if (!user) {
      setSubscription({ checksUsed: 0, creditsBalance: 0, isPremium: false });
      setLoading(false);
      return;
    }

    try {
      const token = await user.getIdToken();
      const response = await fetch(`${API_URL}/api/user/subscription`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch subscription data');
      }

      const data = await response.json();
      setSubscription({
        checksUsed: data.checksUsed,
        creditsBalance: data.creditsBalance || 0,
        isPremium: data.isPremium,
        subscriptionEndDate: data.subscriptionEndDate ? new Date(data.subscriptionEndDate) : undefined,
      });
      setError(null);
    } catch (err) {
      console.error('Error fetching subscription:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      // Fallback to localStorage for backwards compatibility
      const saved = localStorage.getItem('postOrNahChecks');
      if (saved) {
        setSubscription({ checksUsed: parseInt(saved, 10), creditsBalance: 0, isPremium: false });
      }
    } finally {
      setLoading(false);
    }
  };

  // Increment check count on backend
  const incrementCheck = async () => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    try {
      const token = await user.getIdToken();
      const response = await fetch(`${API_URL}/api/user/increment-check`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to increment check');
      }

      const data = await response.json();
      setSubscription({
        checksUsed: data.checksUsed,
        creditsBalance: data.creditsBalance || 0,
        isPremium: data.isPremium,
        subscriptionEndDate: data.subscriptionEndDate ? new Date(data.subscriptionEndDate) : undefined,
      });
      
      // Also update localStorage for backwards compatibility
      localStorage.setItem('postOrNahChecks', data.checksUsed.toString());
    } catch (err) {
      console.error('Error incrementing check:', err);
      // Fallback to localStorage
      setSubscription(prev => {
        const newChecks = prev.checksUsed + 1;
        localStorage.setItem('postOrNahChecks', newChecks.toString());
        return { ...prev, checksUsed: newChecks };
      });
    }
  };

  // Update premium status (DEPRECATED - kept for backwards compatibility only)
  const updatePremium = async (isPremium: boolean, stripeCustomerId?: string, subscriptionEndDate?: Date) => {
    if (!user) {
      console.error('❌ updatePremium: No user');
      throw new Error('User not authenticated');
    }

    console.log('⚠️  updatePremium is deprecated and will not work unless called by an admin');
    console.log('🚀 updatePremium called for:', user.uid);
    console.log('📧 User email:', user.email);

    try {
      // Force fresh token to avoid 401 errors
      console.log('🔑 Getting fresh token...');
      const token = await user.getIdToken(true);
      console.log('✅ Got token (first 30 chars):', token.substring(0, 30) + '...');
      
      console.log('📡 Sending request to:', `${API_URL}/api/user/update-premium`);
      const response = await fetch(`${API_URL}/api/user/update-premium`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isPremium,
          stripeCustomerId,
          subscriptionEndDate: subscriptionEndDate?.toISOString(),
        }),
      });

      if (!response.ok) {
        let detail = '';
        try {
          const txt = await response.text();
          detail = txt ? `: ${txt}` : '';
        } catch {}
        // Include status for better client-side handling (e.g., 403)
        throw new Error(`HTTP ${response.status} Failed to update premium status${detail}`);
      }

      const data = await response.json();
      setSubscription({
        checksUsed: data.checksUsed,
        creditsBalance: data.creditsBalance || 0,
        isPremium: data.isPremium,
        subscriptionEndDate: data.subscriptionEndDate ? new Date(data.subscriptionEndDate) : undefined,
      });
    } catch (err) {
      console.error('Error updating premium status:', err);
      throw err;
    }
  };

  // Fetch on mount and when user changes
  useEffect(() => {
    fetchSubscription();
  }, [user]);

  return {
    ...subscription,
    loading,
    error,
    incrementCheck,
    updatePremium,
    refetch: fetchSubscription,
  };
}
