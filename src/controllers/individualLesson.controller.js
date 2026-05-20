const { IndividualLesson, User, Homework } = require('../models');
const { Op } = require('sequelize');

const studentInclude = { model: User, as: 'student', attributes: ['id', 'name'] };

// Строит WHERE по query-параметрам: from, to, date, studentId (только для teacher)
const buildDateWhere = (query, role, userId) => {
  const where = role === 'teacher'
    ? { teacherId: userId }
    : { studentId: userId };

  if (query.studentId && role === 'teacher') where.studentId = query.studentId;
  if (query.date) { where.date = query.date; return where; }
  if (query.from || query.to) {
    where.date = {};
    if (query.from) where.date[Op.gte] = query.from;
    if (query.to)   where.date[Op.lte] = query.to;
  }
  return where;
};

const getAll = async (req, res) => {
  try {
    const where = buildDateWhere(req.query, req.user.role, req.user.id);
    const page   = Math.max(1, parseInt(req.query.page)  || 1);
    const limit  = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;

    const { count, rows } = await IndividualLesson.findAndCountAll({
      where,
      include: [
        studentInclude,
        { model: Homework, attributes: ['id'], required: false },
      ],
      order: [['date', 'ASC'], ['time', 'ASC']],
      limit,
      offset,
      distinct: true,
    });
    res.json({ data: rows, pagination: { page, limit, total: count, pages: Math.ceil(count / limit) } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка получения индивидуальных уроков' });
  }
};

const create = async (req, res) => {
  try {
    const { studentId, date, time, topic, description, lessonLink, pricePerLesson, materials, individualCourseId } = req.body;
    if (!studentId || !date || !time) {
      return res.status(400).json({ error: 'studentId, date и time обязательны' });
    }
    const lesson = await IndividualLesson.create({
      teacherId: req.user.id,
      studentId,
      individualCourseId: individualCourseId || null,
      date, time, topic, description, lessonLink, pricePerLesson, materials,
    });
    res.status(201).json({ data: lesson });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка создания индивидуального урока' });
  }
};

const getOne = async (req, res) => {
  try {
    const lesson = await IndividualLesson.findByPk(req.params.id, {
      include: [studentInclude, { model: Homework, required: false }],
    });
    if (!lesson) return res.status(404).json({ error: 'Урок не найден' });

    if (req.user.role === 'student' && lesson.studentId !== req.user.id) {
      return res.status(403).json({ error: 'Доступ запрещён' });
    }

    res.json({ data: lesson });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка получения урока' });
  }
};

const update = async (req, res) => {
  try {
    const lesson = await IndividualLesson.findByPk(req.params.id);
    if (!lesson) return res.status(404).json({ error: 'Урок не найден' });

    if (lesson.teacherId !== req.user.id) {
      return res.status(403).json({ error: 'Доступ запрещён' });
    }

    const { date, time, topic, description, lessonLink, pricePerLesson, materials } = req.body;
    await lesson.update({ date, time, topic, description, lessonLink, pricePerLesson, materials });
    res.json({ data: lesson });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка обновления урока' });
  }
};

const remove = async (req, res) => {
  try {
    const lesson = await IndividualLesson.findByPk(req.params.id);
    if (!lesson) return res.status(404).json({ error: 'Урок не найден' });

    if (lesson.teacherId !== req.user.id) {
      return res.status(403).json({ error: 'Доступ запрещён' });
    }

    await lesson.destroy();
    res.json({ data: { message: 'Урок удалён' } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка удаления урока' });
  }
};

module.exports = { getAll, create, getOne, update, remove };
