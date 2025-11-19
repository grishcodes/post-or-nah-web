import admin from 'firebase-admin';
import { Auth } from 'firebase-admin/auth';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  const serviceAccountPath = path.resolve(process.cwd(), 'gcloud-credentials.json');
  let serviceAccount: any = null;
  try {
    const raw = fs.readFileSync(serviceAccountPath, 'utf8');
    serviceAccount = JSON.parse(raw);
  } catch (e) {
    console.error('❌ Failed to load service account JSON at', serviceAccountPath, e);
    throw e;
  }
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  console.log('✅ Firebase Admin initialized');
  console.log('🔎 Loaded service account project_id:', serviceAccount.project_id);
  console.log('🔎 GCLOUD_PROJECT env:', process.env.GCLOUD_PROJECT);
}

export const db = admin.firestore();
export const auth: Auth = admin.auth();

// User subscription data interface
export interface UserData {
  uid: string;
  email: string | null;
  checksUsed: number;
  isPremium: boolean;
  stripeCustomerId?: string;
  subscriptionEndDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Get or create user data
export async function getUserData(uid: string): Promise<UserData> {
  const userRef = db.collection('users').doc(uid);
  let doc;
  try {
    doc = await userRef.get();
  } catch (e: any) {
    console.error('❌ Firestore get() failed getUserData uid=', uid, e.message || e);
    throw e;
  }
  if (doc.exists) {
    return doc.data() as UserData;
  }
  const now = new Date();
  const newUser: UserData = {
    uid,
    email: null,
    checksUsed: 0,
    isPremium: false,
    createdAt: now,
    updatedAt: now,
  };
  try {
    await userRef.set(newUser);
  } catch (e: any) {
    console.error('❌ Firestore set() failed creating user uid=', uid, e.message || e);
    throw e;
  }
  return newUser;
}

// Increment checks used
export async function incrementChecksUsed(uid: string): Promise<UserData> {
  const userRef = db.collection('users').doc(uid);
  try {
    await userRef.update({
      checksUsed: admin.firestore.FieldValue.increment(1),
      updatedAt: new Date(),
    });
  } catch (e: any) {
    console.error('❌ Firestore update() failed incrementChecksUsed uid=', uid, e.message || e);
    throw e;
  }
  const updated = await userRef.get();
  return updated.data() as UserData;
}

// Update premium status
export async function updatePremiumStatus(
  uid: string,
  isPremium: boolean,
  stripeCustomerId?: string,
  subscriptionEndDate?: Date
): Promise<UserData> {
  const userRef = db.collection('users').doc(uid);
  const updates: Partial<UserData> = {
    isPremium,
    updatedAt: new Date(),
  };
  if (stripeCustomerId) updates.stripeCustomerId = stripeCustomerId;
  if (subscriptionEndDate) updates.subscriptionEndDate = subscriptionEndDate;
  try {
    await userRef.set(updates, { merge: true });
  } catch (e: any) {
    console.error('❌ Firestore set() failed updatePremiumStatus uid=', uid, e.message || e);
    throw e;
  }
  const updated = await userRef.get();
  return updated.data() as UserData;
}

// Reset checks (admin function)
export async function resetChecks(uid: string): Promise<UserData> {
  const userRef = db.collection('users').doc(uid);
  try {
    await userRef.update({
      checksUsed: 0,
      updatedAt: new Date(),
    });
  } catch (e: any) {
    console.error('❌ Firestore update() failed resetChecks uid=', uid, e.message || e);
    throw e;
  }
  const updated = await userRef.get();
  return updated.data() as UserData;
}

// Add credits to user (from Stripe purchase)
export async function addCreditsToUser(uid: string, credits: number, source: string = 'purchase'): Promise<UserData> {
  console.log(`🪙 Adding ${credits} credits to user ${uid} from ${source}`);
  
  const userRef = db.collection('users').doc(uid);
  
  try {
    // For now, any credit purchase makes user premium
    // Later we could add creditsBalance field for more sophisticated tracking
    await userRef.update({
      isPremium: true,
      checksUsed: 0, // Reset their check count as a bonus
      updatedAt: new Date(),
    });
    
    console.log(`✅ Successfully added ${credits} credits to user ${uid}`);
  } catch (e: any) {
    console.error('❌ Firestore update() failed addCreditsToUser uid=', uid, e.message || e);
    throw e;
  }
  
  const updated = await userRef.get();
  return updated.data() as UserData;
}
