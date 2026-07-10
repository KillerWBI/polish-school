const { Op } = require('sequelize');
const { PaymentRecord, Attendance, Lesson, IndividualLesson, Group, User, Student } = require('../models');
const { getStudentIdsForUser, getTeacherStudentIds } = require('../utils/students');
const { createNotification } = require('../utils/notify');

// getTeacherStudentIds — все Student.id учителя из таблицы Student (utils/students.js).
// Раньше тут был локальный вариант через GroupStudent+IndividualCourse — он терял учеников
// с одними лишь разовыми инд.уроками (individualCourseId=null) и учеников, убранных из групп
// (но с историей долга). Таблица Student покрывает всех учеников ростера.

const getStudentDebtTotal = async (studentId) => {
  // Начислено по каждому учителю (из посещений)
  const charged = await computeChargedByTeacher(studentId);

  const records = await PaymentRecord.findAll({
    where: { studentId },
    attributes: ['teacherId', 'amount'],
  });
  // Map: teacherId → сумма оплаченного
  const paid = new Map();
  for (const r of records) {
    paid.set(r.teacherId, (paid.get(r.teacherId) ?? 0) + parseFloat(r.amount));
  }
  // Вычисляем долг по каждому учителю: сколько начислено минус сколько оплачено.
  const debt = {};
  for (const [teacherId, amount] of charged) {
    debt[teacherId] = amount - (paid.get(teacherId) ?? 0);
  }

  const allAmount = Object.values(debt).reduce( (sum, amt) => sum + amt , 0);
  return Math.max(allAmount, 0); // переплата не уводит долг в минус

};

// Три пакетных запроса: начислено и оплачено по каждому ученику для данного учителя.
// Используется в getTeacherDebtTotal и getDebtsForTeacher — единый источник истины.
const fetchChargesAndPayments = async (studentIds, teacherId) => {
  const chargedByStudent = new Map();
  const add = (sid, price) =>
    chargedByStudent.set(sid, (chargedByStudent.get(sid) ?? 0) + (parseFloat(price) || 0));

  const [groupAtt, indAtt, payRecords] = await Promise.all([
    Attendance.findAll({
      where: { studentId: studentIds, present: true },
      attributes: ['studentId'],
      include: [{
        model: Lesson, required: true, attributes: ['id'],
        include: [{ model: Group, required: true, where: { teacherId }, attributes: ['pricePerLesson'] }],
      }],
    }),
    Attendance.findAll({
      where: { studentId: studentIds, present: true },
      attributes: ['studentId'],
      include: [{ model: IndividualLesson, required: true, where: { teacherId }, attributes: ['pricePerLesson'] }],
    }),
    PaymentRecord.findAll({
      where: { studentId: studentIds, teacherId },
      attributes: ['studentId', 'amount'],
    }),
  ]);

  for (const a of groupAtt) add(a.studentId, a.Lesson.Group.pricePerLesson);
  for (const a of indAtt)   add(a.studentId, a.IndividualLesson.pricePerLesson);

  const paidByStudent = new Map();
  for (const r of payRecords)
    paidByStudent.set(r.studentId, (paidByStudent.get(r.studentId) ?? 0) + (parseFloat(r.amount) || 0));

  return { chargedByStudent, paidByStudent };
};

// Сколько учителю должны ВСЕ его ученики суммарно (для KPI дашборда).
const getTeacherDebtTotal = async (teacherId) => {
  const studentIds = await getTeacherStudentIds(teacherId);
  if (!studentIds.length) return 0;

  const { chargedByStudent, paidByStudent } = await fetchChargesAndPayments(studentIds, teacherId);

  let total = 0;
  for (const sid of studentIds)
    total += Math.max((chargedByStudent.get(sid) ?? 0) - (paidByStudent.get(sid) ?? 0), 0);
  return total;
};

// Начислено студенту по каждому учителю: сумма цен подтверждённых посещений.
// Возвращает Map: teacherId → число (сумма в валюте).
const computeChargedByTeacher = async (studentId) => {
  const charged = new Map();

  // Групповые посещения: Attendance → Lesson → Group (teacherId + pricePerLesson)
  const groupAttendances = await Attendance.findAll({
    where: { studentId, present: true },
    include: [{
      model: Lesson,
      required: true,
      include: [{ model: Group, required: true, attributes: ['teacherId', 'pricePerLesson'] }],
    }],
  });
  for (const a of groupAttendances) {
    const { teacherId, pricePerLesson } = a.Lesson.Group;
    const price = parseFloat(pricePerLesson) || 0;
    charged.set(teacherId, (charged.get(teacherId) ?? 0) + price);
  }

  // Индивидуальные посещения: Attendance → IndividualLesson (teacherId + pricePerLesson)
  const indAttendances = await Attendance.findAll({
    where: { studentId, present: true },
    include: [{
      model: IndividualLesson,
      required: true,
      attributes: ['teacherId', 'pricePerLesson'],
    }],
  });
  for (const a of indAttendances) {
    const { teacherId, pricePerLesson } = a.IndividualLesson;
    const price = parseFloat(pricePerLesson) || 0;
    charged.set(teacherId, (charged.get(teacherId) ?? 0) + price);
  }

  return charged;
};

