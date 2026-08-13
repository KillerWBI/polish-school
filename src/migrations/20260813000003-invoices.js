'use strict';

/**
 * Счета на оплату.
 *
 * Счёт — это снимок расчёта на момент выставления, а не «вид» на текущий долг.
 * Поэтому позиции лежат в JSONB прямо в счёте: если преподаватель завтра поменяет
 * цену группы или удалит урок, уже выставленный счёт не должен измениться задним числом.
 * По той же причине здесь хранится и валюта — она копируется из User в момент выпуска.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Invoices', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
        primaryKey: true,
      },
      teacherId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onDelete: 'CASCADE',
      },
      // Ученик — Student, а не User: счёт можно выставить и тому, у кого нет аккаунта
      // (он получит его на бумаге), ровно как посещаемость и долг считаются для обоих.
      studentId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Students', key: 'id' },
        onDelete: 'CASCADE',
      },
      // Номер сквозной у каждого преподавателя своей нумерацией: «Счёт № 7» у одного
      // и «№ 7» у другого — это разные документы, глобальная нумерация тут не нужна.
      number:     { type: Sequelize.INTEGER, allowNull: false },
      currency:   { type: Sequelize.STRING(3), allowNull: false, defaultValue: 'PLN' },
      periodFrom: { type: Sequelize.DATEONLY, allowNull: false },
      periodTo:   { type: Sequelize.DATEONLY, allowNull: false },
      issuedAt:   { type: Sequelize.DATEONLY, allowNull: false },
      dueDate:    { type: Sequelize.DATEONLY, allowNull: true },
      // [{ date, title, price }] — по одной строке на занятие
      positions:  { type: Sequelize.JSONB, allowNull: false, defaultValue: [] },
      total:      { type: Sequelize.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
      status: {
        type: Sequelize.ENUM('issued', 'paid', 'cancelled'),
        allowNull: false,
        defaultValue: 'issued',
      },
      note:      { type: Sequelize.TEXT, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
    });

    // Уникальность номера у преподавателя — не украшение, а сам механизм нумерации:
    // два одновременных запроса «взять MAX+1» получат одно число, и второй упадёт
    // на этом индексе, после чего контроллер повторит попытку с новым номером.
    await queryInterface.addIndex('Invoices', ['teacherId', 'number'], {
      unique: true,
      name: 'invoices_teacher_number_unique',
    });
    await queryInterface.addIndex('Invoices', ['studentId'], { name: 'invoices_student_idx' });

    // Оплата привязывается к счёту — так видно, что именно закрыло документ
    await queryInterface.addColumn('PaymentRecords', 'invoiceId', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'Invoices', key: 'id' },
      onDelete: 'SET NULL',
    });
    await queryInterface.addIndex('PaymentRecords', ['invoiceId'], { name: 'payment_records_invoice_idx' });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('PaymentRecords', 'payment_records_invoice_idx');
    await queryInterface.removeColumn('PaymentRecords', 'invoiceId');
    await queryInterface.dropTable('Invoices');
    // dropTable не убирает ENUM-тип — без этого повторный up упадёт на «type already exists»
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Invoices_status";');
  },
};
