const {
  Group, GroupStudent, Lesson, IndividualLesson, IndividualCourse,
  Homework, HomeworkSubmission, Attendance, Payment, User,
} = require('../models');
const { Op } = require('sequelize');

/* ════════════════════════════════════════════════════════════════════════
   УЧИТЕЛЬ
   ════════════════════════════════════════════════════════════════════════ */
const buildTeacherDashboard = async (teacherId) => {
  const today        = new Date().toISOString().slice(0, 10);
  const currentMonth = today.slice(0, 7);
  const [year, mon]  = currentMonth.split('-').map(Number);
  const monthStart   = `${currentMonth}-01`;
  const monthEnd     = new Date(year, mon, 0).toISOString().slice(0, 10);

  const groups = await Group.findAll({ where: { teacherId }, attributes: ['id', 'name'] });
  const groupIds = groups.map(g => g.id);

  const [allLessons, allIndLessons] = await Promise.all([
    groupIds.length
      ? Lesson.findAll({ where: { groupId: { [Op.in]: groupIds } }, attributes: ['id'] })
      : Promise.resolve([]),
    IndividualLesson.findAll({ where: { teacherId }, attributes: ['id'] }),
  ]);
  const allLessonIds    = allLessons.map(l => l.id);
  const allIndLessonIds = allIndLessons.map(l => l.id);

  // 1. Уроков сегодня
  const [groupLessonsToday, indLessonsToday] = await Promise.all([
    groupIds.length
      ? Lesson.count({ where: { groupId: { [Op.in]: groupIds }, date: today } })
      : Promise.resolve(0),
    IndividualLesson.count({ where: { teacherId, date: today } }),
  ]);
  const lessonsToday = groupLessonsToday + indLessonsToday;

  // 2. ДЗ без проверки
  let ungradedCount = 0;
  let ungradedList  = [];
  const hwOr = [];
  if (allLessonIds.length)    hwOr.push({ lessonId:           { [Op.in]: allLessonIds } });
  if (allIndLessonIds.length) hwOr.push({ individualLessonId: { [Op.in]: allIndLessonIds } });
  if (hwOr.length) {
    const hws = await Homework.findAll({ where: { [Op.or]: hwOr }, attributes: ['id'] });
    const hwIds = hws.map(h => h.id);
    if (hwIds.length) {
      [ungradedCount, ungradedList] = await Promise.all([
        HomeworkSubmission.count({ where: { homeworkId: { [Op.in]: hwIds }, status: 'pending' } }),
        HomeworkSubmission.findAll({
          where: { homeworkId: { [Op.in]: hwIds }, status: 'pending' },
          include: [
            { model: User,     as: 'student', attributes: ['id', 'name'] },
            { model: Homework, attributes: ['id', 'description'] },
          ],
          order: [['createdAt', 'DESC']],
          limit: 5,
        }),
      ]);
    }
  }

  // 3. Долг студентов
  const [groupStudentRows, indCourseRows] = await Promise.all([
    groupIds.length
      ? GroupStudent.findAll({ where: { groupId: { [Op.in]: groupIds } }, attributes: ['studentId'] })
      : Promise.resolve([]),
    IndividualCourse.findAll({ where: { teacherId }, attributes: ['studentId'] }),
  ]);
  const allStudentIds = [...new Set([
    ...groupStudentRows.map(r => r.studentId),
    ...indCourseRows.map(r => r.studentId),
  ])];

  let totalDebt = 0;
  if (allStudentIds.length) {
    const unpaid = await Payment.findAll({
      where: { studentId: { [Op.in]: allStudentIds }, paid: false },
      attributes: ['amount'],
    });
    totalDebt = unpaid.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
  }

  // 4. Посещаемость месяца
  const [monthLessons, monthIndLessons] = await Promise.all([
    groupIds.length
      ? Lesson.findAll({ where: { groupId: { [Op.in]: groupIds }, date: { [Op.between]: [monthStart, monthEnd] } }, attributes: ['id'] })
      : Promise.resolve([]),
    IndividualLesson.findAll({ where: { teacherId, date: { [Op.between]: [monthStart, monthEnd] } }, attributes: ['id'] }),
  ]);
  const monthLessonIds    = monthLessons.map(l => l.id);
  const monthIndLessonIds = monthIndLessons.map(l => l.id);

  let attendancePercent = null;
  const attOr = [];
  if (monthLessonIds.length)    attOr.push({ lessonId:           { [Op.in]: monthLessonIds } });
  if (monthIndLessonIds.length) attOr.push({ individualLessonId: { [Op.in]: monthIndLessonIds } });
  if (attOr.length) {
    const [total, present] = await Promise.all([
      Attendance.count({ where: { [Op.or]: attOr } }),
      Attendance.count({ where: { [Op.or]: attOr, present: true } }),
    ]);
    if (total > 0) attendancePercent = Math.round((present / total) * 100);
  }

  // 5. Ближайшие уроки
  const [upcomingGroup, upcomingInd] = await Promise.all([
    groupIds.length
      ? Lesson.findAll({
          where: { groupId: { [Op.in]: groupIds }, date: { [Op.gte]: today } },
          include: [{ model: Group, attributes: ['id', 'name'] }],
          order: [['date', 'ASC'], ['time', 'ASC']],
          limit: 5,
          attributes: ['id', 'date', 'time', 'topic'],
        })
      : Promise.resolve([]),
    IndividualLesson.findAll({
      where: { teacherId, date: { [Op.gte]: today } },
      include: [{ model: User, as: 'student', attributes: ['id', 'name'] }],
      order: [['date', 'ASC'], ['time', 'ASC']],
      limit: 5,
      attributes: ['id', 'date', 'time'],
    }),
  ]);

  const upcomingLessons = [
    ...upcomingGroup.map(l => ({
      id: l.id, date: l.date, time: l.time, topic: l.topic,
      type: 'group', label: l.Group?.name,
    })),
    ...upcomingInd.map(l => ({
      id: l.id, date: l.date, time: l.time, topic: null,
      type: 'individual', label: l.student?.name,
    })),
  ]
    .sort((a, b) => (`${a.date}T${a.time}` < `${b.date}T${b.time}` ? -1 : 1))
    .slice(0, 5);

  return {
    role: 'teacher',
    kpi: {
      lessonsToday,
      ungradedSubmissions: ungradedCount,
      totalDebt: Math.round(totalDebt * 100) / 100,
      attendancePercent,
    },
    upcomingLessons,
    ungradedList,
  };
};

