const { User } = require('../models');
const {
  verifyWebhook, planForPrice, paddleConfigured,
  getSubscription, cancelSubscription, resumeSubscription,
} = require('../services/paddle');

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

    // Вебхуки приходят не по порядку: более старое событие не должно перезаписать более новое
    // (иначе запоздавший subscription.updated вернёт платный план уже отменённой подписке).
    const occurredAt = event.occurred_at ? new Date(event.occurred_at) : null;
    const isStale = user?.subscriptionEventAt && occurredAt
      && occurredAt <= new Date(user.subscriptionEventAt);
    if (isStale) return res.json({ received: true, skipped: 'stale' });

    if (['subscription.created', 'subscription.activated', 'subscription.updated', 'subscription.resumed'].includes(type)) {
      const priceId = data.items?.[0]?.price?.id;
      const plan = planForPrice(priceId);
      if (user && plan) {
        await user.update({
          plan,
          paddleCustomerId: data.customer_id || user.paddleCustomerId,
          paddleSubscriptionId: data.id || user.paddleSubscriptionId,
          subscriptionStatus: data.status || null,
          subscriptionEventAt: occurredAt || user.subscriptionEventAt,
        });
        console.log(`[paddle] user ${user.id} → ${plan} (${data.status})`);
      }
    } else if (['subscription.canceled', 'subscription.paused'].includes(type)) {
      if (user) {
        await user.update({
          plan: 'free',
          subscriptionStatus: data.status || 'canceled',
          subscriptionEventAt: occurredAt || user.subscriptionEventAt,
        });
        console.log(`[paddle] user ${user.id} → free (${type})`);
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error('[paddle] webhook error:', err.message);
    // 200, чтобы Paddle не ретраил бесконечно из-за нашей ошибки парсинга
    res.status(200).json({ received: true });
  }
};

// ── GET /billing/status — состояние подписки текущего пользователя ───────────────
// Локальные поля отдаём всегда; в Paddle ходим только если подписка есть и ключ задан
// (иначе бесплатный тариф платил бы задержкой сетевого запроса ни за что).
const status = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: ['id', 'plan', 'subscriptionStatus', 'paddleSubscriptionId'],
    });
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

    const base = {
      plan: user.plan,
      subscriptionStatus: user.subscriptionStatus,
      hasSubscription: Boolean(user.paddleSubscriptionId),
      manageable: Boolean(user.paddleSubscriptionId) && paddleConfigured(),
      nextBilledAt: null,
      scheduledCancelAt: null,
      updatePaymentUrl: null,
    };

    if (!base.manageable) return res.json({ data: base });

    try {
      const sub = await getSubscription(user.paddleSubscriptionId);
      base.subscriptionStatus = sub.status || base.subscriptionStatus;
      base.nextBilledAt = sub.next_billed_at || null;
      base.scheduledCancelAt = sub.scheduled_change?.action === 'cancel'
        ? sub.scheduled_change.effective_at
        : null;
      base.updatePaymentUrl = sub.management_urls?.update_payment_method || null;
    } catch (e) {
      // Paddle недоступен — отдаём то, что знаем локально, страница не должна падать
      console.warn('[paddle] status:', e.message);
    }

    res.json({ data: base });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка получения статуса подписки' });
  }
};

// ── POST /billing/cancel — отмена в конце оплаченного периода ────────────────────
const cancel = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user?.paddleSubscriptionId) {
      return res.status(400).json({ error: 'Активной подписки нет' });
    }
    const sub = await cancelSubscription(user.paddleSubscriptionId);
    // plan НЕ трогаем: оплаченный период дорабатывает, на 'free' переведёт вебхук
    await user.update({ subscriptionStatus: sub.status || user.subscriptionStatus });
    res.json({
      data: {
        scheduledCancelAt: sub.scheduled_change?.effective_at || null,
        subscriptionStatus: sub.status || null,
      },
    });
  } catch (err) {
    console.error('[paddle] cancel:', err.message);
    res.status(502).json({ error: 'Не удалось отменить подписку' });
  }
};

// ── POST /billing/resume — снять запланированную отмену ─────────────────────────
const resume = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user?.paddleSubscriptionId) {
      return res.status(400).json({ error: 'Активной подписки нет' });
    }
    const sub = await resumeSubscription(user.paddleSubscriptionId);
    await user.update({ subscriptionStatus: sub.status || user.subscriptionStatus });
    res.json({ data: { subscriptionStatus: sub.status || null } });
  } catch (err) {
    console.error('[paddle] resume:', err.message);
    res.status(502).json({ error: 'Не удалось возобновить подписку' });
  }
};

module.exports = { webhook, status, cancel, resume };
