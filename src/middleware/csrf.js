const crypto = require('crypto');

/**
 * CSRF — double-submit token.
 *
 * Почему это вообще нужно: access-токен лежит ещё и в httpOnly-cookie с
 * `sameSite: 'none'` (кросс-доменный прод: фронт на одном домене, API на другом),
 * а `middleware/auth` отдаёт cookie приоритет над Bearer. Значит браузер приложит
 * cookie к запросу, инициированному чужим сайтом, — классический CSRF.
 *
 * Как защищаемся: при логине сервер кладёт случайный токен в cookie `csrf_token`
 * И возвращает его же в теле ответа. Фронт хранит значение у себя и шлёт в заголовке
 * `X-CSRF-Token`. Совпало с cookie — запрос свой. Чужой сайт cookie приложит, но
 * значения не знает (тело ответа ему недоступно из-за CORS) и заголовок не поставит.
 *
 * Почему токен идёт телом, а не читаемой cookie: домены фронта и API разные, поэтому
 * JS фронта физически не может прочитать cookie, выставленную доменом API.
 */

const CSRF_COOKIE = 'csrf_token';
const CSRF_HEADER = 'x-csrf-token';

const isProd = process.env.NODE_ENV === 'production';

const csrfCookieOpts = {
  httpOnly: true,                    // читает только сервер; фронт знает значение из тела ответа
  secure:   isProd,
  sameSite: isProd ? 'none' : 'lax',
  path:     '/',
  maxAge:   7 * 24 * 60 * 60 * 1000, // как у access-cookie
};

// Генерирует новый токен, кладёт в cookie и возвращает значение для тела ответа.
const issueCsrfToken = (res) => {
  const token = crypto.randomBytes(32).toString('hex');
  res.cookie(CSRF_COOKIE, token, csrfCookieOpts);
  return token;
};

const clearCsrfToken = (res) => {
  res.clearCookie(CSRF_COOKIE, { ...csrfCookieOpts, maxAge: undefined });
};

// Сравнение без утечки по времени; длины должны совпасть, иначе timingSafeEqual бросит.
const safeEqual = (a, b) => {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
};

// Публичные мутирующие эндпоинты: сессии ещё нет либо она подтверждается своим секретом
// (токен из письма, подпись Paddle). Требовать CSRF там нечего и незачем.
const EXEMPT = [
  '/api/v1/auth/login',
  '/api/v1/auth/register',
  '/api/v1/auth/register-teacher',
  '/api/v1/auth/refresh',          // подтверждается refresh-cookie; ответ атакующему не виден
  '/api/v1/auth/logout',
  '/api/v1/auth/forgot-password',
  '/api/v1/auth/reset-password',
  '/api/v1/support/ticket',        // публичная форма поддержки
  '/api/v1/billing/webhook',       // сервер-серверу, проверяется подписью Paddle
];

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const csrf = (req, res, next) => {
  if (SAFE_METHODS.has(req.method)) return next();
  // originalUrl, а не path: middleware смонтирован на '/api/v1' и path приходит уже без префикса
  const fullPath = req.originalUrl.split('?')[0].replace(/\/+$/, '') || '/';
  if (EXEMPT.includes(fullPath)) return next();

  // Нет access-cookie → аутентификация идёт только по Bearer-заголовку, который браузер
  // сам не подставит. Подделать такой запрос с чужого сайта нельзя — проверять нечего.
  const sessionCookie = req.cookies?.access_token;
  if (!sessionCookie) return next();

  const cookieToken = req.cookies?.[CSRF_COOKIE];
  // Сессия, выданная до появления CSRF (или до истечения старой access-cookie), токена
  // не получала. Не рвём такие сессии: cookie появится при следующем /auth/me или /refresh.
  if (!cookieToken) return next();

  const headerToken = req.headers[CSRF_HEADER];
  if (!headerToken || !safeEqual(cookieToken, headerToken)) {
    return res.status(403).json({ error: 'Неверный CSRF-токен', code: 'CSRF' });
  }

  next();
};

module.exports = { csrf, issueCsrfToken, clearCsrfToken, CSRF_COOKIE, CSRF_HEADER };
