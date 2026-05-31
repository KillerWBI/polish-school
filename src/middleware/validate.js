// Валидация входных данных через Zod-схему.
// Использование в роуте: router.post('/', auth, validate(createHomework), ctrl.create)
//
// source — какую часть запроса проверять: 'body' (по умолчанию), 'query' или 'params'.
// При ошибке → 400 с первым сообщением. При успехе → кладёт очищенные
// (обрезанные, приведённые к типам, без лишних полей) данные обратно в req[source].
const validate = (schema, source = 'body') => (req, res, next) => {
  const result = schema.safeParse(req[source]);
  if (!result.success) {
    const msg = result.error.issues[0]?.message || 'Ошибка валидации';
    return res.status(400).json({ error: msg });
  }
  req[source] = result.data;
  next();
};

module.exports = { validate };
