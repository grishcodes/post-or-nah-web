/**
 * CREDITS RESTORATION SCRIPT
 * Restores all users to their correct credit balance based on Stripe subscriptions
 * This fixes the bug where the migration code corrupted premium user credits
 */

import admin from 'firebase-admin';
import Stripe from 'stripe';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();

// Initialize Firebase Admin
if (!admin.apps.length) {
  const serviceAccountPath = path.resolve(process.cwd(), 'gcloud-credentials.json');
  
  if (fs.existsSync(serviceAccountPath)) {
    const raw = fs.readFileSync(serviceAccountPath, 'utf8');
    const serviceAccount = JSON.parse(raw);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } else {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: process.env.GCLOUD_PROJECT
    });
  }
}

const db = admin.firestore();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2025-10-29.clover' });

// Map Stripe price IDs to credit amounts
const priceIdToCredits: Record<string, number> = {
  'price_1Skb33Fvu58DRDkCqEOvW03I': 10,       // $1 Pre Start
  'price_1SiPpnFvu58DRDkCWZQENIqt': 50,       // $5 Starter
  'price_1SiPqIFvu58DRDkC7UQP8hiJ': 200,      // $12 Pro (old variant)
  'price_1SiRKCFvu58DRDkCGoZeG8Er': 200,      // $12 Pro
  'price_1SiPqnFvu58DRDkCWwdway9a': 999999,   // $25 Unlimited
};

interface UserData {
  uid: string;
  email?: string;
  creditsBalance: number;
  isPremium: boolean;
  subscriptionId?: string;
  [key: string]: any;
}

async function restoreCredits() {
  console.log('🔄 Starting credits restoration...\n');
  
  let restoredCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  try {
    // Get all Stripe subscriptions
    console.log('📥 Fetching Stripe subscriptions...');
    const subscriptions = await stripe.subscriptions.list({
      status: 'active',
      limit: 100,
    });

    console.log(`✅ Found ${subscriptions.data.length} active Stripe subscriptions\n`);

    for (const subscription of subscriptions.data) {
      const userId = subscription.metadata?.userId;
      const priceId = subscription.items.data[0]?.price?.id;

      console.log(`\n📌 Processing subscription ${subscription.id}`);
      console.log(`   User ID: ${userId}`);
      console.log(`   Price ID: ${priceId}`);

      if (!userId) {
        console.log(`⚠️  No userId metadata - skipping`);
        skippedCount++;
        continue;
      }

      let creditAmount = priceId ? priceIdToCredits[priceId] : null;

      if (creditAmount === null) {
        console.log(`⚠️  Unknown price ID "${priceId}"`);
        console.log(`    Available: ${Object.keys(priceIdToCredits).join(', ')}`);
        creditAmount = 0;
      }

      try {
        const userRef = db.collection('users').doc(userId);
        console.log(`   Setting credits to: ${creditAmount}`);
        
        await userRef.update({
          creditsBalance: creditAmount,
          isPremium: creditAmount > 0,
          subscriptionId: subscription.id,
          updatedAt: new Date(),
        });

        console.log(`✅ Restored user ${userId}: ${creditAmount} credits`);
        restoredCount++;
      } catch (err: any) {
        console.error(`❌ Error:`, err.message);
        errorCount++;
      }
    }

    console.log(`\n📊 Restoration Summary:`);
    console.log(`   ✅ Restored: ${restoredCount}`);
    console.log(`   ⚠️  Skipped: ${skippedCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log(`\n✨ Credits restoration complete!`);
  } catch (err) {
    console.error('❌ Fatal error:', err);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

// Run the restoration
restoreCredits();
