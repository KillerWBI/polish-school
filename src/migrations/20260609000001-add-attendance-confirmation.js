'use strict';

const { DataTypes } = require('sequelize');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    // 1. Делаем present nullable — pending-записи будут NULL пока не подтверждены
    await queryInterface.changeColumn('Attendances', 'present', {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: null,
    });

    // 2. Добавляем новые поля
    await queryInterface.addColumn('Attendances', 'teacherMarked', {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: null,
    });
    await queryInterface.addColumn('Attendances', 'studentMarked', {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: null,
    });
    await queryInterface.addColumn('Attendances', 'status', {
      type: DataTypes.ENUM('pending_student', 'confirmed', 'disputed'),
      allowNull: false,
      defaultValue: 'confirmed',
    });

    // 3. Backfill существующих записей: они уже подтверждены (оба согласны = present)
    await queryInterface.sequelize.query(`
      UPDATE "Attendances"
      SET "teacherMarked" = "present",
          "studentMarked" = "present"
      WHERE "teacherMarked" IS NULL
    `);
  },

  async down(queryInterface) {
    // Перед изменением обратно — зануляем null-значения (pending) в false
    await queryInterface.sequelize.query(`
      UPDATE "Attendances" SET "present" = false WHERE "present" IS NULL
    `);

    await queryInterface.removeColumn('Attendances', 'teacherMarked');
    await queryInterface.removeColumn('Attendances', 'studentMarked');
    await queryInterface.removeColumn('Attendances', 'status');

    await queryInterface.changeColumn('Attendances', 'present', {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    // Postgres не удаляет ENUM автоматически
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_Attendances_status"'
    );
  },
};
