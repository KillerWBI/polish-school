const { z } = require('zod');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

// POST /my-lessons — создать запись о занятии
const createLog = z.object({
  teacherLabel:   z.string().trim().max(100).nullable().optional(),
  subject:        z.string().trim().min(1, 'Укажите предмет').max(100),
  date:           z.string().regex(DATE_RE, 'date: формат YYYY-MM-DD'),
  time:           z.string().regex(TIME_RE, 'time: формат HH:MM').nullable().optional(),
  durationMin:    z.coerce.number().int().min(0).max(1440).nullable().optional(),
  topic:          z.string().trim().max(200).nullable().optional(),
  notes:          z.string().trim().max(2000).nullable().optional(),
  pricePerLesson: z.coerce.number().min(0).optional(),
  isPaid:         z.boolean().optional(),
  type:           z.enum(['external', 'self_study']).optional(),
});

// PUT /my-lessons/:id — обновить
const updateLog = z.object({
  teacherLabel:   z.string().trim().max(100).nullable().optional(),
  subject:        z.string().trim().min(1).max(100).optional(),
  date:           z.string().regex(DATE_RE).optional(),
  time:           z.string().regex(TIME_RE).nullable().optional(),
  durationMin:    z.coerce.number().int().min(0).max(1440).nullable().optional(),
  topic:          z.string().trim().max(200).nullable().optional(),
  notes:          z.string().trim().max(2000).nullable().optional(),
  pricePerLesson: z.coerce.number().min(0).optional(),
  isPaid:         z.boolean().optional(),
  type:           z.enum(['external', 'self_study']).optional(),
});

module.exports = { createLog, updateLog };
