const jwt = require('jsonwebtoken');
const { User } = require('../src/models');
const auth = require('../src/middleware/auth');
const { isTeacher, isStudent, isAdmin } = require('../src/middleware/role');
const { limitsFor, planOf } = require('../src/config/planLimits');

// Режим админа без БД: User.findByPk подменяется, мидлвары — чистые функции от запроса.

const SECRET = 'test-secret';
const realFindByPk = User.findByPk;

beforeAll(() => { process.env.JWT_SECRET = SECRET; });
afterAll(() => { User.findByPk = realFindByPk; });

// Прогоняет auth для пользователя с заданной ролью и заголовками; возвращает req.user.
const authAs = async (role, headers = {}) => {
  User.findByPk = async () => ({ id: 'u1', role, active: true });
  const req = { headers: { authorization: `Bearer ${jwt.sign({ id: 'u1' }, SECRET)}`, ...headers }, cookies: {} };
  let passed = false;
  await auth(req, {}, () => { passed = true; });
  expect(passed).toBe(true);
  return req.user;
};

const passes = (mw, user) => {
  const res = { status() { return this; }, json() { return this; } };
  let ok = false;
  mw({ user }, res, () => { ok = true; });
  return ok;
};

describe('Админ работает в кабинете учителя или ученика', () => {
  test('по умолчанию — кабинет учителя, админка доступна', async () => {
    const user = await authAs('admin');
    expect(user).toEqual({ id: 'u1', role: 'teacher', isAdmin: true });
    expect(passes(isTeacher, user)).toBe(true);
    expect(passes(isStudent, user)).toBe(false);
    expect(passes(isAdmin, user)).toBe(true);
  });

  test('X-Act-As: student — кабинет ученика, админка по-прежнему доступна', async () => {
    const user = await authAs('admin', { 'x-act-as': 'student' });
    expect(user.role).toBe('student');
    expect(passes(isStudent, user)).toBe(true);
    expect(passes(isTeacher, user)).toBe(false);
    expect(passes(isAdmin, user)).toBe(true);
  });

  test('обычный пользователь заголовком роль не меняет и в админку не попадает', async () => {
    const user = await authAs('student', { 'x-act-as': 'teacher' });
    expect(user).toEqual({ id: 'u1', role: 'student' });
    expect(passes(isTeacher, user)).toBe(false);
    expect(passes(isAdmin, user)).toBe(false);
  });
});

describe('Лимиты тарифа для админа', () => {
  test('админу — без лимитов, остальным — тариф из БД', () => {
    expect(planOf({ user: { isAdmin: true } }, { plan: 'free' })).toBe('unlimited');
    expect(planOf({ user: { role: 'teacher' } }, { plan: 'pro' })).toBe('pro');
    expect(limitsFor('teacher', 'unlimited').students).toBe(Infinity);
    expect(limitsFor('student', 'unlimited').aiPerDay).toBe(Infinity);
  });

  test('у ученика лимиты растут с тарифом', () => {
    expect(limitsFor('student', 'pro').tracks).toBeGreaterThan(limitsFor('student', 'free').tracks);
  });
});
