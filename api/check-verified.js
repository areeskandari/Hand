/**
 * Vercel serverless: GET /api/check-verified?email=xxx
 * Returns { "verified": true } if the email has clicked the verification link.
 */

let kv;
try {
  kv = require('@vercel/kv').kv;
} catch {
  kv = null;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const email = req.query?.email;
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ verified: false });
  }

  if (!kv) {
    return res.status(200).json({ verified: false });
  }

  const value = await kv.get(`verified:${email}`);
  return res.status(200).json({ verified: value === '1' });
};
