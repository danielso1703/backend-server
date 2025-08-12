import fetch from 'node-fetch';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

const testEndpoints = async () => {
  console.log('🧪 Testing API endpoints...\n');

  try {
    // Test health check
    console.log('1. Testing health check...');
    const healthResponse = await fetch(`${BASE_URL}/health`);
    const healthData = await healthResponse.json();
    console.log('✅ Health check:', healthData.status);
    console.log('   Database:', healthData.database);
    console.log('');

    // Test root endpoint
    console.log('2. Testing root endpoint...');
    const rootResponse = await fetch(`${BASE_URL}/`);
    const rootData = await rootResponse.json();
    console.log('✅ Root endpoint:', rootData.status);
    console.log('   Service:', rootData.service);
    console.log('   Version:', rootData.version);
    console.log('');

    // Test chat endpoint (without auth)
    console.log('3. Testing chat endpoint (anonymous)...');
    const chatResponse = await fetch(`${BASE_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          { role: 'user', content: 'Hello, this is a test message.' }
        ],
        model: 'gpt-4o-mini'
      })
    });

    if (chatResponse.ok) {
      const chatData = await chatResponse.json();
      console.log('✅ Chat endpoint (anonymous): Success');
      console.log('   Response has choices:', !!chatData.choices);
    } else {
      const errorData = await chatResponse.json();
      console.log('⚠️  Chat endpoint (anonymous):', errorData.error?.message || 'Failed');
    }
    console.log('');

    // Test auth endpoints (should return 400 without proper data)
    console.log('4. Testing auth endpoints...');
    const authResponse = await fetch(`${BASE_URL}/api/auth/google-signin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({})
    });
    
    if (authResponse.status === 400) {
      console.log('✅ Auth endpoint: Properly validates input');
    } else {
      console.log('⚠️  Auth endpoint: Unexpected response');
    }
    console.log('');

    // Test subscription endpoints (should return 401 without auth)
    console.log('5. Testing subscription endpoints...');
    const subResponse = await fetch(`${BASE_URL}/api/subscriptions/status`, {
      headers: {
        'Authorization': 'Bearer invalid-token'
      }
    });
    
    if (subResponse.status === 401) {
      console.log('✅ Subscription endpoint: Properly requires authentication');
    } else {
      console.log('⚠️  Subscription endpoint: Unexpected response');
    }
    console.log('');

    // Test usage endpoints (should return 401 without auth)
    console.log('6. Testing usage endpoints...');
    const usageResponse = await fetch(`${BASE_URL}/api/usage/status`, {
      headers: {
        'Authorization': 'Bearer invalid-token'
      }
    });
    
    if (usageResponse.status === 401) {
      console.log('✅ Usage endpoint: Properly requires authentication');
    } else {
      console.log('⚠️  Usage endpoint: Unexpected response');
    }
    console.log('');

    console.log('🎉 API testing completed!');
    console.log('📝 Note: Some endpoints require proper authentication to test fully.');

  } catch (error) {
    console.error('❌ API testing failed:', error.message);
    console.log('');
    console.log('💡 Make sure the server is running on:', BASE_URL);
    console.log('   Run: npm run dev');
  }
};

// Run tests
testEndpoints();
