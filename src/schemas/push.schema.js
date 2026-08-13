const { z } = require('zod');

// POST /push/subscribe — то, что вернул pushManager.subscribe() в браузере.
// Форма фиксирована спецификацией Push API, поэтому проверяем её строго:
// кривой объект здесь превратился бы в неотправляемую подписку и молчаливо
// сломал бы уведомления на этом устройстве.
const subscribePush = z.object({
  // Адрес push-сервиса. Только https — по спецификации иначе не бывает,
  // а свободная строка позволила бы записать в таблицу произвольный URL.
  endpoint: z.url('Неверный endpoint').startsWith('https://', 'endpoint должен быть https'),
  keys: z.object({
    p256dh: z.string().min(1, 'Нет ключа p256dh'),
    auth:   z.string().min(1, 'Нет ключа auth'),
  }),
});

// DELETE /push/subscribe
const unsubscribePush = z.object({
  endpoint: z.url('Неверный endpoint'),
});

module.exports = { subscribePush, unsubscribePush };
