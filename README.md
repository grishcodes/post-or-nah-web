# 📸 Post or Nah Web App

A web application that helps you decide whether to post your photos on social media. Get instant AI-powered feedback based on different aesthetic cores using Google Vertex AI (Gemini).

## 🎯 Features

- **AI Photo Analysis**: Upload photos and get "Post ✅" or "Nah ❌" verdicts with suggestions
- **Vibe Categories**: Aesthetic core, Classy core, Rizz core, Matcha core, Baddie vibe
- **Google Authentication**: Sign in with Google via Firebase
- **Free Tier**: 3 free photo checks per month
- **Premium Upgrade**: Unlimited checks for $9/month (demo mode)

## 🛠️ Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite 6** for fast development and builds
- **Tailwind CSS** for styling
- **Radix UI** for accessible components
- **Motion** (Framer Motion) for animations
- **Firebase** for Google authentication

### Backend
- **Node.js** with **Express 5**
- **TypeScript** compilation
- **Google Cloud Vertex AI** (Gemini 1.5 Flash) for image analysis
- **CORS** enabled for cross-origin requests

## 📋 Prerequisites

1. **Node.js** 18+ installed
2. **Google Cloud Project** with:
   - Vertex AI API enabled
   - Service account with Vertex AI User role
   - Service account key JSON file downloaded as `gcloud-credentials.json`
3. **Firebase Project** configured for Google authentication

## 🚀 Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the project root:

```env
# Google Cloud Vertex AI
GCLOUD_PROJECT="your-project-id"
GCLOUD_LOCATION="us-central1"
GOOGLE_APPLICATION_CREDENTIALS="gcloud-credentials.json"

# Backend Server Port
BACKEND_PORT=3001
```

### 3. Add Google Cloud Credentials

Place your Google Cloud service account key file in the project root as `gcloud-credentials.json`.

**To create a service account key**:
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select your project
3. Navigate to **IAM & Admin** → **Service Accounts**
4. Create a new service account or select existing
5. Grant **Vertex AI User** role
6. Create and download JSON key
7. Save as `gcloud-credentials.json` in project root

### 4. Configure Firebase

Update `src/firebaseConfig.ts` with your Firebase project credentials.

## 🏃 Running the Application

You need to run **both** the backend and frontend servers:

### Terminal 1 - Backend Server (Port 3001)

```bash
npm run backend
```

This compiles `server.ts` and starts the Express server.

Expected output:
```
🚀 Backend server running at http://localhost:3001
```

### Terminal 2 - Frontend Dev Server (Port 5000)

```bash
npm run dev
```

Expected output:
```
VITE v6.3.7  ready in 524 ms
➜  Local:   http://localhost:5000/
```

### Open the App

Visit **http://localhost:5000** in your browser.

## 📦 Available Scripts

- `npm run dev` - Start Vite development server (frontend)
- `npm run backend` - Build and start backend server
- `npm run build:frontend` - Build frontend for production
- `npm run build:backend` - Compile TypeScript backend to JavaScript

## 🔧 How It Works

### User Flow
1. User opens app → **SplashScreen** with "Get Started"
2. Click "Login with Google" → Firebase authentication
3. **UploadScreen**: Upload photo + select 1-2 vibe categories
4. Click "Check This Photo" → Frontend sends base64 image to backend
5. Backend calls **Gemini API** with image and prompt
6. Gemini analyzes photo and returns verdict + suggestion
7. **ResultScreen** displays AI feedback
8. User can try another photo or upgrade to premium after 3 checks

### API Flow
```
Frontend (Port 5000)
    ↓ POST /api/feedback
Vite Proxy
    ↓ Forward to localhost:3001
Backend Express Server (Port 3001)
    ↓ Call Vertex AI API
Google Cloud Gemini 1.5 Flash
    ↓ Return analysis
Backend formats response
    ↓ JSON: {verdict, suggestion, raw}
Frontend displays result
```

## 📁 Project Structure

