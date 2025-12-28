## OAuth Fix for Storage-Partitioned Environments (Instagram, Safari Private Mode, etc.)

### What was the problem?

Your app failed in Instagram's in-app browser and other storage-partitioned environments because Firebase's `signInWithRedirect` requires sessionStorage to store OAuth state. These environments either:
- Block sessionStorage completely
- Partition it per-origin (so auth state becomes inaccessible after redirect)
- Clear it between navigations

### How does the fix work?

The fix implements a **server-side OAuth flow** that:

1. **Client requests OAuth initialization** → `/api/oauth/init`
2. **Backend generates state** and stores it server-side (instead of client-side)
3. **Backend returns Google auth URL** with state parameter
4. **Client redirects to Google** (works everywhere!)
5. **Google redirects back to callback** → `/auth/callback`
6. **Backend exchanges code for tokens** → `/api/oauth/callback`
7. **Client signs in with Firebase** using the returned token

### What files changed?

#### Backend Changes
- **`server.ts`**: Added OAuth state storage and endpoints:
  - `POST /api/oauth/init` - Initialize OAuth flow
  - `POST /api/oauth/callback` - Exchange auth code for tokens
  - Added helper functions: `createOAuthState()`, `getAndValidateOAuthState()`

#### Frontend Changes
- **`src/firebaseConfig.ts`**: 
  - Added `isStoragePartitioned()` - Detects if sessionStorage is unavailable
  - Added `isInstagramBrowser()` - Detects Instagram's in-app browser
  - Added `signInWithServerSideOAuth()` - Implements server-side OAuth flow
  - Updated `signInWithGoogle()` to use server-side OAuth as a fallback

- **`src/pages/OAuthCallbackPage.tsx`** (NEW):
  - Handles the OAuth redirect callback
  - Exchanges auth code for tokens
  - Signs in with Firebase

- **`src/main.tsx`**:
  - Added route for `/auth/callback` (OAuth callback page)
  - Added route for `/login` (if not already there)

### Environment Variables Required

Add these to your `.env` file:

```env
# Frontend
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_bucket.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
VITE_BACKEND_URL=http://localhost:3001  # or your production backend URL

# Backend - OAuth Configuration
GOOGLE_OAUTH_CLIENT_ID=your_oauth_client_id.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=your_oauth_client_secret
FRONTEND_URL=http://localhost:5173  # or your production frontend URL

# Other existing env vars (Stripe, Vertex AI, etc.)
...
```

### How to get Google OAuth credentials?

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create an OAuth 2.0 credential:
   - Type: Web application
   - Add authorized JavaScript origins:
     - `http://localhost:5173` (dev)
     - `http://localhost:3001` (dev backend)
     - Your production domain
   - Add authorized redirect URIs:
     - `http://localhost:3001/api/oauth/callback` (dev)
     - Your production callback URL
3. Download the credentials and copy:
   - `Client ID` → `GOOGLE_OAUTH_CLIENT_ID`
   - `Client Secret` → `GOOGLE_OAUTH_CLIENT_SECRET`

### How does the user experience change?

**Before (Fails in Instagram):**
```
User clicks "Sign in with Google"
→ Popup try (works in most browsers)
→ Popup blocked in Instagram
→ Falls back to redirect
→ Fails: "missing initial state" (Instagram blocks sessionStorage)
```

**After (Works everywhere!):**
```
User clicks "Sign in with Google"
→ Popup try (works in Chrome, Firefox, etc.)
→ Popup blocked in Instagram
→ Detects storage-partitioned environment
→ Uses server-side OAuth flow
→ Redirects to Google (works in Instagram!)
→ Returns with auth token
→ Signs in successfully ✅
```

### Testing the fix

1. **Test in Instagram**: Share your link in Instagram, tap it, try signing in
2. **Test in Safari private mode**: Open in private/incognito and try signing in
3. **Test in Chrome**: Should work as before with popup
4. **Test mobile browsers**: All should work

### What if a browser neither allows popups nor supports the OAuth flow?

The app will show a helpful error message:
- **Instagram users**: "Instagram's browser has restrictions. Please open this link in Chrome, Safari, or Firefox instead."
- **Other storage-partitioned**: "Your browser has storage restrictions. Please try in a standard browser or disable private browsing mode."

### Notes

- State tokens are stored in-memory on the backend and automatically cleaned up after 10 minutes
- For production with multiple servers, use Redis or a database for state storage instead of `Map`
- The OAuth flow requires HTTPS in production (browsers enforce this)
- Make sure CORS is configured correctly on your backend (it already is!)

