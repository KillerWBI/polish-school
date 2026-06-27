'use strict';

const { DataTypes } = require('sequelize');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('Students', {
      id:        { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      // владелец-учитель
      teacherId: { type: DataTypes.UUID, allowNull: false, references: { model: 'Users', key: 'id' }, onDelete: 'CASCADE' },
      // привязанный аккаунт (null = заглушка). При удалении аккаунта запись остаётся заглушкой.
      userId:    { type: DataTypes.UUID, allowNull: true, references: { model: 'Users', key: 'id' }, onDelete: 'SET NULL' },
      name:      { type: DataTypes.STRING, allowNull: false },
      contact:   { type: DataTypes.STRING, allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
    });

    // Частичный unique: у учителя один аккаунт = одна строка (заглушки с userId=null не ограничиваем)
    await queryInterface.sequelize.query(
      'CREATE UNIQUE INDEX "students_teacher_user_unique" ON "Students" ("teacherId", "userId") WHERE "userId" IS NOT NULL'
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable('Students');
  },
};
