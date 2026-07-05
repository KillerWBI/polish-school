const { z } = require('zod');

// Email: сначала нормализация (trim + toLowerCase), ПОТОМ проверка формата через .pipe().
// Если наоборот (z.email().trim()) — формат проверяется до обрезки пробелов и " a@b.c " падает.
// Сетевые проверки (MX-записи, disposable-домены) остаются в контроллере — схема синхронна.
const emailField = z.string({ error: 'Email обязателен' })
  .trim()
  .toLowerCase()
  .pipe(z.email('Неверный формат email'));

// POST /auth/register и /auth/register-teacher — одна форма данных, роль задаёт контроллер.
const registerSchema = z.object({
  name:     z.string({ error: 'Имя обязательно' }).trim().min(1, 'Имя обязательно'),
  email:    emailField,
  password: z.string({ error: 'Пароль обязателен' }).min(6, 'Пароль минимум 6 символов'),
});

// POST /auth/login — формат не проверяем строго заранее? Проверяем: в БД только валидные email.
const loginSchema = z.object({
  email:    emailField,
  password: z.string({ error: 'Пароль обязателен' }).min(1, 'Пароль обязателен'),
});

// PUT /auth/password — текущий пароль без min (старые могли быть любыми), новый — min 6.
const changePasswordSchema = z.object({
  currentPassword: z.string({ error: 'currentPassword обязателен' }).min(1, 'currentPassword обязателен'),
  newPassword:     z.string({ error: 'newPassword обязателен' }).min(6, 'Новый пароль минимум 6 символов'),
});

// POST /auth/forgot-password — запрос ссылки на сброс (по email)
const forgotPasswordSchema = z.object({
  email: emailField,
});

// POST /auth/reset-password — задать новый пароль по токену из письма
const resetPasswordSchema = z.object({
  token:    z.string({ error: 'token обязателен' }).min(1, 'token обязателен'),
  password: z.string({ error: 'Пароль обязателен' }).min(6, 'Пароль минимум 6 символов'),
});

module.exports = { registerSchema, loginSchema, changePasswordSchema, forgotPasswordSchema, resetPasswordSchema };
