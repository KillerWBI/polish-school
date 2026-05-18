const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const GroupStudent = sequelize.define('GroupStudent', {
  groupId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  studentId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
}, {
  timestamps: false,
});

module.exports = GroupStudent;
