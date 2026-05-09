async function testLogin() {
  try {
    // First register a test user
    console.log('Registering test user...');
    const registerRes = await fetch('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        firstName: 'Test',
        lastName: 'User',
        email: 'testuser@example.com',
        password: 'password123',
        role: 'tenant'
      })
    });
    const registerData = await registerRes.json();
    console.log('Register response:', JSON.stringify(registerData, null, 2));

    // Now login
    console.log('Logging in...');
    const res = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({email: 'testuser@example.com', password: 'password123'})
    });
    const data = await res.json();
    console.log('Login response:', JSON.stringify(data, null, 2));
    if (data.token) {
      console.log('Token obtained:', data.token.substring(0, 50) + '...');
      return data.token;
    }
  } catch (err) {
    console.error('Login error:', err);
  }
}

async function testRecommendations(token) {
  try {
    const res = await fetch('http://localhost:3000/api/recommendations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        latitude: 27.7172,
        longitude: 85.3240,
        limit: 5
      })
    });
    const data = await res.json();
    console.log('Recommendations response:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Recommendations error:', err);
  }
}

async function main() {
  const token = await testLogin();
  if (token) {
    await testRecommendations(token);
  }
}

main();