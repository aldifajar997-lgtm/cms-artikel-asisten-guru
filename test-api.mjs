import fs from 'fs';

async function testApi() {
  console.log('Logging in...');
  const loginRes = await fetch('http://localhost:8787/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@asisten-guru.id', password: 'password123' }) // Need correct credentials, wait
  });

  const loginData = await loginRes.json();
  console.log('Login Response:', loginData);
}

testApi();
