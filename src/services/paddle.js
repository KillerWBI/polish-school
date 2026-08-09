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
  if (priceId === process.env.PADDLE_PRICE_BASIC) return 'basic';
  if (priceId === process.env.PADDLE_PRICE_PRO) return 'pro';
  if (priceId === process.env.PADDLE_PRICE_SCHOOL) return 'school';
  return null;
};

// ── Paddle API (server-side) ────────────────────────────────────────────────────
// Нужен отдельный ключ PADDLE_API_KEY (не тот, что webhook secret, и не client token).
// Домен зависит от среды: sandbox и production — разные аккаунты и разные ключи.
const apiBase = () => (process.env.PADDLE_ENV === 'production'
  ? 'https://api.paddle.com'
  : 'https://sandbox-api.paddle.com');

const paddleConfigured = () => Boolean(process.env.PADDLE_API_KEY);

const paddleApi = async (path, { method = 'GET', body } = {}) => {
  if (!paddleConfigured()) throw new Error('PADDLE_API_KEY не задан');

  // Без таймаута зависший Paddle подвесил бы и наш запрос
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetch(`${apiBase()}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${process.env.PADDLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json?.error?.detail || `Paddle ответил ${res.status}`);
    }
    return json.data;
  } finally {
    clearTimeout(timer);
  }
};

// Состояние подписки: статус, дата следующего списания, запланированная отмена
const getSubscription = (subscriptionId) => paddleApi(`/subscriptions/${subscriptionId}`);

// Отмена в конце оплаченного периода — деньги за текущий месяц не сгорают
const cancelSubscription = (subscriptionId) =>
  paddleApi(`/subscriptions/${subscriptionId}/cancel`, {
    method: 'POST',
    body: { effective_from: 'next_billing_period' },
  });

// Снять запланированную отмену (пользователь передумал до конца периода)
const resumeSubscription = (subscriptionId) =>
  paddleApi(`/subscriptions/${subscriptionId}`, {
    method: 'PATCH',
    body: { scheduled_change: null },
  });

module.exports = {
  verifyWebhook,
  planForPrice,
  paddleConfigured,
  getSubscription,
  cancelSubscription,
  resumeSubscription,
};
