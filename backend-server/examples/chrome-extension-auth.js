// Chrome Extension Authentication Example
// This file shows how to implement authentication in your Chrome extension

class ChromeExtensionAuth {
  constructor(backendUrl) {
    this.backendUrl = backendUrl;
    this.authToken = null;
    this.user = null;
  }

  // Initialize authentication
  async init() {
    // Check if we have a stored token
    const storedToken = localStorage.getItem('authToken');
    if (storedToken) {
      try {
        // Verify token is still valid
        const isValid = await this.verifyToken(storedToken);
        if (isValid) {
          this.authToken = storedToken;
          this.user = JSON.parse(localStorage.getItem('user'));
          return { success: true, user: this.user };
        }
      } catch (error) {
        console.log('Stored token is invalid, re-authenticating...');
      }
    }

    // No valid token, need to authenticate
    return this.authenticate();
  }

  // Authenticate with Google OAuth
  async authenticate() {
    try {
      // Get Google access token
      const accessToken = await this.getGoogleToken();
      
      // Get user info from Google
      const userInfo = await this.getGoogleUserInfo(accessToken);
      
      // Authenticate with backend
      const authResult = await this.authenticateWithBackend(accessToken, userInfo);
      
      if (authResult.success) {
        this.authToken = authResult.token;
        this.user = authResult.user;
        
        // Store for future use
        localStorage.setItem('authToken', this.authToken);
        localStorage.setItem('user', JSON.stringify(this.user));
        
        return { success: true, user: this.user };
      } else {
        throw new Error(authResult.error);
      }
    } catch (error) {
      console.error('Authentication failed:', error);
      return { success: false, error: error.message };
    }
  }

  // Get Google access token using Chrome identity API
  getGoogleToken() {
    return new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive: true }, function(token) {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(token);
        }
      });
    });
  }

  // Get user info from Google
  async getGoogleUserInfo(accessToken) {
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to get user info from Google');
    }

    return await response.json();
  }

  // Authenticate with your backend
  async authenticateWithBackend(accessToken, userInfo) {
    const response = await fetch(`${this.backendUrl}/api/auth/google-signin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        accessToken: accessToken,
        userInfo: userInfo
      })
    });

    const data = await response.json();

    if (response.ok) {
      return {
        success: true,
        token: data.token,
        user: data.user,
        subscription: data.subscription
      };
    } else {
      return {
        success: false,
        error: data.error?.message || 'Authentication failed'
      };
    }
  }

  // Verify if stored token is still valid
  async verifyToken(token) {
    try {
      const response = await fetch(`${this.backendUrl}/api/auth/profile`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  // Sign out
  async signOut() {
    try {
      // Call backend signout endpoint
      if (this.authToken) {
        await fetch(`${this.backendUrl}/api/auth/signout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.authToken}`
          }
        });
      }
    } catch (error) {
      console.error('Signout error:', error);
    }

    // Clear local storage
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    
    // Revoke Google token
    if (this.authToken) {
      chrome.identity.removeCachedAuthToken({ token: this.authToken }, () => {});
    }

    this.authToken = null;
    this.user = null;
  }

  // Make authenticated requests
  async authenticatedRequest(url, options = {}) {
    if (!this.authToken) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.authToken}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    // Handle token expiration
    if (response.status === 401) {
      await this.signOut();
      throw new Error('Token expired, please re-authenticate');
    }

    return response;
  }

  // Get current user
  getCurrentUser() {
    return this.user;
  }

  // Check if authenticated
  isAuthenticated() {
    return !!this.authToken;
  }
}

// Usage Example
const auth = new ChromeExtensionAuth('https://your-backend.com');

// Initialize authentication
auth.init().then(result => {
  if (result.success) {
    console.log('Authenticated as:', result.user.name);
    
    // Make authenticated requests
    auth.authenticatedRequest('/api/usage/status')
      .then(response => response.json())
      .then(data => {
        console.log('Usage status:', data);
      });
  } else {
    console.error('Authentication failed:', result.error);
  }
});

// Export for use in other parts of extension
window.ChromeExtensionAuth = ChromeExtensionAuth;
