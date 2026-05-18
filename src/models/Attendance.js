const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Attendance = sequelize.define('Attendance', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  lessonId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  individualLessonId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  studentId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  present: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
});

module.exports = Attendance;
