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
    allowNull: false,
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
});

module.exports = HomeworkSubmission;
