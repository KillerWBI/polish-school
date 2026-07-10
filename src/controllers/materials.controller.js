const { Op } = require('sequelize');
const { Group, GroupStudent, Lesson, IndividualLesson } = require('../models');
const { getStudentIdsForUser } = require('../utils/students');

// GET /materials — все материалы уроков пользователя в одном месте.
//   teacher → уроки его групп + его инд.уроки с непустыми materials
//   student → уроки его групп + его инд.уроки с непустыми materials
// Ответ: [{ lessonId|individualLessonId, kind, date, topic, groupName, teacherName?, materials:[...] }]
const list = async (req, res) => {
  try {
    const user = req.user;

    // 1. Определяем доступные группы + фильтр инд.уроков
    let groupIds = [];
    let indWhere;
    if (user.role === 'teacher') {
      const groups = await Group.findAll({ where: { teacherId: user.id }, attributes: ['id'] });
      groupIds = groups.map(g => g.id);
      indWhere = { teacherId: user.id };
    } else {
      const myStudentIds = await getStudentIdsForUser(user.id);
      if (myStudentIds.length) {
        const memberships = await GroupStudent.findAll({ where: { studentId: myStudentIds }, attributes: ['groupId'] });
        groupIds = [...new Set(memberships.map(m => m.groupId))];
      }
      indWhere = myStudentIds.length ? { studentId: myStudentIds } : { studentId: '00000000-0000-0000-0000-000000000000' };
    }

    // 2. Групповые уроки с материалами
    const groupLessons = groupIds.length
      ? await Lesson.findAll({
          where: { groupId: { [Op.in]: groupIds } },
          attributes: ['id', 'date', 'topic', 'materials'],
          include: [{ model: Group, attributes: ['name'] }],
          order: [['date', 'DESC']],
        })
      : [];

    // 3. Индивидуальные уроки с материалами
    const indLessons = await IndividualLesson.findAll({
      where: indWhere,
      attributes: ['id', 'date', 'topic', 'materials'],
      order: [['date', 'DESC']],
    });

    const hasMaterials = (m) => Array.isArray(m) && m.length > 0;

    const data = [];
    for (const l of groupLessons) {
      if (!hasMaterials(l.materials)) continue;
      data.push({
        id: l.id, kind: 'group', date: l.date, topic: l.topic,
        groupName: l.Group?.name ?? null, materials: l.materials,
      });
    }
    for (const il of indLessons) {
      if (!hasMaterials(il.materials)) continue;
      data.push({
        id: il.id, kind: 'individual', date: il.date, topic: il.topic,
        groupName: null, materials: il.materials,
      });
    }

    // Сортируем всё вместе по дате (свежие сверху)
    data.sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json({ data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка получения материалов' });
  }
};

module.exports = { list };
