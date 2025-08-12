# AI Calendar Backend - Setup Steps Guide

This document outlines all the steps you need to complete to set up and deploy your AI Calendar backend system.

## 🚨 Important: OpenAI Key Safety

**Your OpenAI key will remain safe!** The backend system:
- ✅ **Preserves your existing OpenAI integration**
- ✅ **Adds authentication and usage tracking on top**
- ✅ **Does NOT change how your extension calls OpenAI**
- ✅ **Maintains the same `/api/chat` endpoint**

The only change is that authenticated users will have their usage tracked, but the core OpenAI functionality remains identical.

---

## 📋 Complete Setup Checklist

### Phase 1: Local Development Setup

#### 1.1 Install Dependencies
```bash
cd backend-server
npm install
```

#### 1.2 Set Up Environment Variables
```bash
cp env.example .env
# Edit .env with your actual values
```

**Required variables to set:**
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Generate a secure random string
- `GOOGLE_CLIENT_ID` - From Google Cloud Console
- `GOOGLE_CLIENT_SECRET` - From Google Cloud Console
- `STRIPE_SECRET_KEY` - From Stripe Dashboard
- `STRIPE_PUBLISHABLE_KEY` - From Stripe Dashboard
- `STRIPE_WEBHOOK_SECRET` - From Stripe Webhook setup
- `STRIPE_PRICE_ID` - From Stripe Products
- `OPENAI_API_KEY` - Your existing OpenAI key

#### 1.3 Set Up Database
```bash
# Create PostgreSQL database locally (if testing locally)
createdb ai_calendar_db

# Run database migrations
npm run migrate

# Optional: Seed with test data
npm run seed
```

#### 1.4 Test Locally
```bash
npm run dev
npm test
```

---

### Phase 2: Third-Party Service Setup

#### 2.1 Google OAuth Setup
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Enable Google+ API
4. Go to Credentials → Create Credentials → OAuth 2.0 Client IDs
5. Application type: Web application
6. Authorized redirect URIs: 
   - Local: `http://localhost:3000/auth/google/callback`
   - Production: `https://your-app.onrender.com/auth/google/callback`
7. Copy Client ID and Client Secret to your `.env`

#### 2.2 Stripe Setup
1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Create a new product: "AI Calendar Premium"
3. Add recurring price: $9.99/month
4. Copy the Price ID (starts with `price_`) to your `.env`
5. Go to Webhooks → Add endpoint
6. URL: `https://your-app.onrender.com/api/webhooks/stripe`
7. Select these events:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `checkout.session.completed`
8. Copy webhook secret (starts with `whsec_`) to your `.env`

---

### Phase 3: Deployment Setup

#### 3.1 Render.com Setup
1. Go to [Render.com](https://render.com)
2. Sign up/Login with GitHub
3. Click "New +" → "Web Service"
4. Connect your GitHub repository
5. Configure service:
   - Name: `ai-calendar-backend`
   - Environment: `Node`
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Plan: `Starter`

#### 3.2 Add PostgreSQL Database
1. In Render, click "New +" → "PostgreSQL"
2. Name: `ai-calendar-db`
3. Database: `ai_calendar_db`
4. User: `ai_calendar_user`
5. Plan: `Starter`
6. Copy the provided `DATABASE_URL` to your environment variables

#### 3.3 Set Environment Variables in Render
Add ALL these variables in Render dashboard:

```env
# Database (Render provides this)
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
STRIPE_SECRET_KEY=sk_live_your_stripe_secret_key
STRIPE_PUBLISHABLE_KEY=pk_live_your_stripe_publishable_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
STRIPE_PRICE_ID=price_your_premium_price_id

# OpenAI (Your existing key)
OPENAI_API_KEY=sk-your-openai-api-key-here

# Server Configuration
NODE_ENV=production
PORT=10000
ALLOWED_ORIGINS=chrome-extension://*,moz-extension://*,http://localhost:3000

# Subscription Limits
FREE_QUESTIONS_LIMIT=50
PREMIUM_QUESTIONS_LIMIT=1000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=200

# Logging
LOG_LEVEL=info
```

#### 3.4 Deploy and Initialize
1. Click "Create Web Service" in Render
2. Wait for build to complete
3. Note your app URL (e.g., `https://ai-calendar-backend.onrender.com`)
4. Go to your service → Shell
5. Run: `npm run migrate`
6. Optional: Run: `npm run seed`

---

### Phase 4: Chrome Extension Updates

#### 4.1 Update Extension Manifest
Update your Chrome extension's `manifest.json`:

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

#### 4.2 Update Extension Code
Replace your current API calls with the new backend:

```javascript
// Old: Direct OpenAI calls
// New: Backend API calls

const API_BASE = 'https://your-app.onrender.com';

// Google OAuth Sign-in
const signIn = async (idToken, accessToken) => {
  const response = await fetch(`${API_BASE}/api/auth/google-signin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken, accessToken })
  });
  return response.json();
};

