import express from 'express';
import Stripe from 'stripe';
import { query } from '../config/database.js';
import asyncHandler from 'express-async-handler';

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Stripe webhook handler
router.post('/stripe', express.raw({ type: 'application/json' }), asyncHandler(async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log('Received Stripe webhook event:', event.type);

  try {
    switch (event.type) {
      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;

      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object);
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object);
        break;

      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
}));

// Handle subscription created
async function handleSubscriptionCreated(subscription) {
  console.log('Processing subscription created:', subscription.id);

  try {
    const customer = await stripe.customers.retrieve(subscription.customer);
    const userId = customer.metadata.user_id;

    if (!userId) {
      console.error('No user_id found in customer metadata');
      return;
    }

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

    console.log(`Subscription ${subscription.id} created for user ${userId}`);
  } catch (error) {
    console.error('Error handling subscription created:', error);
    throw error;
  }
}

// Handle subscription updated
async function handleSubscriptionUpdated(subscription) {
  console.log('Processing subscription updated:', subscription.id);

  try {
    const customer = await stripe.customers.retrieve(subscription.customer);
    const userId = customer.metadata.user_id;

    if (!userId) {
      console.error('No user_id found in customer metadata');
      return;
    }

    await query(
      `UPDATE subscriptions 
       SET status = $1, current_period_start = $2, current_period_end = $3,
           cancel_at_period_end = $4, updated_at = NOW()
       WHERE stripe_subscription_id = $5`,
      [
        subscription.status,
        new Date(subscription.current_period_start * 1000),
        new Date(subscription.current_period_end * 1000),
        subscription.cancel_at_period_end,
        subscription.id
      ]
    );

    console.log(`Subscription ${subscription.id} updated for user ${userId}`);
  } catch (error) {
    console.error('Error handling subscription updated:', error);
    throw error;
  }
}

// Handle subscription deleted
async function handleSubscriptionDeleted(subscription) {
  console.log('Processing subscription deleted:', subscription.id);

  try {
    const customer = await stripe.customers.retrieve(subscription.customer);
    const userId = customer.metadata.user_id;

    if (!userId) {
      console.error('No user_id found in customer metadata');
      return;
    }

    await query(
      `UPDATE subscriptions 
       SET status = $1, updated_at = NOW()
       WHERE stripe_subscription_id = $2`,
      ['cancelled', subscription.id]
    );

    // Reset to free plan usage limit
    const currentMonth = new Date().toISOString().slice(0, 7);
    await query(
      `INSERT INTO usage_tracking (user_id, month_year, questions_limit)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, month_year)
       DO UPDATE SET questions_limit = $3, updated_at = NOW()`,
      [userId, currentMonth, parseInt(process.env.FREE_QUESTIONS_LIMIT) || 50]
    );

    console.log(`Subscription ${subscription.id} cancelled for user ${userId}`);
  } catch (error) {
    console.error('Error handling subscription deleted:', error);
    throw error;
  }
}

// Handle payment succeeded
async function handlePaymentSucceeded(invoice) {
  console.log('Processing payment succeeded:', invoice.id);

  try {
    if (invoice.subscription) {
      const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
      const customer = await stripe.customers.retrieve(subscription.customer);
      const userId = customer.metadata.user_id;

      if (userId) {
        await query(
          `UPDATE subscriptions 
           SET status = $1, updated_at = NOW()
           WHERE stripe_subscription_id = $2`,
          ['active', subscription.id]
        );

        console.log(`Payment succeeded for subscription ${subscription.id}`);
      }
    }
  } catch (error) {
    console.error('Error handling payment succeeded:', error);
    throw error;
  }
}

// Handle payment failed
async function handlePaymentFailed(invoice) {
  console.log('Processing payment failed:', invoice.id);

  try {
    if (invoice.subscription) {
      const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
      const customer = await stripe.customers.retrieve(subscription.customer);
      const userId = customer.metadata.user_id;

      if (userId) {
        await query(
          `UPDATE subscriptions 
           SET status = $1, updated_at = NOW()
           WHERE stripe_subscription_id = $2`,
          ['past_due', subscription.id]
        );

        console.log(`Payment failed for subscription ${subscription.id}`);
      }
    }
  } catch (error) {
    console.error('Error handling payment failed:', error);
    throw error;
  }
}

// Handle checkout completed
async function handleCheckoutCompleted(session) {
  console.log('Processing checkout completed:', session.id);

  try {
    if (session.mode === 'subscription' && session.subscription) {
      const subscription = await stripe.subscriptions.retrieve(session.subscription);
      const customer = await stripe.customers.retrieve(subscription.customer);
      const userId = customer.metadata.user_id;

      if (userId) {
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

        console.log(`Checkout completed for user ${userId}`);
      }
    }
  } catch (error) {
    console.error('Error handling checkout completed:', error);
    throw error;
  }
}

export default router;
