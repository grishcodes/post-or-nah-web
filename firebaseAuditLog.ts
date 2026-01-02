/**
 * Audit Log Helper
 * Logs all credit changes, premium status changes, and other important events
 * This creates a permanent audit trail for debugging and accountability
 */

import admin from 'firebase-admin';

export interface AuditLogEntry {
  timestamp: Date;
  userId: string;
  action: 'credits_added' | 'credits_deducted' | 'premium_status_changed' | 'subscription_updated' | 'credits_restored';
  oldValue?: number;
  newValue?: number;
  amount?: number;
  reason?: string;
  source?: string; // 'stripe_webhook', 'manual', 'api', etc.
  metadata?: Record<string, any>;
}

const db = admin.firestore();

/**
 * Log a credit change
 */
export async function logCreditChange(
  userId: string,
  action: 'credits_added' | 'credits_deducted',
  oldBalance: number,
  newBalance: number,
  amount: number,
  reason?: string,
  source?: string
) {
  try {
    const entry: AuditLogEntry = {
      timestamp: new Date(),
      userId,
      action,
      oldValue: oldBalance,
      newValue: newBalance,
      amount,
      reason: reason || `${action} by system`,
      source: source || 'api',
    };

    await db.collection('audit_logs').add(entry);
    console.log(`📝 Audit: ${userId} - ${action} (${amount} credits, ${oldBalance} → ${newBalance})`);
  } catch (err) {
    console.error(`❌ Failed to log audit entry for ${userId}:`, err);
    // Don't throw - audit logging should not break the main operation
  }
}

/**
 * Log a premium status change
 */
export async function logPremiumStatusChange(
  userId: string,
  isPremium: boolean,
  reason?: string,
  source?: string
) {
  try {
    const entry: AuditLogEntry = {
      timestamp: new Date(),
      userId,
      action: 'premium_status_changed',
      newValue: isPremium ? 1 : 0,
      reason: reason || `Premium status changed to ${isPremium}`,
      source: source || 'api',
    };

    await db.collection('audit_logs').add(entry);
    console.log(`📝 Audit: ${userId} - Premium status: ${isPremium}`);
  } catch (err) {
    console.error(`❌ Failed to log premium status change for ${userId}:`, err);
  }
}

/**
 * Log a subscription update
 */
export async function logSubscriptionUpdate(
  userId: string,
  subscriptionData: any,
  reason?: string
) {
  try {
    const entry: AuditLogEntry = {
      timestamp: new Date(),
      userId,
      action: 'subscription_updated',
      reason: reason || 'Subscription updated',
      source: 'stripe_webhook',
      metadata: subscriptionData,
    };

    await db.collection('audit_logs').add(entry);
    console.log(`📝 Audit: ${userId} - Subscription updated`);
  } catch (err) {
    console.error(`❌ Failed to log subscription update for ${userId}:`, err);
  }
}

/**
 * Get audit logs for a user
 */
export async function getUserAuditLogs(userId: string, limit: number = 50) {
  try {
    const logs = await db
      .collection('audit_logs')
      .where('userId', '==', userId)
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .get();

    return logs.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (err) {
    console.error(`❌ Failed to get audit logs for ${userId}:`, err);
    return [];
  }
}

/**
 * Get all audit logs (for admins)
 */
export async function getAllAuditLogs(limit: number = 100) {
  try {
    const logs = await db
      .collection('audit_logs')
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .get();

    return logs.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (err) {
    console.error('❌ Failed to get all audit logs:', err);
    return [];
  }
}