// Chat API (same as before, but with optional auth)
const sendMessage = async (messages, token = null) => {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  
  const response = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ messages, model: 'gpt-4o-mini' })
  });
  return response.json();
};

// Get usage status
const getUsage = async (token) => {
  const response = await fetch(`${API_BASE}/api/usage/status`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.json();
};

// Create checkout session
const createCheckout = async (token, priceId) => {
  const response = await fetch(`${API_BASE}/api/subscriptions/create-checkout-session`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      priceId,
      successUrl: 'chrome-extension://your-id/success.html',
      cancelUrl: 'chrome-extension://your-id/cancel.html'
    })
  });
  return response.json();
};
```

---

### Phase 5: Testing and Verification

#### 5.1 Test Backend Health
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

#### 5.2 Test Chat API
```bash
curl -X POST https://your-app.onrender.com/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "Hello"}],
    "model": "gpt-4o-mini"
  }'
```

#### 5.3 Test Authentication
```bash
curl -X POST https://your-app.onrender.com/api/auth/google-signin \
  -H "Content-Type: application/json" \
  -d '{"idToken": "test"}'
```

Should return 400 (validation error) or 401 (Google auth failed).

---

### Phase 6: Production Launch

#### 6.1 Final Checklist
- [ ] All environment variables set in Render
- [ ] Database migrated successfully
- [ ] Health check passing
- [ ] Chat API responding
- [ ] Google OAuth configured
- [ ] Stripe webhook configured
- [ ] Chrome extension updated with new API URL
- [ ] Extension manifest permissions updated
- [ ] Test user authentication flow
- [ ] Test subscription flow
- [ ] Test usage tracking

#### 6.2 Monitor and Debug
- Check Render logs for any errors
- Monitor Stripe webhook delivery
- Test user sign-up and authentication
- Verify usage tracking is working
- Test subscription creation and management

---

## 🔧 Troubleshooting Common Issues

### Database Connection Failed
- Check `DATABASE_URL` in Render environment variables
- Ensure PostgreSQL database is created in Render
- Verify SSL settings for production

### Stripe Webhook Errors
- Check webhook URL is correct: `https://your-app.onrender.com/api/webhooks/stripe`
- Verify webhook secret matches in environment variables
- Check Stripe dashboard for failed webhook attempts

### Google OAuth Issues
- Verify redirect URI matches exactly: `https://your-app.onrender.com/auth/google/callback`
- Check Client ID and Secret are correct
- Ensure Google+ API is enabled

### CORS Errors
- Ensure `ALLOWED_ORIGINS` includes `chrome-extension://*`
- Check Chrome extension manifest permissions
- Verify HTTPS is used in production

### OpenAI Key Issues
- Your existing OpenAI key should work exactly as before
- The backend proxies requests to OpenAI with your key
- No changes needed to your OpenAI account or billing

---

## 📞 Support

If you encounter issues:

1. Check Render logs: Go to your service → Logs
2. Test API endpoints: Use the provided test script
3. Verify environment variables: Check all are set in Render
4. Test database connection: Use Render Shell to connect
5. Check Stripe webhook status: Monitor in Stripe dashboard

For additional help, refer to the main README.md or DEPLOYMENT.md files.
