'use strict';

const { DataTypes } = require('sequelize');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('LessonRequests', {
      id:            { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      studentId:     { type: DataTypes.UUID, allowNull: false, references: { model: 'Users', key: 'id' }, onDelete: 'CASCADE' },
      teacherId:     { type: DataTypes.UUID, allowNull: false, references: { model: 'Users', key: 'id' }, onDelete: 'CASCADE' },
      language:      { type: DataTypes.STRING, allowNull: false },
      level:         { type: DataTypes.STRING, allowNull: true },
      message:       { type: DataTypes.TEXT,   allowNull: true },
      contactMethod: { type: DataTypes.ENUM('telegram', 'whatsapp', 'instagram', 'phone'), allowNull: false },
      contactValue:  { type: DataTypes.STRING, allowNull: false },
      status:        { type: DataTypes.ENUM('pending', 'accepted', 'declined'), allowNull: false, defaultValue: 'pending' },
      createdAt:     { type: DataTypes.DATE, allowNull: false },
      updatedAt:     { type: DataTypes.DATE, allowNull: false },
    });

    // Быстрый доступ к входящим заявкам учителя по статусу
    await queryInterface.addIndex('LessonRequests', ['teacherId', 'status'], {
      name: 'lesson_requests_teacher_status_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('LessonRequests');
    // Postgres: dropTable НЕ удаляет ENUM-типы — чистим вручную,
    // иначе повторный up упадёт с «type already exists».
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_LessonRequests_contactMethod";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_LessonRequests_status";');
  },
};
