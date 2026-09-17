const axios = require('axios');
(async () => {
  try {
    const res = await axios.put('http://127.0.0.1:8787/api/users/me', {
      avatar_url: ''
    }, {
      headers: {
        'Cookie': 'refresh_token=YOUR_TOKEN_HERE',
        'Authorization': 'Bearer YOUR_TOKEN_HERE'
      }
    });
    console.log(res.data);
  } catch (e) {
    console.error(e.response ? e.response.data : e.message);
  }
})();
