const { api, token, resetDb, seedTeacherGraph, Student, Group } = require('./helpers');

beforeEach(resetDb);

describe('Ростер учеников (Student: реальные + заглушки)', () => {
  test('GET /users/me/students — возвращает и реального, и заглушку', async () => {
    const { teacher, student } = await seedTeacherGraph();
    const ph = await Student.create({ teacherId: teacher.id, userId: null, name: 'Заглушка Вася', contact: 'tg:@vasya' });

    const res = await api().get('/api/v1/users/me/students').set('Authorization', `Bearer ${token(teacher)}`);
    expect(res.status).toBe(200);

    const ids = res.body.data.map(s => s.id);
    expect(ids).toContain(student.id); // реальный
    expect(ids).toContain(ph.id);      // заглушка

    const phRow = res.body.data.find(s => s.id === ph.id);
    expect(phRow.isPlaceholder).toBe(true);
    expect(phRow.contact).toBe('tg:@vasya');
  });

  test('POST /groups/:id/students — добавляет заглушку по Student.id', async () => {
    const { teacher } = await seedTeacherGraph();
    const ph = await Student.create({ teacherId: teacher.id, userId: null, name: 'Заглушка' });
    const group = await Group.create({ name: 'G2', teacherId: teacher.id, pricePerLesson: 50, schedule: [] });

    const res = await api().post(`/api/v1/groups/${group.id}/students`)
      .set('Authorization', `Bearer ${token(teacher)}`).send({ studentId: ph.id });
    expect(res.status).toBe(201);
  });

  test('POST /individual-lessons — создаёт урок по Student.id из ростера', async () => {
    const { teacher } = await seedTeacherGraph();
    const ph = await Student.create({ teacherId: teacher.id, userId: null, name: 'Заглушка' });

    const res = await api().post('/api/v1/individual-lessons')
      .set('Authorization', `Bearer ${token(teacher)}`)
      .send({ studentId: ph.id, date: '2026-06-15', time: '12:00', topic: 'Разовый' });
    expect(res.status).toBe(201);
  });

  test('чужой Student.id в свою группу — 403', async () => {
    const A = await seedTeacherGraph();
    const B = await seedTeacherGraph();
    const group = await Group.create({ name: 'GB', teacherId: B.teacher.id, pricePerLesson: 50, schedule: [] });

    // B пытается добавить ученика учителя A
    const res = await api().post(`/api/v1/groups/${group.id}/students`)
      .set('Authorization', `Bearer ${token(B.teacher)}`).send({ studentId: A.student.id });
    expect(res.status).toBe(403);
  });
});
