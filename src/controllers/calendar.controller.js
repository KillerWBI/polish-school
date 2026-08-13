const crypto = require('crypto');
const { Op } = require('sequelize');
const { User, Group, GroupStudent, Lesson, IndividualLesson, Student, StudentLessonLog, StudentTeacher } = require('../models');
const { getStudentIdsForUser } = require('../utils/students');
const { buildCalendar } = require('../utils/ics');

// Сколько отдаём в подписку. Прошлое нужно — календари показывают историю,
// и человек ждёт увидеть там вчерашний урок. Дальше года вперёд смысла нет.
const PAST_DAYS   = 60;
const FUTURE_DAYS = 365;

const shiftDays = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

/**
 * GET /calendar/subscription — выдать (и при первом обращении создать) ссылку подписки.
 * Требует авторизации: узнать свою ссылку может только сам пользователь.
 */
const getSubscription = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, { attributes: ['id', 'calendarToken'] });
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

    // Токен создаём лениво — при первом нажатии «Подписаться». 24 случайных байта
    // это 48 hex-символов: перебрать нереально, а в ссылку помещается.
    if (!user.calendarToken) {
      await user.update({ calendarToken: crypto.randomBytes(24).toString('hex') });
    }

    const base = (process.env.CLIENT_URL || '').split(',')[0].replace(/\/+$/, '');
    const path = `/api/v1/calendar/${user.calendarToken}.ics`;
    res.json({ data: {
      token: user.calendarToken,
      // https — открыть в браузере и скачать; webcal — сразу предложить подписку
      url:       `${base}${path}`,
      webcalUrl: `${base.replace(/^https?:/, 'webcal:')}${path}`,
    } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка получения ссылки' });
  }
};

/**
 * POST /calendar/subscription/reset — выпустить новый токен.
 * Нужен, если ссылка утекла: старая подписка сразу перестаёт отдавать данные.
 */
const resetSubscription = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
    await user.update({ calendarToken: crypto.randomBytes(24).toString('hex') });
    res.json({ data: { token: user.calendarToken } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка обновления ссылки' });
  }
};

/**
 * GET /calendar/:token.ics — сам календарь. БЕЗ авторизации.
 *
 * За файлом приходит сервер Google/Apple, а не браузер пользователя: ни куки,
 * ни Bearer он не пришлёт. Поэтому доступ даёт только знание токена — и по этой
 * же причине токен длинный, а ответ помечен no-store, чтобы промежуточные
 * прокси не оставляли чужое расписание в общем кэше.
 */
const getIcs = async (req, res) => {
  try {
    // Роут ловит ':token.ics' целиком — отрезаем расширение
    const token = String(req.params.token || '').replace(/\.ics$/i, '');
    if (!/^[a-f0-9]{48}$/.test(token)) return res.status(404).send('Not found');

    const user = await User.findOne({
      where: { calendarToken: token },
      attributes: ['id', 'role', 'name'],
    });
    // 404, а не 403: не подтверждаем существование токена, который не подошёл
    if (!user) return res.status(404).send('Not found');

    const from = shiftDays(-PAST_DAYS);
    const to   = shiftDays(FUTURE_DAYS);
    const period = { [Op.between]: [from, to] };

    // Какие групповые уроки видит этот пользователь — та же логика, что в lesson.getAll:
    // учитель видит уроки своих групп, ученик — тех, где он состоит.
    let groupIds = [];
    let myStudentIds = [];
    if (user.role === 'teacher') {
      const groups = await Group.findAll({ where: { teacherId: user.id }, attributes: ['id'] });
      groupIds = groups.map(g => g.id);
    } else {
      myStudentIds = await getStudentIdsForUser(user.id);
      if (myStudentIds.length) {
        const memberships = await GroupStudent.findAll({ where: { studentId: myStudentIds }, attributes: ['groupId'] });
        groupIds = memberships.map(m => m.groupId);
      }
    }

    const [groupLessons, indLessons, ownLessons] = await Promise.all([
      groupIds.length
        ? Lesson.findAll({
            where: { groupId: { [Op.in]: groupIds }, date: period },
            include: [{ model: Group, attributes: ['name', 'lessonLink'] }],
          })
        : [],
      IndividualLesson.findAll({
        where: user.role === 'teacher'
          ? { teacherId: user.id, date: period }
          : { studentId: { [Op.in]: myStudentIds.length ? myStudentIds : [null] }, date: period },
        include: [{ model: Student, as: 'student', attributes: ['name'], required: false }],
      }),
      // Свои занятия ученика — тоже часть его расписания
      user.role === 'student'
        ? StudentLessonLog.findAll({
            where: { userId: user.id, date: period },
            include: [{ model: StudentTeacher, as: 'studentTeacher', attributes: ['name'], required: false }],
          })
        : [],
    ]);

    const events = [
      ...groupLessons.map(l => ({
        // uid стабильный: при следующем обходе календарь обновит событие, а не создаст второе
        uid: `lesson-${l.id}@diklario`,
        date: l.date, time: l.time,
        title: l.topic || l.Group?.name || 'Урок',
        description: l.description,
        url: l.lessonLink || l.Group?.lessonLink || undefined,
      })),
      ...indLessons.map(l => ({
        uid: `ind-${l.id}@diklario`,
        date: l.date, time: l.time,
        title: l.topic || l.student?.name || 'Индивидуальный урок',
        description: l.description,
        url: l.lessonLink || undefined,
      })),
      ...ownLessons.map(l => ({
        uid: `own-${l.id}@diklario`,
        date: l.date, time: l.time, durationMin: l.durationMin,
        title: l.topic || l.subject,
        description: [l.studentTeacher?.name || l.teacherLabel, l.notes].filter(Boolean).join(' · ') || undefined,
      })),
    ];

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'inline; filename="diklario.ics"');
    res.setHeader('Cache-Control', 'no-store'); // чужое расписание не должно осесть в общем кэше
    res.send(buildCalendar({ name: `Diklario — ${user.name}`, events }));
  } catch (err) {
    console.error('[calendar] ics:', err.message);
    res.status(500).send('Error');
  }
};

module.exports = { getSubscription, resetSubscription, getIcs };
