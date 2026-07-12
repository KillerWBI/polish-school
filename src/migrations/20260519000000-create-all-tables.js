'use strict';

const { DataTypes } = require('sequelize');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    // 1. Users
    await queryInterface.createTable('Users', {
      id:        { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      name:      { type: DataTypes.STRING, allowNull: false },
      email:     { type: DataTypes.STRING, allowNull: false, unique: true },
      password:  { type: DataTypes.STRING, allowNull: false },
      role:      { type: DataTypes.ENUM('teacher', 'student'), allowNull: false, defaultValue: 'student' },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
    });

    // 2. Groups (зависит от Users)
    await queryInterface.createTable('Groups', {
      id:             { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      name:           { type: DataTypes.STRING, allowNull: false },
      teacherId:      { type: DataTypes.UUID, allowNull: false, references: { model: 'Users', key: 'id' }, onDelete: 'CASCADE' },
      schedule:       { type: DataTypes.JSONB, defaultValue: [] },
      lessonLink:     { type: DataTypes.STRING, allowNull: true },
      pricePerLesson: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
      createdAt:      { type: DataTypes.DATE, allowNull: false },
      updatedAt:      { type: DataTypes.DATE, allowNull: false },
    });

    // 3. GroupStudents (зависит от Groups, Users)
    await queryInterface.createTable('GroupStudents', {
      groupId:   { type: DataTypes.UUID, allowNull: false, references: { model: 'Groups', key: 'id' }, onDelete: 'CASCADE' },
      studentId: { type: DataTypes.UUID, allowNull: false, references: { model: 'Users',  key: 'id' }, onDelete: 'CASCADE' },
    });

    // 4. Lessons (зависит от Groups)
    await queryInterface.createTable('Lessons', {
      id:          { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      groupId:     { type: DataTypes.UUID, allowNull: false, references: { model: 'Groups', key: 'id' }, onDelete: 'CASCADE' },
      date:        { type: DataTypes.DATEONLY, allowNull: false },
      time:        { type: DataTypes.STRING, allowNull: false },
      topic:       { type: DataTypes.STRING, allowNull: true },
      description: { type: DataTypes.TEXT, allowNull: true },
      lessonLink:  { type: DataTypes.STRING, allowNull: true },
      materials:   { type: DataTypes.JSONB, defaultValue: [] },
      createdAt:   { type: DataTypes.DATE, allowNull: false },
      updatedAt:   { type: DataTypes.DATE, allowNull: false },
    });

    // 5. IndividualCourses (зависит от Users)
    await queryInterface.createTable('IndividualCourses', {
      id:             { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      teacherId:      { type: DataTypes.UUID, allowNull: false, references: { model: 'Users', key: 'id' }, onDelete: 'CASCADE' },
      studentId:      { type: DataTypes.UUID, allowNull: false, references: { model: 'Users', key: 'id' }, onDelete: 'CASCADE' },
      name:           { type: DataTypes.STRING, allowNull: true },
      schedule:       { type: DataTypes.JSONB, defaultValue: [] },
      lessonLink:     { type: DataTypes.STRING, allowNull: true },
      pricePerLesson: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
      createdAt:      { type: DataTypes.DATE, allowNull: false },
      updatedAt:      { type: DataTypes.DATE, allowNull: false },
    });

    // 6. IndividualLessons (зависит от Users, IndividualCourses)
    await queryInterface.createTable('IndividualLessons', {
      id:                 { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      teacherId:          { type: DataTypes.UUID, allowNull: false, references: { model: 'Users', key: 'id' }, onDelete: 'CASCADE' },
      studentId:          { type: DataTypes.UUID, allowNull: false, references: { model: 'Users', key: 'id' }, onDelete: 'CASCADE' },
      individualCourseId: { type: DataTypes.UUID, allowNull: true,  references: { model: 'IndividualCourses', key: 'id' }, onDelete: 'SET NULL' },
      date:               { type: DataTypes.DATEONLY, allowNull: false },
      time:               { type: DataTypes.STRING, allowNull: false },
      topic:              { type: DataTypes.STRING, allowNull: true },
      description:        { type: DataTypes.TEXT, allowNull: true },
      lessonLink:         { type: DataTypes.STRING, allowNull: true },
      pricePerLesson:     { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
      materials:          { type: DataTypes.JSONB, defaultValue: [] },
      createdAt:          { type: DataTypes.DATE, allowNull: false },
      updatedAt:          { type: DataTypes.DATE, allowNull: false },
    });

    // 7. Homework (зависит от Lessons, IndividualLessons).
    // Имя таблицы — «Homework» (единственное): модель sequelize.define('Homework')
    // не склоняет неисчисляемое слово, поэтому и таблица одноимённая.
    await queryInterface.createTable('Homework', {
      id:                 { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      lessonId:           { type: DataTypes.UUID, allowNull: true, references: { model: 'Lessons', key: 'id' }, onDelete: 'CASCADE' },
      individualLessonId: { type: DataTypes.UUID, allowNull: true, references: { model: 'IndividualLessons', key: 'id' }, onDelete: 'CASCADE' },
      description:        { type: DataTypes.TEXT, allowNull: false },
      deadline:           { type: DataTypes.DATE, allowNull: true },
      createdAt:          { type: DataTypes.DATE, allowNull: false },
      updatedAt:          { type: DataTypes.DATE, allowNull: false },
    });

    // 8. HomeworkSubmissions (зависит от Homework, Users)
    await queryInterface.createTable('HomeworkSubmissions', {
      id:         { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      homeworkId: { type: DataTypes.UUID, allowNull: false, references: { model: 'Homework', key: 'id' }, onDelete: 'CASCADE' },
      studentId:  { type: DataTypes.UUID, allowNull: false, references: { model: 'Users', key: 'id' }, onDelete: 'CASCADE' },
      fileUrl:    { type: DataTypes.STRING, allowNull: false },
      comment:    { type: DataTypes.TEXT, allowNull: true },
      grade:      { type: DataTypes.INTEGER, allowNull: true },
      status:     { type: DataTypes.ENUM('pending', 'graded'), defaultValue: 'pending' },
      createdAt:  { type: DataTypes.DATE, allowNull: false },
      updatedAt:  { type: DataTypes.DATE, allowNull: false },
    });

    // 9. Attendances (зависит от Lessons, IndividualLessons, Users)
    await queryInterface.createTable('Attendances', {
      id:                 { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      lessonId:           { type: DataTypes.UUID, allowNull: true, references: { model: 'Lessons', key: 'id' }, onDelete: 'CASCADE' },
      individualLessonId: { type: DataTypes.UUID, allowNull: true, references: { model: 'IndividualLessons', key: 'id' }, onDelete: 'CASCADE' },
      studentId:          { type: DataTypes.UUID, allowNull: false, references: { model: 'Users', key: 'id' }, onDelete: 'CASCADE' },
      present:            { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      createdAt:          { type: DataTypes.DATE, allowNull: false },
      updatedAt:          { type: DataTypes.DATE, allowNull: false },
    });

    await queryInterface.addIndex('Attendances', ['lessonId', 'studentId'],           { unique: true, name: 'attendance_lesson_student_unique' });
    await queryInterface.addIndex('Attendances', ['individualLessonId', 'studentId'], { unique: true, name: 'attendance_indlesson_student_unique' });

    // 10. Payments (зависит от Users)
    await queryInterface.createTable('Payments', {
      id:        { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      studentId: { type: DataTypes.UUID, allowNull: false, references: { model: 'Users', key: 'id' }, onDelete: 'CASCADE' },
      month:     { type: DataTypes.STRING, allowNull: false },
      amount:    { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
      paid:      { type: DataTypes.BOOLEAN, defaultValue: false },
      paidAt:    { type: DataTypes.DATE, allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
    });
  },

  async down(queryInterface) {
    // Удаляем в обратном порядке (зависимости)
    await queryInterface.dropTable('Payments');
    await queryInterface.dropTable('Attendances');
    await queryInterface.dropTable('HomeworkSubmissions');
    await queryInterface.dropTable('Homework');
    await queryInterface.dropTable('IndividualLessons');
    await queryInterface.dropTable('IndividualCourses');
    await queryInterface.dropTable('Lessons');
    await queryInterface.dropTable('GroupStudents');
    await queryInterface.dropTable('Groups');
    await queryInterface.dropTable('Users');
  },
};
