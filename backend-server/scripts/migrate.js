import { query } from '../config/database.js';
import dotenv from 'dotenv';

dotenv.config();

const createTables = async () => {
  try {
    console.log('🔄 Starting database migration...');

    // Enable UUID extension
    await query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    // Create users table
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        display_name VARCHAR(255),
        google_id VARCHAR(255) UNIQUE,
        avatar_url VARCHAR(500),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        last_login TIMESTAMP,
        is_active BOOLEAN DEFAULT TRUE,
        preferences JSONB DEFAULT '{}'
      )
    `);

    // Create subscriptions table
    await query(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        stripe_customer_id VARCHAR(255),
        stripe_subscription_id VARCHAR(255),
        plan_type VARCHAR(50) DEFAULT 'free',
        status VARCHAR(50) DEFAULT 'active',
        current_period_start TIMESTAMP,
        current_period_end TIMESTAMP,
        cancel_at_period_end BOOLEAN DEFAULT FALSE,
        trial_start TIMESTAMP,
        trial_end TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create usage_tracking table
    await query(`
      CREATE TABLE IF NOT EXISTS usage_tracking (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        month_year VARCHAR(7),
        questions_used INTEGER DEFAULT 0,
        questions_limit INTEGER DEFAULT 50,
        last_reset_date TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, month_year)
      )
    `);

    // Create sessions table
    await query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        token VARCHAR(500) UNIQUE NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        last_used TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create indexes
    await query('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');
    await query('CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id)');
    await query('CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id)');
    await query('CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer_id ON subscriptions(stripe_customer_id)');
    await query('CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status)');
    await query('CREATE INDEX IF NOT EXISTS idx_usage_tracking_user_id ON usage_tracking(user_id)');
    await query('CREATE INDEX IF NOT EXISTS idx_usage_tracking_month_year ON usage_tracking(month_year)');
    await query('CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token)');
    await query('CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)');
    await query('CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at)');

    console.log('✅ Database migration completed successfully!');
    console.log('📊 Tables created: users, subscriptions, usage_tracking, sessions');
    console.log('🔍 Indexes created for optimal performance');

  } catch (error) {
    console.error('❌ Database migration failed:', error);
    process.exit(1);
  }
};

// Run migration
createTables();
