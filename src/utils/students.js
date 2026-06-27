const { Student } = require('../models');

// Хелперы фундамента Student (C1 фаза 3). Используются после переключения FK (фаза 4-5).

// Все Student.id, привязанные к аккаунту userId.
// Один человек у N учителей → N строк → student-facing агрегирует по этому списку.
const getStudentIdsForUser = async (userId) => {
  const rows = await Student.findAll({ where: { userId }, attributes: ['id'], raw: true });
  return rows.map((r) => r.id);
};

// Найти/создать Student для пары (teacherId, userId) — при добавлении реального ученика в группу.
// name нужен при создании (NOT NULL); для существующей пары вернёт её, не плодя дублей
// (частичный unique (teacherId,userId) при userId IS NOT NULL).
const resolveStudent = async (teacherId, userId, name) => {
  const [student] = await Student.findOrCreate({
    where: { teacherId, userId },
    defaults: { name: name || '' },
  });
  return student;
};

// Все Student.id учеников учителя (заменяет прежний getTeacherStudentIds, собиравший User.id).
const getTeacherStudentIds = async (teacherId) => {
  const rows = await Student.findAll({ where: { teacherId }, attributes: ['id'], raw: true });
  return rows.map((r) => r.id);
};

// Создать заглушку — ученика без аккаунта (C2). Намеренно НЕ find-or-create:
// заглушки могут дублироваться по имени («две Васи» — норма).
const createPlaceholder = async (teacherId, name, contact) => {
  return Student.create({ teacherId, userId: null, name, contact: contact || null });
};

module.exports = { getStudentIdsForUser, resolveStudent, getTeacherStudentIds, createPlaceholder };
