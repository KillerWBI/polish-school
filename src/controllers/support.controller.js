const { SupportTicket, User } = require('../models');
const { sendSupportReplyEmail } = require('../services/email');

// POST /support/ticket — публичная форма (без auth). Если запрос авторизован — привяжем userId.
const createTicket = async (req, res) => {
  try {
    const { name, email, subject, category, message } = req.body;
    const ticket = await SupportTicket.create({
      userId: req.user?.id || null,
      name, email, subject,
      category: category || 'question',
      message,
    });
    res.status(201).json({ data: { id: ticket.id } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка отправки обращения' });
  }
};

// GET /admin/support — список обращений (isAdmin), фильтр ?status=&category=
const listTickets = async (req, res) => {
  try {
    const where = {};
    if (req.query.status) where.status = req.query.status;
    if (req.query.category) where.category = req.query.category;

    const tickets = await SupportTicket.findAll({
      where,
      order: [['createdAt', 'DESC']],
      include: [{ model: User, as: 'author', attributes: ['id', 'name', 'role'] }],
    });

    // Счётчики по статусам — для бейджей вкладок в админке
    const counts = { open: 0, in_progress: 0, resolved: 0 };
    for (const t of await SupportTicket.findAll({ attributes: ['status'] })) {
      counts[t.status] = (counts[t.status] ?? 0) + 1;
    }

    res.json({ data: tickets, meta: { counts } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка получения обращений' });
  }
};

// PATCH /admin/support/:id — ответить + сменить статус.
// Если задан adminReply — best-effort шлём письмо автору и ставим repliedAt.
const updateTicket = async (req, res) => {
  try {
    const ticket = await SupportTicket.findByPk(req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Обращение не найдено' });

    const { status, adminReply } = req.body;
    const patch = {};
    if (status) patch.status = status;

    if (adminReply != null && adminReply.trim()) {
      patch.adminReply = adminReply.trim();
      patch.repliedAt = new Date();
      // Ответ обычно закрывает тикет, если статус не задан явно
      if (!status) patch.status = 'resolved';
    }

    await ticket.update(patch);

    // Письмо — best-effort: падение почты не ломает сохранение ответа
    if (patch.adminReply) {
      sendSupportReplyEmail(ticket.email, ticket.name, {
        subject: ticket.subject,
        reply: patch.adminReply,
      }).catch((e) => console.error('[support reply email] ошибка:', e.message));
    }

    res.json({ data: ticket });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка обновления обращения' });
  }
};

module.exports = { createTicket, listTickets, updateTicket };
