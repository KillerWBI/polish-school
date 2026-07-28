const crypto = require('crypto');
const { verifyWebhook, planForPrice } = require('../src/services/paddle');

const SECRET = 'test_webhook_secret';
const sign = (body, ts = Math.floor(Date.now() / 1000), secret = SECRET) => {
  const h1 = crypto.createHmac('sha256', secret).update(`${ts}:${body}`).digest('hex');
  return `ts=${ts};h1=${h1}`;
};

describe('Подпись вебхука Paddle', () => {
  beforeEach(() => { process.env.PADDLE_WEBHOOK_SECRET = SECRET; });

  test('валидная подпись принимается', () => {
    const body = JSON.stringify({ event_type: 'subscription.created' });
    expect(verifyWebhook(Buffer.from(body), sign(body))).toBe(true);
  });

  test('чужой секрет отвергается', () => {
    const body = JSON.stringify({ event_type: 'subscription.created' });
    expect(verifyWebhook(Buffer.from(body), sign(body, undefined, 'wrong_secret'))).toBe(false);
  });

  test('подменённое тело отвергается', () => {
    const signature = sign(JSON.stringify({ amount: 1 }));
    expect(verifyWebhook(Buffer.from(JSON.stringify({ amount: 999 })), signature)).toBe(false);
  });

  test('без заголовка подписи — отказ', () => {
    expect(verifyWebhook(Buffer.from('{}'), undefined)).toBe(false);
  });

  test('без настроенного секрета — отказ (не открываем эндпоинт случайно)', () => {
    delete process.env.PADDLE_WEBHOOK_SECRET;
    const body = '{}';
    expect(verifyWebhook(Buffer.from(body), sign(body))).toBe(false);
  });
});

describe('Сопоставление Price ID с тарифом', () => {
  test('каждый из трёх платных тарифов узнаётся по своей цене', () => {
    process.env.PADDLE_PRICE_BASIC = 'pri_basic';
    process.env.PADDLE_PRICE_PRO = 'pri_pro';
    process.env.PADDLE_PRICE_SCHOOL = 'pri_school';

    expect(planForPrice('pri_basic')).toBe('basic');
    expect(planForPrice('pri_pro')).toBe('pro');
    expect(planForPrice('pri_school')).toBe('school');
  });

  test('незнакомая цена не даёт тариф', () => {
    expect(planForPrice('pri_unknown')).toBe(null);
    expect(planForPrice(undefined)).toBe(null);
  });
});
