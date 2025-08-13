import fetch from 'node-fetch';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

const testAuthEndpoints = async () => {
  console.log('🧪 Testing Chrome Extension Authentication...\n');

  try {
    // Test 1: Missing required fields
    console.log('1. Testing missing required fields...');
    const missingFieldsResponse = await fetch(`${BASE_URL}/api/auth/google-signin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({})
    });
    
    if (missingFieldsResponse.status === 400) {
      const errorData = await missingFieldsResponse.json();
      console.log('✅ Missing fields validation:', errorData.error.code === 'VALIDATION_ERROR' ? 'PASS' : 'FAIL');
    } else {
      console.log('❌ Missing fields validation: Unexpected response');
    }
    console.log('');

    // Test 2: Missing userInfo structure
    console.log('2. Testing missing userInfo structure...');
    const missingUserInfoResponse = await fetch(`${BASE_URL}/api/auth/google-signin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        accessToken: 'fake-token'
      })
    });
    
    if (missingUserInfoResponse.status === 400) {
      const errorData = await missingUserInfoResponse.json();
      console.log('✅ Missing userInfo validation:', errorData.error.code === 'VALIDATION_ERROR' ? 'PASS' : 'FAIL');
    } else {
      console.log('❌ Missing userInfo validation: Unexpected response');
    }
    console.log('');

    // Test 3: Invalid access token
    console.log('3. Testing invalid access token...');
    const invalidTokenResponse = await fetch(`${BASE_URL}/api/auth/google-signin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        accessToken: 'invalid-token-123',
        userInfo: {
          email: 'test@example.com',
          name: 'Test User',
          picture: 'https://example.com/picture.jpg',
          id: '123456789',
          verified_email: true
        }
      })
    });
    
    if (invalidTokenResponse.status === 401) {
      const errorData = await invalidTokenResponse.json();
      console.log('✅ Invalid token validation:', errorData.error.code === 'AUTH_FAILED' ? 'PASS' : 'FAIL');
    } else {
      console.log('❌ Invalid token validation: Unexpected response');
    }
    console.log('');

    // Test 4: Valid request format (will fail due to invalid token, but tests structure)
    console.log('4. Testing valid request format...');
    const validFormatResponse = await fetch(`${BASE_URL}/api/auth/google-signin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        accessToken: 'ya29.a0AfH6SMC...',
        userInfo: {
          email: 'test@example.com',
          name: 'Test User',
          picture: 'https://lh3.googleusercontent.com/a/test',
          id: '123456789',
          verified_email: true,
          given_name: 'Test',
          family_name: 'User'
        }
      })
    });
    
    // This should fail with AUTH_FAILED due to invalid token, but the format is correct
    if (validFormatResponse.status === 401) {
      const errorData = await validFormatResponse.json();
      console.log('✅ Valid format accepted:', errorData.error.code === 'AUTH_FAILED' ? 'PASS' : 'FAIL');
    } else {
      console.log('❌ Valid format test: Unexpected response');
    }
    console.log('');

    // Test 5: CORS headers for Chrome extension
    console.log('5. Testing CORS headers...');
    const corsResponse = await fetch(`${BASE_URL}/api/auth/google-signin`, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'chrome-extension://jelmebbplokkmdfjbfagadjakiplggnc',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type'
      }
    });
    
    const corsHeaders = corsResponse.headers;
    console.log('✅ CORS headers:', {
      'Access-Control-Allow-Origin': corsHeaders.get('access-control-allow-origin'),
      'Access-Control-Allow-Methods': corsHeaders.get('access-control-allow-methods'),
      'Access-Control-Allow-Headers': corsHeaders.get('access-control-allow-headers')
    });
    console.log('');

    // Test 6: Rate limiting
    console.log('6. Testing rate limiting...');
    const rateLimitPromises = [];
    for (let i = 0; i < 6; i++) {
      rateLimitPromises.push(
        fetch(`${BASE_URL}/api/auth/google-signin`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            accessToken: 'fake-token-' + i,
            userInfo: {
              email: 'test' + i + '@example.com',
              name: 'Test User ' + i,
              id: '123456789' + i
            }
          })
        })
      );
    }
    
    const rateLimitResponses = await Promise.all(rateLimitPromises);
    const rateLimited = rateLimitResponses.some(response => response.status === 429);
    console.log('✅ Rate limiting:', rateLimited ? 'PASS' : 'FAIL');
    console.log('');

    console.log('🎉 Authentication endpoint testing completed!');
    console.log('📝 Note: To test with real Google tokens, you need valid access tokens from your Chrome extension.');

  } catch (error) {
    console.error('❌ Authentication testing failed:', error.message);
    console.log('');
    console.log('💡 Make sure the server is running on:', BASE_URL);
    console.log('   Run: npm run dev');
  }
};

// Run tests
testAuthEndpoints();
