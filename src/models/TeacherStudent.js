const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Отношение «мой ученик»: создаётся при accept заявки (LessonRequest).
// Отдельное состояние, не зависит от групп — ученик может быть «подписчиком»
// учителя без единой группы. ГЕЙТ: только таких студентов учитель может
// добавлять в группы/инд.курсы.
const TeacherStudent = sequelize.define('TeacherStudent', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  teacherId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  studentId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
}, {
  // Один и тот же ученик не может числиться у учителя дважды
  indexes: [{ unique: true, fields: ['teacherId', 'studentId'] }],
});

module.exports = TeacherStudent;
