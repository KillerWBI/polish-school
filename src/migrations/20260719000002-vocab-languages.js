'use strict';

// Языки слова в словаре: изучаемый (language) и родной/язык перевода (nativeLanguage).
// Оба хранятся как ISO-код ('en', 'pl', 'uk'…). Нужны для фильтра словаря по языку
// и для AI-генерации/массового импорта. Старые слова остаются с NULL → корзина «Без языка».
module.exports = {
  // up() — накатывает изменение (queryInterface — обёртка Sequelize над SQL-командами схемы)
  async up(queryInterface, Sequelize) {
    const t = await queryInterface.describeTable('VocabItems'); // текущие колонки таблицы
    if (!t.language) {
      await queryInterface.addColumn('VocabItems', 'language', { type: Sequelize.STRING, allowNull: true });
    }
    if (!t.nativeLanguage) {
      await queryInterface.addColumn('VocabItems', 'nativeLanguage', { type: Sequelize.STRING, allowNull: true });
    }
  },
  // down() — откат (для db:migrate:undo)
  async down(queryInterface) {
    await queryInterface.removeColumn('VocabItems', 'nativeLanguage');
    await queryInterface.removeColumn('VocabItems', 'language');
  },
};
