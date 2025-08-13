// Test file for Chrome Extension Authentication
import fetch from 'node-fetch';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

// Test data
const testUserInfo = {
  email: "test@example.com",
  name: "Test User",
  picture: "https://lh3.googleusercontent.com/a/test",
  id: "123456789",
  verified_email: true,
  given_name: "Test",
  family_name: "User"
};

// Mock Google access token (in real testing, you'd use a valid token)
const mockAccessToken = "ya29.a0AfH6SMC...";

async function testChromeExtensionAuth() {
  console.log('🧪 Testing Chrome Extension Authentication...\n');

  // Test 1: Valid authentication request
  console.log('1. Testing valid authentication request...');
  try {
    const response = await fetch(`${BASE_URL}/api/auth/google-signin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'chrome-extension://jelmebbplokkmdfjbfagadjakiplggnc'
      },
      body: JSON.stringify({
        accessToken: mockAccessToken,
        userInfo: testUserInfo
      })
    });

    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Valid auth request successful');
      console.log('   Token received:', data.token ? 'Yes' : 'No');
      console.log('   User data received:', data.user ? 'Yes' : 'No');
      console.log('   Subscription data received:', data.subscription ? 'Yes' : 'No');
    } else {
      console.log('❌ Valid auth request failed:', data.error?.message);
    }
  } catch (error) {
    console.log('❌ Valid auth request error:', error.message);
  }

  // Test 2: Missing access token
  console.log('\n2. Testing missing access token...');
  try {
    const response = await fetch(`${BASE_URL}/api/auth/google-signin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'chrome-extension://jelmebbplokkmdfjbfagadjakiplggnc'
      },
      body: JSON.stringify({
        userInfo: testUserInfo
      })
    });

    const data = await response.json();
    
    if (response.status === 400 && data.error?.code === 'VALIDATION_ERROR') {
      console.log('✅ Missing access token handled correctly');
    } else {
      console.log('❌ Missing access token not handled correctly:', data);
    }
  } catch (error) {
    console.log('❌ Missing access token test error:', error.message);
  }

  // Test 3: Missing user info
  console.log('\n3. Testing missing user info...');
  try {
    const response = await fetch(`${BASE_URL}/api/auth/google-signin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'chrome-extension://jelmebbplokkmdfjbfagadjakiplggnc'
      },
      body: JSON.stringify({
        accessToken: mockAccessToken
      })
    });

    const data = await response.json();
    
    if (response.status === 400 && data.error?.code === 'VALIDATION_ERROR') {
      console.log('✅ Missing user info handled correctly');
    } else {
      console.log('❌ Missing user info not handled correctly:', data);
    }
  } catch (error) {
    console.log('❌ Missing user info test error:', error.message);
  }

  // Test 4: Invalid user info structure
  console.log('\n4. Testing invalid user info structure...');
  try {
    const response = await fetch(`${BASE_URL}/api/auth/google-signin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'chrome-extension://jelmebbplokkmdfjbfagadjakiplggnc'
      },
      body: JSON.stringify({
        accessToken: mockAccessToken,
        userInfo: {
          email: "test@example.com"
          // Missing required 'id' field
        }
      })
    });

    const data = await response.json();
    
    if (response.status === 400 && data.error?.code === 'VALIDATION_ERROR') {
      console.log('✅ Invalid user info structure handled correctly');
    } else {
      console.log('❌ Invalid user info structure not handled correctly:', data);
    }
  } catch (error) {
    console.log('❌ Invalid user info structure test error:', error.message);
  }

  // Test 5: CORS headers
  console.log('\n5. Testing CORS headers...');
  try {
    const response = await fetch(`${BASE_URL}/api/auth/google-signin`, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'chrome-extension://jelmebbplokkmdfjbfagadjakiplggnc',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type'
      }
    });

    const corsHeaders = {
      'Access-Control-Allow-Origin': response.headers.get('Access-Control-Allow-Origin'),
      'Access-Control-Allow-Methods': response.headers.get('Access-Control-Allow-Methods'),
      'Access-Control-Allow-Headers': response.headers.get('Access-Control-Allow-Headers'),
      'Access-Control-Allow-Credentials': response.headers.get('Access-Control-Allow-Credentials')
    };

    console.log('   CORS Headers:', corsHeaders);
    
    if (corsHeaders['Access-Control-Allow-Origin'] && 
        corsHeaders['Access-Control-Allow-Methods'] && 
        corsHeaders['Access-Control-Allow-Headers']) {
      console.log('✅ CORS headers properly configured');
    } else {
      console.log('❌ CORS headers missing or incomplete');
    }
  } catch (error) {
    console.log('❌ CORS test error:', error.message);
  }

  // Test 6: Rate limiting
  console.log('\n6. Testing rate limiting...');
  try {
    const promises = [];
    for (let i = 0; i < 6; i++) {
      promises.push(
        fetch(`${BASE_URL}/api/auth/google-signin`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Origin': 'chrome-extension://jelmebbplokkmdfjbfagadjakiplggnc'
          },
          body: JSON.stringify({
            accessToken: mockAccessToken,
            userInfo: testUserInfo
          })
        })
      );
    }

    const responses = await Promise.all(promises);
    const rateLimited = responses.some(r => r.status === 429);
    
    if (rateLimited) {
      console.log('✅ Rate limiting is working');
    } else {
      console.log('❌ Rate limiting may not be working correctly');
    }
  } catch (error) {
    console.log('❌ Rate limiting test error:', error.message);
  }

  console.log('\n🏁 Chrome Extension Authentication tests completed!');
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testChromeExtensionAuth().catch(console.error);
}

export { testChromeExtensionAuth };
