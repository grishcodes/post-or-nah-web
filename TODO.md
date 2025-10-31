# Post or Nah - Development TODO

## ✅ Completed
- [x] Clean up codebase - removed unused backend files (src/server.js, server.js, src/pages/api/)
- [x] Consolidate to single backend (server.ts with Google Vertex AI)
- [x] Configure Vite proxy in `vite.config.ts` to forward `/api` to backend
- [x] Update `src/components/UploadScreen.tsx` fetch logic with fallback URLs
- [x] Document complete project structure and setup in README.md

## 🔧 Current Issues to Fix

### High Priority
- [ ] **Fix Google Cloud authentication** - "AI model could not be reached" error
  - Verify service account permissions (Vertex AI User role)
  - Confirm Vertex AI API is enabled in Google Cloud project
  - Test credentials file path resolution
  - Add detailed error logging to identify root cause

### Medium Priority
- [ ] **Test complete flow** from upload to result display
- [ ] **Implement actual payment processing** for premium subscriptions (currently mock)
- [ ] **Add rate limiting** to prevent API abuse
- [ ] **Add image size/format validation** before upload

### Low Priority
- [ ] Add loading states and better error messages throughout UI
- [ ] Implement logout functionality in UI
- [ ] Add analytics tracking for user interactions
- [ ] Create production deployment configuration

## 🚀 Feature Enhancements
- [ ] Add image cropping/editing before analysis
- [ ] Support batch photo uploads
- [ ] Add photo history/gallery for logged-in users
- [ ] Implement social sharing of results
- [ ] Add dark mode support

## 📝 Documentation
- [ ] Add API documentation for backend endpoints
- [ ] Create deployment guide for production
- [ ] Add troubleshooting guide with common errors
