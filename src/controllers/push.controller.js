const { PushSubscription } = require('../models');
const push = require('../services/push');

// GET /push/key — публичный VAPID-ключ для браузера.
// Публичный по определению: браузер вкладывает его в подписку, чтобы push-сервис потом
// сверял с ним подпись отправителя. Приватный остаётся на сервере и наружу не выходит.
// Отдаём с сервера, а не зашиваем во фронт, чтобы ключ был в одном месте: перегенерировали
// пару — достаточно поменять переменные окружения, пересобирать фронт не нужно.
const getKey = async (req, res) => {
  try {
    if (!push.isEnabled()) {
      return res.status(503).json({ error: 'Push-уведомления не настроены на сервере' });
    }
    res.json({ data: { publicKey: push.getPublicKey() } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка получения ключа' });
  }
};

/**
 * POST /push/subscribe — сохранить подписку браузера.
 *
 * Приходит объект от `pushManager.subscribe()`. Тот же браузер может прислать тот же
 * endpoint повторно (переустановка приложения, повторная выдача разрешения), поэтому
 * пишем через upsert по endpoint — иначе накопились бы дубли и человек получал бы
 * по два одинаковых уведомления на одно устройство.
 */
const subscribe = async (req, res) => {
  try {
    const { endpoint, keys } = req.body; // проверено схемой

    const existing = await PushSubscription.findOne({ where: { endpoint } });
    if (existing) {
      // Endpoint мог достаться другому аккаунту на том же устройстве (вышел один, вошёл
      // другой). Тогда подписку надо переназначить, а не завести вторую с тем же адресом:
      // push ушёл бы прежнему владельцу устройства.
      await existing.update({
        userId:    req.user.id,
        p256dh:    keys.p256dh,
        auth:      keys.auth,
        userAgent: (req.get('user-agent') || '').slice(0, 255),
      });
      return res.json({ data: { id: existing.id, updated: true } });
    }

    const row = await PushSubscription.create({
      userId:    req.user.id,
      endpoint,
      p256dh:    keys.p256dh,
      auth:      keys.auth,
      userAgent: (req.get('user-agent') || '').slice(0, 255),
    });
    res.status(201).json({ data: { id: row.id, updated: false } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сохранения подписки' });
  }
};

// DELETE /push/subscribe — отписаться (человек выключил тумблер в настройках).
// Удаляем по endpoint, а не по id: фронт знает свой endpoint из браузера,
// а id подписки в БД ему неизвестен и знать его незачем.
const unsubscribe = async (req, res) => {
  try {
    const { endpoint } = req.body;
    await PushSubscription.destroy({ where: { endpoint, userId: req.user.id } });
    res.json({ data: { message: 'Подписка удалена' } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка удаления подписки' });
  }
};

// GET /push/status — есть ли у этого пользователя хоть одна подписка.
// Нужен настройкам: тумблер должен показывать состояние, а не гадать.
const status = async (req, res) => {
  try {
    const count = await PushSubscription.count({ where: { userId: req.user.id } });
    res.json({ data: { enabled: push.isEnabled(), devices: count } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка получения статуса' });
  }
};

module.exports = { getKey, subscribe, unsubscribe, status };
