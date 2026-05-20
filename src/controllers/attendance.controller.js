const { Attendance, Lesson, Group } = require('../models');
const { Op } = require('sequelize');

// GET /attendance?lessonId=&groupId=&month=YYYY-MM&from=&to=
const getAll = async (req, res) => {
  try {
    const where = req.user.role === 'student' ? { studentId: req.user.id } : {};

    if (req.query.lessonId)           where.lessonId = req.query.lessonId;
    if (req.query.individualLessonId) where.individualLessonId = req.query.individualLessonId;
    if (req.query.studentId && req.user.role === 'teacher') where.studentId = req.query.studentId;

    // Фильтрация по groupId — через JOIN с Lesson
    const lessonInclude = { model: Lesson, attributes: ['id', 'date', 'time', 'groupId'], required: false };

    // Фильтрация по месяцу (YYYY-MM) или произвольному диапазону — через уроки
    if (req.query.month || req.query.from || req.query.to) {
      const lessonWhere = {};
      if (req.query.groupId) lessonWhere.groupId = req.query.groupId;
      if (req.query.month) {
        const [y, m] = req.query.month.split('-').map(Number);
        const start = `${y}-${String(m).padStart(2,'0')}-01`;
        const end   = new Date(y, m, 0).toISOString().slice(0, 10);
        lessonWhere.date = { [Op.between]: [start, end] };
      } else {
        if (req.query.from || req.query.to) {
          lessonWhere.date = {};
          if (req.query.from) lessonWhere.date[Op.gte] = req.query.from;
          if (req.query.to)   lessonWhere.date[Op.lte] = req.query.to;
        }
      }
      lessonInclude.where    = lessonWhere;
      lessonInclude.required = true;
    } else if (req.query.groupId) {
      lessonInclude.where    = { groupId: req.query.groupId };
      lessonInclude.required = true;
    }

    const page   = Math.max(1, parseInt(req.query.page)  || 1);
    const limit  = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;

    const { count, rows } = await Attendance.findAndCountAll({
      where,
      include: [lessonInclude],
      order: [[{ model: Lesson }, 'date', 'ASC']],
      limit,
      offset,
      subQuery: false,
      distinct: true,
    });

    res.json({ data: rows, pagination: { page, limit, total: count, pages: Math.ceil(count / limit) } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка получения посещаемости' });
  }
};

// Создаёт или обновляет записи посещаемости (bulk).
// Body: { lessonId?, individualLessonId?, records: [{studentId, present}] }
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
