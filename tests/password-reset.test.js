const bcrypt = require('bcryptjs');
const { api, resetDb, createStudentUser } = require('./helpers');
const { User } = require('./helpers');

beforeEach(resetDb);

describe('Восстановление пароля', () => {
  test('forgot → reset → вход новым паролем', async () => {
    const user = await createStudentUser();

    // 1) запрос ссылки — всегда 200
    const forgot = await api().post('/api/v1/auth/forgot-password').send({ email: user.email });
    expect(forgot.status).toBe(200);

    // токен записался в БД
    const withToken = await User.findByPk(user.id);
    expect(withToken.passwordResetToken).toBeTruthy();

    // 2) сброс по токену
    const reset = await api().post('/api/v1/auth/reset-password')
      .send({ token: withToken.passwordResetToken, password: 'newpass123' });
    expect(reset.status).toBe(200);

    // токен очищен, пароль обновлён
    const after = await User.findByPk(user.id);
    expect(after.passwordResetToken).toBeNull();
    expect(await bcrypt.compare('newpass123', after.password)).toBe(true);

    // 3) вход новым паролем работает
    const login = await api().post('/api/v1/auth/login').send({ email: user.email, password: 'newpass123' });
    expect(login.status).toBe(200);
    expect(login.body.data.token).toBeTruthy();
  });

  test('несуществующий email — тоже 200 (не палим существование)', async () => {
    const res = await api().post('/api/v1/auth/forgot-password').send({ email: 'nobody@nowhere.test' });
    expect(res.status).toBe(200);
  });

  test('неверный токен → 400', async () => {
    const res = await api().post('/api/v1/auth/reset-password').send({ token: 'garbage', password: 'newpass123' });
    expect(res.status).toBe(400);
  });

  test('истёкший токен → 400', async () => {
    const user = await createStudentUser();
    await user.update({
      passwordResetToken: 'expired-token-123',
      passwordResetExpiresAt: new Date(Date.now() - 1000), // в прошлом
    });
    const res = await api().post('/api/v1/auth/reset-password')
      .send({ token: 'expired-token-123', password: 'newpass123' });
    expect(res.status).toBe(400);
  });
});
