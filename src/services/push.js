const webpush = require('web-push');
const { PushSubscription } = require('../models');

/**
 * Отправка Web Push.
 *
 * Схема: сервер не может достучаться до браузера напрямую, поэтому шлёт POST на endpoint,
 * который выдал push-сервис браузера (FCM у Chrome, Mozilla у Firefox, Apple у Safari).
 * Тело шифруется ключами подписки — посредник не должен читать содержимое уведомления.
 */

const PUBLIC_KEY  = process.env.VAPID_PUBLIC_KEY;
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
// Контакт отправителя. Push-сервисы требуют его в VAPID-подписи, чтобы было куда написать,
// если с домена польётся спам. В браузер он не попадает.
const SUBJECT = process.env.VAPID_SUBJECT || 'mailto:support@peravenor.com';

const enabled = Boolean(PUBLIC_KEY && PRIVATE_KEY);
if (enabled) {
  webpush.setVapidDetails(SUBJECT, PUBLIC_KEY, PRIVATE_KEY);
} else {
  // Локально ключей обычно нет — это не ошибка, просто push молчит.
  console.log('[push] VAPID-ключи не заданы, push-уведомления выключены');
}

const isEnabled = () => enabled;
const getPublicKey = () => PUBLIC_KEY || null;

/**
 * Разослать push на все устройства пользователя.
 *
 * Best-effort: вызывается из уведомлений, а те — из контроллеров. Упавший push не должен
 * ронять выставление оценки или приём оплаты, поэтому наружу ошибки не пробрасываются.
 */
const sendToUser = async (userId, { title, body, link, type }) => {
  if (!enabled || !userId) return { sent: 0, removed: 0 };

  try {
    const subs = await PushSubscription.findAll({ where: { userId } });
    if (!subs.length) return { sent: 0, removed: 0 };

    // Лимит тела у push-сервисов около 4 КБ, и это ПОСЛЕ шифрования (оно добавляет накладные).
    // Поэтому в payload только то, что нужно показать; всё остальное фронт возьмёт по ссылке.
    const payload = JSON.stringify({ title, body: body || '', link: link || '/', type: type || '' });

    // allSettled, а не all: одна протухшая подписка не должна отменить доставку на остальные
    // устройства. При all первый reject оборвал бы всю рассылку.
    const results = await Promise.allSettled(
      subs.map((s) => webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        payload,
        { TTL: 60 * 60 * 24 }, // сутки: телефон может быть офлайн, но вчерашняя новость уже не нужна
      )),
    );

    // Разбор отказов. Ключевое различие:
    //   404 / 410 — подписки больше нет и не будет (снесли разрешение, переустановили браузер).
    //               Такую строку надо удалить, иначе таблица копит мусор и каждая рассылка
    //               тратит запрос впустую — а push-сервисы за это режут репутацию отправителя.
    //   всё прочее (429, 5xx, сеть) — временное, подписку не трогаем.
    const dead = [];
    results.forEach((r, i) => {
      if (r.status === 'rejected' && [404, 410].includes(r.reason?.statusCode)) {
        dead.push(subs[i].id);
      }
    });
    if (dead.length) await PushSubscription.destroy({ where: { id: dead } });

    const sent = results.filter((r) => r.status === 'fulfilled').length;
    return { sent, removed: dead.length };
  } catch (e) {
    console.error('[push] рассылка не удалась:', e.message);
    return { sent: 0, removed: 0 };
  }
};

module.exports = { sendToUser, isEnabled, getPublicKey };
