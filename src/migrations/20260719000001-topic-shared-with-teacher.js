'use strict';

// Фаза 3 (двусторонность): ученик может «поделиться» треком с учителем.
// sharedWithTeacher=true → учитель видит слабые места этого трека и генерит адресный тест.
module.exports = {
  async up(queryInterface, Sequelize) {
    const t = await queryInterface.describeTable('Topics');
    if (!t.sharedWithTeacher) {
      await queryInterface.addColumn('Topics', 'sharedWithTeacher', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('Topics', 'sharedWithTeacher');
  },
};
