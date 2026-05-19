const { Payment, Attendance, Lesson, Group, GroupStudent } = require('../models');
const { Op } = require('sequelize');

const getAll = async (req, res) => {
  try {
    const where = req.user.role === 'student' ? { studentId: req.user.id } : {};
    const payments = await Payment.findAll({ where });
    res.json({ data: payments });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка получения оплат' });
  }
};

// Рассчитывает оплату за месяц для всех студентов всех групп учителя.
// Body: { month: "2026-05" }
// Исправлен баг: сумма накапливается по всем группам в Map перед записью,
// поэтому студент в нескольких группах получает корректный суммарный amount.
const calculate = async (req, res) => {
  try {
    const { month } = req.body;
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ error: 'month обязателен в формате YYYY-MM' });
    }

    const [year, mon] = month.split('-').map(Number);
    const startDate = `${year}-${String(mon).padStart(2, '0')}-01`;
    const endDate   = new Date(year, mon, 0).toISOString().slice(0, 10);

    const groups = await Group.findAll({ where: { teacherId: req.user.id } });

    // Накапливаем итоговую сумму по studentId перед любой записью в БД.
    // Ключ: studentId, значение: { amount, studentId }
    const totals = new Map();

    for (const group of groups) {
      const memberships = await GroupStudent.findAll({ where: { groupId: group.id } });

      for (const m of memberships) {
        const attendances = await Attendance.findAll({
          where: { studentId: m.studentId, present: true },
          include: [{
            model: Lesson,
            where: { groupId: group.id, date: { [Op.between]: [startDate, endDate] } },
            required: true,
          }],
        });

        const groupAmount = attendances.length * parseFloat(group.pricePerLesson);
        const prev = totals.get(m.studentId) ?? 0;
        totals.set(m.studentId, prev + groupAmount);
      }
    }

    // Одна запись / обновление на студента — без перетирания между группами
    const results = [];
    for (const [studentId, amount] of totals) {
      const [payment, created] = await Payment.findOrCreate({
        where: { studentId, month },
        defaults: { amount, paid: false },
      });

      if (!created && parseFloat(payment.amount) !== amount) {
        await payment.update({ amount });
        results.push(await payment.reload());
      } else {
        results.push(payment);
      }
    }

    res.json({ data: results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка расчёта оплаты' });
  }
};

const update = async (req, res) => {
  try {
    const payment = await Payment.findByPk(req.params.id);
    if (!payment) return res.status(404).json({ error: 'Запись оплаты не найдена' });
    const { paid } = req.body;
    await payment.update({ paid, paidAt: paid ? new Date() : null });
    res.json({ data: payment });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка обновления оплаты' });
  }
};

module.exports = { getAll, calculate, update };
