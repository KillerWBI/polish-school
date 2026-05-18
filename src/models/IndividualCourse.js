const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Контракт между учителем и студентом: расписание индивидуальных занятий
const IndividualCourse = sequelize.define('IndividualCourse', {
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
  name: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  // [{day: 1, time: "17:00"}] — 0=Вс, 1=Пн, ..., 6=Сб
  schedule: {
    type: DataTypes.JSONB,
    defaultValue: [],
  },
  lessonLink: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  pricePerLesson: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
  },
});

module.exports = IndividualCourse;
