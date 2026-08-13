const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Приглашение учитель→ученик в группу (С3, REVISION.md §5.3, механика B).
// Направление противоположно старому LessonRequest (там студент→учитель) —
// поэтому отдельная модель, не расширение LessonRequest.
const Invitation = sequelize.define('Invitation', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  teacherId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  groupId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  // Кого зовём. Либо уже зарегистрированного (inviteeUserId), либо ещё нет —
  // тогда известен только email, а userId проставится при регистрации по ссылке.
  inviteeUserId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  inviteeEmail: { type: DataTypes.STRING, allowNull: true },
  // Одноразовый токен для ссылки в письме. Уникален — по нему ищем приглашение.
  token:        { type: DataTypes.STRING(64), allowNull: true, unique: true },
  expiresAt:    { type: DataTypes.DATE, allowNull: true },
  status: {
    type: DataTypes.ENUM('pending', 'accepted', 'declined', 'revoked'),
    allowNull: false,
    defaultValue: 'pending',
  },
});

module.exports = Invitation;
