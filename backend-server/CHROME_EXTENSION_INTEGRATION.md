# Chrome Extension Integration Guide

## 🚀 **Updated Authentication System**

Your Chrome extension needs to be updated to use the new authentication format. The backend now supports Google OAuth access tokens (not ID tokens) which is the standard for Chrome extensions.

## 📡 **API Endpoint**

```
POST https://your-backend.com/api/auth/google-signin
```

## 🔄 **Request Format (CHANGED)**

### **OLD FORMAT (no longer works):**
```json
{
  "idToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### **NEW FORMAT (use this):**
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

## 🔐 **Complete Authentication Flow**

```javascript
// 1. Get access token from Chrome
chrome.identity.getAuthToken({ interactive: true }, function(token) {
  if (chrome.runtime.lastError) {
    console.error('Auth error:', chrome.runtime.lastError);
    return;
  }
  
  // 2. Get user info from Google
  fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  .then(response => response.json())
  .then(userInfo => {
    // 3. Send to your backend
    return fetch('https://your-backend.com/api/auth/google-signin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accessToken: token,
        userInfo: userInfo
      })
    });
  })
  .then(response => response.json())
  .then(data => {
    // 4. Store JWT token for future requests
    localStorage.setItem('authToken', data.token);
    console.log('Authentication successful:', data.user);
  })
  .catch(error => {
    console.error('Authentication failed:', error);
  });
});
```

## 📤 **Response Format**

Your extension will receive:

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "name": "User Name",
    "picture": "https://lh3.googleusercontent.com/a/...",
    "googleId": "123456789"
  },
  "subscription": {
    "status": "active",
    "questionsUsed": 5,
    "questionsLimit": 50
  }
}
```

## 🔑 **Using the JWT Token**

For all future API requests, include the token:

```javascript
fetch('https://your-backend.com/api/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
  },
  body: JSON.stringify({
    messages: [
      { role: 'user', content: 'Hello, how are you?' }
    ],
    model: 'gpt-4o-mini'
  })
})
.then(response => response.json())
.then(data => {
  console.log('Chat response:', data);
})
.catch(error => {
  console.error('Chat error:', error);
});
```

## ⚠️ **Error Handling**

The backend will return errors in this format:

```json
{
  "error": {
    "code": "AUTH_FAILED",
    "message": "Invalid access token",
    "timestamp": "2025-01-15T10:30:00.000Z"
  }
}
```

## 🚨 **Common Error Codes**

| Code | Description | HTTP Status | Action |
|------|-------------|-------------|---------|
| `VALIDATION_ERROR` | Missing required fields | 400 | Check request format |
| `AUTH_FAILED` | Invalid token or user info mismatch | 401 | Re-authenticate user |
| `RATE_LIMIT_EXCEEDED` | Too many requests | 429 | Wait and retry |
| `SERVER_ERROR` | Internal server error | 500 | Contact support |

## 🧪 **Testing**

You can test the endpoint with curl:

```bash
curl -X POST https://your-backend.com/api/auth/google-signin \
  -H "Content-Type: application/json" \
  -d '{
    "accessToken": "your_access_token",
    "userInfo": {
      "email": "test@example.com",
      "name": "Test User",
      "id": "123456789"
    }
  }'
```

## 📋 **Implementation Checklist**

- [ ] Update authentication request format
- [ ] Get user info from Google's userinfo endpoint
- [ ] Send both accessToken and userInfo to backend
- [ ] Store JWT token from response
- [ ] Use JWT token in Authorization header for other requests
- [ ] Handle authentication errors properly
- [ ] Test the complete flow

## 🔧 **Chrome Extension Configuration**

### **manifest.json**
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

### **Background Script Example**
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

async function authenticateWithBackend(token, sendResponse) {
  try {
    // Get user info from Google
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const userInfo = await userInfoResponse.json();
    
    // Authenticate with backend
    const authResponse = await fetch('https://your-backend.com/api/auth/google-signin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accessToken: token,
        userInfo: userInfo
      })
    });
    
    const authData = await authResponse.json();
    
    if (authResponse.ok) {
      // Store token for future use
      chrome.storage.local.set({ authToken: authData.token });
      sendResponse({ success: true, user: authData.user });
    } else {
      sendResponse({ error: authData.error.message });
    }
  } catch (error) {
    sendResponse({ error: 'Authentication failed' });
  }
}
```

## 🚨 **Important Notes**

1. **No more ID tokens** - Chrome extensions can only provide access tokens
2. **User info is required** - Must include email and id from Google
3. **CORS is configured** - Chrome extensions are allowed
4. **Rate limiting** - 5 auth attempts per 15 minutes per IP
5. **JWT token expires** - Default 7 days, store and refresh as needed

## 🔄 **Token Refresh**

The JWT token expires after 7 days. Handle token refresh:

```javascript
async function makeAuthenticatedRequest(url, options = {}) {
  const token = localStorage.getItem('authToken');
  
  if (!token) {
    // Re-authenticate user
    await authenticateUser();
    return makeAuthenticatedRequest(url, options);
  }
  
  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${token}`
    }
  });
  
  if (response.status === 401) {
    // Token expired, re-authenticate
    localStorage.removeItem('authToken');
    await authenticateUser();
    return makeAuthenticatedRequest(url, options);
  }
  
  return response;
}
```

## 📞 **Support**

If you encounter issues:

1. Check the browser console for error messages
2. Verify Google OAuth is properly configured
3. Ensure all required fields are included in the request
4. Check that the backend URL is correct
5. Monitor rate limiting (429 errors)

---

**Backend URL**: `https://your-backend.com`  
**Authentication Endpoint**: `/api/auth/google-signin`  
**Documentation**: See `CHROME_EXTENSION_AUTH.md` for detailed API docs
