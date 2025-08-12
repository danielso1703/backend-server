import express from 'express';
import { OAuth2Client } from 'google-auth-library';
import { query } from '../config/database.js';
import { generateToken } from '../middleware/auth.js';
import asyncHandler from 'express-async-handler';

const router = express.Router();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Verify Google access token with Google's API
async function verifyGoogleAccessToken(accessToken) {
  try {
    const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${accessToken}`);
    
    if (!response.ok) {
      throw new Error('Invalid access token');
    }
    
    return await response.json();
  } catch (error) {
    throw new Error('Failed to verify access token');
  }
}

// Google OAuth Sign-in (Updated for Chrome Extension)
router.post('/google-signin', asyncHandler(async (req, res) => {
  const { accessToken, userInfo } = req.body;

  // Validate required fields
  if (!accessToken || !userInfo) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Access token and user info are required',
        timestamp: new Date().toISOString()
      }
    });
  }

  // Validate userInfo structure
  if (!userInfo.email || !userInfo.id) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'User info must include email and id',
        timestamp: new Date().toISOString()
      }
    });
  }

  try {
    // Verify the access token with Google
    const tokenData = await verifyGoogleAccessToken(accessToken);
    
    // Verify user info matches token data
    if (tokenData.user_id !== userInfo.id) {
      return res.status(401).json({
        error: {
          code: 'AUTH_FAILED',
          message: 'User info mismatch',
          timestamp: new Date().toISOString()
        }
      });
    }

    const googleId = tokenData.user_id;
    const { email, name, picture } = userInfo;

    // Check if user exists
    let result = await query(
      'SELECT * FROM users WHERE google_id = $1 OR email = $2',
      [googleId, email]
    );

    let user;

    if (result.rows.length > 0) {
      // Update existing user
      user = result.rows[0];
      await query(
        `UPDATE users 
         SET display_name = $1, avatar_url = $2, last_login = NOW(), updated_at = NOW()
         WHERE id = $3`,
        [name, picture, user.id]
      );
    } else {
      // Create new user
      result = await query(
        `INSERT INTO users (email, display_name, google_id, avatar_url, last_login)
         VALUES ($1, $2, $3, $4, NOW())
         RETURNING *`,
        [email, name, googleId, picture]
      );
      user = result.rows[0];

      // Create default subscription for new user
      await query(
        `INSERT INTO subscriptions (user_id, plan_type, status)
         VALUES ($1, 'free', 'active')`,
        [user.id]
      );

      // Create initial usage tracking
      const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format
      await query(
        `INSERT INTO usage_tracking (user_id, month_year, questions_limit)
         VALUES ($1, $2, $3)`,
        [user.id, currentMonth, parseInt(process.env.FREE_QUESTIONS_LIMIT) || 50]
      );
    }

    // Get subscription info
    const subscriptionResult = await query(
      `SELECT s.*, ut.questions_used, ut.questions_limit
       FROM subscriptions s
       LEFT JOIN usage_tracking ut ON s.user_id = ut.user_id 
       AND ut.month_year = $1
       WHERE s.user_id = $2 AND s.status = 'active'
       ORDER BY s.created_at DESC
       LIMIT 1`,
      [new Date().toISOString().slice(0, 7), user.id]
    );

    const subscription = subscriptionResult.rows[0] || {
      plan_type: 'free',
      status: 'active',
      questions_used: 0,
      questions_limit: parseInt(process.env.FREE_QUESTIONS_LIMIT) || 50
    };

    // Generate JWT token
    const token = generateToken(user.id);

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.display_name,
        picture: user.avatar_url,
        googleId: user.google_id
      },
      subscription: {
        status: subscription.status,
        questionsUsed: subscription.questions_used || 0,
        questionsLimit: subscription.questions_limit || (subscription.plan_type === 'premium' ? 100 : 50)
      }
    });

  } catch (error) {
    console.error('Google OAuth error:', error);
    res.status(401).json({
      error: {
        code: 'AUTH_FAILED',
        message: error.message || 'Google authentication failed',
        timestamp: new Date().toISOString()
      }
    });
  }
}));

// Sign out
router.post('/signout', asyncHandler(async (req, res) => {
  // In a JWT-based system, the client just discards the token
  // But we can log the signout for analytics
  res.json({
    message: 'Successfully signed out',
    timestamp: new Date().toISOString()
  });
}));

// Get user profile
router.get('/profile', asyncHandler(async (req, res) => {
  const userId = req.user.id;

  // Get user with subscription info
  const result = await query(
    `SELECT u.*, s.plan_type, s.status as subscription_status, s.current_period_end,
            ut.questions_used, ut.questions_limit
     FROM users u
     LEFT JOIN subscriptions s ON u.id = s.user_id AND s.status = 'active'
     LEFT JOIN usage_tracking ut ON u.id = ut.user_id 
     AND ut.month_year = $1
     WHERE u.id = $2`,
    [new Date().toISOString().slice(0, 7), userId]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({
      error: {
        code: 'USER_NOT_FOUND',
        message: 'User not found',
        timestamp: new Date().toISOString()
      }
    });
  }

  const userData = result.rows[0];

  res.json({
    user: {
      id: userData.id,
      email: userData.email,
      displayName: userData.display_name,
      planType: userData.plan_type || 'free'
    },
    subscription: {
      status: userData.subscription_status || 'active',
      questionsUsed: userData.questions_used || 0,
      questionsLimit: userData.questions_limit || (userData.plan_type === 'premium' ? 100 : 50),
      periodEnd: userData.current_period_end
    }
  });
}));

export default router;
