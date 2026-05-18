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

// Создаёт записи посещаемости для всех студентов урока
// Body: { lessonId?, individualLessonId?, records: [{studentId, present}] }
const create = async (req, res) => {
  try {
    const { lessonId, individualLessonId, records } = req.body;
    if (!records || !Array.isArray(records)) {
      return res.status(400).json({ error: 'records обязателен' });
    }

    const created = await Attendance.bulkCreate(
      records.map(r => ({ lessonId, individualLessonId, studentId: r.studentId, present: r.present }))
    );
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
