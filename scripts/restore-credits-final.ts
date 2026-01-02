/**
 * FINAL CREDITS RESTORATION + AUDIT LOGGING SETUP
 * 1. Restores all users to 3 credits (free tier)
 * 2. Restores 2 specific users to 20 credits
 * 3. Creates audit log entries for all changes
 */

import admin from 'firebase-admin';
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

// Special users who get 20 credits instead of 3
const specialUsers = [
  'XgjSoQujFmSNFXkqw7a6yHhJGC82',
  'PISfa1fkCEhesGxjYecSxYDwZOB3'
];

async function restoreAllCredits() {
  console.log('🔄 Starting comprehensive credits restoration...\n');
  
  let restoredCount = 0;
  let errorCount = 0;
  const now = new Date();

  try {
    // Get all users
    console.log('📥 Fetching all users...');
    const usersSnapshot = await db.collection('users').get();
    console.log(`✅ Found ${usersSnapshot.docs.length} users\n`);

    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      const oldBalance = userDoc.data().creditsBalance || 0;
      
      // Determine new credit amount
      const newBalance = specialUsers.includes(userId) ? 20 : 3;

      try {
        // Update user credits
        await userDoc.ref.update({
          creditsBalance: newBalance,
          isPremium: false,
          updatedAt: new Date(),
        });

        // Create audit log entry
        await db.collection('audit_logs').add({
          timestamp: now,
          userId,
          action: 'credits_restored',
          oldBalance,
          newBalance,
          reason: 'Manual restoration due to migration bug',
          isSpecialCase: specialUsers.includes(userId),
        });

        const marker = specialUsers.includes(userId) ? '⭐' : '  ';
        console.log(`${marker} Restored ${userId}: ${oldBalance} → ${newBalance} credits`);
        restoredCount++;
      } catch (err: any) {
        console.error(`❌ Error updating ${userId}:`, err.message);
        errorCount++;
      }
    }

    console.log(`\n📊 Restoration Summary:`);
    console.log(`   ✅ Restored: ${restoredCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log(`   ⭐ Special cases (20 credits): ${specialUsers.length}`);
    console.log(`\n✨ Credits restoration complete!`);
  } catch (err) {
    console.error('❌ Fatal error:', err);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

// Run the restoration
restoreAllCredits();
