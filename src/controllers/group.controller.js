const { Group, GroupStudent, User } = require('../models');
const { generateGroupLessons } = require('../utils/lessonGenerator');

const getAll = async (req, res) => {
  try {
    let groups;
    if (req.user.role === 'teacher') {
      groups = await Group.findAll({ where: { teacherId: req.user.id } });
    } else {
      // студент видит только свои группы
      const user = await User.findByPk(req.user.id, {
        include: [{ model: Group, as: 'groups' }],
      });
      groups = user.groups;
    }
    res.json({ data: groups });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка получения групп' });
  }
};

const create = async (req, res) => {
  try {
    const { name, schedule, lessonLink, pricePerLesson } = req.body;
    if (!name) return res.status(400).json({ error: 'Название обязательно' });

    const group = await Group.create({
      name,
      teacherId: req.user.id,
      schedule: schedule || [],
      lessonLink: lessonLink || null,
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
      include: [{ model: User, as: 'students', attributes: ['id', 'name', 'email'] }],
    });
    if (!group) return res.status(404).json({ error: 'Группа не найдена' });

    // студент может смотреть только свои группы
    if (req.user.role === 'student') {
      const isMember = await GroupStudent.findOne({
        where: { groupId: group.id, studentId: req.user.id },
      });
      if (!isMember) return res.status(403).json({ error: 'Доступ запрещён' });
    }

    res.json({ data: group });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка получения группы' });
  }
};

const update = async (req, res) => {
  try {
    const group = await Group.findByPk(req.params.id);
    if (!group) return res.status(404).json({ error: 'Группа не найдена' });

    const { name, schedule, lessonLink, pricePerLesson } = req.body;
    await group.update({ name, schedule, lessonLink, pricePerLesson });
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
    await group.destroy();
    res.json({ data: { message: 'Группа удалена' } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка удаления группы' });
  }
};

const addStudent = async (req, res) => {
  try {
    const { studentId } = req.body;
    if (!studentId) return res.status(400).json({ error: 'studentId обязателен' });

    const group = await Group.findByPk(req.params.id);
    if (!group) return res.status(404).json({ error: 'Группа не найдена' });

    const student = await User.findByPk(studentId);
    if (!student || student.role !== 'student') {
      return res.status(404).json({ error: 'Студент не найден' });
    }

    const exists = await GroupStudent.findOne({ where: { groupId: group.id, studentId } });
    if (exists) return res.status(400).json({ error: 'Студент уже в группе' });

    await GroupStudent.create({ groupId: group.id, studentId });
    res.status(201).json({ data: { message: 'Студент добавлен' } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка добавления студента' });
  }
};

const removeStudent = async (req, res) => {
  try {
    const { id: groupId, studentId } = req.params;
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
    const created = await generateGroupLessons({ groupId: req.params.id, from, to });
    res.json({ data: { created: created.length, lessons: created } });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Ошибка генерации уроков' });
  }
};

module.exports = { getAll, create, getOne, update, remove, addStudent, removeStudent, generateLessons };
