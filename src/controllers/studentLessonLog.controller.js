const { Op } = require('sequelize');
const { StudentLessonLog } = require('../models');

// GET /my-lessons — записи ученика (фильтр ?type=&subject=&from=&to=)
const list = async (req, res) => {
  try {
    const { type, subject, from, to } = req.query;
    const where = { userId: req.user.id };
    if (type) where.type = type;
    if (subject) where.subject = subject;
    if (from || to) {
      where.date = {};
      if (from) where.date[Op.gte] = from;
      if (to) where.date[Op.lte] = to;
    }

    const rows = await StudentLessonLog.findAll({ where, order: [['date', 'DESC'], ['time', 'DESC']] });
    res.json({ data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка получения журнала' });
  }
};

// GET /my-lessons/stats — сводка: занятий, часов, долг, оплачено + разбивки
const stats = async (req, res) => {
  try {
    const rows = await StudentLessonLog.findAll({ where: { userId: req.user.id } });

    let lessons = 0, minutes = 0, debt = 0, paid = 0;
    const bySubject = {};      // subject → { lessons, minutes }
    const byTeacher = {};      // teacherLabel → { lessons, debt }

    for (const r of rows) {
      lessons += 1;
      minutes += r.durationMin || 0;
      const price = parseFloat(r.pricePerLesson) || 0;
      if (r.isPaid) paid += price; else debt += price;

      const subj = r.subject || '—';
      bySubject[subj] = bySubject[subj] || { lessons: 0, minutes: 0 };
      bySubject[subj].lessons += 1;
      bySubject[subj].minutes += r.durationMin || 0;

      const tch = r.teacherLabel || '—';
      byTeacher[tch] = byTeacher[tch] || { lessons: 0, debt: 0 };
      byTeacher[tch].lessons += 1;
      if (!r.isPaid) byTeacher[tch].debt += price;
    }

    res.json({
      data: {
        lessons, hours: Math.round(minutes / 6) / 10, // 1 знак после запятой
        debt, paid,
        bySubject, byTeacher,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка получения статистики' });
  }
};

// POST /my-lessons
const create = async (req, res) => {
  try {
    const b = req.body;
    const log = await StudentLessonLog.create({
      userId: req.user.id,
      teacherLabel: b.teacherLabel || null,
      subject: b.subject,
      date: b.date,
      time: b.time || null,
      durationMin: b.durationMin ?? null,
      topic: b.topic || null,
      notes: b.notes || null,
      pricePerLesson: b.pricePerLesson ?? 0,
      isPaid: b.isPaid ?? false,
      paidAt: b.isPaid ? new Date() : null,
      type: b.type || 'external',
    });
    res.status(201).json({ data: log });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка создания записи' });
  }
};

// PUT /my-lessons/:id
const update = async (req, res) => {
  try {
    const log = await StudentLessonLog.findOne({ where: { id: req.params.id, userId: req.user.id } });
    if (!log) return res.status(404).json({ error: 'Запись не найдена' });

    const b = req.body;
    const patch = {};
    for (const k of ['teacherLabel', 'subject', 'date', 'time', 'durationMin', 'topic', 'notes', 'pricePerLesson', 'type']) {
      if (b[k] !== undefined) patch[k] = b[k];
    }
    // Смена флага оплаты синхронизирует paidAt
    if (b.isPaid !== undefined && b.isPaid !== log.isPaid) {
      patch.isPaid = b.isPaid;
      patch.paidAt = b.isPaid ? new Date() : null;
    }
    await log.update(patch);
    res.json({ data: log });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка обновления записи' });
  }
};

// PATCH /my-lessons/:id/pay — отметить оплаченным (ученик заплатил в жизни)
const markPaid = async (req, res) => {
  try {
    const log = await StudentLessonLog.findOne({ where: { id: req.params.id, userId: req.user.id } });
    if (!log) return res.status(404).json({ error: 'Запись не найдена' });
    await log.update({ isPaid: true, paidAt: new Date() });
    res.json({ data: log });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка' });
  }
};

// DELETE /my-lessons/:id
const remove = async (req, res) => {
  try {
    const log = await StudentLessonLog.findOne({ where: { id: req.params.id, userId: req.user.id } });
    if (!log) return res.status(404).json({ error: 'Запись не найдена' });
    await log.destroy();
    res.json({ data: { id: log.id } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка удаления записи' });
  }
};

module.exports = { list, stats, create, update, markPaid, remove };
