/**
 * Vercel serverless: POST /api/send-verification
 * Body: { "email": "user@example.com" }
 * Sends an email with a verification LINK. Token stored in Vercel KV.
 * Set RESEND_API_KEY, optional FROM_EMAIL and APP_URL (e.g. https://your-app.vercel.app).
 */

const { Resend } = require('resend');
const crypto = require('crypto');

let kv;
try {
  kv = require('@vercel/kv').kv;
} catch {
  kv = null;
}

function generateToken() {
  return crypto.randomBytes(24).toString('hex');
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const email = req.body?.email;
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ message: 'Missing email' });
  }

  if (!kv) {
    return res.status(500).json({ message: 'Vercel KV not configured' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ message: 'RESEND_API_KEY not set' });
  }

  const token = generateToken();
  await kv.set(`verify_token:${token}`, email, { ex: 600 });

  const baseUrl = process.env.APP_URL || `https://${process.env.VERCEL_URL || 'your-app.vercel.app'}`;
  const verifyUrl = `${baseUrl}/api/verify-email?token=${token}`;

  const resend = new Resend(apiKey);
  const from = process.env.FROM_EMAIL || 'onboarding@resend.dev';

  const { error } = await resend.emails.send({
    from,
    to: [email],
    subject: 'Verify your email',
    html: `<p>Click the link below to verify your email:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p><p>This link expires in 10 minutes.</p>`,
  });

  if (error) {
    return res.status(500).json({ message: error.message || 'Failed to send email' });
  }

  return res.status(200).json({ ok: true });
};
