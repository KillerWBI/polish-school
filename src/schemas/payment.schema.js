const { z } = require('zod');

// POST /payments/record — учитель вносит оплату от ученика.
const recordPaymentSchema = z.object({
  studentId: z.string().uuid('Некорректный studentId'),
  amount:    z.number().positive('Сумма должна быть больше 0'),
  method:    z.enum(['cash', 'card', 'transfer', 'online']).optional(),
});

// POST /payments/student-pay — ученик сам подаёт оплату (со скриншотом) на проверку учителю.
const studentPaymentSchema = z.object({
  teacherId:     z.string().uuid('Некорректный teacherId'),
  amount:        z.coerce.number().positive('Сумма должна быть больше 0'),
  method:        z.enum(['cash', 'card', 'transfer', 'blik', 'paypal', 'revolut', 'other']).optional(),
  screenshotUrl: z.string().url('Некорректная ссылка на скриншот').nullish(),
});

module.exports = { recordPaymentSchema, studentPaymentSchema };
