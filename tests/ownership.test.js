const { api, token, resetDb, seedTeacherGraph, User } = require('./helpers');

beforeEach(resetDb);

describe('Изоляция арендаторов (ownership)', () => {
  test('GET /attendance — учитель видит посещаемость ТОЛЬКО своих учеников', async () => {
    const A = await seedTeacherGraph();
    const B = await seedTeacherGraph();

    const res = await api().get('/api/v1/attendance').set('Authorization', `Bearer ${token(A.teacher)}`);

    expect(res.status).toBe(200);
    const studentIds = res.body.data.map(r => r.studentId);
    expect(studentIds).toContain(A.student.id);
    expect(studentIds).not.toContain(B.student.id); // чужое не утекает
  });

  test('GET /attendance?studentId=чужой — подстановка чужого id ничего не отдаёт', async () => {
    const A = await seedTeacherGraph();
    const B = await seedTeacherGraph();

    const res = await api()
      .get(`/api/v1/attendance?studentId=${B.student.id}`)
      .set('Authorization', `Bearer ${token(A.teacher)}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });

  test('GET /payments/debts — только свои ученики', async () => {
    const A = await seedTeacherGraph({ price: 100 });
    const B = await seedTeacherGraph({ price: 100 });

    const res = await api().get('/api/v1/payments/debts').set('Authorization', `Bearer ${token(A.teacher)}`);

    expect(res.status).toBe(200);
    const ids = res.body.data.map(r => r.student.id);
    expect(ids).toContain(A.student.id);
    expect(ids).not.toContain(B.student.id);
  });

  test('PUT /users/:id — нельзя переименовать чужой аккаунт', async () => {
    const A = await seedTeacherGraph();
    const B = await seedTeacherGraph();

    const res = await api()
      .put(`/api/v1/users/${B.teacher.id}`)
      .set('Authorization', `Bearer ${token(A.teacher)}`)
      .send({ name: 'Hacked' });

    expect(res.status).toBe(403);
    const fresh = await User.findByPk(B.teacher.id);
    expect(fresh.name).not.toBe('Hacked');
  });

  test('PUT /users/:id — свой аккаунт переименовать можно', async () => {
    const A = await seedTeacherGraph();

    const res = await api()
      .put(`/api/v1/users/${A.teacher.id}`)
      .set('Authorization', `Bearer ${token(A.teacher)}`)
      .send({ name: 'Новое Имя' });

    expect(res.status).toBe(200);
    const fresh = await User.findByPk(A.teacher.id);
    expect(fresh.name).toBe('Новое Имя');
  });
});
