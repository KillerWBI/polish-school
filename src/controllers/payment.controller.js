const { Op } = require('sequelize');
const { PaymentRecord, Attendance, Lesson, IndividualLesson, Group, User, Student } = require('../models');
const { getStudentIdsForUser, getTeacherStudentIds } = require('../utils/students');

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

// Сколько учителю должны ВСЕ его ученики суммарно (для KPI дашборда).
// По каждому ученику: начислено мной − оплачено мне, кламп ≥0,
// чтобы переплата одного не маскировала долг другого.
const getTeacherDebtTotal = async (teacherId) => {
  const studentIds = await getTeacherStudentIds(teacherId);
  let total = 0;
  for (const studentId of studentIds) {
    const charged = await computeChargedByTeacher(studentId);
    const chargedByMe = charged.get(teacherId) ?? 0;

    const records = await PaymentRecord.findAll({
      where: { studentId, teacherId },
      attributes: ['amount'],
    });
    const paidToMe = records.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);

    total += Math.max(chargedByMe - paidToMe, 0);
  }
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

// GET /payments/debt — студент видит долг по каждому учителю
const getDebt = async (req, res) => {
  try {
    // У пользователя может быть несколько Student-записей (по одной на учителя) — агрегируем по всем
    const myStudentIds = await getStudentIdsForUser(req.user.id);

    const charged = new Map(); // teacherId → начислено
    const paid = new Map();    // teacherId → оплачено
    for (const sid of myStudentIds) {
      const c = await computeChargedByTeacher(sid);
      for (const [tid, amt] of c) charged.set(tid, (charged.get(tid) ?? 0) + amt);
      const records = await PaymentRecord.findAll({ where: { studentId: sid }, attributes: ['teacherId', 'amount'] });
      for (const r of records) paid.set(r.teacherId, (paid.get(r.teacherId) ?? 0) + parseFloat(r.amount));
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

    // Начислено/оплачено считаем ПАКЕТНО по всем ученикам сразу (было N+1 — по 3 запроса на ученика).
    const chargedByStudent = new Map();
    const addCharge = (sid, price) => chargedByStudent.set(sid, (chargedByStudent.get(sid) ?? 0) + (parseFloat(price) || 0));

    // Групповые посещения (present) → цена группы этого учителя
    const groupAtt = await Attendance.findAll({
      where: { studentId: studentIds, present: true },
      attributes: ['studentId'],
      include: [{
        model: Lesson, required: true, attributes: ['id'],
        include: [{ model: Group, required: true, where: { teacherId }, attributes: ['pricePerLesson'] }],
      }],
    });
    for (const a of groupAtt) addCharge(a.studentId, a.Lesson.Group.pricePerLesson);

    // Индивидуальные посещения (present) → цена инд. урока этого учителя
    const indAtt = await Attendance.findAll({
      where: { studentId: studentIds, present: true },
      attributes: ['studentId'],
      include: [{ model: IndividualLesson, required: true, where: { teacherId }, attributes: ['pricePerLesson'] }],
    });
    for (const a of indAtt) addCharge(a.studentId, a.IndividualLesson.pricePerLesson);

    // Оплаты (одним запросом)
    const paidByStudent = new Map();
    const payRecords = await PaymentRecord.findAll({ where: { studentId: studentIds, teacherId }, attributes: ['studentId', 'amount'] });
    for (const r of payRecords) paidByStudent.set(r.studentId, (paidByStudent.get(r.studentId) ?? 0) + (parseFloat(r.amount) || 0));

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

module.exports = { computeChargedByTeacher, getDebt, recordPayment, getPaymentHistory, getDebtsForTeacher, getStudentDebtTotal, getTeacherDebtTotal };
