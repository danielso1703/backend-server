# Chrome Extension Authentication Guide

## Overview

This backend supports Chrome extension authentication using Google OAuth access tokens. The implementation is specifically designed for Chrome extensions that can only provide access tokens (not ID tokens) from Google OAuth.

## Authentication Flow

### 1. Chrome Extension Side

```javascript
// In your Chrome extension
chrome.identity.getAuthToken({ interactive: true }, function(token) {
  // Get user info from Google
  fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })
  .then(response => response.json())
  .then(userInfo => {
    // Send to your backend
    return fetch('https://your-backend.com/api/auth/google-signin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        accessToken: token,
        userInfo: userInfo
      })
    });
  })
  .then(response => response.json())
  .then(data => {
    // Store JWT token for future requests
    localStorage.setItem('authToken', data.token);
  });
});
```

### 2. Backend Processing

1. **Validate Request**: Check for required `accessToken` and `userInfo`
2. **Verify Token**: Call Google's tokeninfo API to validate the access token
3. **Validate User Info**: Ensure user info matches token data
4. **Create/Update User**: Store or update user in database
5. **Generate JWT**: Create JWT token for future requests
6. **Return Response**: Send back JWT token and user data

## API Endpoint

### POST `/api/auth/google-signin`

**Request Format:**
```json
{
  "accessToken": "ya29.a0AfH6SMC...",
  "userInfo": {
    "email": "user@example.com",
    "name": "User Name",
    "picture": "https://lh3.googleusercontent.com/a/...",
    "id": "123456789",
    "verified_email": true,
    "given_name": "User",
    "family_name": "Name"
  }
}
```

**Success Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "User Name",
    "picture": "https://lh3.googleusercontent.com/a/...",
    "googleId": "123456789"
  },
  "subscription": {
    "status": "active",
    "questionsUsed": 25,
    "questionsLimit": 50
  }
}
```

**Error Response:**
```json
{
  "error": {
    "code": "AUTH_FAILED",
    "message": "Invalid access token",
    "timestamp": "2025-01-15T10:30:00.000Z"
  }
}
```

## Error Codes

| Code | Description | HTTP Status |
|------|-------------|-------------|
| `VALIDATION_ERROR` | Missing required fields | 400 |
| `AUTH_FAILED` | Invalid token or user info mismatch | 401 |
| `RATE_LIMIT_EXCEEDED` | Too many authentication attempts | 429 |
| `SERVER_ERROR` | Internal server error | 500 |

## Security Features

### 1. Token Verification
- Validates access token with Google's API
- Ensures token is not expired
- Verifies token belongs to the correct user

### 2. User Info Validation
- Matches `user_id` from token with `userInfo.id`
- Matches `email` from token with `userInfo.email`
- Prevents user info spoofing

### 3. Rate Limiting
- 5 authentication attempts per 15 minutes per IP
- Prevents brute force attacks
- Configurable limits

### 4. CORS Configuration
- Allows Chrome extension origins
- Secure cross-origin requests
- Proper headers for extension communication

### 5. Logging & Monitoring
- Logs all authentication attempts
- Tracks success/failure rates
- Monitors for suspicious patterns

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
```

## Testing

### Run Authentication Tests
```bash
npm run test:auth
```

### Test Cases Covered
1. Missing required fields validation
2. Invalid access token handling
3. User info mismatch detection
4. CORS headers verification
5. Rate limiting functionality
6. Valid request format acceptance

### Manual Testing
```bash
# Test with curl
curl -X POST http://localhost:3000/api/auth/google-signin \
  -H "Content-Type: application/json" \
  -d '{
    "accessToken": "invalid-token",
    "userInfo": {
      "email": "test@example.com",
      "name": "Test User",
      "id": "123456789"
    }
  }'
```

## Environment Variables

Required environment variables for Chrome extension authentication:

```env
# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id

# JWT
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=7d

# CORS
ALLOWED_ORIGINS=chrome-extension://*,moz-extension://*

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=200
```

## Chrome Extension Configuration

### manifest.json
```json
{
  "permissions": [
    "identity"
  ],
  "oauth2": {
    "client_id": "your-google-client-id.apps.googleusercontent.com",
    "scopes": [
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/userinfo.profile"
    ]
  }
}
```

### Background Script
```javascript
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'authenticate') {
    chrome.identity.getAuthToken({ interactive: true }, function(token) {
      if (chrome.runtime.lastError) {
        sendResponse({ error: chrome.runtime.lastError.message });
        return;
      }
      
      // Get user info and authenticate with backend
      authenticateWithBackend(token, sendResponse);
    });
    
    return true; // Keep message channel open
  }
});
```

## Troubleshooting

### Common Issues

1. **CORS Errors**
   - Ensure `ALLOWED_ORIGINS` includes your extension ID
   - Check that extension ID matches exactly

2. **Token Validation Failures**
   - Verify Google OAuth is properly configured
   - Check that scopes include userinfo endpoints
   - Ensure access token is not expired

3. **Rate Limiting**
   - Check rate limit configuration
   - Monitor authentication logs
   - Consider increasing limits for development

4. **Database Connection**
   - Verify database is running
   - Check connection string
   - Run migrations if needed

### Debug Logging

Enable debug logging by setting:
```env
LOG_LEVEL=debug
```

This will show detailed authentication flow logs.

## Monitoring

### Key Metrics
- Authentication success rate
- Token validation failures
- Rate limit hits
- New user registrations
- User login frequency

### Log Analysis
```bash
# View authentication logs
grep "google_signin" logs/all.log

# Monitor rate limiting
grep "RATE_LIMIT_EXCEEDED" logs/error.log
```

## Best Practices

1. **Always verify tokens** with Google's API
2. **Validate user info** matches token data
3. **Use HTTPS** for all requests
4. **Implement proper error handling**
5. **Monitor authentication patterns**
6. **Keep JWT secrets secure**
7. **Regular security audits**
8. **Update dependencies regularly**

## Support

For issues with Chrome extension authentication:

1. Check the logs for detailed error messages
2. Verify Google OAuth configuration
3. Test with the provided test suite
4. Review CORS and rate limiting settings
5. Ensure database is properly configured

---

**Note**: This authentication system is specifically designed for Chrome extensions and may not work with other OAuth flows that provide ID tokens instead of access tokens.
