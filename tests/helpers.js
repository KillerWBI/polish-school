const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const request = require('supertest');
const app = require('../src/app');
const sequelize = require('../src/config/database');
const {
  User, Student, TeacherStudent, Group, GroupStudent, Lesson, Attendance, PaymentRecord,
} = require('../src/models');

let counter = 0;
const uid = () => `u${Date.now()}${counter++}`.slice(0, 28); // уникально и в рамках username-регекса

// Токен как у реального login (payload {id, role}) — auth-middleware доверяет ему
const token = (user) => jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET);
const api = () => request(app);

// Полная очистка между тестами (FK — через CASCADE)
async function resetDb() {
  await sequelize.query(
    'TRUNCATE "Users","Students","TeacherStudents","Groups","GroupStudents","Lessons","Attendances","PaymentRecords","Homework","HomeworkSubmissions","IndividualCourses","IndividualLessons" RESTART IDENTITY CASCADE'
  );
}

async function createTeacher() {
  const u = uid();
  return User.create({
    name: `T ${u}`, email: `${u}@t.test`, username: `t_${u}`,
    password: bcrypt.hashSync('x', 10), role: 'teacher', emailVerified: true,
  });
}
async function createStudentUser() {
  const u = uid();
  return User.create({
    name: `S ${u}`, email: `${u}@s.test`, username: `s_${u}`,
    password: bcrypt.hashSync('x', 10), role: 'student', emailVerified: true,
  });
}

// Граф: учитель + реальный ученик + группа(цена) + урок + подтверждённое посещение
async function seedTeacherGraph({ price = 100, present = true } = {}) {
  const teacher = await createTeacher();
  const stuUser = await createStudentUser();
  const student = await Student.create({ teacherId: teacher.id, userId: stuUser.id, name: stuUser.name });
  await TeacherStudent.create({ teacherId: teacher.id, studentId: stuUser.id });
  const group = await Group.create({ name: 'G', teacherId: teacher.id, pricePerLesson: price, schedule: [] });
  await GroupStudent.create({ groupId: group.id, studentId: student.id });
  const lesson = await Lesson.create({ groupId: group.id, date: '2026-06-01', time: '10:00' });
  const att = await Attendance.create({
    lessonId: lesson.id, studentId: student.id,
    present, teacherMarked: present, studentMarked: present, status: 'confirmed',
  });
  return { teacher, stuUser, student, group, lesson, att };
}

module.exports = { token, api, resetDb, createTeacher, createStudentUser, seedTeacherGraph, User, PaymentRecord };
