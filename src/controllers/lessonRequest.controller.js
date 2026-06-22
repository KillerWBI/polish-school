const { LessonRequest, TeacherStudent, User } = require('../models');
const { sendLessonRequestEmail } = require('../services/email');

// Публичные поля пользователя для вложений (карточка студента/учителя в заявке)
const USER_BRIEF = ['id', 'name', 'username', 'avatar', 'role'];

// POST /lesson-requests — студент создаёт заявку на обучение.
const create = async (req, res) => {
  try {
    // Формат полей проверен схемой createLessonRequest.
    const { teacherId, language, level, message, contactMethod, contactValue } = req.body;
    const studentId = req.user.id;

    if (teacherId === studentId) {
      return res.status(400).json({ error: 'Нельзя отправить заявку самому себе' });
    }

    // Получатель должен существовать и быть учителем
    const teacher = await User.findByPk(teacherId, { attributes: ['id', 'name', 'email', 'role'] });
    if (!teacher || teacher.role !== 'teacher') {
      return res.status(404).json({ error: 'Учитель не найден' });
    }

    // Уже ученик этого учителя — заявка не нужна
    const already = await TeacherStudent.findOne({ where: { teacherId, studentId } });
    if (already) return res.status(400).json({ error: 'Вы уже ученик этого учителя' });

    // Анти-спам: одна активная (pending) заявка к учителю
    const pending = await LessonRequest.findOne({ where: { teacherId, studentId, status: 'pending' } });
    if (pending) return res.status(400).json({ error: 'Заявка этому учителю уже отправлена' });

    const request = await LessonRequest.create({
      studentId, teacherId, language,
      level: level || null,
      message: message || null,
      contactMethod, contactValue,
    });

    // Письмо учителю — best-effort, не блокируем при сбое
    try {
      const student = await User.findByPk(studentId, { attributes: ['name'] });
      await sendLessonRequestEmail(teacher.email, teacher.name, student.name, language);
    } catch (err) {
      console.error('Не удалось отправить письмо о заявке:', err.message);
    }

    res.status(201).json({ data: request });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка создания заявки' });
  }
};

// GET /lesson-requests — роль-свитч: учитель видит входящие, студент — свои.
// Опционально ?status=pending|accepted|declined
const getAll = async (req, res) => {
  try {
    const { status } = req.query;
    const where = {};
    if (status) where.status = status;

    let requests;
    if (req.user.role === 'teacher') {
      where.teacherId = req.user.id;
      requests = await LessonRequest.findAll({
        where,
        include: [{ model: User, as: 'student', attributes: USER_BRIEF }],
        order: [['createdAt', 'DESC']],
      });
    } else {
      where.studentId = req.user.id;
      requests = await LessonRequest.findAll({
        where,
        include: [{ model: User, as: 'teacher', attributes: USER_BRIEF }],
        order: [['createdAt', 'DESC']],
      });
    }
    res.json({ data: requests });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка получения заявок' });
  }
};

// PATCH /lesson-requests/:id — учитель принимает (accept) или отклоняет (decline).
// accept → транзакцией: статус + создать связь «мой ученик».
const patch = async (req, res) => {
  try {
    const { status } = req.body; // accepted | declined (проверено схемой)

    const request = await LessonRequest.findByPk(req.params.id);
    if (!request) return res.status(404).json({ error: 'Заявка не найдена' });

    // Только учитель-получатель может решать судьбу заявки
    if (request.teacherId !== req.user.id) {
      return res.status(403).json({ error: 'Доступ запрещён' });
    }
    if (request.status !== 'pending') {
      return res.status(400).json({ error: 'Заявка уже обработана' });
    }

    if (status === 'accepted') {
      await LessonRequest.sequelize.transaction(async (t) => {
        await request.update({ status: 'accepted' }, { transaction: t });
        // findOrCreate — на случай гонки/повторов: связь не задвоится (есть unique-индекс)
        await TeacherStudent.findOrCreate({
          where: { teacherId: request.teacherId, studentId: request.studentId },
          transaction: t,
        });
      });
    } else {
      await request.update({ status: 'declined' });
    }

    res.json({ data: request });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка обработки заявки' });
  }
};

module.exports = { create, getAll, patch };
