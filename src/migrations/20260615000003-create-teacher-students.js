'use strict';

const { DataTypes } = require('sequelize');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('TeacherStudents', {
      id:        { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      teacherId: { type: DataTypes.UUID, allowNull: false, references: { model: 'Users', key: 'id' }, onDelete: 'CASCADE' },
      studentId: { type: DataTypes.UUID, allowNull: false, references: { model: 'Users', key: 'id' }, onDelete: 'CASCADE' },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
    });

    // Один ученик не может числиться у учителя дважды
    await queryInterface.addIndex('TeacherStudents', ['teacherId', 'studentId'], {
      unique: true,
      name: 'teacher_students_teacher_student_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('TeacherStudents');
  },
};
