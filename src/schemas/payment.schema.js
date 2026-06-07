const { z } = require('zod');

// POST /payments/calculate — месяц в формате YYYY-MM и НЕ в будущем.
// .refine — кастомная проверка поверх формата (см. REVIEW.md §5.1).
const calculatePaymentSchema = z.object({
  month: z.string()
    .regex(/^\d{4}-\d{2}$/, 'month обязателен в формате YYYY-MM')
    .refine(m => m <= new Date().toISOString().slice(0, 7), 'Нельзя рассчитать оплату за будущий месяц'),
});

// PUT /payments/:id — отметка оплаты.
const updatePaymentSchema = z.object({
  paid: z.boolean().optional(),
});

// GET /payments — пагинация из query.
// z.coerce превращает строку из URL ("2") в число; .default подставляет, если параметра нет.
const paginationQuery = z.object({
  page:  z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

module.exports = { calculatePaymentSchema, updatePaymentSchema, paginationQuery };
