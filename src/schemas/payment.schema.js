const { z } = require('zod');

// POST /payments/record — учитель вносит оплату от ученика.
const recordPaymentSchema = z.object({
  studentId: z.string().uuid('Некорректный studentId'),
  amount:    z.number().positive('Сумма должна быть больше 0'),
});

module.exports = { recordPaymentSchema };
