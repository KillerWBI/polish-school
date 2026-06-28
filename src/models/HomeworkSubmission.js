const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const HomeworkSubmission = sequelize.define('HomeworkSubmission', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  homeworkId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  studentId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  fileUrl: {
    type: DataTypes.STRING,
    allowNull: true, // null для пустой сдачи (только комментарий)
  },
  comment: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  grade: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('pending', 'graded'),
    defaultValue: 'pending',
  },
}, {
  // Один студент сдаёт одно ДЗ один раз. Индекс в модели → sync({alter}) его создаёт
  // и не сносит (раньше констрейнт из миграции 0521 затирался sync'ом в dev).
  indexes: [
    { unique: true, fields: ['homeworkId', 'studentId'], name: 'homework_submissions_hw_student_uidx' },
  ],
});

module.exports = HomeworkSubmission;
