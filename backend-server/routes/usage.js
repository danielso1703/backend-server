import express from 'express';
import { query } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import asyncHandler from 'express-async-handler';

const router = express.Router();

// Increment question count
router.post('/increment', authenticateToken, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format

  try {
    // Get or create usage tracking for current month
    let result = await query(
      `SELECT ut.*, s.plan_type
       FROM usage_tracking ut
       LEFT JOIN subscriptions s ON ut.user_id = s.user_id AND s.status = 'active'
       WHERE ut.user_id = $1 AND ut.month_year = $2`,
      [userId, currentMonth]
    );

    let usageData;
    let questionsLimit;

    if (result.rows.length === 0) {
      // Create new usage tracking for this month
      const subscriptionResult = await query(
        'SELECT plan_type FROM subscriptions WHERE user_id = $1 AND status = $2',
        [userId, 'active']
      );

      const planType = subscriptionResult.rows[0]?.plan_type || 'free';
      questionsLimit = planType === 'premium' 
        ? parseInt(process.env.PREMIUM_QUESTIONS_LIMIT) || 100
        : parseInt(process.env.FREE_QUESTIONS_LIMIT) || 50;

      await query(
        `INSERT INTO usage_tracking (user_id, month_year, questions_used, questions_limit)
         VALUES ($1, $2, 1, $3)`,
        [userId, currentMonth, questionsLimit]
      );

      usageData = {
        questions_used: 1,
        questions_limit: questionsLimit
      };
    } else {
      usageData = result.rows[0];
      questionsLimit = usageData.questions_limit;

      // Check if user has exceeded their limit
      if (usageData.questions_used >= questionsLimit) {
        return res.status(403).json({
          error: {
            code: 'USAGE_LIMIT_EXCEEDED',
            message: 'You have exceeded your monthly question limit',
            details: {
              questionsUsed: usageData.questions_used,
              questionsLimit: questionsLimit,
              upgradeUrl: '/api/subscriptions/create-checkout-session'
            },
            timestamp: new Date().toISOString()
          }
        });
      }

      // Increment question count
      await query(
        `UPDATE usage_tracking 
         SET questions_used = questions_used + 1, updated_at = NOW()
         WHERE user_id = $1 AND month_year = $2`,
        [userId, currentMonth]
      );

      usageData.questions_used += 1;
    }

    res.json({
      questionsUsed: usageData.questions_used,
      questionsLimit: questionsLimit,
      canAskMore: usageData.questions_used < questionsLimit
    });

  } catch (error) {
    console.error('Usage increment error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to increment usage',
        timestamp: new Date().toISOString()
      }
    });
  }
}));

// Get usage status
router.get('/status/:userId?', authenticateToken, asyncHandler(async (req, res) => {
  const userId = req.params.userId || req.user.id;
  const currentMonth = new Date().toISOString().slice(0, 7);

  try {
    const result = await query(
      `SELECT ut.*, s.plan_type, s.current_period_end
       FROM usage_tracking ut
       LEFT JOIN subscriptions s ON ut.user_id = s.user_id AND s.status = 'active'
       WHERE ut.user_id = $1 AND ut.month_year = $2`,
      [userId, currentMonth]
    );

    let usageData;
    let planType = 'free';
    let questionsLimit = parseInt(process.env.FREE_QUESTIONS_LIMIT) || 50;

    if (result.rows.length > 0) {
      usageData = result.rows[0];
      planType = usageData.plan_type || 'free';
      questionsLimit = usageData.questions_limit;
    } else {
      // Get subscription info if no usage data exists
      const subscriptionResult = await query(
        'SELECT plan_type FROM subscriptions WHERE user_id = $1 AND status = $2',
        [userId, 'active']
      );

      if (subscriptionResult.rows.length > 0) {
        planType = subscriptionResult.rows[0].plan_type;
        questionsLimit = planType === 'premium' 
          ? parseInt(process.env.PREMIUM_QUESTIONS_LIMIT) || 100
          : parseInt(process.env.FREE_QUESTIONS_LIMIT) || 50;
      }

      usageData = {
        questions_used: 0,
        questions_limit: questionsLimit
      };
    }

    // Calculate next reset date (first day of next month)
    const nextReset = new Date();
    nextReset.setMonth(nextReset.getMonth() + 1);
    nextReset.setDate(1);
    nextReset.setHours(0, 0, 0, 0);

    res.json({
      questionsUsed: usageData.questions_used || 0,
      questionsLimit: questionsLimit,
      questionsRemaining: Math.max(0, questionsLimit - (usageData.questions_used || 0)),
      planType: planType,
      nextReset: nextReset.toISOString()
    });

  } catch (error) {
    console.error('Usage status error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to get usage status',
        timestamp: new Date().toISOString()
      }
    });
  }
}));

// Reset usage for a specific month (admin function)
router.post('/reset/:userId/:monthYear', authenticateToken, asyncHandler(async (req, res) => {
  const { userId, monthYear } = req.params;

  // Validate monthYear format (YYYY-MM)
  if (!/^\d{4}-\d{2}$/.test(monthYear)) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid month format. Use YYYY-MM',
        timestamp: new Date().toISOString()
      }
    });
  }

  try {
    await query(
      `UPDATE usage_tracking 
       SET questions_used = 0, last_reset_date = NOW(), updated_at = NOW()
       WHERE user_id = $1 AND month_year = $2`,
      [userId, monthYear]
    );

    res.json({
      success: true,
      message: `Usage reset for ${monthYear}`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Usage reset error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to reset usage',
        timestamp: new Date().toISOString()
      }
    });
  }
}));

// Get usage history
router.get('/history', authenticateToken, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { months = 6 } = req.query;

  try {
    const result = await query(
      `SELECT month_year, questions_used, questions_limit, created_at, updated_at
       FROM usage_tracking
       WHERE user_id = $1
       ORDER BY month_year DESC
       LIMIT $2`,
      [userId, parseInt(months)]
    );

    res.json({
      history: result.rows.map(row => ({
        month: row.month_year,
        questionsUsed: row.questions_used,
        questionsLimit: row.questions_limit,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }))
    });

  } catch (error) {
    console.error('Usage history error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to get usage history',
        timestamp: new Date().toISOString()
      }
    });
  }
}));

export default router;
