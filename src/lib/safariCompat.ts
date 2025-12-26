/**
 * Safari and browser compatibility utilities
 * Handles Safari-specific quirks and private browsing mode
 */

import React from 'react';

export const SafariCompat = {
  /**
   * Check if running in Safari
   */
  isSafari(): boolean {
    return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  },

  /**
   * Check if running in private/incognito mode
   * This is a best-effort check - no foolproof way exists
   */
  isPrivateBrowsing(): Promise<boolean> {
    return new Promise((resolve) => {
      if (!window.indexedDB) {
        resolve(true);
        return;
      }

      try {
        const db = indexedDB.open('__private_browsing_test__');
        db.onerror = () => resolve(true);
        db.onsuccess = () => {
          resolve(false);
          indexedDB.deleteDatabase('__private_browsing_test__');
        };
      } catch {
        resolve(true);
      }
    });
  },

  /**
   * Get browser info for debugging
   */
  getBrowserInfo(): {
    isSafari: boolean;
    userAgent: string;
    version?: string;
  } {
    const ua = navigator.userAgent;
    const isSafari = this.isSafari();
    let version;

    if (isSafari) {
      const match = ua.match(/Version\/([\d.]+)/);
      version = match ? match[1] : undefined;
    }

    return { isSafari, userAgent: ua, version };
  },

  /**
   * Enable credentials for cross-origin requests (Safari requires this)
   */
  enableCredentials(): boolean {
    // Check if credentials mode is required (Safari on iOS)
    return this.isSafari();
  },

  /**
   * Safe fetch wrapper with Safari compatibility
   */
  async safeFetch(
    url: string,
    options?: RequestInit
  ): Promise<Response> {
    const fetchOptions: RequestInit = {
      ...options,
      // Safari requires credentials for CORS requests with cookies
      credentials: 'include',
    };

    try {
      const response = await fetch(url, fetchOptions);

      // Safari sometimes returns 0 status on network errors
      if (response.status === 0 && !response.ok) {
        throw new Error('Network error - Safari may be blocking the request');
      }

      return response;
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        // Safari private mode or CORS issue
        throw new Error(
          'Connection failed. This might be due to: 1) Private browsing mode, ' +
          '2) Strict privacy settings, or 3) Network connectivity. ' +
          'Please try in normal browsing mode.'
        );
      }
      throw error;
    }
  },

  /**
   * Fix for Safari font rendering issues
   */
  applyWebkitFixes(): void {
    if (this.isSafari()) {
      // Fix font smoothing on Safari
      const style = document.createElement('style');
      style.textContent = `
        * {
          -webkit-font-smoothing: antialiased;
          -webkit-text-size-adjust: 100%;
        }
      `;
      document.head.appendChild(style);
    }
  },

  /**
   * Handle Safari viewport issues (especially on notched devices)
   */
  fixViewport(): void {
    if (this.isSafari()) {
      // Add viewport-fit for notched devices
      const metaTag = document.querySelector("meta[name='viewport']");
      if (metaTag) {
        metaTag.setAttribute(
          'content',
          'width=device-width, initial-scale=1.0, viewport-fit=cover'
        );
      }
    }
  },
};

/**
 * React hook for Safari detection and information
 */
export function useSafariCompat() {
  const [isSafari, setIsSafari] = React.useState(false);
  const [isPrivate, setIsPrivate] = React.useState(false);

  React.useEffect(() => {
    setIsSafari(SafariCompat.isSafari());
    SafariCompat.isPrivateBrowsing().then(setIsPrivate);
    SafariCompat.applyWebkitFixes();
    SafariCompat.fixViewport();
  }, []);

  return { isSafari, isPrivate, browserInfo: SafariCompat.getBrowserInfo() };
}

// Auto-apply fixes on import
if (typeof window !== 'undefined') {
  SafariCompat.applyWebkitFixes();
  SafariCompat.fixViewport();
}
