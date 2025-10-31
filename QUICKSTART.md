# Quick Start Guide - Post or Nah

## 🚀 First Time Setup (5 minutes)

### 1. Install Dependencies
```bash
npm install
```

### 2. Setup Google Cloud (if not done)
1. Go to https://console.cloud.google.com
2. Create/select project "pon-app-final" (or your project)
3. Enable **Vertex AI API**:
   - Search "Vertex AI API" in APIs & Services
   - Click Enable
4. Create Service Account:
   - IAM & Admin → Service Accounts
   - Create Service Account
   - Grant role: **Vertex AI User**
   - Create key (JSON) → Download as `gcloud-credentials.json`
5. Place `gcloud-credentials.json` in project root

### 3. Configure Environment
Copy `.env.example` to `.env` and fill in your values:
```bash
cp .env.example .env
```

Edit `.env`:
```env
GCLOUD_PROJECT="pon-app-final"          # Your Google Cloud project ID
GCLOUD_LOCATION="us-central1"           # Region (keep as-is)
GOOGLE_APPLICATION_CREDENTIALS="gcloud-credentials.json"
BACKEND_PORT=3001
```

### 4. Configure Firebase (if not done)
Edit `src/firebaseConfig.ts` with your Firebase project credentials from:
https://console.firebase.google.com

---

## 🏃 Running the App (Every Time)

### Terminal 1 - Backend
```bash
npm run backend
```
**Wait for**: `🚀 Backend server running at http://localhost:3001`

### Terminal 2 - Frontend
```bash
npm run dev
```
**Wait for**: `➜  Local:   http://localhost:5000/`

### Open Browser
Go to: **http://localhost:5000**

---

## ✅ Health Check

Test backend is working:
```bash
curl http://localhost:3001/api/health
```

Should return:
```json
{"status":"ok","message":"Backend is running"}
```

---

## 🐛 Common Issues & Fixes

### Issue: "ECONNREFUSED" in Vite
**Cause**: Backend not running  
**Fix**: Start backend in Terminal 1 (`npm run backend`)

### Issue: "AI model could not be reached"
**Causes & Fixes**:
1. **Missing credentials file**
   - Check: `Test-Path gcloud-credentials.json` returns True
   - Fix: Download service account key from Google Cloud

2. **Vertex AI API not enabled**
   - Fix: https://console.cloud.google.com/apis/library/aiplatform.googleapis.com
   - Click "Enable"

3. **Service account lacks permissions**
   - Fix: Go to IAM & Admin → IAM
   - Find your service account email
   - Add role: **Vertex AI User**

4. **Wrong project ID in .env**
   - Check: Open `gcloud-credentials.json`
   - Verify `"project_id"` matches `GCLOUD_PROJECT` in `.env`

### Issue: Port 3001 already in use
**Fix**: Change `BACKEND_PORT` in `.env` to another port (e.g., 3002)
Also update `vite.config.ts` proxy target to match

### Issue: Google login fails
**Fix**: 
1. Check Firebase console for correct configuration
2. Verify domain is authorized in Firebase Auth settings
3. For localhost: Add `localhost` to authorized domains

---

## 📦 File Checklist

Before running, ensure you have:
- ✅ `.env` file (from `.env.example`)
- ✅ `gcloud-credentials.json` (from Google Cloud)
- ✅ `node_modules/` (run `npm install`)
- ✅ Firebase configured in `src/firebaseConfig.ts`

---

## 🔑 Environment Variables Explained

| Variable | Example | Purpose |
|----------|---------|---------|
| `GCLOUD_PROJECT` | `"pon-app-final"` | Your Google Cloud project ID |
| `GCLOUD_LOCATION` | `"us-central1"` | Google Cloud region for Vertex AI |
| `GOOGLE_APPLICATION_CREDENTIALS` | `"gcloud-credentials.json"` | Path to service account key |
| `BACKEND_PORT` | `3001` | Port for Express backend server |

---

## 🎯 What Each Command Does

| Command | What It Does |
|---------|--------------|
| `npm install` | Installs all dependencies |
| `npm run dev` | Starts Vite frontend dev server (port 5000) |
| `npm run backend` | Builds and starts backend server (port 3001) |
| `npm run build:frontend` | Builds React app for production |
| `npm run build:backend` | Compiles TypeScript backend to JavaScript |

---

## 📊 Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│  Browser: http://localhost:5000                         │
│  ┌───────────────────────────────────────────────────┐  │
│  │  React App (Vite Dev Server)                      │  │
│  │  - Upload photo                                    │  │
│  │  - Select vibes                                    │  │
│  │  - Display results                                 │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                          ↓ POST /api/feedback
┌─────────────────────────────────────────────────────────┐
│  Vite Proxy (configured in vite.config.ts)             │
│  Forwards /api/* → http://localhost:3001/api/*         │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  Express Backend: http://localhost:3001                 │
│  ┌───────────────────────────────────────────────────┐  │
│  │  server.ts (TypeScript)                           │  │
│  │  - Receives image (base64)                        │  │
│  │  - Prepares Gemini prompt                         │  │
│  │  - Calls Google Vertex AI API                     │  │
│  │  - Returns verdict + suggestion                   │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                          ↓ API Request
┌─────────────────────────────────────────────────────────┐
│  Google Cloud Vertex AI                                 │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Gemini 1.5 Flash Model                           │  │
│  │  - Analyzes image                                 │  │
│  │  - Returns JSON with verdict and suggestion       │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## 🎓 Next Steps

1. **Test the app**: Upload a photo and verify you get AI feedback
2. **Check logs**: Look at Terminal 1 (backend) for any errors
3. **If errors persist**: See README.md "Troubleshooting" section
4. **Deploy to production**: See TODO.md for deployment tasks

---

## 💡 Tips

- Keep both terminals open while developing
- Backend Terminal 1 shows API call logs
- Frontend Terminal 2 shows build/hot reload logs
- Press `Ctrl+C` in each terminal to stop servers
- Changes to `server.ts` require restarting backend (`npm run backend`)
- Changes to React files hot-reload automatically (no restart needed)

---

**Need help?** Check the main README.md for detailed documentation.
