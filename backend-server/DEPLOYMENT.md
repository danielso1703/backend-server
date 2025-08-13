# AI Calendar Backend - Deployment Guide

This guide will help you deploy the AI Calendar Backend to Render.com or other platforms.

## 🚀 Quick Deploy to Render

### 1. Prerequisites

Before deploying, ensure you have:

- [ ] GitHub repository with the backend code
- [ ] Stripe account with API keys
- [ ] Google OAuth credentials
- [ ] OpenAI API key
- [ ] PostgreSQL database (Render provides this)

### 2. Render Setup

#### Step 1: Connect Repository
1. Go to [Render.com](https://render.com)
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Select the repository containing the backend code

#### Step 2: Configure Service
- **Name**: `ai-calendar-backend`
- **Environment**: `Node`
- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Plan**: `Starter` (or higher for production)

#### Step 3: Add PostgreSQL Database
1. Click "New +" → "PostgreSQL"
2. Name: `ai-calendar-db`
3. Database: `ai_calendar_db`
4. User: `ai_calendar_user`
5. Plan: `Starter`

#### Step 4: Set Environment Variables

Add these environment variables in Render dashboard:

```env
# Database (Render will provide this automatically)
DATABASE_URL=postgresql://ai_calendar_user:password@host:port/ai_calendar_db

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_make_it_long_and_random
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=30d

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=https://your-app.onrender.com/auth/google/callback

# Stripe Configuration
STRIPE_SECRET_KEY=REPLACE_WITH_YOUR_STRIPE_SECRET_KEY
STRIPE_PUBLISHABLE_KEY=REPLACE_WITH_YOUR_STRIPE_PUBLISHABLE_KEY
STRIPE_WEBHOOK_SECRET=REPLACE_WITH_YOUR_STRIPE_WEBHOOK_SECRET
STRIPE_PRICE_ID=price_your_premium_price_id

# OpenAI
OPENAI_API_KEY=sk-your-openai-api-key-here

# Server Configuration
NODE_ENV=production
PORT=10000
ALLOWED_ORIGINS=chrome-extension://*,moz-extension://*,http://localhost:3000

# Subscription Limits
FREE_QUESTIONS_LIMIT=50
PREMIUM_QUESTIONS_LIMIT=100

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=200

# Logging
LOG_LEVEL=info
```

### 3. Stripe Setup

#### Step 1: Create Products and Prices
1. Go to Stripe Dashboard → Products
2. Create a new product: "AI Calendar Premium"
3. Add a recurring price: $9.99/month
4. Copy the Price ID (starts with `price_`)

#### Step 2: Set up Webhook
1. Go to Stripe Dashboard → Webhooks
2. Click "Add endpoint"
3. URL: `https://your-app.onrender.com/api/webhooks/stripe`
4. Select these events:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `checkout.session.completed`
5. Copy the webhook secret (starts with `whsec_`)

### 4. Google OAuth Setup

#### Step 1: Create OAuth Credentials
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Enable Google+ API
4. Go to Credentials → Create Credentials → OAuth 2.0 Client IDs
5. Application type: Web application
6. Authorized redirect URIs: `https://your-app.onrender.com/auth/google/callback`
7. Copy Client ID and Client Secret

### 5. Deploy and Test

#### Step 1: Deploy
1. Click "Create Web Service" in Render
2. Wait for build to complete
3. Note your app URL (e.g., `https://ai-calendar-backend.onrender.com`)

#### Step 2: Run Database Migration
1. Go to your service in Render
2. Click "Shell"
3. Run: `npm run migrate`

#### Step 3: Test the API
1. Test health check: `https://your-app.onrender.com/health`
2. Test root endpoint: `https://your-app.onrender.com/`
3. Verify database connection

### 6. Chrome Extension Integration

#### Update Your Extension
1. Update `manifest.json`:
```json
{
  "permissions": [
    "https://your-app.onrender.com/*"
  ],
  "host_permissions": [
    "https://your-app.onrender.com/*"
  ]
}
```

2. Update API calls in your extension:
```javascript
const API_BASE = 'https://your-app.onrender.com';

// Example: Google OAuth sign-in
const response = await fetch(`${API_BASE}/api/auth/google-signin`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ idToken, accessToken })
});
```

## 🔧 Alternative Deployment Options

### Heroku
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
# ... add all other env vars

# Deploy
git push heroku main

# Run migrations
heroku run npm run migrate
```

### Railway
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

### DigitalOcean App Platform
1. Connect your GitHub repository
2. Choose Node.js environment
3. Set build command: `npm install`
4. Set run command: `npm start`
5. Add environment variables
6. Add PostgreSQL database
7. Deploy

## 🧪 Testing Your Deployment

### 1. Health Check
```bash
curl https://your-app.onrender.com/health
```

Expected response:
```json
{
  "status": "healthy",
  "database": "connected",
  "service": "ai-calendar-backend"
}
```

### 2. Test Chat API
```bash
curl -X POST https://your-app.onrender.com/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "Hello"}],
    "model": "gpt-4o-mini"
  }'
```

### 3. Test Authentication
```bash
curl -X POST https://your-app.onrender.com/api/auth/google-signin \
  -H "Content-Type: application/json" \
  -d '{"idToken": "test"}'
```

Should return 400 (validation error) or 401 (Google auth failed).

## 🔍 Monitoring and Debugging

### 1. View Logs
- Render: Go to your service → Logs
- Heroku: `heroku logs --tail`
- Railway: `railway logs`

### 2. Check Database
```bash
# Render Shell
psql $DATABASE_URL

# Heroku
heroku pg:psql

# Railway
railway run psql $DATABASE_URL
```

### 3. Common Issues

#### Database Connection Failed
- Check `DATABASE_URL` environment variable
- Ensure database is created and accessible
- Verify SSL settings for production

#### Stripe Webhook Errors
- Check webhook URL is correct
- Verify webhook secret matches
- Check Stripe dashboard for failed webhook attempts

#### CORS Errors
- Ensure `ALLOWED_ORIGINS` includes your extension ID
- Check Chrome extension manifest permissions
- Verify HTTPS is used in production

#### Authentication Issues
- Verify Google OAuth credentials
- Check redirect URI matches exactly
- Ensure JWT secret is set and secure

## 📊 Production Checklist

- [ ] Environment variables configured
- [ ] Database migrated and seeded
- [ ] Stripe webhook configured
- [ ] Google OAuth set up
- [ ] Health check passing
- [ ] API endpoints responding
- [ ] Chrome extension updated with new URL
- [ ] SSL certificate valid
- [ ] Monitoring set up
- [ ] Backup strategy in place

## 🆘 Support

If you encounter issues:

1. Check the logs in your deployment platform
2. Verify all environment variables are set
3. Test database connectivity
4. Check Stripe webhook configuration
5. Verify Google OAuth setup
6. Test with the provided test script: `npm test`

For additional help, check the main README.md file or create an issue in the repository.
