const { Homework, HomeworkSubmission, GroupStudent, Lesson } = require('../models');

const getAll = async (req, res) => {
  try {
    // TODO: фильтрация по группам студента / всё для учителя
    const homeworks = await Homework.findAll();
    res.json({ data: homeworks });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка получения домашних заданий' });
  }
};

const create = async (req, res) => {
  try {
    const { lessonId, individualLessonId, description, deadline } = req.body;
    if (!description) return res.status(400).json({ error: 'Описание обязательно' });
    if (!lessonId && !individualLessonId) {
      return res.status(400).json({ error: 'Нужен lessonId или individualLessonId' });
    }
    const hw = await Homework.create({ lessonId, individualLessonId, description, deadline });
    res.status(201).json({ data: hw });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка создания задания' });
  }
};

const getOne = async (req, res) => {
  try {
    const hw = await Homework.findByPk(req.params.id);
    if (!hw) return res.status(404).json({ error: 'Задание не найдено' });
    res.json({ data: hw });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка получения задания' });
  }
};

const update = async (req, res) => {
  try {
    const hw = await Homework.findByPk(req.params.id);
    if (!hw) return res.status(404).json({ error: 'Задание не найдено' });
    const { description, deadline } = req.body;
    await hw.update({ description, deadline });
    res.json({ data: hw });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка обновления задания' });
  }
};

const remove = async (req, res) => {
  try {
    const hw = await Homework.findByPk(req.params.id);
    if (!hw) return res.status(404).json({ error: 'Задание не найдено' });
    await hw.destroy();
    res.json({ data: { message: 'Задание удалено' } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка удаления задания' });
  }
};

// Студент сдаёт ДЗ (fileUrl из Cloudinary передаётся уже готовым)
const submit = async (req, res) => {
  try {
    const { fileUrl, comment } = req.body;
    if (!fileUrl) return res.status(400).json({ error: 'fileUrl обязателен' });

    const hw = await Homework.findByPk(req.params.id);
    if (!hw) return res.status(404).json({ error: 'Задание не найдено' });

    const existing = await HomeworkSubmission.findOne({
      where: { homeworkId: hw.id, studentId: req.user.id },
    });
    if (existing) return res.status(400).json({ error: 'Вы уже сдали это задание' });

    const sub = await HomeworkSubmission.create({
      homeworkId: hw.id,
      studentId: req.user.id,
      fileUrl,
      comment,
    });
    res.status(201).json({ data: sub });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сдачи задания' });
  }
};

const getSubmissions = async (req, res) => {
  try {
    const submissions = await HomeworkSubmission.findAll({
      where: { homeworkId: req.params.id },
    });
    res.json({ data: submissions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка получения сдач' });
  }
};

const gradeSubmission = async (req, res) => {
  try {
    const sub = await HomeworkSubmission.findByPk(req.params.subId);
    if (!sub) return res.status(404).json({ error: 'Сдача не найдена' });
    const { grade } = req.body;
    await sub.update({ grade, status: 'graded' });
    res.json({ data: sub });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка выставления оценки' });
  }
};

module.exports = { getAll, create, getOne, update, remove, submit, getSubmissions, gradeSubmission };
