const { Notification } = require('../models');
const push = require('../services/push');

// Создать уведомление. Best-effort — вызывающий не должен падать, если запись не удалась.
// Возвращает промис; в контроллерах вызывать с .catch() (или без await, fire-and-forget).
//
// Здесь же уходит push: это единственная точка, через которую в приложении рождается
// уведомление, поэтому подключать его в каждом контроллере не нужно.
const createNotification = async (userId, { type, title, body, link }) => {
  try {
    if (!userId) return null;
    const row = await Notification.create({ userId, type, title, body: body || null, link: link || null });

    // Намеренно БЕЗ await: поход к push-сервису это сеть, и ждать его внутри обработки
    // запроса значит замедлить ответ пользователю ради уведомления другому человеку.
    // Запись в БД уже сделана — колокольчик покажет событие, даже если push не дойдёт.
    push.sendToUser(userId, { title, body, link, type });

    return row;
  } catch (e) {
    console.error('[notify] не удалось создать уведомление:', e.message);
    return null;
  }
};

// Пакетное создание — для рассылки студентам группы (одно и то же событие многим).
const notifyMany = async (userIds, payload) => {
  const ids = [...new Set((userIds || []).filter(Boolean))];
  await Promise.all(ids.map((uid) => createNotification(uid, payload)));
};

module.exports = { createNotification, notifyMany };
