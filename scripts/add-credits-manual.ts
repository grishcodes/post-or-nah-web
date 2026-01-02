/**
 * Quick script to add credits to a specific user
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

async function addCreditsToUser() {
  const userId = 'IzmJ3ob3iceJzcvHawYfM4nyjhB2';
  const creditsToAdd = 100;

  try {
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      console.error(`❌ User ${userId} not found`);
      process.exit(1);
    }

    const userData = userDoc.data();
    const oldBalance = userData.creditsBalance || 0;
    const newBalance = oldBalance + creditsToAdd;

    // Update user credits
    await userRef.update({
      creditsBalance: newBalance,
      updatedAt: new Date(),
    });

    // Create audit log entry
    await db.collection('audit_logs').add({
      timestamp: new Date(),
      userId,
      action: 'credits_added',
      oldValue: oldBalance,
      newValue: newBalance,
      amount: creditsToAdd,
      reason: 'Manual credit addition by admin',
      source: 'manual',
    });

    console.log(`✅ User ${userId}:`);
    console.log(`   Old balance: ${oldBalance}`);
    console.log(`   Added: ${creditsToAdd}`);
    console.log(`   New balance: ${newBalance}`);
    console.log(`\n✨ Audit log created!`);
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

addCreditsToUser();
