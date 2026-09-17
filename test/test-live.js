async function testAPI() {
  try {
    const loginRes = await fetch('https://cms.asisten-guru.my.id/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'aldifajar997@gmail.com', password: 'asdfasdfasdf' })
    });
    
    const loginData = await loginRes.json();
    if (!loginData.accessToken) {
      console.error('Login failed:', loginData);
      return;
    }
    
    console.log('Login success, got token.');
    
    const inviteRes = await fetch('https://cms.asisten-guru.my.id/api/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${loginData.accessToken}`
      },
      body: JSON.stringify({ email: 'fajar.aldi24@gmail.com', name: 'Fajar Aldi' })
    });
    
    const inviteData = await inviteRes.json();
    console.log('Invite Response Status:', inviteRes.status);
    console.log('Invite Response Data:', inviteData);
  } catch (e) {
    console.error(e);
  }
}
testAPI();
