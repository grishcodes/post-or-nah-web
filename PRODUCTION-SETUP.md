# Production Setup Checklist

## ✅ Environment Variables Updated
Your `.env` file has been updated with:

```env
VITE_BACKEND_URL=https://post-or-nah-web-gpg2j4io3q-ew.a.run.app
FRONTEND_URL=https://www.postornah.com
CORS_ORIGIN=https://www.postornah.com
```

## ✅ Favicon Updated
Your app icon now displays in the browser tab (instead of globe icon):
- Created: `public/favicon.svg`
- Updated: `index.html` with SVG favicon link

## ⚠️ Google OAuth Configuration (REQUIRED)

You need to complete this for the Instagram OAuth fix to work:

### 1. Get OAuth Credentials from Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select your project: `pon-app-final`
3. Go to **APIs & Services** → **Credentials**
4. Create OAuth 2.0 credential:
   - Type: **Web application**
   - Name: "Post or Nah - Production"
    - Add authorized origins:
       - `https://www.postornah.com`
       - `https://post-or-nah-web-gpg2j4io3q-ew.a.run.app`
   - Add authorized redirect URIs:
   - `https://post-or-nah-web-gpg2j4io3q-ew.a.run.app/api/oauth/callback`

5. Download credentials (JSON) and copy:
   - `client_id` → `GOOGLE_OAUTH_CLIENT_ID` in `.env`
   - `client_secret` → `GOOGLE_OAUTH_CLIENT_SECRET` in `.env`

### 2. Update Your .env File

Replace these in your `.env`:

```env
GOOGLE_OAUTH_CLIENT_ID="your_oauth_client_id.apps.googleusercontent.com"
GOOGLE_OAUTH_CLIENT_SECRET="your_oauth_client_secret"
```

### 3. Redeploy to Cloud Run

After updating `.env`:

```bash
gcloud run deploy post-or-nah-web \
   --source . \
   --region europe-west1 \
   --env-vars-file .env.cloud
```

Or via the Cloud Console UI.

## 📱 Testing the OAuth Fix

1. **Share link in Instagram**
   - Go to your app: https://www.postornah.com
   - Click "Sign in with Google"
   - Should now work in Instagram's in-app browser! ✅

2. **Test in Safari Private Mode**
   - Open in Safari private browsing
   - Click "Sign in with Google"
   - Should work (previously failed)

3. **Test in Chrome/Firefox**
   - Should work as before with popup

## 🔗 Your Production URLs

- **Frontend**: https://www.postornah.com
- **Backend API**: https://post-or-nah-web-gpg2j4io3q-ew.a.run.app
- **OAuth Callback**: https://post-or-nah-web-gpg2j4io3q-ew.a.run.app/api/oauth/callback

## 📝 What Changed

1. **Server-side OAuth flow** added to backend (`server.ts`)
   - `/api/oauth/init` - Initialize OAuth
   - `/api/oauth/callback` - Handle OAuth callback

2. **Client-side OAuth fallback** added (`src/firebaseConfig.ts`)
   - Detects storage-partitioned environments (Instagram, Safari private, etc.)
   - Falls back to server-side OAuth when needed

3. **OAuth Callback page** created (`src/pages/OAuthCallbackPage.tsx`)
   - Handles redirect from Google
   - Exchanges auth code for tokens
   - Signs in with Firebase

4. **Favicon** updated
   - Now shows your app icon in the browser tab

## 🔒 Security Notes

- OAuth state tokens expire after 10 minutes
- States are stored in-memory on the backend (single server)
- For multiple servers, use Redis or a database
- Keep `GOOGLE_OAUTH_CLIENT_SECRET` secure (never commit to git)

## ❓ Still Have Issues?

If Instagram OAuth still fails after setup:

1. Verify `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET` are correct
2. Check that Cloud Run environment variables are set correctly
3. Look at Cloud Run logs: `gcloud run logs post-or-nah-web --region europe-west1`
4. Verify the redirect URI matches exactly: `https://post-or-nah-web-251339844808.europe-west1.run.app/api/oauth/callback`

