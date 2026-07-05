const { api, token, resetDb, seedTeacherGraph, PaymentRecord } = require('./helpers');

beforeEach(resetDb);

describe('Расчёт долга (charged − paid)', () => {
  test('present=true → начислено = цена урока; оплата уменьшает остаток', async () => {
    const { teacher, student } = await seedTeacherGraph({ price: 100, present: true });
    await PaymentRecord.create({ studentId: student.id, teacherId: teacher.id, amount: 40 });

    const res = await api().get('/api/v1/payments/debts').set('Authorization', `Bearer ${token(teacher)}`);
    const row = res.body.data.find(r => r.student.id === student.id);

    expect(row.charged).toBe(100);
    expect(row.paid).toBe(40);
    expect(row.balance).toBe(60);
  });

  test('present=false → ничего не начисляется (долг 0)', async () => {
    const { teacher, student } = await seedTeacherGraph({ price: 100, present: false });

    const res = await api().get('/api/v1/payments/debts').set('Authorization', `Bearer ${token(teacher)}`);
    const row = res.body.data.find(r => r.student.id === student.id);

    expect(row.charged).toBe(0);
    expect(row.balance).toBe(0);
  });

  test('несколько оплат суммируются', async () => {
    const { teacher, student } = await seedTeacherGraph({ price: 100, present: true });
    await PaymentRecord.create({ studentId: student.id, teacherId: teacher.id, amount: 30 });
    await PaymentRecord.create({ studentId: student.id, teacherId: teacher.id, amount: 25 });

    const res = await api().get('/api/v1/payments/debts').set('Authorization', `Bearer ${token(teacher)}`);
    const row = res.body.data.find(r => r.student.id === student.id);

    expect(row.paid).toBe(55);
    expect(row.balance).toBe(45);
  });
});
