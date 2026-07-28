const { api, token, resetDb, createTeacher, Student } = require('./helpers');
const { LIMITS } = require('../src/config/planLimits');

beforeEach(resetDb);

// Заполняет ростер учителя заглушками до лимита тарифа.
const fillStudents = async (teacherId, n) => {
  await Student.bulkCreate(
    Array.from({ length: n }, (_, i) => ({ teacherId, userId: null, name: `Ученик ${i}` }))
  );
};

describe('Лимиты тарифа на учеников', () => {
  const freeMax = LIMITS.teacher.free.students;

  test('заглушка через индивидуальный КУРС не обходит лимит учеников', async () => {
    const teacher = await createTeacher();
    await fillStudents(teacher.id, freeMax);

    const res = await api()
      .post('/api/v1/individual-courses')
      .set('Authorization', `Bearer ${token(teacher)}`)
      .send({ placeholder: { name: 'Обход лимита' }, name: 'Курс' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('PLAN_LIMIT');
    expect(await Student.count({ where: { teacherId: teacher.id } })).toBe(freeMax);
  });

  test('заглушка через индивидуальный УРОК не обходит лимит учеников', async () => {
    const teacher = await createTeacher();
    await fillStudents(teacher.id, freeMax);

    const res = await api()
      .post('/api/v1/individual-lessons')
      .set('Authorization', `Bearer ${token(teacher)}`)
      .send({ placeholder: { name: 'Обход лимита' }, date: '2026-09-01', time: '10:00' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('PLAN_LIMIT');
    expect(await Student.count({ where: { teacherId: teacher.id } })).toBe(freeMax);
  });

  test('до лимита заглушка создаётся нормально', async () => {
    const teacher = await createTeacher();
    await fillStudents(teacher.id, freeMax - 1);

    const res = await api()
      .post('/api/v1/individual-lessons')
      .set('Authorization', `Bearer ${token(teacher)}`)
      .send({ placeholder: { name: 'Последний слот' }, date: '2026-09-01', time: '10:00' });

    expect(res.status).toBe(201);
    expect(await Student.count({ where: { teacherId: teacher.id } })).toBe(freeMax);
  });

  test('на тарифе basic лимит выше, чем на free', async () => {
    const teacher = await createTeacher();
    await teacher.update({ plan: 'basic' });
    await fillStudents(teacher.id, freeMax);

    const res = await api()
      .post('/api/v1/individual-lessons')
      .set('Authorization', `Bearer ${token(teacher)}`)
      .send({ placeholder: { name: 'Сверх free' }, date: '2026-09-01', time: '11:00' });

    expect(res.status).toBe(201);
  });
});
