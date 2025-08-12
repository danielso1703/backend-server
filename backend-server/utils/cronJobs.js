import cron from 'node-cron';
import { query } from '../config/database.js';

// Monthly usage reset job - runs on the 1st of every month at 00:00
export const setupMonthlyUsageReset = () => {
  cron.schedule('0 0 1 * *', async () => {
    console.log('🔄 Running monthly usage reset...');
    
    try {
      const currentMonth = new Date().toISOString().slice(0, 7);
      
      // Get all users with active subscriptions
      const result = await query(
        `SELECT DISTINCT u.id, s.plan_type
         FROM users u
         JOIN subscriptions s ON u.id = s.user_id
         WHERE s.status = 'active'`
      );

      for (const user of result.rows) {
        const questionsLimit = user.plan_type === 'premium' 
          ? parseInt(process.env.PREMIUM_QUESTIONS_LIMIT) || 100
          : parseInt(process.env.FREE_QUESTIONS_LIMIT) || 50;

        // Create or update usage tracking for the new month
        await query(
          `INSERT INTO usage_tracking (user_id, month_year, questions_used, questions_limit)
           VALUES ($1, $2, 0, $3)
           ON CONFLICT (user_id, month_year)
           DO UPDATE SET 
             questions_used = 0,
             questions_limit = $3,
             last_reset_date = NOW(),
             updated_at = NOW()`,
          [user.id, currentMonth, questionsLimit]
        );
      }

      console.log(`✅ Monthly usage reset completed for ${result.rows.length} users`);
    } catch (error) {
      console.error('❌ Monthly usage reset failed:', error);
    }
  }, {
    scheduled: true,
    timezone: "UTC"
  });

  console.log('📅 Monthly usage reset job scheduled');
};

// Clean up expired sessions - runs daily at 02:00
export const setupSessionCleanup = () => {
  cron.schedule('0 2 * * *', async () => {
    console.log('🧹 Running session cleanup...');
    
    try {
      const result = await query(
        'DELETE FROM sessions WHERE expires_at < NOW()'
      );

      console.log(`✅ Session cleanup completed. Removed ${result.rowCount} expired sessions`);
    } catch (error) {
      console.error('❌ Session cleanup failed:', error);
    }
  }, {
    scheduled: true,
    timezone: "UTC"
  });

  console.log('📅 Session cleanup job scheduled');
};

// Subscription status check - runs daily at 06:00
export const setupSubscriptionCheck = () => {
  cron.schedule('0 6 * * *', async () => {
    console.log('🔍 Running subscription status check...');
    
    try {
      // Check for subscriptions that have expired
      const result = await query(
        `UPDATE subscriptions 
         SET status = 'expired', updated_at = NOW()
         WHERE status = 'active' 
         AND current_period_end < NOW()
         AND cancel_at_period_end = false`
      );

      if (result.rowCount > 0) {
        console.log(`✅ Updated ${result.rowCount} expired subscriptions`);
      } else {
        console.log('✅ No expired subscriptions found');
      }
    } catch (error) {
      console.error('❌ Subscription status check failed:', error);
    }
  }, {
    scheduled: true,
    timezone: "UTC"
  });

  console.log('📅 Subscription status check job scheduled');
};

// Initialize all cron jobs
export const initializeCronJobs = () => {
  setupMonthlyUsageReset();
  setupSessionCleanup();
  setupSubscriptionCheck();
  
  console.log('🚀 All cron jobs initialized');
};
