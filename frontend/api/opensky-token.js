// Vercel serverless function — proxies OpenSky OAuth token fetch server-side.
// Railway's IPs are blocked by OpenSky; Vercel's IPs are not.
// Browser CORS also blocks client_credentials token POSTs, so this must run server-side.
const https = require('https');
const querystring = require('querystring');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const clientId = process.env.VITE_OPENSKY_CLIENT_ID || process.env.OPENSKY_CLIENT_ID;
  const clientSecret = process.env.VITE_OPENSKY_CLIENT_SECRET || process.env.OPENSKY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return res.status(503).json({ error: 'OpenSky credentials not configured' });
  }

  const body = querystring.stringify({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
  });

  try {
    const token = await new Promise((resolve, reject) => {
      const options = {
        hostname: 'opensky-network.org',
        path: '/auth/realms/opensky-network/protocol/openid-connect/token',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(body),
        },
      };
      const request = https.request(options, (response) => {
        let data = '';
        response.on('data', chunk => { data += chunk; });
        response.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.access_token) resolve(parsed.access_token);
            else reject(new Error(parsed.error_description || 'No token in response'));
          } catch (e) { reject(e); }
        });
      });
      request.on('error', reject);
      request.setTimeout(8000, () => { request.destroy(); reject(new Error('timeout')); });
      request.write(body);
      request.end();
    });
    res.status(200).json({ token, expires_in: 300 });
  } catch (e) {
    res.status(503).json({ error: e.message });
  }
};
