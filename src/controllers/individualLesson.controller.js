const { IndividualLesson, IndividualCourse, User, Homework, Student } = require('../models');
const { Op } = require('sequelize');
const { getStudentIdsForUser, resolveStudent, createPlaceholder } = require('../utils/students');

const studentInclude = { model: Student, as: 'student', attributes: ['id', 'name'] };

// Строит WHERE по query-параметрам. Для студента studentIds — его Student-записи.
const buildDateWhere = (query, role, userId, studentIds) => {
  const where = role === 'teacher'
    ? { teacherId: userId }
    : { studentId: studentIds };

  if (query.studentId && role === 'teacher') where.studentId = query.studentId;
  if (query.individualCourseId) where.individualCourseId = query.individualCourseId;
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
    const studentIds = req.user.role === 'student' ? await getStudentIdsForUser(req.user.id) : [];
    const where = buildDateWhere(req.query, req.user.role, req.user.id, studentIds);
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
    const { studentId, placeholder, date, time, topic, description, lessonLink, pricePerLesson, materials, individualCourseId } = req.body;
    if (!date || !time) {
      return res.status(400).json({ error: 'date и time обязательны' });
    }
    // Ученик определяется тремя способами:
    // 1) урок в рамках курса (individualCourseId) — ученик берётся из курса;
    // 2) заглушка (placeholder) — создаётся новая;
    // 3) studentId = Student.id из ростера учителя (реальный ИЛИ заглушка).
    let student;
    if (individualCourseId) {
      const course = await IndividualCourse.findByPk(individualCourseId);
      if (!course) return res.status(404).json({ error: 'Курс не найден' });
      if (course.teacherId !== req.user.id) return res.status(403).json({ error: 'Доступ запрещён' });
      student = { id: course.studentId }; // studentId курса — уже Student.id
    } else if (placeholder && placeholder.name) {
      student = await createPlaceholder(req.user.id, placeholder.name, placeholder.contact);
    } else {
      if (!studentId) return res.status(400).json({ error: 'Нужен studentId, placeholder или individualCourseId' });
      const st = await Student.findOne({ where: { id: studentId, teacherId: req.user.id } });
      if (!st) return res.status(404).json({ error: 'Ученик не найден в вашем ростере' });
      student = { id: st.id };
    }
    const lesson = await IndividualLesson.create({
      teacherId: req.user.id,
      studentId: student.id,
      individualCourseId: individualCourseId || null,
      date, time, topic, description, lessonLink, pricePerLesson, materials,
    });
    res.status(201).json({ data: lesson });
  } catch (err) {
    // unique (individualCourseId,date,time) — урок серии на это время уже есть
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ error: 'Урок на эту дату и время уже существует' });
    }
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

    if (req.user.role === 'student') {
      const myStudentIds = await getStudentIdsForUser(req.user.id);
      if (!myStudentIds.includes(lesson.studentId)) return res.status(403).json({ error: 'Доступ запрещён' });
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
