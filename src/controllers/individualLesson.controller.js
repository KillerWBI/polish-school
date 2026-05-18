const { IndividualLesson } = require('../models');

const getAll = async (req, res) => {
  try {
    const where = req.user.role === 'teacher'
      ? { teacherId: req.user.id }
      : { studentId: req.user.id };
    const lessons = await IndividualLesson.findAll({ where });
    res.json({ data: lessons });
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
    const lesson = await IndividualLesson.findByPk(req.params.id);
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
    await lesson.destroy();
    res.json({ data: { message: 'Урок удалён' } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка удаления урока' });
  }
};

module.exports = { getAll, create, getOne, update, remove };
