/**
 * Vercel serverless: GET /api/verify-email?token=xxx
 * Validates token, marks email as verified in KV, returns HTML success page.
 */

let kv;
try {
  kv = require('@vercel/kv').kv;
} catch {
  kv = null;
}

const HTML_SUCCESS = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Email verified</title></head>
<body style="font-family:system-ui;max-width:400px;margin:80px auto;text-align:center;padding:24px;">
  <h1 style="color:#1A77F3;">Email verified</h1>
  <p>You can close this tab and return to the extension.</p>
</body>
</html>
`;

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).send('Method not allowed');
  }

  const token = req.query?.token;
  if (!token || !kv) {
    return res.status(400).send('Invalid or missing token');
  }

  const email = await kv.get(`verify_token:${token}`);
  if (!email) {
    return res.status(400).send('Link expired or invalid.');
  }

  await kv.del(`verify_token:${token}`);
  await kv.set(`verified:${email}`, '1', { ex: 86400 * 7 });

  res.setHeader('Content-Type', 'text/html');
  return res.status(200).send(HTML_SUCCESS);
};
