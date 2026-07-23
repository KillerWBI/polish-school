const { Group, GroupStudent, User, Student, Lesson, Homework, HomeworkSubmission, Attendance, TeacherStudent } = require('../models');
const { generateGroupLessons } = require('../utils/lessonGenerator');
const { getStudentIdsForUser, resolveStudent, createPlaceholder } = require('../utils/students');
const { overLimit } = require('../config/planLimits');

const getAll = async (req, res) => {
  try {
    let groups;
    if (req.user.role === 'teacher') {
      groups = await Group.findAll({ where: { teacherId: req.user.id } });
    } else {
      // студент видит свои группы: через его Student-записи → членства
      const myStudentIds = await getStudentIdsForUser(req.user.id);
      const memberships = myStudentIds.length
        ? await GroupStudent.findAll({ where: { studentId: myStudentIds }, attributes: ['groupId'] })
        : [];
      const groupIds = [...new Set(memberships.map(m => m.groupId))];
      groups = groupIds.length ? await Group.findAll({ where: { id: groupIds } }) : [];
    }
    res.json({ data: groups });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка получения групп' });
  }
};

const create = async (req, res) => {
  try {
    // name/schedule/pricePerLesson проверены схемой createGroup.
    const { name, schedule, lessonLink, chatLink, pricePerLesson } = req.body;

    // Лимит тарифа на число групп
    const me = await User.findByPk(req.user.id, { attributes: ['plan'] });
    const usedGroups = await Group.count({ where: { teacherId: req.user.id } });
    if (overLimit(res, 'teacher', me?.plan, 'groups', usedGroups)) return;

    const group = await Group.create({
      name,
      teacherId: req.user.id,
      schedule: schedule || [],
      lessonLink: lessonLink || null,
      chatLink: chatLink || null,
      pricePerLesson: pricePerLesson || 0,
    });
    res.status(201).json({ data: group });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка создания группы' });
  }
};

