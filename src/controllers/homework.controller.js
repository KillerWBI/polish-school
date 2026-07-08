const { Homework, HomeworkSubmission, GroupStudent, Lesson, Group, IndividualLesson, User, Student, Quiz } = require('../models');
const { Op } = require('sequelize');
const { isHwOwner } = require('../utils/ownership');
const { getStudentIdsForUser } = require('../utils/students');
const { isAllowedUploadUrl } = require('../utils/cloudinary');



// Собирает id уроков, к которым у пользователя есть доступ.
//   teacher  → уроки его групп + его индивидуальные уроки
//   student  → уроки групп, где он состоит + инд. уроки, где он студент
// Возвращает { lessonIds, indLessonIds }. Используется в getAll / getOne / submit.
const collectAccessibleLessonIds = async (user) => {
  let groupIds;
  let myStudentIds = [];
  if (user.role === 'teacher') {
    const groups = await Group.findAll({ where: { teacherId: user.id }, attributes: ['id'] });
    groupIds = groups.map(g => g.id);
  } else {
    // студент: его Student-записи → членства в группах
    myStudentIds = await getStudentIdsForUser(user.id);
    const memberships = myStudentIds.length
      ? await GroupStudent.findAll({ where: { studentId: myStudentIds }, attributes: ['groupId'] })
      : [];
    groupIds = memberships.map(m => m.groupId);
  }

  const [lessons, indLessons] = await Promise.all([
    groupIds.length > 0
      ? Lesson.findAll({ where: { groupId: { [Op.in]: groupIds } }, attributes: ['id'] })
      : Promise.resolve([]),
    IndividualLesson.findAll({
      where: user.role === 'teacher' ? { teacherId: user.id } : { studentId: myStudentIds },
      attributes: ['id'],
    }),
  ]);

  return {
    lessonIds:    lessons.map(l => l.id),
    indLessonIds: indLessons.map(il => il.id),
  };
};

// Возвращает Student.id, под которым пользователь имеет доступ к ДЗ (состоит в группе урока
// ИЛИ это его инд. урок), или null. studentIds — Student-записи пользователя (по учителям).
const resolveAccessStudentId = async (hw, studentIds) => {
  if (!studentIds.length) return null;
  if (hw.lessonId) {
    const lesson = await Lesson.findByPk(hw.lessonId, { attributes: ['groupId'] });
    if (!lesson) return null;
    const member = await GroupStudent.findOne({
      where: { groupId: lesson.groupId, studentId: studentIds }, attributes: ['studentId'],
    });
    return member ? member.studentId : null;
  }
  if (hw.individualLessonId) {
    const il = await IndividualLesson.findByPk(hw.individualLessonId, { attributes: ['studentId'] });
    return (il && studentIds.includes(il.studentId)) ? il.studentId : null;
  }
  return null;
};

// S1: и учитель, и студент видят ТОЛЬКО ДЗ своих уроков.
const getAll = async (req, res) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page)  || 1);
    const limit  = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;

    const { lessonIds, indLessonIds } = await collectAccessibleLessonIds(req.user);

    const orConditions = [];
    if (lessonIds.length    > 0) orConditions.push({ lessonId:           { [Op.in]: lessonIds } });
    if (indLessonIds.length > 0) orConditions.push({ individualLessonId: { [Op.in]: indLessonIds } });

    // Нет доступных уроков — нет ДЗ
    if (orConditions.length === 0) {
      return res.json({ data: [], pagination: { page, limit, total: 0, pages: 0 } });
    }

    // Прикреплённый тест (обе роли видят). Студенту — ещё его сдачу (для статуса).
    const myStudentIds = req.user.role === 'student' ? await getStudentIdsForUser(req.user.id) : [];
    const include = [{ model: Quiz, as: 'quiz', attributes: ['id', 'topic', 'type', 'questions'] }];
    if (req.user.role === 'student') {
      include.push({ model: HomeworkSubmission, required: false, where: { studentId: myStudentIds } });
    }

    const { count, rows } = await Homework.findAndCountAll({
      where: { [Op.or]: orConditions },
      include,
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
    // Формат/обязательность/взаимоисключение/будущий deadline уже проверены
    // схемой createHomework (middleware validate). Здесь — только ownership.
    const { lessonId, individualLessonId, description, deadline, quizId } = req.body;

    // Прикреплённый тест должен принадлежать этому учителю
    if (quizId) {
      const q = await Quiz.findOne({ where: { id: quizId, teacherId: req.user.id } });
      if (!q) return res.status(403).json({ error: 'Тест не найден или не ваш' });
    }

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

    const hw = await Homework.create({ lessonId, individualLessonId, description, deadline, quizId: quizId || null });
    res.status(201).json({ data: hw });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка создания задания' });
  }
};

