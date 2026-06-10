const { Lesson, Group, GroupStudent, Homework } = require('../models');
const { Op } = require('sequelize');

const groupInclude = { model: Group, attributes: ['id', 'name', 'lessonLink', 'teacherId'] };

// Строит WHERE по query-параметрам: groupId, from, to, date
const buildDateWhere = (query) => {
  const where = {};
  if (query.groupId) where.groupId = query.groupId;
  if (query.from || query.to) {
    where.date = {};
    if (query.from) where.date[Op.gte] = query.from;
    if (query.to)   where.date[Op.lte] = query.to;
  } else if (query.date) {
    where.date = query.date;
  }
  return where;
};

const getAll = async (req, res) => {
  try {
    const extraWhere = buildDateWhere(req.query);
    let groupIds;

    if (req.user.role === 'teacher') {
      const groups = await Group.findAll({ where: { teacherId: req.user.id }, attributes: ['id'] });
      groupIds = groups.map(g => g.id);
    } else {
      const memberships = await GroupStudent.findAll({
        where: { studentId: req.user.id },
        attributes: ['groupId'],
      });
      groupIds = memberships.map(m => m.groupId);
    }

    // Если фильтруют по конкретному groupId — проверяем что он входит в доступные
    if (extraWhere.groupId && !groupIds.includes(extraWhere.groupId)) {
      return res.json({ data: [] });
    }

    const where = { groupId: extraWhere.groupId ? extraWhere.groupId : groupIds, ...extraWhere };
    delete where.groupId; // уже обработан выше
    where.groupId = extraWhere.groupId || { [Op.in]: groupIds };

    const page   = Math.max(1, parseInt(req.query.page)  || 1);
    const limit  = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;

    const { count, rows } = await Lesson.findAndCountAll({
      where,
      include: [
        groupInclude,
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
    res.status(500).json({ error: 'Ошибка получения уроков' });
  }
};

const create = async (req, res) => {
  try {
    // groupId/date/time проверены схемой createLesson.
    const { groupId, date, time, topic, description, lessonLink, materials } = req.body;

    // Проверяем что группа принадлежит этому учителю
    const group = await Group.findByPk(groupId);
    if (!group || group.teacherId !== req.user.id) {
      return res.status(403).json({ error: 'Группа не найдена или доступ запрещён' });
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
    const lesson = await Lesson.findByPk(req.params.id, {
      include: [groupInclude, { model: Homework, required: false }],
    });
    if (!lesson) return res.status(404).json({ error: 'Урок не найден' });

    if (req.user.role === 'teacher') {
      if (lesson.Group?.teacherId !== req.user.id) {
        return res.status(403).json({ error: 'Доступ запрещён' });
      }
    } else {
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
    const lesson = await Lesson.findByPk(req.params.id, { include: [groupInclude] });
    if (!lesson) return res.status(404).json({ error: 'Урок не найден' });

    // Только учитель-владелец группы
    if (lesson.Group.teacherId !== req.user.id) {
      return res.status(403).json({ error: 'Доступ запрещён' });
    }

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
    const lesson = await Lesson.findByPk(req.params.id, { include: [groupInclude] });
    if (!lesson) return res.status(404).json({ error: 'Урок не найден' });

    if (lesson.Group.teacherId !== req.user.id) {
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
