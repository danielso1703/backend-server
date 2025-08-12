# 🚀 Quick Start Guide

## Essential Steps (30 minutes)

### 1. Deploy to Render (10 min)
1. Go to [Render.com](https://render.com)
2. Click "New +" → "Web Service"
3. Connect your GitHub repo
4. Build Command: `npm install`
5. Start Command: `npm start`
6. Add PostgreSQL database in Render
7. Copy `DATABASE_URL` to environment variables

### 2. Set Environment Variables (5 min)
In Render dashboard, add these **required** variables:

```env
# Your existing OpenAI key (no changes needed)
OPENAI_API_KEY=sk-your-openai-api-key-here

# Generate a random string
JWT_SECRET=your_super_secret_jwt_key_make_it_long_and_random

# Database (Render provides this)
DATABASE_URL=postgresql://ai_calendar_user:password@host:port/ai_calendar_db

# Server settings
NODE_ENV=production
PORT=10000
ALLOWED_ORIGINS=chrome-extension://*,http://localhost:3000

# Subscription limits
FREE_QUESTIONS_LIMIT=50
PREMIUM_QUESTIONS_LIMIT=1000
```

### 3. Initialize Database (2 min)
1. Go to your Render service → Shell
2. Run: `npm run migrate`

### 4. Test Backend (3 min)
```bash
# Test health
curl https://your-app.onrender.com/health

# Test chat (should work exactly like before)
curl -X POST https://your-app.onrender.com/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Hello"}],"model":"gpt-4o-mini"}'
```

### 5. Update Chrome Extension (5 min)
1. Update `manifest.json`:
```json
{
  "permissions": ["https://your-app.onrender.com/*"],
  "host_permissions": ["https://your-app.onrender.com/*"]
}
```

2. Update API calls:
```javascript
// Replace your current API URL with:
const API_BASE = 'https://your-app.onrender.com';

// Your existing chat calls will work the same way
const response = await fetch(`${API_BASE}/api/chat`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ messages, model: 'gpt-4o-mini' })
});
```

## ✅ Done!

Your backend is now running with:
- ✅ Same OpenAI functionality (no changes to your key)
- ✅ Usage tracking for authenticated users
- ✅ Ready for subscription features
- ✅ Production-ready security

## 🔧 Optional: Add Authentication & Payments

If you want to add user authentication and payments later:

1. **Google OAuth**: Set up in Google Cloud Console
2. **Stripe**: Create products and webhooks
3. **Add remaining environment variables**

See `SETUP_STEPS.md` for detailed instructions.

## 🆘 Need Help?

- Check Render logs for errors
- Test with: `npm test` (if running locally)
- Verify environment variables are set
- Ensure database migration ran successfully
