# Post or Nah Web App

## Overview
A web application that helps users decide whether to post their photos or not. Users can upload photos, select aesthetic vibes, and get AI-powered feedback on whether to post or not.

## Project Setup (Completed October 15, 2025)

### Technology Stack
- **Frontend**: React 18 + TypeScript + Vite
- **UI Components**: Radix UI, Tailwind CSS, Motion (Framer Motion)
- **Backend**: Express.js + TypeScript
- **Authentication**: Firebase Auth (Google Sign-In)
- **Image Upload**: Cloudinary
- **AI Feedback**: HuggingFace API

### Configuration
- Frontend runs on port 5000 (0.0.0.0 for Replit proxy compatibility)
- Backend runs on port 3001 (localhost only)
- Vite configured with proxy to forward `/api` requests to backend
- Firebase authentication configured with hardcoded config

### Environment Variables
The following environment variables are optional but needed for full backend functionality:

**Cloudinary (for image uploads):**
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

**HuggingFace (for AI feedback):**
- `HUGGINGFACE_API_KEY`
- `HUGGINGFACE_MODEL` (optional, defaults to microsoft/DialoGPT-medium)

**Backend Port:**
- `BACKEND_PORT` (optional, defaults to 3001)

### Project Structure
```
/
├── src/
│   ├── components/       # React components
│   │   ├── ui/          # Reusable UI components (Radix)
│   │   └── figma/       # Figma-specific components
│   ├── context/         # React Context (Auth)
│   ├── pages/           # Page components
│   ├── lib/             # Utilities (Cloudinary)
│   ├── styles/          # Global styles
│   ├── App.tsx          # Main app component
│   ├── main.tsx         # Entry point
│   └── firebaseConfig.ts # Firebase configuration
├── server.ts            # Express backend server
├── vite.config.ts       # Vite configuration
└── package.json         # Dependencies
```

### Features
- **Photo Upload & Analysis**: Upload photos and get AI feedback
- **Multiple Aesthetic Vibes**: Choose from various aesthetic categories
- **Free Tier**: 15 free photo checks
- **Premium Tier**: Unlimited checks (demo mode)
- **Google Authentication**: Sign in with Google

### Recent Changes
- Configured Vite to serve on port 5000 with host 0.0.0.0
- Added proxy configuration for backend API calls
- Set backend to run on port 3001
- Fixed lucide-react source map corruption
- Fixed TypeScript type issues in server.ts and main.tsx

### Running the App

**Frontend (Already Running):**
The Frontend workflow is configured to run `npm run dev` on port 5000. The app is ready to use!

**Backend (Optional - for API features):**
To enable backend features (image uploads, AI feedback), you need to:
1. Set the required environment variables (Cloudinary and HuggingFace API keys)
2. Run the backend server with: `npm run backend`
   - The backend will start on port 3001
   - Frontend proxy will forward `/api` requests to the backend

### Notes
- Backend API features are optional - the frontend works independently
- Backend features require environment variables to be set (see Environment Variables section)
- Firebase config is embedded (not using environment variables)
- App uses localStorage for tracking free tier usage
- The frontend can be used without the backend (UI and authentication will work)
