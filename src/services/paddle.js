const crypto = require('crypto');

// Проверка подписи вебхука Paddle (Billing).
// Заголовок Paddle-Signature: "ts=1700000000;h1=<hex-hmac>".
// Валидно, если HMAC-SHA256( `${ts}:${rawBody}` , secret) === h1.
const verifyWebhook = (rawBody, signatureHeader) => {
  const secret = process.env.PADDLE_WEBHOOK_SECRET;
  if (!secret || !signatureHeader) return false;

  const parts = Object.fromEntries(
    String(signatureHeader).split(';').map((p) => p.split('=')),
  );
  const ts = parts.ts;
  const h1 = parts.h1;
  if (!ts || !h1) return false;

  const body = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody || '');
  const expected = crypto.createHmac('sha256', secret).update(`${ts}:${body}`).digest('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(h1, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
};

// price_id -> наш тариф (задаётся в .env)
const planForPrice = (priceId) => {
  if (!priceId) return null;
  if (priceId === process.env.PADDLE_PRICE_PRO) return 'pro';
  if (priceId === process.env.PADDLE_PRICE_SCHOOL) return 'school';
  return null;
};

module.exports = { verifyWebhook, planForPrice };
