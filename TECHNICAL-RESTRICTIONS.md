# Technical Restrictions Preventing OAuth in Storage-Partitioned Environments

## The 3 Core Restrictions

### 1. **SessionStorage Partitioning (Third-Party Cookie Blocking)**

**What it is:**
- Modern browsers (Safari, Chrome with Privacy Sandbox, etc.) partition storage by top-level domain
- In Instagram's in-app WebView, storage is additionally partitioned by the parent app

**Why it breaks OAuth:**
```
Step 1: App stores auth state in sessionStorage
  → sessionStorage at: https://yourapp.com/
  
Step 2: Redirect to Google auth
  → sessionStorage at: https://accounts.google.com/
  → Original app's sessionStorage is inaccessible!

Step 3: Google redirects back to your app
  → sessionStorage at: https://yourapp.com/
  → BUT the state we stored in Step 1 is now gone!
```

**The Fix:** Store state on the backend (server-side) instead. The server's memory is not partitioned.

---

### 2. **Cross-Origin Storage Access Restrictions**

**What it is:**
- Browsers enforce Same-Origin Policy: JavaScript from origin A cannot access storage from origin B
- OAuth inherently crosses origins:
  - Your app (origin: yourapp.com)
  - Google Auth (origin: accounts.google.com)

**Why it breaks OAuth:**
```
OAuth Flow:
1. yourapp.com stores state in its sessionStorage
2. Redirect to accounts.google.com
   ↓
3. User authenticates, Google redirects back to yourapp.com
   ↓
4. Try to read state from sessionStorage...
   ❌ ERROR: Cannot access sessionStorage!
   
   Problem: The browser switched origins, and each origin has its own storage
```

**Real browser behavior:**
- In normal browsers, popup windows share context (somewhat)
- In storage-partitioned environments (Instagram), even popup windows can't share storage
- Redirect flow **always** loses state because you're literally switching domains

**The Fix:** Use the backend as a shared state store. Both origins (yourapp.com and accounts.google.com) can communicate with yourapp.com's backend via HTTPS.

---

### 3. **Storage Inaccessibility in Privacy Modes**

**What it is:**
- Safari Private Mode, Chrome Incognito, Firefox Private Browsing block/clear sessionStorage
- Some regions (GDPR, India, etc.) enforce strict privacy settings that disable storage
- Instagram's WebView intentionally blocks cross-site storage

**Why it breaks OAuth:**
```
Firebase's signInWithRedirect tries:
1. Write state to sessionStorage
   ↓
2. sessionStorage is blocked/cleared
   ↓
3. Redirect happens anyway
   ↓
4. Try to read state from sessionStorage
   ❌ ERROR: "missing initial state"
   
The state was never written because storage is unavailable
```

**The Fix:** Don't rely on client-side storage at all. The backend has persistent memory (or database) that works regardless of browser privacy settings.

---

## How the Fix Works

### Before: Client-Side OAuth (Firebase SDK Default)
```
Browser (Client)               Firebase SDK              Google
    |                              |                        |
    |--signInWithRedirect()-------->|                        |
    |                              |--stores state in---------|
    |                              |  sessionStorage         |
    |                              |                        |
    |                              |--redirect to Google---->|
    |                              |                        |
    |<--Google redirects back-----<-getRedirectResult()-----|
    |  reads state from sessionStorage (NOW BLOCKED!)       |
    ❌ FAILS: "missing initial state"
```

### After: Server-Side OAuth (Our Fix)
```
Browser (Client)         Your Backend          Google
    |                        |                    |
    |--POST /api/oauth/init->|                    |
    |                        |--stores state---->|
    |                        |  in memory         |
    |<--returns authUrl------<-                   |
    |                        |                    |
    |--redirect to Google---------------------->|
    |                        |                    |
    |<--Google redirects back with code----------|
    |--POST /api/oauth/callback + code + state-->|
    |                        |--verifies state---|
    |                        |  (in backend      |
    |                        |   memory)         |
    |<--returns ID token-----<-                   |
    |                        |                    |
    ✅ SUCCESS: Works everywhere!
```

---

## Why This Works Everywhere

| Environment | Popup | Client Redirect | Server OAuth |
|------------|-------|-----------------|--------------|
| Chrome (normal) | ✅ | ✅ | ✅ |
| Chrome (incognito) | ✅ | ❌ (no storage) | ✅ |
| Safari (normal) | ✅ | ⚠️ (partitioned) | ✅ |
| Safari (private) | ✅ | ❌ (no storage) | ✅ |
| Firefox (normal) | ✅ | ✅ | ✅ |
| Firefox (private) | ✅ | ❌ (no storage) | ✅ |
| **Instagram app** | ❌ | ❌ (partitioned) | ✅ |
| **Facebook app** | ❌ | ❌ (partitioned) | ✅ |
| **TikTok app** | ❌ | ❌ (partitioned) | ✅ |
| WeChat browser | ⚠️ | ❌ (restricted) | ✅ |
| Brave shields on | ✅ | ⚠️ | ✅ |

---

## Key Implementation Details

### State Storage on Backend
```typescript
// In-memory storage (works for single server)
const oauthStateStore = new Map<string, OAuthState>();

// For production with multiple servers, upgrade to:
// - Redis
// - Database
// - Distributed cache
```

### State Expiry
```typescript
// States expire after 10 minutes
// Prevents abuse and reduces memory usage
// Automatic cleanup every 60 seconds
```

### Verification Flow
```
1. Client creates OAuth init request
2. Backend creates state (random 32 chars)
3. Backend stores: state → { nonce, createdAt, expiresAt }
4. Backend returns authUrl with state param
5. User authorizes on Google
6. Google redirects: /auth/callback?code=...&state=...
7. Backend verifies: state exists and not expired
8. Backend exchanges code for token
9. State is deleted (one-time use)
10. Token returned to client
```

---

## The Trade-off

**What we gain:**
- ✅ Works in 100% of browsers
- ✅ Works in all privacy modes
- ✅ Works in Instagram, Facebook, WeChat, TikTok in-app browsers
- ✅ Better security (state not exposed to client)

**What we need:**
- Backend endpoint for OAuth state management
- Backend OAuth integration with Google
- One additional API call (state init)

**Performance impact:**
- Negligible (one extra round trip before redirect)
- Still faster than failed auth + user retry

---

## References

- [OAuth 2.0 RFC 6749](https://tools.ietf.org/html/rfc6749) - State parameter purpose
- [Safari ITP 2.0](https://webkit.org/blog/8828/intelligent-tracking-prevention-2-0/) - Storage partitioning
- [Chrome Privacy Sandbox](https://developer.chrome.com/docs/privacy-sandbox/) - Third-party cookie deprecation
- [Firebase Documentation](https://firebase.google.com/docs/auth) - SDK limitations in restricted environments

