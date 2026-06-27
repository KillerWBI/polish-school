const { z } = require('zod');

// GET /teachers/catalog — query-параметры каталога.
// coerce превращает строки из URL в числа; language/q — опциональный фильтр/поиск.
const catalogQuery = z.object({
  page:     z.coerce.number().int().min(1).default(1),
  limit:    z.coerce.number().int().min(1).max(100).default(20),
  language: z.string().trim().min(1).optional(),
  q:        z.string().trim().min(1).optional(),
});

module.exports = { catalogQuery };
