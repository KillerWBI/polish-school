const { Notification } = require('../models');
const { Op } = require('sequelize');

// Сколько прочитанное уведомление ещё висит в колокольчике.
// Убирать сразу нельзя: пользователь кликает по списку, и запись исчезала бы под курсором.
const READ_GRACE_MS = 60 * 60 * 1000; // 1 час

// GET /notifications — лента колокольчика: непрочитанные + прочитанные за последний час.
// ?unread=true — только непрочитанные. Всё остальное живёт в «Истории событий».
const list = async (req, res) => {
  try {
    const where = { userId: req.user.id };
    if (req.query.unread === 'true') {
      where.readAt = null;
    } else {
      where[Op.or] = [
        { readAt: null },
        { readAt: { [Op.gt]: new Date(Date.now() - READ_GRACE_MS) } },
      ];
    }

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

// GET /notifications/history?page=&limit= — полная история событий, включая давно прочитанные
const history = async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 30));

    const { rows, count } = await Notification.findAndCountAll({
      where: { userId: req.user.id },
      order: [['createdAt', 'DESC']],
      limit,
      offset: (page - 1) * limit,
    });

    res.json({ data: rows, meta: { page, limit, total: count, pages: Math.ceil(count / limit) } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка получения истории событий' });
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

module.exports = { list, history, markRead, markAllRead };
