const { IndividualCourse, User, TeacherStudent, Student } = require('../models');
const { generateIndividualLessons } = require('../utils/lessonGenerator');
const { getStudentIdsForUser, resolveStudent, createPlaceholder } = require('../utils/students');
const { overLimit } = require('../config/planLimits');

// Ученик курса (Student.id) — чтобы фронт показывал имя (getStudent по /users/:id не годится: там User)
const studentInclude = { model: Student, as: 'student', attributes: ['id', 'name', 'userId'] };

const getAll = async (req, res) => {
  try {
    const where = req.user.role === 'teacher'
      ? { teacherId: req.user.id }
      : { studentId: await getStudentIdsForUser(req.user.id) };
    const courses = await IndividualCourse.findAll({ where, include: [studentInclude] });
    res.json({ data: courses });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка получения курсов' });
  }
};

const create = async (req, res) => {
  try {
    const { studentId, placeholder, name, schedule, lessonLink, pricePerLesson } = req.body;

    // Лимит тарифа на число индивидуальных курсов
    const me = await User.findByPk(req.user.id, { attributes: ['plan'] });
    const usedCourses = await IndividualCourse.count({ where: { teacherId: req.user.id } });
    if (overLimit(res, 'teacher', me?.plan, 'courses', usedCourses)) return;

    // Ученик курса — заглушка (placeholder) ИЛИ реальный аккаунт (studentId)
    let student;
    if (placeholder && placeholder.name) {
      // Заглушка — без гейта TeacherStudent
      student = await createPlaceholder(req.user.id, placeholder.name, placeholder.contact);
    } else {
      if (!studentId) return res.status(400).json({ error: 'Нужен studentId или placeholder' });
      const user = await User.findByPk(studentId);
      if (!user || user.role !== 'student') {
        return res.status(404).json({ error: 'Студент не найден' });
      }
      // Гейт: курс реальному ученику — только принятому. TeacherStudent — по User.id.
      const isMine = await TeacherStudent.findOne({ where: { teacherId: req.user.id, studentId } });
      if (!isMine) {
        return res.status(403).json({ error: 'Сначала примите этого студента в ученики (через заявку)' });
      }
      student = await resolveStudent(req.user.id, studentId, user.name);
    }

    const course = await IndividualCourse.create({
      teacherId: req.user.id,
      studentId: student.id,
      name: name || null,
      schedule: schedule || [],
      lessonLink: lessonLink || null,
      pricePerLesson: pricePerLesson || 0,
    });
    res.status(201).json({ data: course });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка создания курса' });
  }
};

const getOne = async (req, res) => {
  try {
    const course = await IndividualCourse.findByPk(req.params.id, { include: [studentInclude] });
    if (!course) return res.status(404).json({ error: 'Курс не найден' });

    if (req.user.role === 'teacher' && course.teacherId !== req.user.id) {
      return res.status(403).json({ error: 'Доступ запрещён' });
    }
    if (req.user.role === 'student') {
      const myStudentIds = await getStudentIdsForUser(req.user.id);
      if (!myStudentIds.includes(course.studentId)) return res.status(403).json({ error: 'Доступ запрещён' });
    }

    res.json({ data: course });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка получения курса' });
  }
};

const update = async (req, res) => {
  try {
    const course = await IndividualCourse.findByPk(req.params.id);
    if (!course) return res.status(404).json({ error: 'Курс не найден' });
    if (course.teacherId !== req.user.id) return res.status(403).json({ error: 'Доступ запрещён' });

    const { name, schedule, lessonLink, pricePerLesson } = req.body;
    await course.update({ name, schedule, lessonLink, pricePerLesson });
    res.json({ data: course });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка обновления курса' });
  }
};

const remove = async (req, res) => {
  try {
    const course = await IndividualCourse.findByPk(req.params.id);
    if (!course) return res.status(404).json({ error: 'Курс не найден' });
    if (course.teacherId !== req.user.id) return res.status(403).json({ error: 'Доступ запрещён' });

    await course.destroy();
    res.json({ data: { message: 'Курс удалён' } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка удаления курса' });
  }
};

const generateLessons = async (req, res) => {
  try {
    const { from, to } = req.body;
    const course = await IndividualCourse.findByPk(req.params.id);
    if (!course) return res.status(404).json({ error: 'Курс не найден' });
    if (course.teacherId !== req.user.id) return res.status(403).json({ error: 'Доступ запрещён' });
    const created = await generateIndividualLessons({ courseId: req.params.id, from, to });
    res.json({ data: { created: created.length, lessons: created } });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Ошибка генерации уроков' });
  }
};

module.exports = { getAll, create, getOne, update, remove, generateLessons };
