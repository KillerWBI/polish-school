const { z } = require('zod');

// Дата в формате YYYY-MM-DD — как её хранит DATEONLY.
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Дата в формате ГГГГ-ММ-ДД');

// GET /invoices/preview?studentId=&from=&to=
const previewInvoice = z.object({
  studentId: z.uuid('Неверный studentId'),
  from: dateOnly,
  to:   dateOnly,
}).refine((v) => v.from <= v.to, { message: 'Начало периода позже конца', path: ['from'] });

// POST /invoices
const createInvoice = z.object({
  studentId: z.uuid('Неверный studentId'),
  from: dateOnly,
  to:   dateOnly,
  dueDate: dateOnly.nullable().optional(),
  note: z.string().trim().max(500).nullable().optional(),
}).refine((v) => v.from <= v.to, { message: 'Начало периода позже конца', path: ['from'] });

// PATCH /invoices/:id — только смена состояния; позиции и сумма неизменны,
// иначе счёт перестал бы быть снимком расчёта на момент выпуска.
const patchInvoice = z.object({
  status: z.enum(['paid', 'cancelled'], 'status должен быть paid или cancelled'),
});

module.exports = { previewInvoice, createInvoice, patchInvoice };
