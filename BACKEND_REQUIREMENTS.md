# AI Calendar Extension - Backend Requirements

## Overview

This document outlines the complete backend requirements for the AI Calendar Extension, including user authentication, subscription management, and Stripe payment integration. The backend will replace the current client-side subscription management and provide a secure, scalable foundation.

## Table of Contents

1. [Authentication System](#authentication-system)
2. [Subscription Management](#subscription-management)
3. [Stripe Integration](#stripe-integration)
4. [API Endpoints](#api-endpoints)
5. [Database Schema](#database-schema)
6. [Security Requirements](#security-requirements)
7. [Environment Configuration](#environment-configuration)
8. [Error Handling](#error-handling)
9. [Monitoring & Analytics](#monitoring--analytics)
10. [Deployment Guide](#deployment-guide)

---

## Authentication System

### User Management

- **User Registration/Login**: Google OAuth integration (since your extension uses Google services)
- **Session Management**: JWT tokens or session-based authentication
- **User Profiles**: Store user information (email, display name, preferences)
- **Account Linking**: Link Google accounts to your user system

### Authentication Flow

1. User clicks "Sign in with Google" in extension
2. Extension opens Google OAuth popup
3. User authorizes the extension
4. Extension sends Google ID token to backend
5. Backend verifies token and creates/updates user record
6. Backend returns JWT token and user data
7. Extension stores JWT token for future requests

---

## Subscription Management

### Core Features

- **Question Usage Tracking**: Track questions used per user per month
- **Plan Management**: Free (50 questions) vs Premium (100 questions)
- **Billing Cycles**: Monthly subscription periods
- **Usage Limits**: Enforce question limits based on plan
- **Monthly Reset**: Automatically reset question counts monthly

### Subscription States

- **Free Plan**: 50 questions per month
- **Premium Plan**: 100 questions per month ($9.99/month)
- **Trial Period**: Optional trial for new users
- **Grace Period**: Allow usage after payment failure

---

## Stripe Integration

### Payment Processing

- **Checkout Sessions**: Create Stripe checkout sessions for subscriptions
- **Webhook Handling**: Process Stripe events (subscription created, updated, cancelled)
- **Customer Management**: Create and manage Stripe customers
- **Subscription Management**: Handle subscription lifecycle

### Required Stripe Events

- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

---

## API Endpoints

### Authentication Endpoints

#### Google OAuth Sign-in
```http
POST /api/auth/google-signin
Content-Type: application/json

{
  "idToken": "google_id_token",
  "accessToken": "google_access_token"
}
```

**Response:**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "displayName": "John Doe",
    "planType": "free"
  },
  "token": "jwt_token",
  "subscription": {
    "status": "active",
    "questionsUsed": 25,
    "questionsLimit": 50
  }
}
```

#### Sign Out
```http
POST /api/auth/signout
Authorization: Bearer jwt_token
```

#### Get User Profile
```http
GET /api/user/profile
Authorization: Bearer jwt_token
```

**Response:**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "displayName": "John Doe",
    "planType": "premium"
  },
  "subscription": {
    "status": "active",
    "questionsUsed": 75,
    "questionsLimit": 100,
    "periodEnd": "2024-02-01T00:00:00.000Z"
  }
}
```

### Subscription Endpoints

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

**Response:**
```json
{
  "sessionId": "cs_test_..."
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

**Response:**
```json
{
  "success": true,
  "subscription": {
    "status": "active",
    "questionsLimit": 100,
    "periodEnd": "2024-02-01T00:00:00.000Z"
  }
}
```

#### Cancel Subscription
```http
POST /api/subscriptions/cancel
Authorization: Bearer jwt_token
```

**Response:**
```json
{
  "success": true,
  "cancelAt": "2024-02-01T00:00:00.000Z"
}
```

### Usage Tracking Endpoints

#### Increment Question Count
```http
POST /api/usage/increment
Authorization: Bearer jwt_token
```

**Response:**
```json
{
  "questionsUsed": 51,
  "questionsLimit": 100,
  "canAskMore": true
}
```

#### Get Usage Status
```http
GET /api/usage/status/:userId
Authorization: Bearer jwt_token
```

**Response:**
```json
{
  "questionsUsed": 25,
  "questionsLimit": 100,
  "questionsRemaining": 75,
  "planType": "premium",
  "nextReset": "2024-02-01T00:00:00.000Z"
}
```

### Webhook Endpoint

#### Stripe Webhook
```http
POST /api/webhooks/stripe
Content-Type: application/json
Stripe-Signature: whsec_...
```

---

## Database Schema

### Users Table
```sql
CREATE TABLE users (
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
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_google_id ON users(google_id);
```

### Subscriptions Table
```sql
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  stripe_customer_id VARCHAR(255),
  stripe_subscription_id VARCHAR(255),
  plan_type VARCHAR(50) DEFAULT 'free', -- 'free' or 'premium'
  status VARCHAR(50) DEFAULT 'active', -- 'active', 'cancelled', 'past_due', 'trialing'
  current_period_start TIMESTAMP,
  current_period_end TIMESTAMP,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  trial_start TIMESTAMP,
  trial_end TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_stripe_customer_id ON subscriptions(stripe_customer_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
```

### Usage Tracking Table
```sql
CREATE TABLE usage_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  month_year VARCHAR(7), -- '2024-01' format
  questions_used INTEGER DEFAULT 0,
  questions_limit INTEGER DEFAULT 50,
  last_reset_date TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, month_year)
);

CREATE INDEX idx_usage_tracking_user_id ON usage_tracking(user_id);
CREATE INDEX idx_usage_tracking_month_year ON usage_tracking(month_year);
```

### Sessions Table (Optional - for session-based auth)
```sql
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(500) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  last_used TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_sessions_token ON sessions(token);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);
```

---

## Security Requirements

### Authentication Security

- **JWT Tokens**: Secure token generation and validation
- **Token Expiration**: Set appropriate expiration times (7-30 days)
- **Refresh Tokens**: Implement refresh token mechanism
- **CORS Configuration**: Allow requests from your extension
- **Rate Limiting**: Prevent abuse of API endpoints
- **Input Validation**: Validate all incoming data

### Payment Security

- **Webhook Verification**: Verify Stripe webhook signatures
- **HTTPS Only**: All endpoints must use HTTPS
- **API Key Security**: Secure storage of Stripe keys
- **Error Handling**: Proper error responses without exposing sensitive data
- **PCI Compliance**: Follow Stripe's security guidelines

### Data Security

- **Password Hashing**: If implementing password auth (not needed for Google OAuth)
- **SQL Injection Prevention**: Use parameterized queries
- **XSS Prevention**: Sanitize all user inputs
- **CSRF Protection**: Implement CSRF tokens where needed

---

## Environment Configuration

### Required Environment Variables
```env
# Database
DATABASE_URL=postgresql://ai_calendar_user:kzfVhc96JJ7qruQtVoXUxaq42gLRuaXh@dpg-d2dqqdodl3ps73b66ai0-a.oregon-postgres.render.com/ai_calendar_db

# JWT
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=30d

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_REDIRECT_URI=https://backend-server-3pxb.onrender.com/auth/google/callback

# Stripe
STRIPE_SECRET_KEY=your_stripe_secret_key_here
STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key_here
STRIPE_WEBHOOK_SECRET=whsec_1sqStqJ5EmqHzO4upIM4Lv1rLtX6EG1h
STRIPE_PRICE_ID=price_1RvQOqKYPm0REgId2awooMFO

# Server
PORT=3000
NODE_ENV=production
CORS_ORIGIN=https://jelmebbplokkmdfjbfagadjakiplggnc.chromiumapp.org

# Redis (for session storage - optional)
REDIS_URL=redis://localhost:6379

# Logging
LOG_LEVEL=info
SENTRY_DSN=your_sentry_dsn
```

---

## Error Handling

### Standard Error Response Format
```json
{
  "error": {
    "code": "SUBSCRIPTION_LIMIT_EXCEEDED",
    "message": "You have exceeded your monthly question limit",
    "details": {
      "questionsUsed": 50,
      "questionsLimit": 50,
      "upgradeUrl": "/api/subscriptions/create-checkout-session"
    },
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

### Common Error Codes

#### Authentication Errors
- `INVALID_TOKEN`: JWT token is invalid or expired
- `UNAUTHORIZED`: User is not authenticated
- `GOOGLE_AUTH_FAILED`: Google OAuth verification failed

#### Subscription Errors
- `SUBSCRIPTION_LIMIT_EXCEEDED`: User has exceeded question limit
- `SUBSCRIPTION_NOT_FOUND`: No active subscription found
- `PAYMENT_FAILED`: Stripe payment processing failed
- `SUBSCRIPTION_CANCELLED`: Subscription has been cancelled

#### Usage Errors
- `USAGE_LIMIT_EXCEEDED`: Monthly usage limit reached
- `INVALID_USAGE_REQUEST`: Invalid usage tracking request

#### General Errors
- `VALIDATION_ERROR`: Request validation failed
- `INTERNAL_SERVER_ERROR`: Unexpected server error
- `RATE_LIMIT_EXCEEDED`: Too many requests

---

## Monitoring & Analytics

### Key Metrics to Track

#### User Metrics
- User registration and login rates
- Daily/Monthly active users
- User retention rates
- Session duration

#### Subscription Metrics
- Subscription conversion rates
- Plan upgrade/downgrade rates
- Churn rates
- Revenue per user

#### Usage Metrics
- Questions asked per user
- Peak usage times
- Feature usage patterns
- Usage by plan type

#### Payment Metrics
- Payment success/failure rates
- Average revenue per user
- Subscription renewal rates
- Payment method preferences

### Logging Strategy

#### Structured Logging
```json
{
  "level": "info",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "service": "ai-calendar-backend",
  "userId": "uuid",
  "action": "question_asked",
  "details": {
    "questionsUsed": 25,
    "questionsLimit": 50,
    "planType": "free"
  }
}
```

#### Error Tracking
- Use Sentry or similar service for error tracking
- Log all API errors with context
- Monitor webhook delivery failures
- Track payment processing errors

---

## Deployment Guide

### Prerequisites

1. **Database**: PostgreSQL 12+ with UUID extension
2. **Node.js**: Version 18+ LTS
3. **Redis**: For session storage (optional)
4. **Domain**: HTTPS-enabled domain for production
5. **SSL Certificate**: Valid SSL certificate

### Deployment Platforms

#### Heroku
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
```

#### AWS (EC2)
```bash
# Install dependencies
sudo apt update
sudo apt install nodejs npm postgresql

# Set up database
sudo -u postgres createdb ai_calendar_db

# Set up PM2 for process management
npm install -g pm2
pm2 start app.js --name ai-calendar-backend

# Set up Nginx reverse proxy
sudo apt install nginx
# Configure Nginx for your domain
```

#### Railway
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway init
railway up
```

### Database Migrations

#### Initial Setup
```bash
# Install migration tool (e.g., node-pg-migrate)
npm install node-pg-migrate

# Create migration
npx node-pg-migrate create initial-schema

# Run migrations
npx node-pg-migrate up
```

#### Migration Files
```sql
-- 001_initial_schema.sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE users (
  -- ... user table schema
);

CREATE TABLE subscriptions (
  -- ... subscription table schema
);

CREATE TABLE usage_tracking (
  -- ... usage tracking table schema
);
```

### Health Checks

#### Health Check Endpoint
```http
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "services": {
    "database": "connected",
    "stripe": "connected",
    "redis": "connected"
  }
}
```

### Monitoring Setup

#### Application Monitoring
- Set up application performance monitoring (APM)
- Configure alerting for critical errors
- Monitor database performance
- Track API response times

#### Infrastructure Monitoring
- Server resource usage (CPU, memory, disk)
- Database connection pool status
- Network latency and availability
- SSL certificate expiration

---

## Testing Strategy

### Unit Tests
- Test all business logic functions
- Mock external services (Stripe, Google)
- Test error handling scenarios
- Validate input/output formats

### Integration Tests
- Test API endpoints with real database
- Test Stripe webhook handling
- Test Google OAuth flow
- Test subscription lifecycle

### End-to-End Tests
- Test complete user journey
- Test payment flow
- Test usage tracking
- Test error scenarios

### Load Testing
- Test API performance under load
- Test database performance
- Test webhook processing
- Test concurrent user scenarios

---

## Development Workflow

### Local Development Setup

1. **Clone Repository**
   ```bash
   git clone <repository-url>
   cd ai-calendar-backend
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Set Up Environment**
   ```bash
   cp .env.example .env
   # Edit .env with your local values
   ```

4. **Set Up Database**
   ```bash
   # Install PostgreSQL locally or use Docker
   docker run --name postgres -e POSTGRES_PASSWORD=password -p 5432:5432 -d postgres
   
   # Run migrations
   npm run migrate
   ```

5. **Start Development Server**
   ```bash
   npm run dev
   ```

### Code Quality

#### Linting and Formatting
```json
{
  "scripts": {
    "lint": "eslint src/",
    "format": "prettier --write src/",
    "test": "jest",
    "test:watch": "jest --watch"
  }
}
```

#### Git Hooks
```json
{
  "husky": {
    "hooks": {
      "pre-commit": "npm run lint && npm run test",
      "pre-push": "npm run test:coverage"
    }
  }
}
```

---

## Support and Maintenance

### Documentation
- API documentation (Swagger/OpenAPI)
- Database schema documentation
- Deployment guides
- Troubleshooting guides

### Support Channels
- GitHub Issues for bug reports
- Email support for urgent issues
- Documentation for self-service
- Status page for service updates

### Maintenance Tasks
- Regular security updates
- Database backups
- SSL certificate renewal
- Dependency updates
- Performance monitoring

---

## Conclusion

This backend system will provide a robust, scalable foundation for your AI Calendar Extension. It handles all authentication, subscription management, and payment processing while maintaining security and performance standards.

The system is designed to be:
- **Scalable**: Can handle growth in users and usage
- **Secure**: Implements best practices for data protection
- **Reliable**: Includes proper error handling and monitoring
- **Maintainable**: Well-documented and tested codebase

Follow this guide to implement the backend, and your extension will have a production-ready subscription system that can grow with your user base.