const getOne = async (req, res) => {
  try {
    const group = await Group.findByPk(req.params.id, {
      include: [{
        model: Student, as: 'students', attributes: ['id', 'name', 'userId', 'contact'],
        include: [{ model: User, as: 'account', attributes: ['email', 'username', 'avatar'] }],
      }],
    });
    if (!group) return res.status(404).json({ error: 'Группа не найдена' });

    // учитель видит только свою группу
    if (req.user.role === 'teacher' && group.teacherId !== req.user.id) {
      return res.status(403).json({ error: 'Доступ запрещён' });
    }

    // студент может смотреть только свои группы (по своим Student-записям)
    if (req.user.role === 'student') {
      const myStudentIds = await getStudentIdsForUser(req.user.id);
      const isMember = myStudentIds.length
        ? await GroupStudent.findOne({ where: { groupId: group.id, studentId: myStudentIds } })
        : null;
      if (!isMember) return res.status(403).json({ error: 'Доступ запрещён' });
    }

    // Уплощаем ученика: id (=Student.id), name из Student, контакты — из привязанного аккаунта.
    // isPlaceholder = нет аккаунта (заглушка); contact — ручной контакт для заглушки.
    const data = group.toJSON();
    data.students = (data.students || []).map(s => ({
      id: s.id,
      name: s.name,
      isPlaceholder: s.userId === null,
      contact: s.contact ?? null,
      email: s.account?.email ?? null,
      username: s.account?.username ?? null,
      avatar: s.account?.avatar ?? null,
    }));

    res.json({ data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка получения группы' });
  }
};

const update = async (req, res) => {
  try {
    const group = await Group.findByPk(req.params.id);
    if (!group) return res.status(404).json({ error: 'Группа не найдена' });
    if (group.teacherId !== req.user.id) return res.status(403).json({ error: 'Доступ запрещён' });

    const { name, schedule, lessonLink, chatLink, pricePerLesson } = req.body;
    await group.update({ name, schedule, lessonLink, chatLink, pricePerLesson });
    res.json({ data: group });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка обновления группы' });
  }
};

const remove = async (req, res) => {
  try {
    const group = await Group.findByPk(req.params.id);
    if (!group) return res.status(404).json({ error: 'Группа не найдена' });
    if (group.teacherId !== req.user.id) return res.status(403).json({ error: 'Доступ запрещён' });

    // Каскадное удаление в транзакции — либо всё, либо ничего
    await Group.sequelize.transaction(async (t) => {
      const lessons = await Lesson.findAll({
        where: { groupId: group.id }, attributes: ['id'], transaction: t,
      });
      const lessonIds = lessons.map(l => l.id);

      if (lessonIds.length > 0) {
        await Attendance.destroy({ where: { lessonId: lessonIds }, transaction: t });

        const homeworks = await Homework.findAll({
          where: { lessonId: lessonIds }, attributes: ['id'], transaction: t,
        });
        const hwIds = homeworks.map(h => h.id);
        if (hwIds.length > 0) {
          await HomeworkSubmission.destroy({ where: { homeworkId: hwIds }, transaction: t });
          await Homework.destroy({ where: { id: hwIds }, transaction: t });
        }

        await Lesson.destroy({ where: { groupId: group.id }, transaction: t });
      }

      await GroupStudent.destroy({ where: { groupId: group.id }, transaction: t });
      await group.destroy({ transaction: t });
    });

    res.json({ data: { message: 'Группа удалена' } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка удаления группы' });
  }
};

const addStudent = async (req, res) => {
  try {
    // studentId (UUID) проверен схемой addStudent.
    const { studentId } = req.body;

    const group = await Group.findByPk(req.params.id);
    if (!group) return res.status(404).json({ error: 'Группа не найдена' });
    if (group.teacherId !== req.user.id) return res.status(403).json({ error: 'Доступ запрещён' });

    // studentId — это Student.id из ростера учителя (реальный ИЛИ заглушка).
    // Само наличие Student у этого учителя = гейт «мой ученик».
    const student = await Student.findOne({ where: { id: studentId, teacherId: req.user.id } });
    if (!student) {
      return res.status(403).json({ error: 'Этот ученик не в вашем ростере' });
    }

    const exists = await GroupStudent.findOne({ where: { groupId: group.id, studentId: student.id } });
    if (exists) return res.status(400).json({ error: 'Студент уже в группе' });

    await GroupStudent.create({ groupId: group.id, studentId: student.id });
    res.status(201).json({ data: { message: 'Студент добавлен' } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка добавления студента' });
  }
};

// POST /groups/:id/placeholder — добавить заглушку (ученик без аккаунта).
// БЕЗ гейта TeacherStudent: заглушка уже принадлежит учителю (teacherId).
const addPlaceholder = async (req, res) => {
  try {
    const { name, contact } = req.body;

    const group = await Group.findByPk(req.params.id);
    if (!group) return res.status(404).json({ error: 'Группа не найдена' });
    if (group.teacherId !== req.user.id) return res.status(403).json({ error: 'Доступ запрещён' });

    // Лимит тарифа на число учеников
    const me = await User.findByPk(req.user.id, { attributes: ['plan'] });
    const usedStudents = await Student.count({ where: { teacherId: req.user.id } });
    if (overLimit(res, 'teacher', me?.plan, 'students', usedStudents)) return;

    const student = await createPlaceholder(req.user.id, name, contact);
    await GroupStudent.create({ groupId: group.id, studentId: student.id });
    res.status(201).json({ data: { id: student.id, name: student.name, contact: student.contact, isPlaceholder: true } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка добавления заглушки' });
  }
};

const removeStudent = async (req, res) => {
  try {
    const { id: groupId, studentId } = req.params;
    const group = await Group.findByPk(groupId);
    if (!group || group.teacherId !== req.user.id) return res.status(403).json({ error: 'Доступ запрещён' });

    const record = await GroupStudent.findOne({ where: { groupId, studentId } });
    if (!record) return res.status(404).json({ error: 'Студент не в группе' });
    await record.destroy();
    res.json({ data: { message: 'Студент удалён из группы' } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка удаления студента из группы' });
  }
};

// Массовая генерация уроков по расписанию группы в период [from, to]
// Дубли по (groupId, date, time) не создаются — можно вызывать повторно.
const generateLessons = async (req, res) => {
  try {
    const { from, to } = req.body;
    const group = await Group.findByPk(req.params.id);
    if (!group) return res.status(404).json({ error: 'Группа не найдена' });
    if (group.teacherId !== req.user.id) return res.status(403).json({ error: 'Доступ запрещён' });
    const created = await generateGroupLessons({ groupId: req.params.id, from, to });
    res.json({ data: { created: created.length, lessons: created } });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Ошибка генерации уроков' });
  }
};

module.exports = { getAll, create, getOne, update, remove, addStudent, addPlaceholder, removeStudent, generateLessons };
