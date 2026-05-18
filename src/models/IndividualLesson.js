const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const IndividualLesson = sequelize.define('IndividualLesson', {
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
  date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  time: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  topic: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
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

module.exports = IndividualLesson;
