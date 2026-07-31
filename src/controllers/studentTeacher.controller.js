const { StudentTeacher, StudentLessonLog } = require('../models');

// «Мои преподаватели» — карточки, которые ученик завёл сам (репетитор офлайн, школа, курсы,
// самостоятельные занятия по предмету). Границы жёсткие: видно и правится только своё.

// GET /student-teachers — список со сводкой по занятиям и долгу
const list = async (req, res) => {
  try {
    const rows = await StudentTeacher.findAll({
      where: { userId: req.user.id },
      order: [['name', 'ASC']],
    });

    // Сводка одним запросом: сколько занятий и сколько не оплачено по каждой карточке
    const logs = await StudentLessonLog.findAll({
      where: { userId: req.user.id },
      attributes: ['studentTeacherId', 'pricePerLesson', 'isPaid'],
    });
    const summary = {};
    for (const l of logs) {
      if (!l.studentTeacherId) continue;
      const s = summary[l.studentTeacherId] || (summary[l.studentTeacherId] = { lessons: 0, debt: 0 });
      s.lessons += 1;
      if (!l.isPaid) s.debt += parseFloat(l.pricePerLesson) || 0;
    }

    res.json({
      data: rows.map((r) => ({
        ...r.toJSON(),
        lessons: summary[r.id]?.lessons || 0,
        debt:    summary[r.id]?.debt || 0,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка получения списка преподавателей' });
  }
};

// POST /student-teachers
const create = async (req, res) => {
  try {
    const b = req.body;
    const row = await StudentTeacher.create({
      userId: req.user.id,
      name: b.name,
      subject: b.subject,
      pricePerLesson: b.pricePerLesson ?? 0,
      contact: b.contact || null,
      notes: b.notes || null,
    });
    res.status(201).json({ data: row });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка создания преподавателя' });
  }
};

// PUT /student-teachers/:id
const update = async (req, res) => {
  try {
    const row = await StudentTeacher.findOne({ where: { id: req.params.id, userId: req.user.id } });
    if (!row) return res.status(404).json({ error: 'Преподаватель не найден' });

    const b = req.body;
    const patch = {};
    for (const k of ['name', 'subject', 'pricePerLesson', 'contact', 'notes']) {
      if (b[k] !== undefined) patch[k] = b[k];
    }
    await row.update(patch);

    // Имя в карточке поменялось — обновляем подпись в занятиях, чтобы список не
    // показывал старое имя рядом с новым
    if (patch.name) {
      await StudentLessonLog.update(
        { teacherLabel: patch.name },
        { where: { userId: req.user.id, studentTeacherId: row.id } },
      );
    }
    res.json({ data: row });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка обновления преподавателя' });
  }
};

// DELETE /student-teachers/:id — карточка уходит, занятия остаются (имя в них уже сохранено)
const remove = async (req, res) => {
  try {
    const row = await StudentTeacher.findOne({ where: { id: req.params.id, userId: req.user.id } });
    if (!row) return res.status(404).json({ error: 'Преподаватель не найден' });
    await row.destroy();
    res.json({ data: { id: row.id } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка удаления преподавателя' });
  }
};

module.exports = { list, create, update, remove };
