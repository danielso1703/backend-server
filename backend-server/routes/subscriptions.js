import express from 'express';
import Stripe from 'stripe';
import { query } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import asyncHandler from 'express-async-handler';

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Create checkout session
router.post('/create-checkout-session', authenticateToken, asyncHandler(async (req, res) => {
  const { priceId, successUrl, cancelUrl } = req.body;
  const userId = req.user.id;

  if (!priceId || !successUrl || !cancelUrl) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'priceId, successUrl, and cancelUrl are required',
        timestamp: new Date().toISOString()
      }
    });
  }

  try {
    // Get user's current subscription
    const subscriptionResult = await query(
      'SELECT * FROM subscriptions WHERE user_id = $1 AND status = $2',
      [userId, 'active']
    );

    // Create or get Stripe customer
    let stripeCustomerId = null;
    if (subscriptionResult.rows.length > 0) {
      stripeCustomerId = subscriptionResult.rows[0].stripe_customer_id;
    }

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: req.user.email,
        name: req.user.display_name,
        metadata: {
          user_id: userId
        }
      });
      stripeCustomerId = customer.id;

      // Update user's subscription with Stripe customer ID
      if (subscriptionResult.rows.length > 0) {
        await query(
          'UPDATE subscriptions SET stripe_customer_id = $1 WHERE user_id = $2',
          [stripeCustomerId, userId]
        );
      } else {
        await query(
          'INSERT INTO subscriptions (user_id, stripe_customer_id, plan_type, status) VALUES ($1, $2, $3, $4)',
          [userId, stripeCustomerId, 'free', 'active']
        );
      }
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        user_id: userId
      }
    });

    res.json({
      sessionId: session.id
    });

  } catch (error) {
    console.error('Stripe checkout error:', error);
    res.status(500).json({
      error: {
        code: 'PAYMENT_FAILED',
        message: 'Failed to create checkout session',
        timestamp: new Date().toISOString()
      }
    });
  }
}));

// Verify payment
router.post('/verify-payment', authenticateToken, asyncHandler(async (req, res) => {
  const { sessionId } = req.body;
  const userId = req.user.id;

  if (!sessionId) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'sessionId is required',
        timestamp: new Date().toISOString()
      }
    });
  }

  try {
    // Retrieve the checkout session
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== 'paid') {
      return res.status(400).json({
        error: {
          code: 'PAYMENT_FAILED',
          message: 'Payment not completed',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Get the subscription from the session
    const subscription = await stripe.subscriptions.retrieve(session.subscription);

    // Update user's subscription in database
    await query(
      `UPDATE subscriptions 
       SET stripe_subscription_id = $1, plan_type = $2, status = $3,
           current_period_start = $4, current_period_end = $5, updated_at = NOW()
       WHERE user_id = $6`,
      [
        subscription.id,
        'premium',
        subscription.status,
        new Date(subscription.current_period_start * 1000),
        new Date(subscription.current_period_end * 1000),
        userId
      ]
    );

    // Update usage tracking with new limit
    const currentMonth = new Date().toISOString().slice(0, 7);
    await query(
      `INSERT INTO usage_tracking (user_id, month_year, questions_limit)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, month_year)
       DO UPDATE SET questions_limit = $3, updated_at = NOW()`,
      [userId, currentMonth, parseInt(process.env.PREMIUM_QUESTIONS_LIMIT) || 100]
    );

    res.json({
      success: true,
      subscription: {
        status: subscription.status,
        questionsLimit: parseInt(process.env.PREMIUM_QUESTIONS_LIMIT) || 100,
        periodEnd: new Date(subscription.current_period_end * 1000)
      }
    });

  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({
      error: {
        code: 'PAYMENT_FAILED',
        message: 'Failed to verify payment',
        timestamp: new Date().toISOString()
      }
    });
  }
}));

// Cancel subscription
router.post('/cancel', authenticateToken, asyncHandler(async (req, res) => {
  const userId = req.user.id;

  try {
    // Get user's active subscription
    const result = await query(
      'SELECT * FROM subscriptions WHERE user_id = $1 AND status = $2',
      [userId, 'active']
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: {
          code: 'SUBSCRIPTION_NOT_FOUND',
          message: 'No active subscription found',
          timestamp: new Date().toISOString()
        }
      });
    }

    const subscription = result.rows[0];

    if (subscription.stripe_subscription_id) {
      // Cancel at period end in Stripe
      await stripe.subscriptions.update(subscription.stripe_subscription_id, {
        cancel_at_period_end: true
      });
    }

    // Update subscription in database
    await query(
      `UPDATE subscriptions 
       SET cancel_at_period_end = $1, updated_at = NOW()
       WHERE user_id = $2`,
      [true, userId]
    );

    res.json({
      success: true,
      cancelAt: subscription.current_period_end
    });

  } catch (error) {
    console.error('Subscription cancellation error:', error);
    res.status(500).json({
      error: {
        code: 'SUBSCRIPTION_CANCELLED',
        message: 'Failed to cancel subscription',
        timestamp: new Date().toISOString()
      }
    });
  }
}));

// Get subscription status
router.get('/status', authenticateToken, asyncHandler(async (req, res) => {
  const userId = req.user.id;

  try {
    const result = await query(
      `SELECT s.*, ut.questions_used, ut.questions_limit
       FROM subscriptions s
       LEFT JOIN usage_tracking ut ON s.user_id = ut.user_id 
       AND ut.month_year = $1
       WHERE s.user_id = $2 AND s.status = $3
       ORDER BY s.created_at DESC
       LIMIT 1`,
      [new Date().toISOString().slice(0, 7), userId, 'active']
    );

    const subscription = result.rows[0] || {
      plan_type: 'free',
      status: 'active',
      questions_used: 0,
      questions_limit: parseInt(process.env.FREE_QUESTIONS_LIMIT) || 50
    };

    res.json({
      subscription: {
        planType: subscription.plan_type,
        status: subscription.status,
        questionsUsed: subscription.questions_used || 0,
        questionsLimit: subscription.questions_limit || (subscription.plan_type === 'premium' ? 100 : 50),
        periodEnd: subscription.current_period_end,
        cancelAtPeriodEnd: subscription.cancel_at_period_end
      }
    });

  } catch (error) {
    console.error('Subscription status error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to get subscription status',
        timestamp: new Date().toISOString()
      }
    });
  }
}));

export default router;