/* ════════════════════════════════════════════════════════════════════════
   СТУДЕНТ
   ════════════════════════════════════════════════════════════════════════ */
const buildStudentDashboard = async (studentId) => {
  const today        = new Date().toISOString().slice(0, 10);
  const currentMonth = today.slice(0, 7);
  const [year, mon]  = currentMonth.split('-').map(Number);
  const monthStart   = `${currentMonth}-01`;
  const monthEnd     = new Date(year, mon, 0).toISOString().slice(0, 10);
  const next7Days    = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  // Группы студента
  const memberships = await GroupStudent.findAll({ where: { studentId }, attributes: ['groupId'] });
  const groupIds = memberships.map(m => m.groupId);

  // Все уроки студента (для ДЗ)
  const [allLessons, allIndLessons] = await Promise.all([
    groupIds.length
      ? Lesson.findAll({ where: { groupId: { [Op.in]: groupIds } }, attributes: ['id'] })
      : Promise.resolve([]),
    IndividualLesson.findAll({ where: { studentId }, attributes: ['id'] }),
  ]);
  const allLessonIds    = allLessons.map(l => l.id);
  const allIndLessonIds = allIndLessons.map(l => l.id);

  // 1. Уроков на ближайшие 7 дней
  const [weekGroupCount, weekIndCount] = await Promise.all([
    groupIds.length
      ? Lesson.count({ where: { groupId: { [Op.in]: groupIds }, date: { [Op.between]: [today, next7Days] } } })
      : Promise.resolve(0),
    IndividualLesson.count({ where: { studentId, date: { [Op.between]: [today, next7Days] } } }),
  ]);
  const lessonsThisWeek = weekGroupCount + weekIndCount;

  // 2. ДЗ к сдаче (мои + не сданные)
  let pendingHwCount = 0;
  let pendingHwList  = [];
  const hwOr = [];
  if (allLessonIds.length)    hwOr.push({ lessonId:           { [Op.in]: allLessonIds } });
  if (allIndLessonIds.length) hwOr.push({ individualLessonId: { [Op.in]: allIndLessonIds } });
  if (hwOr.length) {
    const hws = await Homework.findAll({
      where: { [Op.or]: hwOr },
      attributes: ['id', 'description', 'deadline', 'lessonId', 'individualLessonId'],
      order: [['deadline', 'ASC']],
    });
    if (hws.length) {
      const hwIds = hws.map(h => h.id);
      // Уже сданные мной ДЗ
      const mySubs = await HomeworkSubmission.findAll({
        where: { homeworkId: { [Op.in]: hwIds }, studentId },
        attributes: ['homeworkId'],
      });
      const submittedHwIds = new Set(mySubs.map(s => s.homeworkId));
      const pending = hws.filter(h => !submittedHwIds.has(h.id));
      pendingHwCount = pending.length;
      pendingHwList  = pending.slice(0, 5).map(h => ({
        id: h.id, description: h.description, deadline: h.deadline,
        type: h.lessonId ? 'group' : 'individual',
      }));
    }
  }

  // 3. Посещаемость месяца (моя)
  const [monthLessons, monthIndLessons] = await Promise.all([
    groupIds.length
      ? Lesson.findAll({ where: { groupId: { [Op.in]: groupIds }, date: { [Op.between]: [monthStart, monthEnd] } }, attributes: ['id'] })
      : Promise.resolve([]),
    IndividualLesson.findAll({ where: { studentId, date: { [Op.between]: [monthStart, monthEnd] } }, attributes: ['id'] }),
  ]);
  const monthLessonIds    = monthLessons.map(l => l.id);
  const monthIndLessonIds = monthIndLessons.map(l => l.id);

  let attendancePercent = null;
  const attOr = [];
  if (monthLessonIds.length)    attOr.push({ lessonId:           { [Op.in]: monthLessonIds } });
  if (monthIndLessonIds.length) attOr.push({ individualLessonId: { [Op.in]: monthIndLessonIds } });
  if (attOr.length) {
    const [total, present] = await Promise.all([
      Attendance.count({ where: { [Op.or]: attOr, studentId } }),
      Attendance.count({ where: { [Op.or]: attOr, studentId, present: true } }),
    ]);
    if (total > 0) attendancePercent = Math.round((present / total) * 100);
  }

  // 4. Мой долг
  const unpaid = await Payment.findAll({
    where: { studentId, paid: false },
    attributes: ['amount'],
  });
  const myDebt = unpaid.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);

  // 5. Ближайшие уроки
  const [upcomingGroup, upcomingInd] = await Promise.all([
    groupIds.length
      ? Lesson.findAll({
          where: { groupId: { [Op.in]: groupIds }, date: { [Op.gte]: today } },
          include: [{ model: Group, attributes: ['id', 'name', 'lessonLink'] }],
          order: [['date', 'ASC'], ['time', 'ASC']],
          limit: 5,
          attributes: ['id', 'date', 'time', 'topic', 'lessonLink'],
        })
      : Promise.resolve([]),
    IndividualLesson.findAll({
      where: { studentId, date: { [Op.gte]: today } },
      include: [{ model: User, as: 'teacher', attributes: ['id', 'name'] }],
      order: [['date', 'ASC'], ['time', 'ASC']],
      limit: 5,
      attributes: ['id', 'date', 'time'],
    }),
  ]);

  const upcomingLessons = [
    ...upcomingGroup.map(l => ({
      id: l.id, date: l.date, time: l.time, topic: l.topic,
      type: 'group', label: l.Group?.name,
      lessonLink: l.lessonLink || l.Group?.lessonLink,
    })),
    ...upcomingInd.map(l => ({
      id: l.id, date: l.date, time: l.time, topic: null,
      type: 'individual', label: l.teacher?.name,
      lessonLink: null,
    })),
  ]
    .sort((a, b) => (`${a.date}T${a.time}` < `${b.date}T${b.time}` ? -1 : 1))
    .slice(0, 5);

  return {
    role: 'student',
    kpi: {
      lessonsThisWeek,
      pendingHomework: pendingHwCount,
      attendancePercent,
      myDebt: Math.round(myDebt * 100) / 100,
    },
    upcomingLessons,
    pendingHomework: pendingHwList,
  };
};

