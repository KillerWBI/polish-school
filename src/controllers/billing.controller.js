const { User } = require('../models');
const { verifyWebhook, planForPrice } = require('../services/paddle');

// POST /billing/webhook — приём событий Paddle (billing). Тело — RAW (см. app.js).
// Обновляет User.plan по подписке. Отвечаем 200 всегда (иначе Paddle ретраит).
const webhook = async (req, res) => {
  try {
    const raw = req.body; // Buffer (express.raw)
    if (!verifyWebhook(raw, req.headers['paddle-signature'])) {
      return res.status(401).json({ error: 'bad signature' });
    }

    const event = JSON.parse(raw.toString('utf8'));
    const type = event.event_type;
    const data = event.data || {};

    // Ищем нашего пользователя: сначала по custom_data.userId (передаём при checkout),
    // затем по сохранённому paddleCustomerId.
    const userId = data.custom_data?.userId;
    let user = null;
    if (userId) user = await User.findByPk(userId).catch(() => null);
    if (!user && data.customer_id) {
      user = await User.findOne({ where: { paddleCustomerId: data.customer_id } }).catch(() => null);
    }

    if (['subscription.created', 'subscription.activated', 'subscription.updated', 'subscription.resumed'].includes(type)) {
      const priceId = data.items?.[0]?.price?.id;
      const plan = planForPrice(priceId);
      if (user && plan) {
        await user.update({
          plan,
          paddleCustomerId: data.customer_id || user.paddleCustomerId,
          paddleSubscriptionId: data.id || user.paddleSubscriptionId,
          subscriptionStatus: data.status || null,
        });
        console.log(`[paddle] ${user.email} → ${plan} (${data.status})`);
      }
    } else if (['subscription.canceled', 'subscription.paused'].includes(type)) {
      if (user) {
        await user.update({ plan: 'free', subscriptionStatus: data.status || 'canceled' });
        console.log(`[paddle] ${user.email} → free (${type})`);
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error('[paddle] webhook error:', err.message);
    // 200, чтобы Paddle не ретраил бесконечно из-за нашей ошибки парсинга
    res.status(200).json({ received: true });
  }
};

module.exports = { webhook };