```
post-or-nah-web/
├── src/
│   ├── components/       # React UI components
│   │   ├── SplashScreen.tsx
│   │   ├── UploadScreen.tsx
│   │   ├── ResultScreen.tsx
│   │   ├── SubscriptionScreen.tsx
│   │   └── ui/           # Reusable UI components (Radix)
│   ├── context/          # React context (AuthContext)
│   ├── assets/           # Images and static files
│   ├── App.tsx           # Main app logic and routing
│   ├── main.tsx          # React entry point
│   ├── firebaseConfig.ts # Firebase initialization
│   └── index.css         # Global styles
├── server.ts             # Express backend (Google Vertex AI)
├── vite.config.ts        # Vite configuration + proxy
├── tsconfig.json         # TypeScript config (frontend)
├── tsconfig.node.json    # TypeScript config (backend)
├── package.json          # Dependencies and scripts
├── .env                  # Environment variables (git-ignored)
└── gcloud-credentials.json  # Google Cloud key (git-ignored)
```

## 🐛 Troubleshooting

### "ECONNREFUSED" or "Proxy error"
**Cause**: Backend server isn't running
**Solution**: Start backend with `npm run backend` in a separate terminal

### "AI model could not be reached"
**Causes**:
1. Google Cloud credentials missing or invalid
2. Vertex AI API not enabled in Google Cloud project
3. Service account lacks Vertex AI User role
4. Wrong project ID or location in `.env`

**Solutions**:
- Verify `gcloud-credentials.json` exists in project root
- Check `.env` has correct `GCLOUD_PROJECT` and `GCLOUD_LOCATION`
- Enable Vertex AI API in [Google Cloud Console](https://console.cloud.google.com/apis/library/aiplatform.googleapis.com)
- Verify service account permissions in IAM & Admin

### Backend startup errors
**Check**:
- Node.js version (18+)
- All dependencies installed (`npm install`)
- `.env` file exists with all required variables
- Port 3001 is not already in use

### HEIC uploads (iPhone photos)
- The app supports HEIC batches by attempting a browser-side conversion to JPEG.
- If conversion fails (browser limitations), the original HEIC is uploaded and the backend attempts conversion.
- If “Pick Best Photo” fails in production, try exporting the images as JPG/PNG or reduce the number/size of images.

## 🔐 Security Notes

- **Never commit** `.env` or `gcloud-credentials.json` to version control
- Both files are already in `.gitignore`
- Rotate API keys if accidentally exposed
- Use environment variables in production deployments

## 📝 License

Private project - All rights reserved

## 👨‍💻 Development

Built with ❤️ using React, TypeScript, and Google Gemini AI

## 🚀 Deployment (Frontend + Backend)

### Backend: Google Cloud Run

Deploy the Express server using the included Dockerfile.

1. Install Google Cloud SDK and login:

```
gcloud auth login
gcloud config set project pon-app-final
```

2. Deploy to Cloud Run (uses `.env.cloud`):

```
gcloud run deploy post-or-nah-web \
    --source . \
    --region europe-west1 \
    --allow-unauthenticated \
    --env-vars-file .env.cloud \
    --timeout 180s \
    --cpu 1 \
    --memory 1Gi
```

Notes:
- The service listens on port `3001` (Cloud Run maps it automatically).
- `GOOGLE_APPLICATION_CREDENTIALS` points to `/app/gcloud-credentials.json` inside the container; alternatively use a service account with Vertex AI permissions.

### Frontend: Vercel

The app is a static build served from `build/` and uses `vercel.json` to proxy `/api/*` to Cloud Run.

1. Install Vercel CLI and login:

```
npm i -g vercel
vercel login
```

2. Set production env vars in the Vercel project:
- `VITE_API_URL=https://post-or-nah-web-gpg2j4io3q-ew.a.run.app`
- `VITE_BACKEND_URL=https://post-or-nah-web-gpg2j4io3q-ew.a.run.app`

3. Deploy:

```
vercel --prod
```

### Troubleshooting
- If the frontend shows “Failed to fetch”, verify the Vercel env matches the Cloud Run hostname and that `vercel.json` rewrites `/api/*` correctly.
- The `Find Best Photo` flow tries multiple endpoints and prints all targets in the error message.
