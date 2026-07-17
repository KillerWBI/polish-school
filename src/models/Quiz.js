const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Сохранённый тест (сгенерированный AI). questions — массив вопросов «как есть»
// ({ question, options, answer, sampleAnswer, explanation }). Принадлежит учителю.
const Quiz = sequelize.define('Quiz', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  teacherId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  topic: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  type: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'single',
  },
  difficulty: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  language: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  questions: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: [],
  },
  // Ответы пользователя: { [индекс вопроса]: выбор } (число | число[] | строка)
  answers: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {},
  },
  // Результат прохождения (для объективных типов). null — не считается (открытые вопросы)
  score: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  total: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  // Если это прохождение теста, прикреплённого к ДЗ — ссылка на ДЗ и на исходный тест-библиотеку
  homeworkId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  sourceQuizId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  // Если это практика по личной теме ученика — ссылка на тему (история для адаптивной генерации)
  topicId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  // Шаг роадмапа темы, к которому относится эта попытка (id шага из Topic.roadmap)
  stepId: {
    type: DataTypes.STRING,
    allowNull: true,
  },
});

module.exports = Quiz;
