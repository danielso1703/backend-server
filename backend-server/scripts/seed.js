import { query } from '../config/database.js';
import dotenv from 'dotenv';

dotenv.config();

const seedDatabase = async () => {
  try {
    console.log('🌱 Starting database seeding...');

    // Create a test user
    const testUser = await query(
      `INSERT INTO users (email, display_name, google_id, avatar_url, is_active)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (email) DO UPDATE SET
         display_name = EXCLUDED.display_name,
         avatar_url = EXCLUDED.avatar_url,
         updated_at = NOW()
       RETURNING *`,
      [
        'test@example.com',
        'Test User',
        'test_google_id_123',
        'https://via.placeholder.com/150',
        true
      ]
    );

    console.log('✅ Test user created:', testUser.rows[0].email);

    // Create test subscription
    const testSubscription = await query(
      `INSERT INTO subscriptions (user_id, plan_type, status)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id) DO UPDATE SET
         plan_type = EXCLUDED.plan_type,
         status = EXCLUDED.status,
         updated_at = NOW()
       RETURNING *`,
      [testUser.rows[0].id, 'free', 'active']
    );

    console.log('✅ Test subscription created');

    // Create test usage tracking
    const currentMonth = new Date().toISOString().slice(0, 7);
    const testUsage = await query(
      `INSERT INTO usage_tracking (user_id, month_year, questions_used, questions_limit)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, month_year) DO UPDATE SET
         questions_used = EXCLUDED.questions_used,
         questions_limit = EXCLUDED.questions_limit,
         updated_at = NOW()
       RETURNING *`,
      [testUser.rows[0].id, currentMonth, 25, 50]
    );

    console.log('✅ Test usage tracking created');

    console.log('🎉 Database seeding completed successfully!');
    console.log('📊 Test data:');
    console.log(`   - User: ${testUser.rows[0].email}`);
    console.log(`   - Plan: ${testSubscription.rows[0].plan_type}`);
    console.log(`   - Usage: ${testUsage.rows[0].questions_used}/${testUsage.rows[0].questions_limit}`);

  } catch (error) {
    console.error('❌ Database seeding failed:', error);
    process.exit(1);
  }
};

// Run seeding
seedDatabase();
