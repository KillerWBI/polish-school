const { csrf } = require('../src/middleware/csrf');

// CSRF-мидлвара — чистая функция от запроса, БД ей не нужна.
// Тест держит обе границы: чужой сайт не проходит, свои клиенты не ломаются.

const run = (req) => {
  const res = {
    statusCode: null, body: null,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
  };
  let passed = false;
  csrf(req, res, () => { passed = true; });
  return { passed, res };
};

const withSession = (over = {}) => ({
  method: 'POST',
  originalUrl: '/api/v1/groups',
  headers: {},
  cookies: { access_token: 'jwt', csrf_token: 'secret-token' },
  ...over,
});

describe('CSRF middleware', () => {
  it('пропускает GET — читающие запросы не защищаем', () => {
    expect(run({ ...withSession(), method: 'GET' }).passed).toBe(true);
  });

  it('блокирует мутацию без заголовка — это и есть форжен запрос с чужого сайта', () => {
    const { passed, res } = run(withSession());
    expect(passed).toBe(false);
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('CSRF');
  });

  it('блокирует мутацию с чужим значением заголовка', () => {
    const { passed, res } = run(withSession({ headers: { 'x-csrf-token': 'wrong' } }));
    expect(passed).toBe(false);
    expect(res.statusCode).toBe(403);
  });

  it('пропускает мутацию, когда заголовок совпал с cookie', () => {
    expect(run(withSession({ headers: { 'x-csrf-token': 'secret-token' } })).passed).toBe(true);
  });

  it('не трогает Bearer-клиентов: без access-cookie подделать запрос нельзя', () => {
    expect(run(withSession({ cookies: {} })).passed).toBe(true);
  });

  it('не рвёт сессии, открытые до появления защиты (cookie с токеном ещё нет)', () => {
    expect(run(withSession({ cookies: { access_token: 'jwt' } })).passed).toBe(true);
  });

  it('пропускает публичные эндпоинты — сессии там ещё нет', () => {
    for (const url of ['/api/v1/auth/login', '/api/v1/auth/refresh', '/api/v1/billing/webhook']) {
      expect(run(withSession({ originalUrl: url })).passed, url).toBe(true);
    }
  });

  it('смотрит на путь без query — иначе исключение обходится через ?x=1', () => {
    expect(run(withSession({ originalUrl: '/api/v1/auth/login?next=/' })).passed).toBe(true);
    // и наоборот: защищённый путь с query остаётся защищённым
    expect(run(withSession({ originalUrl: '/api/v1/groups?page=2' })).passed).toBe(false);
  });
});
