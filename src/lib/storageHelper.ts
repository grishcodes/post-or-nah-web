/**
 * Safe storage utilities that gracefully handle restricted environments:
 * - Private/Incognito browsing (Safari, Chrome, Firefox)
 * - Strict privacy settings (India, Bahamas, GDPR regions)
 * - Storage quota exceeded
 * - Cross-site tracking restrictions
 */

type StorageType = 'localStorage' | 'sessionStorage' | 'memory';

class SafeStorage {
  private memoryStore: Map<string, string> = new Map();
  private storageType: StorageType = 'memory';
  private initialized = false;

  constructor() {
    this.detectStorage();
  }

  /**
   * Detects which storage mechanism is available
   */
  private detectStorage(): void {
    // Try localStorage first (most persistent)
    if (this.isStorageAvailable('localStorage')) {
      this.storageType = 'localStorage';
      this.initialized = true;
      console.log('✅ Storage: Using localStorage');
      return;
    }

    // Fallback to sessionStorage
    if (this.isStorageAvailable('sessionStorage')) {
      this.storageType = 'sessionStorage';
      this.initialized = true;
      console.log('⚠️ Storage: Using sessionStorage (data will be cleared on tab close)');
      return;
    }

    // Final fallback to in-memory storage
    this.storageType = 'memory';
    this.initialized = true;
    console.log('⚠️ Storage: Using in-memory storage (Safari private mode, strict privacy, or quota exceeded)');
  }

  /**
   * Tests if a storage type is actually available
   * Some browsers report availability but throw errors on use (e.g., Safari private mode)
   */
  private isStorageAvailable(type: StorageType | string): boolean {
    try {
      const storage = type === 'localStorage' 
        ? window.localStorage 
        : type === 'sessionStorage' 
        ? window.sessionStorage 
        : null;

      if (!storage) return false;

      // Try to actually write and delete to verify it works
      const testKey = '__storage_test__';
      storage.setItem(testKey, 'test');
      const value = storage.getItem(testKey);
      storage.removeItem(testKey);

      return value === 'test';
    } catch (e) {
      // Any error means storage is not available (quota exceeded, disabled, private mode, etc.)
      return false;
    }
  }

  /**
   * Set an item in the available storage
   */
  setItem(key: string, value: string): boolean {
    try {
      if (this.storageType === 'memory') {
        this.memoryStore.set(key, value);
        return true;
      }

      const storage = this.storageType === 'localStorage' 
        ? window.localStorage 
        : window.sessionStorage;

      storage.setItem(key, value);
      return true;
    } catch (e: any) {
      // Handle quota exceeded or other errors
      console.warn(`Failed to set storage item "${key}":`, e.message);
      
      // If we failed and aren't in memory mode, fall back to memory
      if (this.storageType !== 'memory') {
        console.log('Falling back to in-memory storage');
        this.storageType = 'memory';
        this.memoryStore.set(key, value);
      }
      return false;
    }
  }

  /**
   * Get an item from the available storage
   */
  getItem(key: string): string | null {
    try {
      if (this.storageType === 'memory') {
        return this.memoryStore.get(key) ?? null;
      }

      const storage = this.storageType === 'localStorage' 
        ? window.localStorage 
        : window.sessionStorage;

      return storage.getItem(key);
    } catch (e) {
      console.warn(`Failed to get storage item "${key}":`, e);
      return null;
    }
  }

  /**
   * Remove an item from storage
   */
  removeItem(key: string): void {
    try {
      if (this.storageType === 'memory') {
        this.memoryStore.delete(key);
        return;
      }

      const storage = this.storageType === 'localStorage' 
        ? window.localStorage 
        : window.sessionStorage;

      storage.removeItem(key);
    } catch (e) {
      console.warn(`Failed to remove storage item "${key}":`, e);
    }
  }

  /**
   * Clear all items from storage
   */
  clear(): void {
    try {
      if (this.storageType === 'memory') {
        this.memoryStore.clear();
        return;
      }

      const storage = this.storageType === 'localStorage' 
        ? window.localStorage 
        : window.sessionStorage;

      storage.clear();
    } catch (e) {
      console.warn('Failed to clear storage:', e);
    }
  }

  /**
   * Get the current storage type being used
   */
  getStorageType(): StorageType {
    return this.storageType;
  }

  /**
   * Check if storage is persistent (localStorage) or temporary
   */
  isPersistent(): boolean {
    return this.storageType === 'localStorage';
  }
}

// Export singleton instance
export const storage = new SafeStorage();

/**
 * Hook-friendly wrapper for getting storage type info
 */
export function useStorageInfo() {
  return {
    type: storage.getStorageType(),
    isPersistent: storage.isPersistent(),
    isMemoryOnly: storage.getStorageType() === 'memory',
  };
}
