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
  inviteeUserId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('pending', 'accepted', 'declined', 'revoked'),
    allowNull: false,
    defaultValue: 'pending',
  },
});

module.exports = Invitation;