// POST /payments/record — учитель вносит оплату от ученика (вручную)
const recordPayment = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const { studentId, amount, method } = req.body;

    // studentId — это Student.id; проверяем, что эта запись принадлежит учителю
    const student = await Student.findOne({ where: { id: studentId, teacherId } });
    if (!student) return res.status(403).json({ error: 'Этот ученик не в вашем ростере' });

    // source='manual' — оплату внёс учитель руками (онлайн-платёжка проставит 'online')
    const record = await PaymentRecord.create({
      studentId, teacherId, amount, method: method || 'cash', source: 'manual',
    });

    // Уведомляем ученика, что учитель зафиксировал оплату (fire-and-forget)
    if (student.userId) {
      createNotification(student.userId, {
        type: 'payment_recorded',
        title: 'Оплата зафиксирована',
        body: `Внесено ${Math.round(Number(amount))} zł`,
        link: '/payments',
      });
    }

    res.status(201).json({ data: record });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка записи оплаты' });
  }
};

// GET /payments/history — история оплат учителя с фильтрами (?studentId=&method=&from=&to=)
// Возвращает список записей + сводку { total, byMethod } по этому фильтру.
const getPaymentHistory = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const { studentId, method, from, to } = req.query;

    const where = { teacherId };
    if (studentId) where.studentId = studentId;
    if (method) where.method = method;
    if (from || to) {
      where.paidAt = {};
      if (from) where.paidAt[Op.gte] = new Date(from);
      if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999); // включаем весь день «to»
        where.paidAt[Op.lte] = end;
      }
    }

    const records = await PaymentRecord.findAll({
      where,
      order: [['paidAt', 'DESC']],
      include: [{ model: Student, as: 'student', attributes: ['id', 'name'] }],
    });

    // Сводка по способам оплаты (в рамках текущего фильтра)
    const byMethod = {};
    let total = 0;
    for (const r of records) {
      const amt = parseFloat(r.amount) || 0;
      total += amt;
      byMethod[r.method] = (byMethod[r.method] ?? 0) + amt;
    }

    const data = records.map((r) => ({
      id: r.id,
      amount: parseFloat(r.amount) || 0,
      method: r.method,
      source: r.source,
      paidAt: r.paidAt,
      student: r.student ? { id: r.student.id, name: r.student.name } : null,
    }));

    res.json({ data, summary: { total, byMethod } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка получения истории оплат' });
  }
};

