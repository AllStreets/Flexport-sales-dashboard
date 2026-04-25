// Vercel serverless function — proxies OpenSky OAuth token fetch server-side.
// Railway's IPs are blocked by OpenSky; Vercel's IPs are not.
// Browser CORS also blocks client_credentials token POSTs, so this must run server-side.

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const clientId = process.env.VITE_OPENSKY_CLIENT_ID || process.env.OPENSKY_CLIENT_ID;
  const clientSecret = process.env.VITE_OPENSKY_CLIENT_SECRET || process.env.OPENSKY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return res.status(503).json({ error: 'OpenSky credentials not configured' });
  }

  try {
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }).toString();

    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), 8000)
    );

    const request = fetch(
      'https://opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      }
    );

    const r = await Promise.race([request, timeout]);
    const data = await r.json();

    if (!data.access_token) {
      return res.status(503).json({ error: data.error_description || 'No token in response' });
    }
    res.status(200).json({ token: data.access_token, expires_in: data.expires_in || 300 });
  } catch (e) {
    res.status(503).json({ error: e.message });
  }
}