/* ════════════════════════════════════════════════════════════════════════
   Главный handler — switch по роли
   ════════════════════════════════════════════════════════════════════════ */
const getDashboard = async (req, res) => {
  try {
    const data = req.user.role === 'teacher'
      ? await buildTeacherDashboard(req.user.id)
      : await buildStudentDashboard(req.user.id);
    res.json({ data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка загрузки дашборда' });
  }
};

/* ════════════════════════════════════════════════════════════════════════
   ЛЕНТА АКТИВНОСТИ — отдельно для каждой роли
   ════════════════════════════════════════════════════════════════════════ */
const buildTeacherActivity = async (teacherId) => {
  const groups = await Group.findAll({ where: { teacherId }, attributes: ['id'] });
  const groupIds = groups.map(g => g.id);

  const [allLessons, allIndLessons] = await Promise.all([
    groupIds.length
      ? Lesson.findAll({ where: { groupId: { [Op.in]: groupIds } }, attributes: ['id'] })
      : Promise.resolve([]),
    IndividualLesson.findAll({ where: { teacherId }, attributes: ['id'] }),
  ]);
  const allLessonIds    = allLessons.map(l => l.id);
  const allIndLessonIds = allIndLessons.map(l => l.id);

  let submissions = [];
  const hwOr = [];
  if (allLessonIds.length)    hwOr.push({ lessonId:           { [Op.in]: allLessonIds } });
  if (allIndLessonIds.length) hwOr.push({ individualLessonId: { [Op.in]: allIndLessonIds } });
  if (hwOr.length) {
    const hws = await Homework.findAll({ where: { [Op.or]: hwOr }, attributes: ['id', 'description'] });
    const hwIds = hws.map(h => h.id);
    if (hwIds.length) {
      submissions = await HomeworkSubmission.findAll({
        where: { homeworkId: { [Op.in]: hwIds } },
        include: [
          { model: User,     as: 'student', attributes: ['id', 'name'] },
          { model: Homework, attributes: ['id', 'description'] },
        ],
        order: [['createdAt', 'DESC']],
        limit: 10,
        attributes: ['id', 'status', 'createdAt'],
      });
    }
  }

  const [groupStudentRows, indCourseRows] = await Promise.all([
    groupIds.length
      ? GroupStudent.findAll({ where: { groupId: { [Op.in]: groupIds } }, attributes: ['studentId'] })
      : Promise.resolve([]),
    IndividualCourse.findAll({ where: { teacherId }, attributes: ['studentId'] }),
  ]);
  const allStudentIds = [...new Set([
    ...groupStudentRows.map(r => r.studentId),
    ...indCourseRows.map(r => r.studentId),
  ])];

  let payments = [];
  if (allStudentIds.length) {
    payments = await Payment.findAll({
      where: { studentId: { [Op.in]: allStudentIds }, paid: true },
      include: [{ model: User, as: 'student', attributes: ['id', 'name'] }],
      order: [['updatedAt', 'DESC']],
      limit: 10,
      attributes: ['id', 'amount', 'month', 'updatedAt'],
    });
  }

  return [
    ...submissions.map(s => ({
      id:   `sub-${s.id}`,
      type: 'submission',
      text: `${s.student?.name ?? '?'} сдал${s.student?.name?.endsWith('а') ? 'а' : ''} ДЗ «${s.Homework?.description?.slice(0, 40) ?? ''}»`,
      at:   s.createdAt,
      extra: s.status === 'pending' ? 'Ждёт проверки' : 'Проверено',
    })),
    ...payments.map(p => ({
      id:   `pay-${p.id}`,
      type: 'payment',
      text: `${p.student?.name ?? '?'} оплатил${p.student?.name?.endsWith('а') ? 'а' : ''} ${p.month} — ${p.amount} zł`,
      at:   p.updatedAt,
      extra: null,
    })),
  ].sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 15);
};

const buildStudentActivity = async (studentId) => {
  // Мои сдачи + оценки
  const submissions = await HomeworkSubmission.findAll({
    where: { studentId },
    include: [{ model: Homework, attributes: ['id', 'description'] }],
    order: [['updatedAt', 'DESC']],
    limit: 10,
    attributes: ['id', 'status', 'grade', 'createdAt', 'updatedAt'],
  });

  // Мои оплаты (paid=true)
  const payments = await Payment.findAll({
    where: { studentId, paid: true },
    order: [['updatedAt', 'DESC']],
    limit: 10,
    attributes: ['id', 'amount', 'month', 'updatedAt'],
  });

  return [
    ...submissions.map(s => {
      const isGraded = s.status === 'graded';
      const text = isGraded
        ? `Оценка ${s.grade}/100 за «${s.Homework?.description?.slice(0, 40) ?? ''}»`
        : `Сдал${s.studentId ? '' : ''} «${s.Homework?.description?.slice(0, 40) ?? ''}» — ждёт проверки`;
      return {
        id:   `sub-${s.id}`,
        type: isGraded ? 'grade' : 'submission',
        text,
        at:   s.updatedAt,
        extra: null,
      };
    }),
    ...payments.map(p => ({
      id:   `pay-${p.id}`,
      type: 'payment',
      text: `Оплачено ${p.month} — ${p.amount} zł`,
      at:   p.updatedAt,
      extra: null,
    })),
  ].sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 15);
};

const getActivity = async (req, res) => {
  try {
    const events = req.user.role === 'teacher'
      ? await buildTeacherActivity(req.user.id)
      : await buildStudentActivity(req.user.id);
    res.json({ data: events });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка загрузки активности' });
  }
};

module.exports = { getDashboard, getActivity };