// S3: читать ДЗ может только владелец-учитель ИЛИ студент этого урока.
const getOne = async (req, res) => {
  try {
    const hw = await Homework.findByPk(req.params.id, {
      include: [{ model: Quiz, as: 'quiz', attributes: ['id', 'topic', 'type', 'questions'] }],
    });
    if (!hw) return res.status(404).json({ error: 'Задание не найдено' });

    const allowed = req.user.role === 'teacher'
      ? await isHwOwner(hw, req.user.id)
      : !!(await resolveAccessStudentId(hw, await getStudentIdsForUser(req.user.id)));
    if (!allowed) return res.status(403).json({ error: 'Доступ запрещён' });

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
    const { description, deadline, quizId } = req.body;
    if (quizId) {
      const q = await Quiz.findOne({ where: { id: quizId, teacherId: req.user.id } });
      if (!q) return res.status(403).json({ error: 'Тест не найден или не ваш' });
    }
    await hw.update({ description, deadline, ...(quizId !== undefined ? { quizId: quizId || null } : {}) });
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

    // Ссылка должна быть на наш Cloudinary (анти-фишинг/мусор в БД).
    if (!isAllowedUploadUrl(fileUrl)) {
      return res.status(400).json({ error: 'Недопустимая ссылка на файл' });
    }

    const hw = await Homework.findByPk(req.params.id);
    if (!hw) return res.status(404).json({ error: 'Задание не найдено' });

    // S2: студент может сдать только ДЗ своих групп / инд. уроков.
    // accessStudentId — Student.id (по нужному учителю), под которым пишем сдачу.
    const myStudentIds = await getStudentIdsForUser(req.user.id);
    const accessStudentId = await resolveAccessStudentId(hw, myStudentIds);
    if (!accessStudentId) {
      return res.status(403).json({ error: 'Это задание не относится к вашим занятиям' });
    }

    const existing = await HomeworkSubmission.findOne({
      where: { homeworkId: hw.id, studentId: accessStudentId },
    });
    if (existing) return res.status(400).json({ error: 'Вы уже сдали это задание' });

    const sub = await HomeworkSubmission.create({
      homeworkId: hw.id,
      studentId:  accessStudentId,
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
      include: [{ model: Student, as: 'student', attributes: ['id', 'name'],
        include: [{ model: User, as: 'account', attributes: ['email'] }] }],
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
    // Проверяем что сдача принадлежит именно этому ДЗ (не другому)
    if (sub.homeworkId !== hw.id) return res.status(404).json({ error: 'Сдача не найдена' });

    // grade (0–100, целое) уже проверен схемой gradeSubmission.
    // grade: null → сброс оценки обратно в pending.
    const { grade } = req.body;
    const isReset = grade === null || grade === undefined;
    await sub.update({ grade: isReset ? null : grade, status: isReset ? 'pending' : 'graded' });
    res.json({ data: sub });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка выставления оценки' });
  }
};

// POST /homework/:id/quiz-attempt — ученик (или учитель-владелец) проходит прикреплённый тест.
// Вопросы берём с сервера из прикреплённого теста; клиент шлёт только ответы и результат.
const submitQuizAttempt = async (req, res) => {
  try {
    const hw = await Homework.findByPk(req.params.id);
    if (!hw) return res.status(404).json({ error: 'Задание не найдено' });
    if (!hw.quizId) return res.status(400).json({ error: 'К заданию не прикреплён тест' });

    const allowed = req.user.role === 'teacher'
      ? await isHwOwner(hw, req.user.id)
      : !!(await resolveAccessStudentId(hw, await getStudentIdsForUser(req.user.id)));
    if (!allowed) return res.status(403).json({ error: 'Это задание не относится к вам' });

    const source = await Quiz.findByPk(hw.quizId);
    if (!source) return res.status(404).json({ error: 'Тест не найден' });

    const { answers, score, total } = req.body;
    const attempt = await Quiz.create({
      teacherId: req.user.id,               // владелец = проходивший
      topic: source.topic, type: source.type, difficulty: source.difficulty, language: source.language,
      questions: source.questions,
      answers: answers || {}, score: score ?? null, total: total ?? null,
      homeworkId: hw.id, sourceQuizId: source.id,
    });
    res.status(201).json({ data: attempt });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сохранения прохождения' });
  }
};

// GET /homework/:id/quiz-attempts — учитель-владелец видит прохождения теста учениками (с ответами).
const getQuizAttempts = async (req, res) => {
  try {
    const hw = await Homework.findByPk(req.params.id);
    if (!hw) return res.status(404).json({ error: 'Задание не найдено' });
    if (!await isHwOwner(hw, req.user.id)) return res.status(403).json({ error: 'Доступ запрещён' });

    const attempts = await Quiz.findAll({
      where: { homeworkId: hw.id },
      include: [{ model: User, as: 'owner', attributes: ['id', 'name'] }],
      order: [['createdAt', 'DESC']],
    });
    const data = attempts.map((a) => ({
      id: a.id,
      student: a.owner ? { id: a.owner.id, name: a.owner.name } : null,
      topic: a.topic, type: a.type,
      questions: a.questions, answers: a.answers,
      score: a.score, total: a.total,
      createdAt: a.createdAt,
    }));
    res.json({ data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка получения прохождений' });
  }
};

module.exports = { getAll, create, getOne, update, remove, submit, getSubmissions, gradeSubmission, submitQuizAttempt, getQuizAttempts };
