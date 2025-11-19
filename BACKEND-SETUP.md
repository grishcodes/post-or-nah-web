# Backend Storage Setup Guide

## ✅ What I've Implemented

I've set up a complete backend storage system with Firestore to replace localStorage. Here's what's now in place:

### 1. **Backend Infrastructure** (`firebaseAdmin.ts`)
- Firebase Admin SDK integration
- Firestore database connection
- User data management functions:
  - `getUserData(uid)` - Get or create user record
  - `incrementChecksUsed(uid)` - Track photo checks
  - `updatePremiumStatus(uid, isPremium, ...)` - Manage subscriptions
  - `resetChecks(uid)` - Admin function

### 2. **Server Endpoints** (`server.ts`)
Added new API endpoints:
- `GET /api/user/subscription` - Fetch user's check count and premium status
- `POST /api/user/increment-check` - Increment checks after photo analysis
- `POST /api/user/update-premium` - Update premium status (for Stripe integration)

All endpoints are protected with Firebase token authentication.

### 3. **Frontend Hook** (`src/hooks/useUserSubscription.ts`)
- React hook that manages user subscription state
- Automatically syncs with backend
- Fallback to localStorage for backwards compatibility
- Functions: `incrementCheck()`, `updatePremium()`, `refetch()`

### 4. **Updated App** (`App.tsx`)
- Replaced localStorage with backend calls
- Now properly syncs across devices
- Premium status persists across sessions

---

## 🔧 What You Need to Do

### Step 1: Enable Firestore in Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **pon-app-final**
3. Click **Firestore Database** in the left menu
4. Click **Create Database**
5. Choose **Start in production mode** (we'll add rules next)
6. Select a location (choose **us-east4** to match your region)
7. Click **Enable**

### Step 2: Set Firestore Security Rules

After Firestore is enabled, go to the **Rules** tab and paste this:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read and write their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Admin access (optional - for your backend)
    match /{document=**} {
      allow read, write: if request.auth.token.admin == true;
    }
  }
}
```

Click **Publish** to save the rules.

### Step 3: Test the Backend

1. **Restart your backend server:**
   ```powershell
   # Stop the current server (Ctrl+C)
   # Then restart it:
   npm run server
   ```

2. **Restart your frontend:**
   ```powershell
   # In another terminal
   npm run dev
   ```

3. **Test the flow:**
   - Sign in with Google
   - Upload a photo and get analysis
   - Check the browser console - you should see API calls to `/api/user/subscription` and `/api/user/increment-check`

### Step 4: Verify in Firestore

1. Go back to Firebase Console > Firestore Database
2. You should see a new collection called `users`
3. Inside, you'll see a document with your user ID
4. It should contain:
   - `uid`: Your Firebase user ID
   - `checksUsed`: Number of photos analyzed
   - `isPremium`: false (for now)
   - `createdAt` and `updatedAt`: Timestamps

---

## 📊 Database Structure

Your Firestore database now has this structure:

```
users (collection)
  └── {userId} (document)
      ├── uid: string
      ├── email: string | null
      ├── checksUsed: number
      ├── isPremium: boolean
      ├── stripeCustomerId: string (optional)
      ├── subscriptionEndDate: Date (optional)
      ├── createdAt: Date
      └── updatedAt: Date
```

---

## 🎯 Benefits You Now Have

✅ **Secure Storage** - Data is stored on Firebase, not in browser localStorage  
✅ **User Association** - Each user's checks are tied to their Firebase UID  
✅ **Sync Across Devices** - Sign in on any device and see your check count  
✅ **Premium Status Persists** - Premium status survives browser refresh  
✅ **Backend Verification** - Server can verify if user is actually premium  
✅ **Ready for Stripe** - Backend endpoints ready for payment integration  

---

## 🔜 Next Steps: Stripe Integration

Once this is working, I can add:
1. Stripe checkout flow
2. Webhook handler for payment events
3. Automatic premium status updates
4. Subscription management

Let me know once you've enabled Firestore and I'll help you test it!

---

## 🐛 Troubleshooting

**Error: "Permission denied"**
- Make sure Firestore security rules are set correctly
- Check that you're signed in with Firebase Auth

**Error: "Firebase Admin not initialized"**
- Make sure `gcloud-credentials.json` file exists in your project root
- Check that the service account has Firestore permissions

**Checks not syncing**
- Check browser console for API errors
- Make sure backend server is running on port 3001
- Verify `VITE_API_URL` in `.env` is correct
