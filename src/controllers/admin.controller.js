const { User, Student, Group, Lesson, IndividualLesson, PaymentRecord } = require('../models');
const { Op } = require('sequelize');

// GET /admin/stats — сводка по платформе
const getStats = async (req, res) => {
  try {
    const [teachers, students, groups, lessons, revenue] = await Promise.all([
      User.count({ where: { role: 'teacher', active: true } }),
      User.count({ where: { role: 'student', active: true } }),
      Group.count(),
      Lesson.count(),
      PaymentRecord.sum('amount'),
    ]);
    res.json({
      data: {
        teachers,
        students,
        groups,
        lessons,
        revenue: parseFloat(revenue) || 0,
      },
    });
  } catch (e) {
    console.error('admin.getStats:', e);
    res.status(500).json({ error: 'Ошибка получения статистики' });
  }
};

// GET /admin/teachers — список всех учителей с KPI
const getTeachers = async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const offset = (page - 1) * limit;

    const { count, rows } = await User.findAndCountAll({
      where: { role: 'teacher' },
      attributes: ['id', 'name', 'email', 'username', 'plan', 'active', 'createdAt', 'emailVerified'],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    res.json({
      data: rows,
      meta: { total: count, page, limit, pages: Math.ceil(count / limit) },
    });
  } catch (e) {
    console.error('admin.getTeachers:', e);
    res.status(500).json({ error: 'Ошибка получения списка учителей' });
  }
};

// GET /admin/users — все пользователи с фильтрацией по роли
const getUsers = async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const offset = (page - 1) * limit;

    const where = {};
    if (req.query.role) where.role = req.query.role;
    if (req.query.active !== undefined) where.active = req.query.active === 'true';

    const { count, rows } = await User.findAndCountAll({
      where,
      attributes: ['id', 'name', 'email', 'username', 'role', 'plan', 'active', 'createdAt', 'emailVerified'],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    res.json({
      data: rows,
      meta: { total: count, page, limit, pages: Math.ceil(count / limit) },
    });
  } catch (e) {
    console.error('admin.getUsers:', e);
    res.status(500).json({ error: 'Ошибка получения списка пользователей' });
  }
};

// PATCH /admin/users/:id/deactivate — деактивировать аккаунт
const deactivateUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, { attributes: ['id', 'role', 'active'] });
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
    if (user.role === 'admin') return res.status(400).json({ error: 'Нельзя деактивировать администратора' });

    await user.update({ active: false });
    res.json({ data: { id: user.id, active: false } });
  } catch (e) {
    console.error('admin.deactivateUser:', e);
    res.status(500).json({ error: 'Ошибка деактивации' });
  }
};

// PATCH /admin/users/:id/activate — восстановить аккаунт
const activateUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, { attributes: ['id', 'active'] });
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

    await user.update({ active: true });
    res.json({ data: { id: user.id, active: true } });
  } catch (e) {
    console.error('admin.activateUser:', e);
    res.status(500).json({ error: 'Ошибка активации' });
  }
};

// PATCH /admin/users/:id/role — изменить роль пользователя (включая повышение в admin)
const setUserRole = async (req, res) => {
  try {
    const { role } = req.body;
    if (!['teacher', 'student', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Допустимые роли: teacher, student, admin' });
    }
    // Нельзя понизить самого себя — защита от случайного самоудаления прав
    if (req.params.id === req.user.id && role !== 'admin') {
      return res.status(400).json({ error: 'Нельзя снять с себя роль admin' });
    }
    const user = await User.findByPk(req.params.id, { attributes: ['id', 'role'] });
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

    await user.update({ role });
    res.json({ data: { id: user.id, role } });
  } catch (e) {
    console.error('admin.setUserRole:', e);
    res.status(500).json({ error: 'Ошибка изменения роли' });
  }
};

// PATCH /admin/users/:id/plan — изменить тариф учителя
const setUserPlan = async (req, res) => {
  try {
    const { plan } = req.body;
    if (!['free', 'pro', 'school'].includes(plan)) {
      return res.status(400).json({ error: 'Недопустимый тариф' });
    }
    const user = await User.findByPk(req.params.id, { attributes: ['id', 'role', 'plan'] });
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
    if (user.role !== 'teacher') return res.status(400).json({ error: 'Тарифы только для учителей' });

    await user.update({ plan });
    res.json({ data: { id: user.id, plan } });
  } catch (e) {
    console.error('admin.setUserPlan:', e);
    res.status(500).json({ error: 'Ошибка изменения тарифа' });
  }
};

module.exports = { getStats, getTeachers, getUsers, deactivateUser, activateUser, setUserPlan, setUserRole };
