# 💳 Pricing System Documentation

## Overview
The app now uses a **credit-based pricing system** with 3 tiers: Starter, Creator, and Pro.

---

## 🎯 Pricing Tiers

### Free Tier
- **Credits:** 3 free generations
- **Cost:** Free
- **Behavior:** After using all 3 credits, users see the pricing page

### Starter Plan
- **Credits:** 20 image generations
- **Cost:** $4.99 (one-time)
- **Description:** "Great for casual creators."
- **Features:**
  - One-time payment
  - No expiration
  - Full quality outputs

### Creator Plan ⭐ Most Popular
- **Credits:** 50 image generations
- **Cost:** $9.99 (one-time)
- **Description:** "Best value for regular users."
- **Features:**
  - One-time payment
  - No expiration
  - Priority processing

### Pro Plan
- **Credits:** Unlimited (999,999 internally)
- **Cost:** $24.99/month (subscription)
- **Description:** "Unlimited access for professionals."
- **Features:**
  - Unlimited generations
  - Monthly subscription
  - Cancel anytime
  - Premium support

---

## 🔄 User Flow

1. **New User**
   - Starts with 3 free credits
   - Each image generation deducts 1 credit
   
2. **Credit Depletion**
   - When credits reach 0, user cannot generate images
   - Pricing page automatically displays
   
3. **Plan Purchase**
   - User selects a plan
   - Credits are added to their account
   - Plan name is displayed in the UI
   
4. **Active User**
   - Credits remaining shown on upload screen
   - Current plan badge displayed (if not Free)
   - Plan indicator badge in top-left corner

---

## 💾 Data Storage

### LocalStorage Keys
- `postOrNahCredits` - Integer (remaining credits)
- `postOrNahPlan` - String (Free/Starter/Creator/Pro)

### State Management (App.tsx)
```typescript
const [credits, setCredits] = useState(3);
const [currentPlan, setCurrentPlan] = useState<string>('Free');
```

---

## 🎨 UI/UX Design

### Color Palette
- **Background:** Slate-50 to Slate-100 gradient
- **Cards:** White with soft shadows
- **Primary CTA:** Blue-600 (Creator plan)
- **Secondary CTA:** Slate-800
- **Accents:** Green-600 for checkmarks

### Typography
- **Headers:** Bold, Slate-800
- **Body:** Slate-600/700
- **Prices:** Large, Slate-900

### Layout
- **Desktop:** 3-column grid
- **Mobile:** Stacked cards
- **Spacing:** Generous padding (p-8)
- **Corners:** Rounded-2xl
- **Animations:** Smooth fade/scale with Framer Motion

### Badges
- "Most Popular" badge on Creator plan (top-right)
- Plan indicator badge (top-left of app) when user has paid plan

---

## 🛠️ Component Structure

### PricingPlans.tsx
- **Props:**
  - `onSelectPlan: (planName: string, credits: number) => void`
  - `onClose: () => void`
- **Features:**
  - Displays 3 pricing cards
  - Handles plan selection
  - Close button for navigation

### App.tsx
- **Credit Logic:**
  - Deducts 1 credit per generation
  - Shows pricing page when credits = 0
  - Updates plan and credits on purchase
  
### UploadScreen.tsx
- **Display:**
  - Shows remaining credits
  - Shows current plan name (if not Free)

---

## 🔮 Future Enhancements

### Payment Integration
- Integrate Stripe or similar payment processor
- Real transaction handling
- Subscription management for Pro plan

### Backend Integration
- Store credits in database (Firebase/PostgreSQL)
- Sync across devices
- Prevent client-side manipulation

### Analytics
- Track conversion rates
- Monitor popular plans
- A/B test pricing

### Features
- Gift credits
- Referral bonuses
- Team/enterprise plans
- Usage analytics dashboard

---

## 📝 Notes
- Currently in **demo mode** - purchases show alert and update state
- Credits are stored in localStorage (client-side only)
- Pro plan uses 999,999 credits internally for "unlimited" representation