// GET /payments/my-history — ученик видит свою историю оплат (по всем учителям)
// Ответ: { data: [{ id, amount, method, source, paidAt, teacher }], summary: { total, byMethod } }
const getMyPaymentHistory = async (req, res) => {
  try {
    const myStudentIds = await getStudentIdsForUser(req.user.id);
    if (!myStudentIds.length) return res.json({ data: [], summary: { total: 0, byMethod: {} } });

    const { method, from, to } = req.query;
    const where = { studentId: myStudentIds };
    if (method) where.method = method;
    if (from || to) {
      where.paidAt = {};
      if (from) where.paidAt[Op.gte] = new Date(from);
      if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        where.paidAt[Op.lte] = end;
      }
    }

    const records = await PaymentRecord.findAll({
      where,
      order: [['paidAt', 'DESC']],
      include: [{ model: User, as: 'teacher', attributes: ['id', 'name'] }],
    });

    const byMethod = {};
    let total = 0;
    for (const r of records) {
      const amt = parseFloat(r.amount) || 0;
      total += amt;
      byMethod[r.method] = (byMethod[r.method] ?? 0) + amt;
    }

    const data = records.map((r) => ({
      id: r.id,
      amount: parseFloat(r.amount) || 0,
      method: r.method,
      source: r.source,
      paidAt: r.paidAt,
      teacher: r.teacher ? { id: r.teacher.id, name: r.teacher.name } : null,
    }));

    res.json({ data, summary: { total, byMethod } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка получения истории оплат' });
  }
};

// GET /payments/debt — студент видит долг по каждому учителю
const getDebt = async (req, res) => {
  try {
    const myStudentIds = await getStudentIdsForUser(req.user.id);
    if (!myStudentIds.length) return res.json({ data: [] });

    // Три пакетных запроса вместо 3×N: по всем Student-записям пользователя сразу
    const [groupAtt, indAtt, payRecords] = await Promise.all([
      Attendance.findAll({
        where: { studentId: myStudentIds, present: true },
        attributes: ['studentId'],
        include: [{
          model: Lesson, required: true, attributes: ['id'],
          include: [{ model: Group, required: true, attributes: ['teacherId', 'pricePerLesson'] }],
        }],
      }),
      Attendance.findAll({
        where: { studentId: myStudentIds, present: true },
        attributes: ['studentId'],
        include: [{ model: IndividualLesson, required: true, attributes: ['teacherId', 'pricePerLesson'] }],
      }),
      PaymentRecord.findAll({
        where: { studentId: myStudentIds },
        attributes: ['teacherId', 'amount'],
      }),
    ]);

    const charged = new Map(); // teacherId → начислено
    const paid = new Map();    // teacherId → оплачено

    for (const a of groupAtt) {
      const { teacherId, pricePerLesson } = a.Lesson.Group;
      charged.set(teacherId, (charged.get(teacherId) ?? 0) + (parseFloat(pricePerLesson) || 0));
    }
    for (const a of indAtt) {
      const { teacherId, pricePerLesson } = a.IndividualLesson;
      charged.set(teacherId, (charged.get(teacherId) ?? 0) + (parseFloat(pricePerLesson) || 0));
    }
    for (const r of payRecords) {
      paid.set(r.teacherId, (paid.get(r.teacherId) ?? 0) + (parseFloat(r.amount) || 0));
    }

    // Объединяем все teacherId из обоих источников
    const teacherIds = [...new Set([...charged.keys(), ...paid.keys()])];
    if (teacherIds.length === 0) return res.json({ data: [] });

    const teachers = await User.findAll({
      where: { id: teacherIds },
      attributes: ['id', 'name', 'email'],
    });
    const teacherMap = new Map(teachers.map(t => [t.id, t]));

    const data = teacherIds.map(teacherId => {
      const chargedAmt = charged.get(teacherId) ?? 0;
      const paidAmt    = paid.get(teacherId) ?? 0;
      return {
        teacher: teacherMap.get(teacherId),
        charged: chargedAmt,
        paid:    paidAmt,
        balance: chargedAmt - paidAmt,
      };
    });

    res.json({ data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка получения долга' });
  }
};

//[{ student: {id, name, email}, charged, paid, balance }]
const getDebtsForTeacher = async (req, res) => {
  try {
    const studentIds = await getTeacherStudentIds(req.user.id);
    if (studentIds.length === 0) {
      return res.json({ data: [] });
    }
    const teacherId = req.user.id;
    const students = await Student.findAll({
      where: { id: studentIds },
      attributes: ['id', 'name'],
      include: [{ model: User, as: 'account', attributes: ['email'] }],
    });

    const { chargedByStudent, paidByStudent } = await fetchChargesAndPayments(studentIds, teacherId);

    const data = students.map(student => {
      const charged = chargedByStudent.get(student.id) ?? 0;
      const paid    = paidByStudent.get(student.id) ?? 0;
      return {
        student: { id: student.id, name: student.name, email: student.account?.email ?? null },
        charged, paid, balance: charged - paid,
      };
    });
    res.json({ data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка получения долгов' });
  }
};

// GET /payments/teacher-info/:teacherId — реквизиты учителя для страницы оплаты ученика
const getTeacherPaymentInfo = async (req, res) => {
  try {
    const teacher = await User.findByPk(req.params.teacherId, {
      attributes: ['id', 'name', 'paymentDetails'],
    });
    if (!teacher) return res.status(404).json({ error: 'Преподаватель не найден' });
    res.json({ data: { id: teacher.id, name: teacher.name, paymentDetails: teacher.paymentDetails || {} } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка получения данных' });
  }
};

// POST /payments/student-pay — ученик сам подаёт запись об оплате (со скриншотом)
const studentRecordPayment = async (req, res) => {
  try {
    const userId = req.user.id;
    const { teacherId, amount, method, screenshotUrl } = req.body;

    if (!teacherId || !amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      return res.status(400).json({ error: 'Укажите teacherId и сумму' });
    }

    // Находим Student-запись этого пользователя у этого учителя
    const student = await Student.findOne({ where: { userId, teacherId } });
    if (!student) return res.status(403).json({ error: 'Вы не ученик этого преподавателя' });

    const record = await PaymentRecord.create({
      studentId: student.id,
      teacherId,
      amount: parseFloat(amount),
      method: method || 'transfer',
      source: 'student',
      screenshotUrl: screenshotUrl || null,
    });
    res.status(201).json({ data: record });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка записи оплаты' });
  }
};

module.exports = { computeChargedByTeacher, getDebt, getMyPaymentHistory, recordPayment, getPaymentHistory, getDebtsForTeacher, getStudentDebtTotal, getTeacherDebtTotal, getTeacherPaymentInfo, studentRecordPayment };
