const apiKey = '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';

async function testEmail() {
  const email = 'fajar.aldi24@gmail.com';
  console.log(`Mengirim email pengujian ke ${email}...`);

  try {
    const brevoResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        templateId: 4,
        to: [{ email: email, name: 'Fajar Aldi' }],
        params: {
          NAME: 'Fajar Aldi',
          EMAIL: email,
          SETUP_LINK: 'https://cms.asisten-guru.my.id/?reset_token=TEST-ONLY-FROM-SYSTEM'
        }
      })
    });

    if (brevoResponse.ok) {
      console.log('✅ BERHASIL! Brevo mengonfirmasi email terkirim. HTTP Status:', brevoResponse.status);
      const data = await brevoResponse.json();
      console.log('Response dari Brevo:', data);
    } else {
      console.log('❌ GAGAL mengirim email. HTTP Status:', brevoResponse.status);
      const text = await brevoResponse.text();
      console.log('Pesan Error:', text);
    }
  } catch (err) {
    console.error('Fetch error:', err);
  }
}

testEmail();
