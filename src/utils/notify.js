const { Notification } = require('../models');

// Создать уведомление. Best-effort — вызывающий не должен падать, если запись не удалась.
// Возвращает промис; в контроллерах вызывать с .catch() (или без await, fire-and-forget).
const createNotification = async (userId, { type, title, body, link }) => {
  try {
    if (!userId) return null;
    return await Notification.create({ userId, type, title, body: body || null, link: link || null });
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
