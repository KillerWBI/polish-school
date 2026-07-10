const { Notification } = require('../models');

// GET /notifications — мои уведомления (?unread=true — только непрочитанные) + счётчик непрочитанных
const list = async (req, res) => {
  try {
    const where = { userId: req.user.id };
    if (req.query.unread === 'true') where.readAt = null;

    const rows = await Notification.findAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: 50,
    });
    const unreadCount = await Notification.count({ where: { userId: req.user.id, readAt: null } });

    res.json({ data: rows, meta: { unreadCount } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка получения уведомлений' });
  }
};

// PATCH /notifications/:id/read — отметить одно прочитанным
const markRead = async (req, res) => {
  try {
    const n = await Notification.findOne({ where: { id: req.params.id, userId: req.user.id } });
    if (!n) return res.status(404).json({ error: 'Уведомление не найдено' });
    if (!n.readAt) await n.update({ readAt: new Date() });
    res.json({ data: { id: n.id, readAt: n.readAt } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка' });
  }
};

// PATCH /notifications/read-all — отметить все прочитанными
const markAllRead = async (req, res) => {
  try {
    await Notification.update(
      { readAt: new Date() },
      { where: { userId: req.user.id, readAt: null } }
    );
    res.json({ data: { ok: true } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка' });
  }
};

module.exports = { list, markRead, markAllRead };
