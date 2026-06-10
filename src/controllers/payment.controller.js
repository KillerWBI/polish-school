const { Payment, Attendance, Lesson, IndividualLesson, Group, GroupStudent, IndividualCourse, User } = require('../models');
const { Op } = require('sequelize');

// id студентов учителя: через его группы (GroupStudent) + индивидуальные курсы.
// Set убирает дубли, если студент и в группе, и на инд. курсе.
const getTeacherStudentIds = async (teacherId) => {
  const groups = await Group.findAll({ where: { teacherId }, attributes: ['id'] });
  const groupIds = groups.map(g => g.id);

  const [groupStudents, indCourses] = await Promise.all([
    groupIds.length
      ? GroupStudent.findAll({ where: { groupId: { [Op.in]: groupIds } }, attributes: ['studentId'] })
      : Promise.resolve([]),
    IndividualCourse.findAll({ where: { teacherId }, attributes: ['studentId'] }),
  ]);

  return [...new Set([
    ...groupStudents.map(r => r.studentId),
    ...indCourses.map(r => r.studentId),
  ])];
};

const getAll = async (req, res) => {
  try {
    // page/limit уже проверены и приведены к числам схемой paginationQuery (validate 'query').
    const { page, limit } = req.validatedQuery;
    const offset = (page - 1) * limit;

    // S4: учитель видит платежи ТОЛЬКО своих студентов (не всех в БД).
    let where;
    if (req.user.role === 'student') {
      where = { studentId: req.user.id };
    } else {
      const studentIds = await getTeacherStudentIds(req.user.id);
      if (studentIds.length === 0) {
        return res.json({ data: [], pagination: { page, limit, total: 0, pages: 0 } });
      }
      where = { studentId: { [Op.in]: studentIds } };
    }

    const { count, rows } = await Payment.findAndCountAll({
      where,
      include: [{ model: User, as: 'student', attributes: ['id', 'name', 'email'] }],
      order: [['month', 'DESC']],
      limit,
      offset,
      distinct: true,
    });
    res.json({ data: rows, pagination: { page, limit, total: count, pages: Math.ceil(count / limit) } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка получения оплат' });
  }
};

// Рассчитывает оплату за месяц: групповые + индивидуальные уроки.
// Body: { month: "2026-05" }
const calculate = async (req, res) => {
  try {
    // Формат YYYY-MM и «не будущее» проверены схемой calculatePaymentSchema.
    const { month } = req.body;
    const [year, mon] = month.split('-').map(Number);
    const startDate = `${year}-${String(mon).padStart(2, '0')}-01`;
    // Date.UTC избегает локальной TZ: new Date(year, mon, 0) зависит от TZ сервера
    const endDate   = new Date(Date.UTC(year, mon, 0)).toISOString().slice(0, 10);

    // totals[studentId] = суммарная сумма за месяц
    // выглядет вот такЖ totals = {
    //   123: 1500, // студент 123 должен 1500 руб
    //   456: 2000,
    // }
    const totals = new Map();

    // ── 1. Групповые уроки ──────────────────────────────────────────────────

    // отдает вот так поллный ответ вот так:
    // [
    //   {
    //     id: 1,
    //     present: true,
    //     studentId: 123,
    //     lessonId: 10,
    //     Lesson: {
    //       id: 10,
    //       date: '2026-05-15',
    //       groupId: 5,
    //       Group: {
    //         id: 5,
    //         teacherId: 999,
    //         pricePerLesson: '500.00'
    //       }
    //     }
    //   },
    //   ...
    // ]
    const atandances = await Attendance.findAll({
      where: { present: true},
      include: [{
        model: Lesson,
        where: { date: { [Op.between]: [startDate, endDate] } },
        required: true,
        include: [{
          model: Group,
          required: true,
          where: { teacherId: req.user.id },
        }]
      }],

    });
   for(const a of  atandances) {
    const price = parseFloat(a.Lesson.Group.pricePerLesson);
    totals.set( a.studentId, (totals.get(a.studentId) ?? 0) + price );
   }


    // ── 2. Индивидуальные уроки ─────────────────────────────────────────────
    const indLessons = await IndividualLesson.findAll({
      where: {
        teacherId: req.user.id,
        date: { [Op.between]: [startDate, endDate] },
      },
    });

    for (const lesson of indLessons) {
      const attended = await Attendance.findOne({
        where: { individualLessonId: lesson.id, studentId: lesson.studentId, present: true },
      });
      if (!attended) continue;

      const price = parseFloat(lesson.pricePerLesson) || 0;
      totals.set(lesson.studentId, (totals.get(lesson.studentId) ?? 0) + price);
    }

    // ── 3. Запись в Payment (атомарный upsert на студента) ──────────────────
    const results = await Payment.sequelize.transaction(async (t) => {
      const out = [];
      for (const [studentId, amount] of totals) {
        const [payment, created] = await Payment.findOrCreate({
          where: { studentId, month },
          defaults: { amount, paid: false },
          transaction: t,
        });

        if (!created && parseFloat(payment.amount) !== amount) {
          await payment.update({ amount }, { transaction: t });
        }
        out.push(payment);
      }
      return out;
    });

    res.json({ data: results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка расчёта оплаты' });
  }
};


const update = async (req, res) => {
  try {
    const payment = await Payment.findByPk(req.params.id, {
      include: [{ model: User, as: 'student', attributes: ['id'] }],
    });
    if (!payment) return res.status(404).json({ error: 'Запись оплаты не найдена' });

    // Проверяем что этот студент учится у данного учителя — через группу ИЛИ инд. курс
    const isOwnGroup = await GroupStudent.findOne({
      include: [{ model: Group, where: { teacherId: req.user.id }, required: true }],
      where: { studentId: payment.studentId },
    });
    const isOwnIndividual = isOwnGroup ? null : await IndividualCourse.findOne({
      where: { studentId: payment.studentId, teacherId: req.user.id },
    });
    if (!isOwnGroup && !isOwnIndividual) {
      return res.status(403).json({ error: 'Доступ запрещён' });
    }

    const { paid } = req.body;
    await payment.update({ paid, paidAt: paid ? new Date() : null });
    res.json({ data: payment });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка обновления оплаты' });
  }
};

module.exports = { getAll, calculate, update };
