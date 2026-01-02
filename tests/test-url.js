const axios = require('axios');
const https = require('https');

const url = "https://fs1.sfile.sbs/files/1/g7knvx9nseldzm/_Cima-Now.CoM_Karsa.Tabe3ya.S01E10.HD-1080p.mp4";

async function testUrl() {
  console.log('Testing URL:', url);
  
  try {
    const agent = new https.Agent({
      rejectUnauthorized: false,
      keepAlive: true
    });

    const config = {
      method: 'HEAD',
      url: url,
      httpsAgent: agent,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    };

    console.log('Attempting HEAD request...');
    const response = await axios(config);
    console.log('HEAD Success:', response.status);
    console.log('Headers:', response.headers);
  } catch (error) {
    console.error('HEAD Failed:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
    }
    
    // Try GET
    try {
      console.log('Attempting GET request...');
      const config = {
        method: 'GET',
        url: url,
        httpsAgent: new https.Agent({ rejectUnauthorized: false }),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Range': 'bytes=0-0'
        }
      };
      const response = await axios(config);
      console.log('GET Success:', response.status);
      console.log('Headers:', response.headers);
    } catch (err) {
      console.error('GET Failed:', err.message);
      console.error('Full Error:', err);
    }
  }
}

testUrl();
