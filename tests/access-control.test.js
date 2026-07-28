const { api, token, resetDb, createTeacher, seedTeacherGraph, Student } = require('./helpers');
const { IndividualLesson } = require('../src/models');

beforeEach(resetDb);

describe('Доступ к индивидуальному уроку (IDOR)', () => {
  const seedLesson = async () => {
    const teacher = await createTeacher();
    const student = await Student.create({ teacherId: teacher.id, userId: null, name: 'Ученик' });
    const lesson = await IndividualLesson.create({
      teacherId: teacher.id, studentId: student.id,
      date: '2026-09-01', time: '10:00', topic: 'Секретная тема',
    });
    return { teacher, lesson };
  };

  test('чужой учитель не может открыть урок по UUID', async () => {
    const { lesson } = await seedLesson();
    const outsider = await createTeacher();

    const res = await api()
      .get(`/api/v1/individual-lessons/${lesson.id}`)
      .set('Authorization', `Bearer ${token(outsider)}`);

    expect(res.status).toBe(403);
    expect(JSON.stringify(res.body)).not.toContain('Секретная тема');
  });

  test('владелец урок видит', async () => {
    const { teacher, lesson } = await seedLesson();

    const res = await api()
      .get(`/api/v1/individual-lessons/${lesson.id}`)
      .set('Authorization', `Bearer ${token(teacher)}`);

    expect(res.status).toBe(200);
    expect(res.body.data.topic).toBe('Секретная тема');
  });

  test('посторонний ученик урок не видит', async () => {
    const { lesson } = await seedLesson();
    const other = await seedTeacherGraph();

    const res = await api()
      .get(`/api/v1/individual-lessons/${lesson.id}`)
      .set('Authorization', `Bearer ${token(other.stuUser)}`);

    expect(res.status).toBe(403);
  });
});

describe('Оплата, поданная учеником (student-pay)', () => {
  test('учитель не может подать оплату за ученика', async () => {
    const { teacher } = await seedTeacherGraph();

    const res = await api()
      .post('/api/v1/payments/student-pay')
      .set('Authorization', `Bearer ${token(teacher)}`)
      .send({ teacherId: teacher.id, amount: 100 });

    expect(res.status).toBe(403);
  });

  test('отрицательная сумма отклоняется схемой', async () => {
    const { teacher, stuUser } = await seedTeacherGraph();

    const res = await api()
      .post('/api/v1/payments/student-pay')
      .set('Authorization', `Bearer ${token(stuUser)}`)
      .send({ teacherId: teacher.id, amount: -500 });

    expect(res.status).toBe(400);
  });

  test('скриншот с чужого домена отклоняется', async () => {
    const { teacher, stuUser } = await seedTeacherGraph();

    const res = await api()
      .post('/api/v1/payments/student-pay')
      .set('Authorization', `Bearer ${token(stuUser)}`)
      .send({ teacherId: teacher.id, amount: 100, screenshotUrl: 'https://evil.example.com/phish.png' });

    expect(res.status).toBe(400);
  });

  test('оплата чужому учителю (не своему) отклоняется', async () => {
    const { stuUser } = await seedTeacherGraph();
    const outsider = await createTeacher();

    const res = await api()
      .post('/api/v1/payments/student-pay')
      .set('Authorization', `Bearer ${token(stuUser)}`)
      .send({ teacherId: outsider.id, amount: 100 });

    expect(res.status).toBe(403);
  });

  test('корректная оплата создаётся со статусом pending', async () => {
    const { teacher, stuUser } = await seedTeacherGraph();

    const res = await api()
      .post('/api/v1/payments/student-pay')
      .set('Authorization', `Bearer ${token(stuUser)}`)
      .send({ teacherId: teacher.id, amount: 150, method: 'blik' });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('pending');
  });
});
