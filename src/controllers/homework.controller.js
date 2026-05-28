const { Homework, HomeworkSubmission, GroupStudent, Lesson, Group, IndividualLesson, User } = require('../models');
const { Op } = require('sequelize');

// Возвращает true если учитель владеет уроком, к которому привязано ДЗ
const isHwOwner = async (hw, teacherId) => {
  if (hw.lessonId) {
    const lesson = await Lesson.findByPk(hw.lessonId, {
      include: [{ model: Group, attributes: ['teacherId'] }],
    });
    return !!(lesson && lesson.Group && lesson.Group.teacherId === teacherId);
  }
  if (hw.individualLessonId) {
    const il = await IndividualLesson.findByPk(hw.individualLessonId, { attributes: ['teacherId'] });
    return !!(il && il.teacherId === teacherId);
  }
  return false;
};

// Исправлен баг: студент видит только ДЗ своих групп и инд. уроков.
// Алгоритм:
//   1. Найти groupId студента через GroupStudent
//   2. Найти lessonId из этих групп
//   3. Найти individualLessonId где studentId = req.user.id
//   4. ДЗ у которых lessonId IN (шаг 2) OR individualLessonId IN (шаг 3)
const getAll = async (req, res) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page)  || 1);
    const limit  = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;

    if (req.user.role === 'teacher') {
      const { count, rows } = await Homework.findAndCountAll({ limit, offset });
      return res.json({ data: rows, pagination: { page, limit, total: count, pages: Math.ceil(count / limit) } });
    }

    // Шаги 1–3: собираем допустимые ID
    const memberships = await GroupStudent.findAll({
      where: { studentId: req.user.id },
      attributes: ['groupId'],
    });
    const groupIds = memberships.map(m => m.groupId);

    const [lessons, indLessons] = await Promise.all([
      groupIds.length > 0
        ? Lesson.findAll({ where: { groupId: { [Op.in]: groupIds } }, attributes: ['id'] })
        : Promise.resolve([]),
      IndividualLesson.findAll({ where: { studentId: req.user.id }, attributes: ['id'] }),
    ]);

    const lessonIds    = lessons.map(l => l.id);
    const indLessonIds = indLessons.map(il => il.id);

    // Если нет ни уроков, ни инд. уроков — пустой ответ
    const orConditions = [];
    if (lessonIds.length    > 0) orConditions.push({ lessonId:           { [Op.in]: lessonIds } });
    if (indLessonIds.length > 0) orConditions.push({ individualLessonId: { [Op.in]: indLessonIds } });

    if (orConditions.length === 0) return res.json({ data: [] });

    // Включаем сдачу студента (если есть) — для отображения статуса на фронте
    const { count, rows } = await Homework.findAndCountAll({
      where: { [Op.or]: orConditions },
      include: [{
        model: HomeworkSubmission,
        required: false,
        where: { studentId: req.user.id },
      }],
      distinct: true,
      limit,
      offset,
    });
    res.json({ data: rows, pagination: { page, limit, total: count, pages: Math.ceil(count / limit) } });
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
    if (lessonId && individualLessonId) {
      return res.status(400).json({ error: 'Нельзя привязать ДЗ одновременно к групповому и индивидуальному уроку' });
    }

    // 👉 ЗАДАЧА S6 (пиши здесь): валидация deadline.
    //    Если deadline передан и он в прошлом — вернуть 400.
    //    Если deadline нет — пропустить (поле опционально).
    //    Твой код ↓


    // Ownership check
    if (lessonId) {
      const lesson = await Lesson.findByPk(lessonId, {
        include: [{ model: Group, attributes: ['teacherId'] }],
      });
      if (!lesson || !lesson.Group || lesson.Group.teacherId !== req.user.id)
        return res.status(403).json({ error: 'Урок не найден или доступ запрещён' });
    }
    if (individualLessonId) {
      const il = await IndividualLesson.findByPk(individualLessonId, { attributes: ['teacherId'] });
      if (!il || il.teacherId !== req.user.id)
        return res.status(403).json({ error: 'Урок не найден или доступ запрещён' });
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
    if (!await isHwOwner(hw, req.user.id)) return res.status(403).json({ error: 'Доступ запрещён' });
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
    if (!await isHwOwner(hw, req.user.id)) return res.status(403).json({ error: 'Доступ запрещён' });
    await hw.destroy();
    res.json({ data: { message: 'Задание удалено' } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка удаления задания' });
  }
};

// Студент сдаёт ДЗ. fileUrl необязателен — можно сдать пустое с комментарием.
const submit = async (req, res) => {
  try {
    const { fileUrl, comment } = req.body;

    const hw = await Homework.findByPk(req.params.id);
    if (!hw) return res.status(404).json({ error: 'Задание не найдено' });

    const existing = await HomeworkSubmission.findOne({
      where: { homeworkId: hw.id, studentId: req.user.id },
    });
    if (existing) return res.status(400).json({ error: 'Вы уже сдали это задание' });

    const sub = await HomeworkSubmission.create({
      homeworkId: hw.id,
      studentId:  req.user.id,
      fileUrl:    fileUrl || null,
      comment:    comment || null,
    });
    res.status(201).json({ data: sub });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сдачи задания' });
  }
};

const getSubmissions = async (req, res) => {
  try {
    const hw = await Homework.findByPk(req.params.id);
    if (!hw) return res.status(404).json({ error: 'Задание не найдено' });
    if (!await isHwOwner(hw, req.user.id)) return res.status(403).json({ error: 'Доступ запрещён' });

    const submissions = await HomeworkSubmission.findAll({
      where: { homeworkId: req.params.id },
      include: [{ model: User, as: 'student', attributes: ['id', 'name', 'email'] }],
    });
    res.json({ data: submissions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка получения сдач' });
  }
};

const gradeSubmission = async (req, res) => {
  try {
    const hw = await Homework.findByPk(req.params.id);
    if (!hw) return res.status(404).json({ error: 'Задание не найдено' });
    if (!await isHwOwner(hw, req.user.id)) return res.status(403).json({ error: 'Доступ запрещён' });

    const sub = await HomeworkSubmission.findByPk(req.params.subId);
    if (!sub) return res.status(404).json({ error: 'Сдача не найдена' });
    const { grade } = req.body;
    if (grade !== undefined && (!Number.isInteger(grade) || grade < 0 || grade > 100)) {
      return res.status(400).json({ error: 'grade: целое число от 0 до 100' });
    }
    await sub.update({ grade, status: 'graded' });
    res.json({ data: sub });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка выставления оценки' });
  }
};

module.exports = { getAll, create, getOne, update, remove, submit, getSubmissions, gradeSubmission };
