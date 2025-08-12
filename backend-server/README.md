# AI Calendar Backend

A comprehensive backend system for the AI Calendar Chrome Extension, providing authentication, subscription management, usage tracking, and Stripe payment integration.

## Features

- 🔐 **Google OAuth Authentication** - Secure user authentication via Google
- 💳 **Stripe Payment Integration** - Subscription management and billing
- 📊 **Usage Tracking** - Monitor and limit question usage per user
- 🔄 **Monthly Resets** - Automatic usage limit resets
- 🛡️ **Security** - JWT tokens, rate limiting, and input validation
- 📈 **Monitoring** - Health checks and structured logging
- ⚡ **Performance** - Database connection pooling and caching

## Quick Start

### Prerequisites

- Node.js 18+ 
- PostgreSQL 12+
- Stripe account
- Google OAuth credentials

### Installation

1. **Clone and install dependencies**
   ```bash
   cd backend-server
   npm install
   ```

2. **Set up environment variables**
   ```bash
   cp env.example .env
   # Edit .env with your configuration
   ```

3. **Set up database**
   ```bash
   # Create PostgreSQL database
   createdb ai_calendar_db
   
   # Run migrations
   npm run migrate
   ```

4. **Start the server**
   ```bash
   # Development
   npm run dev
   
   # Production
   npm start
   ```

## Environment Configuration

### Required Variables

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/ai_calendar_db

# JWT
JWT_SECRET=your_jwt_secret_key_here_make_it_long_and_random
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=30d

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Stripe
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
STRIPE_PRICE_ID=price_your_premium_price_id

# OpenAI
OPENAI_API_KEY=sk-your-openai-api-key-here

# Server
PORT=3000
NODE_ENV=production
ALLOWED_ORIGINS=chrome-extension://*,http://localhost:3000

# Subscription Limits
FREE_QUESTIONS_LIMIT=50
PREMIUM_QUESTIONS_LIMIT=100
```

## API Endpoints

### Authentication

#### Google OAuth Sign-in
```http
POST /api/auth/google-signin
Content-Type: application/json

{
  "idToken": "google_id_token",
  "accessToken": "google_access_token"
}
```

#### Get User Profile
```http
GET /api/user/profile
Authorization: Bearer jwt_token
```

#### Sign Out
```http
POST /api/auth/signout
Authorization: Bearer jwt_token
```

### Subscriptions

#### Create Checkout Session
```http
POST /api/subscriptions/create-checkout-session
Authorization: Bearer jwt_token
Content-Type: application/json

{
  "priceId": "price_premium_monthly",
  "successUrl": "chrome-extension://id/success.html",
  "cancelUrl": "chrome-extension://id/cancel.html"
}
```

#### Verify Payment
```http
POST /api/subscriptions/verify-payment
Authorization: Bearer jwt_token
Content-Type: application/json

{
  "sessionId": "cs_test_..."
}
```

#### Cancel Subscription
```http
POST /api/subscriptions/cancel
Authorization: Bearer jwt_token
```

#### Get Subscription Status
```http
GET /api/subscriptions/status
Authorization: Bearer jwt_token
```

### Usage Tracking

#### Increment Question Count
```http
POST /api/usage/increment
Authorization: Bearer jwt_token
```

#### Get Usage Status
```http
GET /api/usage/status
Authorization: Bearer jwt_token
```

#### Get Usage History
```http
GET /api/usage/history?months=6
Authorization: Bearer jwt_token
```

### Chat API

#### Send Message (with usage tracking)
```http
POST /api/chat
Authorization: Bearer jwt_token (optional)
Content-Type: application/json

{
  "messages": [
    {"role": "user", "content": "Hello"}
  ],
  "model": "gpt-4o-mini",
  "stream": false
}
```

### Webhooks

#### Stripe Webhook
```http
POST /api/webhooks/stripe
Content-Type: application/json
Stripe-Signature: whsec_...
```

## Database Schema

### Users Table
- `id` - UUID primary key
- `email` - User email (unique)
- `display_name` - User display name
- `google_id` - Google OAuth ID (unique)
- `avatar_url` - User avatar URL
- `created_at` - Account creation timestamp
- `updated_at` - Last update timestamp
- `last_login` - Last login timestamp
- `is_active` - Account status
- `preferences` - User preferences (JSONB)

### Subscriptions Table
- `id` - UUID primary key
- `user_id` - Foreign key to users
- `stripe_customer_id` - Stripe customer ID
- `stripe_subscription_id` - Stripe subscription ID
- `plan_type` - 'free' or 'premium'
- `status` - Subscription status
- `current_period_start` - Billing period start
- `current_period_end` - Billing period end
- `cancel_at_period_end` - Cancel at period end flag
- `created_at` - Subscription creation timestamp
- `updated_at` - Last update timestamp

### Usage Tracking Table
- `id` - UUID primary key
- `user_id` - Foreign key to users
- `month_year` - Month in YYYY-MM format
- `questions_used` - Questions used this month
- `questions_limit` - Monthly question limit
- `last_reset_date` - Last reset timestamp
- `created_at` - Record creation timestamp
- `updated_at` - Last update timestamp

## Deployment

### Render Deployment

1. **Connect your repository to Render**

2. **Create a new Web Service**
   - Build Command: `npm install`
   - Start Command: `npm start`

3. **Set Environment Variables**
   - Add all required environment variables from `.env`

4. **Add PostgreSQL Database**
   - Create a new PostgreSQL database in Render
   - Use the provided `DATABASE_URL`

5. **Set up Stripe Webhook**
   - URL: `https://your-app.onrender.com/api/webhooks/stripe`
   - Events: `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`, `checkout.session.completed`

### Heroku Deployment

```bash
# Install Heroku CLI
npm install -g heroku

# Create app
heroku create your-app-name

# Add PostgreSQL
heroku addons:create heroku-postgresql:hobby-dev

# Set environment variables
heroku config:set NODE_ENV=production
heroku config:set JWT_SECRET=your_secret
heroku config:set STRIPE_SECRET_KEY=sk_live_...

# Deploy
git push heroku main

# Run migrations
heroku run npm run migrate
```

### Railway Deployment

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway init
railway up

# Set environment variables in Railway dashboard
# Run migrations
railway run npm run migrate
```

## Monitoring & Health Checks

### Health Check Endpoint
```http
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 3600,
  "service": "ai-calendar-backend",
  "database": "connected"
}
```

### Logging

The application uses Winston for structured logging:
- Console output in development
- File logging in production
- Error logs saved to `logs/error.log`
- All logs saved to `logs/all.log`

## Cron Jobs

The system includes automated tasks:

- **Monthly Usage Reset** - Runs on 1st of every month at 00:00 UTC
- **Session Cleanup** - Runs daily at 02:00 UTC
- **Subscription Status Check** - Runs daily at 06:00 UTC

## Security Features

- JWT token authentication
- Rate limiting (configurable)
- Input validation and sanitization
- CORS protection
- Helmet security headers
- Stripe webhook signature verification
- SQL injection prevention

## Error Handling

All API endpoints return standardized error responses:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": {},
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

## Development

### Running Tests
```bash
npm test
```

### Database Migrations
```bash
# Create new migration
npx node-pg-migrate create migration_name

# Run migrations
npm run migrate

# Rollback
npx node-pg-migrate down
```

### Local Development
```bash
# Start with nodemon
npm run dev

# Check logs
tail -f logs/all.log
```

## Support

For issues and questions:
- Check the logs in `logs/` directory
- Verify environment variables are set correctly
- Ensure database is accessible
- Check Stripe webhook configuration

## License

MIT License - see LICENSE file for details. 