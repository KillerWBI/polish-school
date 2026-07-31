const { Op } = require('sequelize');
const { StudentLessonLog, StudentTeacher } = require('../models');

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

    const rows = await StudentLessonLog.findAll({
      where,
      // Карточка преподавателя нужна календарю и списку — показать предмет и контакт
      include: [{ model: StudentTeacher, as: 'studentTeacher', attributes: ['id', 'name', 'subject', 'contact'], required: false }],
      order: [['date', 'DESC'], ['time', 'DESC']],
    });
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

    for (const r of rows) {
      lessons += 1;
      minutes += r.durationMin || 0;
      const price = parseFloat(r.pricePerLesson) || 0;
      if (r.isPaid) paid += price; else debt += price;

      const subj = r.subject || '—';
      bySubject[subj] = bySubject[subj] || { lessons: 0, minutes: 0 };
      bySubject[subj].lessons += 1;
      bySubject[subj].minutes += r.durationMin || 0;
    }

    // Разбивка по преподавателям приходит из GET /student-teachers — там она
    // считается по карточкам, а не по строке-имени, поэтому здесь её нет
    res.json({
      data: {
        lessons, hours: Math.round(minutes / 6) / 10, // 1 знак после запятой
        debt, paid,
        bySubject,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка получения статистики' });
  }
};

// Сдвигает дату 'YYYY-MM-DD' на N недель вперёд
const plusWeeks = (isoDate, weeks) => {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + weeks * 7);
  return d.toISOString().slice(0, 10);
};

// Сколько занятий создаёт галочка «повторять еженедельно»: это и две следующие недели.
// Дальше ученик добавляет сам — так в календаре не появляется расписание на год,
// которое потом нечем разгрести.
const REPEAT_COUNT = 3;

// POST /my-lessons — одно занятие или, с repeatWeekly, сразу три подряд по неделям.
// Каждое созданное занятие — отдельная запись: лишнее удаляется по одному.
const create = async (req, res) => {
  try {
    const b = req.body;

    // Занятие можно привязать к карточке «моего преподавателя». Проверяем, что она своя.
    let teacher = null;
    if (b.studentTeacherId) {
      teacher = await StudentTeacher.findOne({ where: { id: b.studentTeacherId, userId: req.user.id } });
      if (!teacher) return res.status(404).json({ error: 'Преподаватель не найден' });
    }

    const baseFields = {
      userId: req.user.id,
      studentTeacherId: teacher ? teacher.id : null,
      // Имя дублируем в запись, чтобы история пережила удаление карточки
      teacherLabel: teacher ? teacher.name : (b.teacherLabel || null),
      subject: b.subject,
      time: b.time || null,
      durationMin: b.durationMin ?? null,
      topic: b.topic || null,
      notes: b.notes || null,
      pricePerLesson: b.pricePerLesson ?? 0,
      isPaid: b.isPaid ?? false,
      paidAt: b.isPaid ? new Date() : null,
      type: b.type || 'external',
    };

    const dates = b.repeatWeekly
      ? Array.from({ length: REPEAT_COUNT }, (_, i) => plusWeeks(b.date, i))
      : [b.date];

    const rows = await StudentLessonLog.bulkCreate(dates.map((date) => ({ ...baseFields, date })));
    res.status(201).json({ data: b.repeatWeekly ? rows : rows[0] });
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
    // Сменили карточку преподавателя — проверяем, что она своя, и подтягиваем имя
    if (b.studentTeacherId !== undefined) {
      if (b.studentTeacherId) {
        const teacher = await StudentTeacher.findOne({ where: { id: b.studentTeacherId, userId: req.user.id } });
        if (!teacher) return res.status(404).json({ error: 'Преподаватель не найден' });
        patch.studentTeacherId = teacher.id;
        patch.teacherLabel = teacher.name;
      } else {
        patch.studentTeacherId = null;
      }
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
