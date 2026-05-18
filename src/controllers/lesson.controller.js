const { Lesson, Group, GroupStudent } = require('../models');

const groupInclude = { model: Group, attributes: ['id', 'name', 'lessonLink'] };

const getAll = async (req, res) => {
  try {
    let lessons;
    if (req.user.role === 'teacher') {
      const groups = await Group.findAll({ where: { teacherId: req.user.id }, attributes: ['id'] });
      const groupIds = groups.map(g => g.id);
      lessons = await Lesson.findAll({ where: { groupId: groupIds }, include: [groupInclude] });
    } else {
      const memberships = await GroupStudent.findAll({ where: { studentId: req.user.id }, attributes: ['groupId'] });
      const groupIds = memberships.map(m => m.groupId);
      lessons = await Lesson.findAll({ where: { groupId: groupIds }, include: [groupInclude] });
    }
    res.json({ data: lessons });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка получения уроков' });
  }
};

const create = async (req, res) => {
  try {
    const { groupId, date, time, topic, description, lessonLink, materials } = req.body;
    if (!groupId || !date || !time) {
      return res.status(400).json({ error: 'groupId, date и time обязательны' });
    }
    const lesson = await Lesson.create({ groupId, date, time, topic, description, lessonLink, materials });
    res.status(201).json({ data: lesson });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка создания урока' });
  }
};

const getOne = async (req, res) => {
  try {
    const lesson = await Lesson.findByPk(req.params.id, { include: [groupInclude] });
    if (!lesson) return res.status(404).json({ error: 'Урок не найден' });

    if (req.user.role === 'student') {
      const isMember = await GroupStudent.findOne({
        where: { groupId: lesson.groupId, studentId: req.user.id },
      });
      if (!isMember) return res.status(403).json({ error: 'Доступ запрещён' });
    }

    res.json({ data: lesson });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка получения урока' });
  }
};

const update = async (req, res) => {
  try {
    const lesson = await Lesson.findByPk(req.params.id);
    if (!lesson) return res.status(404).json({ error: 'Урок не найден' });
    const { date, time, topic, description, lessonLink, materials } = req.body;
    await lesson.update({ date, time, topic, description, lessonLink, materials });
    res.json({ data: lesson });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка обновления урока' });
  }
};

const remove = async (req, res) => {
  try {
    const lesson = await Lesson.findByPk(req.params.id);
    if (!lesson) return res.status(404).json({ error: 'Урок не найден' });
    await lesson.destroy();
    res.json({ data: { message: 'Урок удалён' } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка удаления урока' });
  }
};

module.exports = { getAll, create, getOne, update, remove };
