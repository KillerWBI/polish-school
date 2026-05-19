const { Attendance } = require('../models');

const getAll = async (req, res) => {
  try {
    const where = req.user.role === 'student' ? { studentId: req.user.id } : {};
    const records = await Attendance.findAll({ where });
    res.json({ data: records });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка получения посещаемости' });
  }
};

// Создаёт или обновляет записи посещаемости (bulk).
// Body: { lessonId?, individualLessonId?, records: [{studentId, present}] }
// Исправлен баг: updateOnDuplicate гарантирует что повторный вызов обновит present
// вместо создания дублей. Уникальный индекс (lessonId, studentId) в модели.
const create = async (req, res) => {
  try {
    const { lessonId, individualLessonId, records } = req.body;
    if (!records || !Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ error: 'records обязателен и не должен быть пустым' });
    }
    if (!lessonId && !individualLessonId) {
      return res.status(400).json({ error: 'Нужен lessonId или individualLessonId' });
    }

    const rows = records.map(r => ({
      lessonId:           lessonId           ?? null,
      individualLessonId: individualLessonId ?? null,
      studentId: r.studentId,
      present:   r.present ?? false,
    }));

    const created = await Attendance.bulkCreate(rows, {
      updateOnDuplicate: ['present'],
    });

    res.status(201).json({ data: created });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка создания посещаемости' });
  }
};

const update = async (req, res) => {
  try {
    const record = await Attendance.findByPk(req.params.id);
    if (!record) return res.status(404).json({ error: 'Запись не найдена' });
    await record.update({ present: req.body.present });
    res.json({ data: record });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка обновления посещаемости' });
  }
};

module.exports = { getAll, create, update };
